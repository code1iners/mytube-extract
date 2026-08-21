import { type DownloadJob } from '../../domain/download-job/download-job';

/** 최근 다운로드 job을 저장하는 chrome.storage.local key. */
export const LATEST_DOWNLOAD_JOB_STORAGE_KEY = 'latestDownloadJob';

/** 최근 다운로드 job 영속 저장 adapter. Popup이 닫혀 있어도 Background가 기록한 최신 상태를 읽고 구독할 수 있게 한다. */
export type DownloadJobStorageAdapter = {
  /** 저장된 최근 job을 읽는다. 저장된 값이 없으면 null을 반환한다. */
  loadLatestJob(): Promise<DownloadJob | null>;
  /** 최근 job을 저장한다. */
  saveLatestJob(job: DownloadJob): Promise<void>;
  /** 저장된 최근 job이 바뀔 때마다 호출된다. */
  subscribeLatestJob(listener: (job: DownloadJob) => void): () => void;
};

/** Chrome download job storage adapter를 만든다. */
export function createDownloadJobStorageAdapter(
  chromeApi: typeof chrome = chrome,
): DownloadJobStorageAdapter {
  return {
    loadLatestJob() {
      return new Promise((resolve, reject) => {
        chromeApi.storage.local.get([LATEST_DOWNLOAD_JOB_STORAGE_KEY], (items) => {
          if (chromeApi.runtime.lastError) {
            reject(new Error('Could not load the latest download job.'));
            return;
          }

          /** 저장된 최근 job. */
          const storedJob = items[LATEST_DOWNLOAD_JOB_STORAGE_KEY] as DownloadJob | undefined;

          resolve(storedJob ?? null);
        });
      });
    },
    saveLatestJob(job) {
      return new Promise((resolve, reject) => {
        chromeApi.storage.local.set({ [LATEST_DOWNLOAD_JOB_STORAGE_KEY]: job }, () => {
          if (chromeApi.runtime.lastError) {
            reject(new Error('Could not save the latest download job.'));
            return;
          }

          resolve();
        });
      });
    },
    subscribeLatestJob(listener) {
      /** chrome.storage.onChanged listener. */
      function handleStorageChange(
        changes: Record<string, chrome.storage.StorageChange>,
        areaName: string,
      ) {
        if (areaName !== 'local') {
          return;
        }

        /** 최근 job storage key 변경 내역. */
        const change = changes[LATEST_DOWNLOAD_JOB_STORAGE_KEY];

        if (!change) {
          return;
        }

        listener(change.newValue as DownloadJob);
      }

      chromeApi.storage.onChanged.addListener(handleStorageChange);

      return function unsubscribeDownloadJobStorage() {
        chromeApi.storage.onChanged.removeListener(handleStorageChange);
      };
    },
  };
}
