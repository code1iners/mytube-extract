import { type TrackedDownloadJobRecord } from '../../src/adapters/chrome/active-download-jobs-storage';
import { createNoopDownloadNotificationsAdapter } from '../../src/adapters/chrome/notifications';
import {
  LATEST_DOWNLOAD_JOB_STORAGE_KEY,
  RECENT_DOWNLOAD_JOBS_STORAGE_KEY,
} from '../../src/adapters/chrome/download-job-storage';
import { type DownloadJob } from '../../src/domain/download-job/download-job';
import {
  createDownloadJobManager,
  createTimeoutPollingScheduler,
} from '../../src/features/download-jobs/download-job-manager';
import { isDownloadJobSubmitRequest } from '../../src/features/download-jobs/download-job-message';
import { createDownloadJobSubmitHandler } from '../../src/features/download-jobs/download-job-submit-handler';
import { createMyTubeExtractClient } from '../../src/services/mytube-extract/mytube-extract-client';

/** Dev preview option storage key. */
const DEV_PREVIEW_STORAGE_KEY = 'mytube-extract-dev-preview-options';

/** Dev preview chrome API 설치 option. */
type InstallDevPreviewChromeApiOptions = {
  /** Chrome API를 설치할 target object. */
  target?: typeof globalThis;
  /** Preview URL query string. */
  locationSearch?: string;
  /** Preview local storage. */
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  /** 다운로드 URL open 함수. */
  openUrl?: (url: string) => void;
};

/** Dev preview에서 저장하는 option map. */
type DevPreviewStoredOptions = Record<string, unknown>;

/** chrome.storage.onChanged listener. */
type StorageChangeListener = (
  changes: Record<string, { newValue?: unknown; oldValue?: unknown }>,
  areaName: string,
) => void;

/** Chrome extension runtime API가 이미 있는지 확인한다. */
export function hasChromeExtensionRuntime(target: typeof globalThis = globalThis): boolean {
  /** Runtime에서 제공되는 Chrome API 후보. */
  const chromeApi = target.chrome;

  return Boolean(
      chromeApi?.runtime &&
      chromeApi.storage?.local &&
      chromeApi.downloads &&
      chromeApi.tabs,
  );
}

/** localhost preview에서 popup이 동작하도록 fake Chrome API를 설치한다. */
export function installDevPreviewChromeApi(options: InstallDevPreviewChromeApiOptions = {}): boolean {
  /** Chrome API를 설치할 target object. */
  const target = options.target ?? globalThis;

  if (hasChromeExtensionRuntime(target)) {
    return false;
  }

  /** Preview option storage. */
  const storage = options.storage ?? target.localStorage;
  /** Preview download URL opener. */
  const openUrl =
    options.openUrl ??
    ((url: string) => {
      target.open(url, '_blank');
    });
  /** Preview 저장 option. */
  const storedOptions = readStoredOptions(storage);

  target.chrome = createDevPreviewChromeApi({
    openUrl,
    storage,
    storedOptions,
  });

  return true;
}

