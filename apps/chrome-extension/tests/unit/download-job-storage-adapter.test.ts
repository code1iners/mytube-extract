import { describe, expect, it, vi } from 'vitest';
import { type DownloadJob } from '../../src/domain/download-job/download-job';
import {
  LATEST_DOWNLOAD_JOB_STORAGE_KEY,
  createDownloadJobStorageAdapter,
} from '../../src/adapters/chrome/download-job-storage';

/** 테스트용 job 상태를 만든다. */
function createJob(overrides: Partial<DownloadJob> = {}): DownloadJob {
  return {
    createdAt: '2026-06-24T05:32:00.000Z',
    displayStatus: 'queued',
    downloadUrl: null,
    errorCode: null,
    jobId: 'job-1',
    message: '요청이 접수되어 대기 중입니다.',
    progress: 0,
    quality: '192',
    retentionDays: 7,
    status: 'queued',
    type: 'audio',
    ...overrides,
  };
}

describe('download job storage adapter', () => {
  it('resolves null when no job has been saved yet', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({ lastError: null, storedItems: {} });
    /** job storage adapter. */
    const adapter = createDownloadJobStorageAdapter(chromeApi);

    await expect(adapter.loadLatestJob()).resolves.toBeNull();
    expect(chromeApi.storage.local.get).toHaveBeenCalledWith(
      [LATEST_DOWNLOAD_JOB_STORAGE_KEY],
      expect.any(Function),
    );
  });

  it('loads the previously saved job', async () => {
    /** 저장된 job. */
    const job = createJob({ status: 'processing' });
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({
      lastError: null,
      storedItems: { [LATEST_DOWNLOAD_JOB_STORAGE_KEY]: job },
    });
    /** job storage adapter. */
    const adapter = createDownloadJobStorageAdapter(chromeApi);

    await expect(adapter.loadLatestJob()).resolves.toEqual(job);
  });

  it('rejects loadLatestJob when chrome.runtime.lastError is set', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({
      lastError: { message: 'blocked' },
      storedItems: {},
    });
    /** job storage adapter. */
    const adapter = createDownloadJobStorageAdapter(chromeApi);

    await expect(adapter.loadLatestJob()).rejects.toThrow(
      'Could not load the latest download job.',
    );
  });

  it('saves the latest job under the dedicated storage key', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({ lastError: null, storedItems: {} });
    /** job storage adapter. */
    const adapter = createDownloadJobStorageAdapter(chromeApi);
    /** 저장할 job. */
    const job = createJob();

    await adapter.saveLatestJob(job);

    expect(chromeApi.storage.local.set).toHaveBeenCalledWith(
      { [LATEST_DOWNLOAD_JOB_STORAGE_KEY]: job },
      expect.any(Function),
    );
  });

  it('rejects saveLatestJob when chrome.runtime.lastError is set', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({
      lastError: { message: 'blocked' },
      storedItems: {},
    });
    /** job storage adapter. */
    const adapter = createDownloadJobStorageAdapter(chromeApi);

    await expect(adapter.saveLatestJob(createJob())).rejects.toThrow(
      'Could not save the latest download job.',
    );
  });

  it('notifies subscribers only for changes to the latest job key in local storage', () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({ lastError: null, storedItems: {} });
    /** job storage adapter. */
    const adapter = createDownloadJobStorageAdapter(chromeApi);
    /** 구독 listener. */
    const listener = vi.fn();

    adapter.subscribeLatestJob(listener);

    /** 다른 key 변경 — listener를 호출하면 안 된다. */
    chromeApi.storage.onChanged.__fire({ someOtherKey: { newValue: 'x' } }, 'local');
    expect(listener).not.toHaveBeenCalled();

    /** sync 영역 변경 — listener를 호출하면 안 된다. */
    chromeApi.storage.onChanged.__fire(
      { [LATEST_DOWNLOAD_JOB_STORAGE_KEY]: { newValue: createJob() } },
      'sync',
    );
    expect(listener).not.toHaveBeenCalled();

    /** 최근 job 변경. */
    const updatedJob = createJob({ status: 'completed' });

    chromeApi.storage.onChanged.__fire(
      { [LATEST_DOWNLOAD_JOB_STORAGE_KEY]: { newValue: updatedJob } },
      'local',
    );
    expect(listener).toHaveBeenCalledWith(updatedJob);
  });

  it('stops notifying after unsubscribe', () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({ lastError: null, storedItems: {} });
    /** job storage adapter. */
    const adapter = createDownloadJobStorageAdapter(chromeApi);
    /** 구독 listener. */
    const listener = vi.fn();
    /** 구독 해제 함수. */
    const unsubscribe = adapter.subscribeLatestJob(listener);

    unsubscribe();
    chromeApi.storage.onChanged.__fire(
      { [LATEST_DOWNLOAD_JOB_STORAGE_KEY]: { newValue: createJob() } },
      'local',
    );

    expect(listener).not.toHaveBeenCalled();
  });
});

/** 테스트용 Chrome API를 만든다. */
function createChromeApi({
  lastError,
  storedItems,
}: {
  /** chrome.runtime.lastError 값. */
  lastError: { message: string } | null;
  /** chrome.storage.local.get가 반환할 저장 값. */
  storedItems: Record<string, unknown>;
}) {
  /** 등록된 storage.onChanged listener 목록. */
  const changeListeners = new Set<
    (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void
  >();

  return {
    runtime: { lastError },
    storage: {
      local: {
        get: vi.fn(
          (
            _keys: readonly string[],
            callback: (items: Record<string, unknown>) => void,
          ) => callback(storedItems),
        ),
        set: vi.fn((_items: Record<string, unknown>, callback: () => void) => callback()),
      },
      onChanged: {
        addListener: vi.fn((listener) => {
          changeListeners.add(listener);
        }),
        removeListener: vi.fn((listener) => {
          changeListeners.delete(listener);
        }),
        __fire(changes: Record<string, chrome.storage.StorageChange>, areaName: string) {
          changeListeners.forEach((listener) => listener(changes, areaName));
        },
      },
    },
  } as unknown as typeof chrome & {
    storage: { onChanged: { __fire: (changes: unknown, areaName: string) => void } };
  };
}
