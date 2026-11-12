import { describe, expect, it, vi } from 'vitest';
import { type DownloadJob } from '../../src/domain/download-job/download-job';
import {
  LATEST_DOWNLOAD_JOB_STORAGE_KEY,
  RECENT_DOWNLOAD_JOBS_STORAGE_KEY,
  createDownloadJobStorageAdapter,
} from '../../src/adapters/chrome/download-job-storage';

/** 원본 주소·제목 필드가 생기기 전 버전이 저장한 job 모양을 만든다. */
function createLegacyStoredJob(overrides: Partial<DownloadJob> = {}): Record<string, unknown> {
  /** 현재 job에서 두 필드를 뺀 예전 저장 값. */
  const { sourceUrl: _sourceUrl, title: _title, ...legacyJob } = createJob(overrides);

  return legacyJob;
}

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
    sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
    status: 'queued',
    title: '테스트 영상 제목',
    type: 'audio',
    ...overrides,
  };
}

describe('download job storage adapter', () => {
  it('loads the recent jobs list and preserves its newest-first order', async () => {
    /** 저장된 최근 job 목록. */
    const jobs = [
      createJob({ jobId: 'job-2', status: 'processing' }),
      createJob({ jobId: 'job-1', status: 'completed' }),
    ];
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({
      lastError: null,
      storedItems: { [RECENT_DOWNLOAD_JOBS_STORAGE_KEY]: jobs },
    });
    /** job storage adapter. */
    const adapter = createDownloadJobStorageAdapter(chromeApi);

    await expect(adapter.loadJobs()).resolves.toEqual(jobs);
    expect(chromeApi.storage.local.get).toHaveBeenCalledWith(
      [RECENT_DOWNLOAD_JOBS_STORAGE_KEY, LATEST_DOWNLOAD_JOB_STORAGE_KEY],
      expect.any(Function),
    );
  });

  it('migrates the legacy latest job into a one-item recent jobs list', async () => {
    /** 기존 단일 job. */
    const job = createJob({ status: 'processing' });
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({
      lastError: null,
      storedItems: { [LATEST_DOWNLOAD_JOB_STORAGE_KEY]: job },
    });
    /** job storage adapter. */
    const adapter = createDownloadJobStorageAdapter(chromeApi);

    await expect(adapter.loadJobs()).resolves.toEqual([job]);
  });

  it('saves the complete recent jobs list under its dedicated storage key', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({ lastError: null, storedItems: {} });
    /** job storage adapter. */
    const adapter = createDownloadJobStorageAdapter(chromeApi);
    /** 저장할 최근 job 목록. */
    const jobs = [createJob(), createJob({ jobId: 'job-2', status: 'completed' })];

    await adapter.saveJobs(jobs);

    expect(chromeApi.storage.local.set).toHaveBeenCalledWith(
      { [RECENT_DOWNLOAD_JOBS_STORAGE_KEY]: jobs },
      expect.any(Function),
    );
  });

  it('notifies recent jobs subscribers only for local recent-list changes', () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({ lastError: null, storedItems: {} });
    /** job storage adapter. */
    const adapter = createDownloadJobStorageAdapter(chromeApi);
    /** 구독 listener. */
    const listener = vi.fn();
    /** 변경된 job 목록. */
    const jobs = [createJob({ status: 'completed' })];

    adapter.subscribeJobs(listener);

    chromeApi.storage.onChanged.__fire(
      { [RECENT_DOWNLOAD_JOBS_STORAGE_KEY]: { newValue: jobs } },
      'sync',
    );
    expect(listener).not.toHaveBeenCalled();

    chromeApi.storage.onChanged.__fire(
      { [RECENT_DOWNLOAD_JOBS_STORAGE_KEY]: { newValue: jobs } },
      'local',
    );
    expect(listener).toHaveBeenCalledWith(jobs);
  });

  it('saves and restores the source URL and requested video title of each job', async () => {
    /** 원본 주소와 제목을 가진 job 목록. 제목이 없는 job도 포함한다. */
    const jobs = [
      createJob({ jobId: 'job-2', title: null }),
      createJob({ jobId: 'job-1', sourceUrl: 'https://www.youtube.com/watch?v=zyx987_WVU6' }),
    ];
    /** 저장 후 다시 읽을 storage 값. */
    const storedItems: Record<string, unknown> = {};
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({ lastError: null, storedItems });
    /** job storage adapter. */
    const adapter = createDownloadJobStorageAdapter(chromeApi);

    await adapter.saveJobs(jobs);
    Object.assign(storedItems, vi.mocked(chromeApi.storage.local.set).mock.calls[0]?.[0]);

    /** 다시 읽은 job 목록. */
    const restoredJobs = await adapter.loadJobs();

    expect(restoredJobs.map((job) => [job.sourceUrl, job.title])).toEqual([
      ['https://www.youtube.com/watch?v=abc123_DEF0', null],
      ['https://www.youtube.com/watch?v=zyx987_WVU6', '테스트 영상 제목'],
    ]);
  });

  it('restores previously stored jobs without source URL and title as empty values', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({
      lastError: null,
      storedItems: {
        [RECENT_DOWNLOAD_JOBS_STORAGE_KEY]: [createLegacyStoredJob({ status: 'completed' })],
      },
    });
    /** job storage adapter. */
    const adapter = createDownloadJobStorageAdapter(chromeApi);

    await expect(adapter.loadJobs()).resolves.toEqual([
      createJob({ sourceUrl: null, status: 'completed', title: null }),
    ]);
  });

  it('restores a legacy latest job without source URL and title as empty values', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({
      lastError: null,
      storedItems: { [LATEST_DOWNLOAD_JOB_STORAGE_KEY]: createLegacyStoredJob() },
    });
    /** job storage adapter. */
    const adapter = createDownloadJobStorageAdapter(chromeApi);
    /** 기대하는 복원 job. */
    const expectedJob = createJob({ sourceUrl: null, title: null });

    await expect(adapter.loadJobs()).resolves.toEqual([expectedJob]);
    await expect(adapter.loadLatestJob()).resolves.toEqual(expectedJob);
  });

  it('delivers changed jobs without source URL and title as empty values to subscribers', () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({ lastError: null, storedItems: {} });
    /** job storage adapter. */
    const adapter = createDownloadJobStorageAdapter(chromeApi);
    /** 목록 구독 listener. */
    const jobsListener = vi.fn();
    /** 단일 latest job 구독 listener. */
    const latestListener = vi.fn();
    /** 기대하는 복원 job. */
    const expectedJob = createJob({ sourceUrl: null, title: null });

    adapter.subscribeJobs(jobsListener);
    adapter.subscribeLatestJob(latestListener);
    chromeApi.storage.onChanged.__fire(
      { [RECENT_DOWNLOAD_JOBS_STORAGE_KEY]: { newValue: [createLegacyStoredJob()] } },
      'local',
    );
    chromeApi.storage.onChanged.__fire(
      { [LATEST_DOWNLOAD_JOB_STORAGE_KEY]: { newValue: createLegacyStoredJob() } },
      'local',
    );

    expect(jobsListener).toHaveBeenNthCalledWith(1, [expectedJob]);
    expect(jobsListener).toHaveBeenNthCalledWith(2, [expectedJob]);
    expect(latestListener).toHaveBeenCalledWith(expectedJob);
  });

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