/** Dev preview용 fake Chrome API를 만든다. */
function createDevPreviewChromeApi({
  openUrl,
  storage,
  storedOptions,
}: {
  /** 다운로드 URL open 함수. */
  openUrl: (url: string) => void;
  /** Preview option storage. */
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  /** Preview 저장 option. */
  storedOptions: DevPreviewStoredOptions;
}): typeof chrome {
  /** 현재 preview option. */
  let currentOptions: DevPreviewStoredOptions = {
    ...storedOptions,
  };
  /** Preview에서 시뮬레이션할 YouTube permission 상태. */
  let youtubePermissionGranted = false;
  /** 등록된 storage.onChanged listener 목록. */
  const storageChangeListeners = new Set<StorageChangeListener>();

  /** preview storage에 값을 쓰고, localStorage에 반영한 뒤 onChanged listener에게 알린다. */
  function setStorageItems(items: DevPreviewStoredOptions): void {
    currentOptions = {
      ...currentOptions,
      ...items,
    };
    storage.setItem(DEV_PREVIEW_STORAGE_KEY, JSON.stringify(currentOptions));

    /** 이번 변경으로 생긴 storage.onChanged 변경 내역. */
    const changes = Object.fromEntries(
      Object.entries(items).map(([key, value]) => [key, { newValue: value }]),
    );

    storageChangeListeners.forEach((listener) => listener(changes, 'local'));
  }

  /** Preview용 MyTube Extract API client. 실제 fetch로 real API를 호출한다. */
  const myTubeExtractClient = createMyTubeExtractClient();
  /** Preview는 페이지를 새로고침하면 상태가 사라지므로, 진행 중 job도 메모리에만 임시로 담아둔다. */
  const activeJobRecordsById = new Map<string, TrackedDownloadJobRecord>();
  /** Preview용 download job manager. Popup의 job 제출·폴링·자동 다운로드를 Background 없이 흉내 낸다. */
  const downloadJobManager = createDownloadJobManager({
    activeJobsStore: {
      loadActiveJobs: () => Promise.resolve([...activeJobRecordsById.values()]),
      removeActiveJob: (jobId) => {
        activeJobRecordsById.delete(jobId);
        return Promise.resolve();
      },
      saveActiveJob: (record) => {
        activeJobRecordsById.set(record.job.jobId, record);
        return Promise.resolve();
      },
    },
    downloads: {
      startDownload(downloadUrl, filename) {
        openUrl(downloadUrl);

        return Promise.resolve(1);
      },
    },
    myTubeExtractClient,
    notifications: createNoopDownloadNotificationsAdapter(),
    recentJobsStore: {
      loadJobs: () => {
        const storedJobs = currentOptions[RECENT_DOWNLOAD_JOBS_STORAGE_KEY];

        if (Array.isArray(storedJobs)) {
          return Promise.resolve(storedJobs as DownloadJob[]);
        }

        const legacyJob = currentOptions[LATEST_DOWNLOAD_JOB_STORAGE_KEY] as
          | DownloadJob
          | undefined;

        return Promise.resolve(legacyJob ? [legacyJob] : []);
      },
      saveJobs: (jobs) => {
        setStorageItems({
          [LATEST_DOWNLOAD_JOB_STORAGE_KEY]: jobs[0],
          [RECENT_DOWNLOAD_JOBS_STORAGE_KEY]: jobs,
        });
        return Promise.resolve();
      },
    },
    scheduler: createTimeoutPollingScheduler(),
  });
  /** Preview용 job 제출 요청 handler. Background의 message handler와 동일하게 동작한다. */
  const handleDownloadJobSubmit = createDownloadJobSubmitHandler({
    jobManager: downloadJobManager,
    myTubeExtractClient,
  });

  /** Popup이 사용하는 Chrome API subset. */
  const chromeApi = {
    runtime: {
      lastError: null,
      sendMessage(message: unknown, callback: (response: unknown) => void) {
        if (isDownloadJobSubmitRequest(message)) {
          void handleDownloadJobSubmit(message).then(callback);
          return;
        }

        callback({ ok: true });
      },
    },
    storage: {
      local: {
        get(keys: unknown, callback: (items: DevPreviewStoredOptions) => void) {
          /** Chrome storage get 결과. */
          const result: DevPreviewStoredOptions = {};

          if (Array.isArray(keys)) {
            keys.forEach((key) => {
              if (typeof key === 'string' && currentOptions[key] !== undefined) {
                result[key] = currentOptions[key];
              }
            });
          } else {
            Object.assign(result, currentOptions);
          }

          callback(result);
        },
        set(items: DevPreviewStoredOptions, callback?: () => void) {
          setStorageItems(items);
          callback?.();
        },
      },
      onChanged: {
        addListener(listener: StorageChangeListener) {
          storageChangeListeners.add(listener);
        },
        removeListener(listener: StorageChangeListener) {
          storageChangeListeners.delete(listener);
        },
      },
    },
    downloads: {
      download(downloadOptions: { url: string }, callback?: (downloadId?: number) => void) {
        openUrl(downloadOptions.url);
        callback?.(1);
      },
    },
    tabs: {
      query(_queryInfo: chrome.tabs.QueryInfo, callback: (tabs: chrome.tabs.Tab[]) => void) {
        callback([
          {
            active: true,
            id: 1,
            url: 'https://www.youtube.com/watch?v=abc123_DEF0',
          } as chrome.tabs.Tab,
        ]);
      },
    },
    permissions: {
      contains(
        _permissions: chrome.permissions.Permissions,
        callback: (granted: boolean) => void,
      ) {
        callback(youtubePermissionGranted);
      },
      request(
        _permissions: chrome.permissions.Permissions,
        callback: (granted: boolean) => void,
      ) {
        youtubePermissionGranted = true;
        callback(true);
      },
    },
  };

  return chromeApi as unknown as typeof chrome;
}

/** Dev preview 저장 option을 읽는다. */
function readStoredOptions(storage: Pick<Storage, 'getItem'> | undefined): DevPreviewStoredOptions {
  if (!storage) {
    return {};
  }

  try {
    /** 저장된 preview option JSON. */
    const storedValue = storage.getItem(DEV_PREVIEW_STORAGE_KEY);

    if (!storedValue) {
      return {};
    }

    /** 파싱한 preview option. */
    const parsedValue = JSON.parse(storedValue);

    return typeof parsedValue === 'object' && parsedValue !== null ? parsedValue : {};
  } catch {
    return {};
  }
}
