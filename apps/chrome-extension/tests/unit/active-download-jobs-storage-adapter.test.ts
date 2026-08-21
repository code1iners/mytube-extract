import { describe, expect, it, vi } from 'vitest';
import { type DownloadJob } from '../../src/domain/download-job/download-job';
import {
  ACTIVE_DOWNLOAD_JOBS_STORAGE_KEY,
  createActiveDownloadJobsStorageAdapter,
  type TrackedDownloadJobRecord,
} from '../../src/adapters/chrome/active-download-jobs-storage';

/** 테스트용 job 상태를 만든다. */
function createJob(overrides: Partial<DownloadJob> = {}): DownloadJob {
  return {
    createdAt: '2026-06-24T05:32:00.000Z',
    displayStatus: 'processing',
    downloadUrl: null,
    errorCode: null,
    jobId: 'job-1',
    message: '처리 중입니다.',
    progress: 50,
    quality: '192',
    retentionDays: 7,
    status: 'processing',
    type: 'audio',
    ...overrides,
  };
}

/** 테스트용 추적 기록을 만든다. */
function createRecord(overrides: Partial<TrackedDownloadJobRecord> = {}): TrackedDownloadJobRecord {
  return {
    apiBaseUrl: 'http://127.0.0.1:3030',
    job: createJob(),
    localFilename: 'my clip.mp3',
    ...overrides,
  };
}

describe('active download jobs storage adapter', () => {
  it('resolves an empty list when nothing has been saved yet', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({ storedItems: {} });
    /** active jobs storage adapter. */
    const adapter = createActiveDownloadJobsStorageAdapter(chromeApi);

    await expect(adapter.loadActiveJobs()).resolves.toEqual([]);
    expect(chromeApi.storage.local.get).toHaveBeenCalledWith(
      [ACTIVE_DOWNLOAD_JOBS_STORAGE_KEY],
      expect.any(Function),
    );
  });

  it('saves a record under its jobId and loads it back', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({ storedItems: {} });
    /** active jobs storage adapter. */
    const adapter = createActiveDownloadJobsStorageAdapter(chromeApi);
    /** 저장할 추적 기록. */
    const record = createRecord();

    await adapter.saveActiveJob(record);

    expect(chromeApi.storage.local.set).toHaveBeenCalledWith(
      { [ACTIVE_DOWNLOAD_JOBS_STORAGE_KEY]: { [record.job.jobId]: record } },
      expect.any(Function),
    );
  });

  it('merges a new record with previously saved records instead of overwriting them', async () => {
    /** 이미 저장돼 있던 기록. */
    const existingRecord = createRecord({ job: createJob({ jobId: 'job-a' }) });
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({
      storedItems: { [ACTIVE_DOWNLOAD_JOBS_STORAGE_KEY]: { 'job-a': existingRecord } },
    });
    /** active jobs storage adapter. */
    const adapter = createActiveDownloadJobsStorageAdapter(chromeApi);
    /** 새로 저장할 기록. */
    const newRecord = createRecord({ job: createJob({ jobId: 'job-b' }) });

    await adapter.saveActiveJob(newRecord);

    expect(chromeApi.storage.local.set).toHaveBeenCalledWith(
      {
        [ACTIVE_DOWNLOAD_JOBS_STORAGE_KEY]: {
          'job-a': existingRecord,
          'job-b': newRecord,
        },
      },
      expect.any(Function),
    );
  });

  it('loads previously saved records as a list', async () => {
    /** 저장된 기록들. */
    const recordA = createRecord({ job: createJob({ jobId: 'job-a' }) });
    const recordB = createRecord({ job: createJob({ jobId: 'job-b' }) });
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({
      storedItems: {
        [ACTIVE_DOWNLOAD_JOBS_STORAGE_KEY]: { 'job-a': recordA, 'job-b': recordB },
      },
    });
    /** active jobs storage adapter. */
    const adapter = createActiveDownloadJobsStorageAdapter(chromeApi);

    await expect(adapter.loadActiveJobs()).resolves.toEqual(
      expect.arrayContaining([recordA, recordB]),
    );
  });

  it('removes a record by jobId while keeping the others', async () => {
    /** 저장된 기록들. */
    const recordA = createRecord({ job: createJob({ jobId: 'job-a' }) });
    const recordB = createRecord({ job: createJob({ jobId: 'job-b' }) });
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({
      storedItems: {
        [ACTIVE_DOWNLOAD_JOBS_STORAGE_KEY]: { 'job-a': recordA, 'job-b': recordB },
      },
    });
    /** active jobs storage adapter. */
    const adapter = createActiveDownloadJobsStorageAdapter(chromeApi);

    await adapter.removeActiveJob('job-a');

    expect(chromeApi.storage.local.set).toHaveBeenCalledWith(
      { [ACTIVE_DOWNLOAD_JOBS_STORAGE_KEY]: { 'job-b': recordB } },
      expect.any(Function),
    );
  });

  it('does nothing when removing a jobId that was never saved', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({
      storedItems: { [ACTIVE_DOWNLOAD_JOBS_STORAGE_KEY]: {} },
    });
    /** active jobs storage adapter. */
    const adapter = createActiveDownloadJobsStorageAdapter(chromeApi);

    await adapter.removeActiveJob('missing-job');

    expect(chromeApi.storage.local.set).toHaveBeenCalledWith(
      { [ACTIVE_DOWNLOAD_JOBS_STORAGE_KEY]: {} },
      expect.any(Function),
    );
  });

  it('rejects loadActiveJobs when chrome.runtime.lastError is set', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({ lastError: { message: 'blocked' }, storedItems: {} });
    /** active jobs storage adapter. */
    const adapter = createActiveDownloadJobsStorageAdapter(chromeApi);

    await expect(adapter.loadActiveJobs()).rejects.toThrow(
      'Could not load the tracked download jobs.',
    );
  });

  it('rejects saveActiveJob when chrome.runtime.lastError is set', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({ lastError: { message: 'blocked' }, storedItems: {} });
    /** active jobs storage adapter. */
    const adapter = createActiveDownloadJobsStorageAdapter(chromeApi);

    // 기존 기록을 먼저 읽어 병합하는 구현이라, get 단계에서 lastError를 만나 load 오류로 거절된다.
    await expect(adapter.saveActiveJob(createRecord())).rejects.toThrow(
      'Could not load the tracked download jobs.',
    );
  });

  it('rejects saveActiveJob when the write itself fails', async () => {
    /** get은 성공하고 set에서만 lastError가 발생하는, 아직 타입을 씌우지 않은 테스트용 Chrome API. */
    const rawChromeApi = {
      runtime: { lastError: null as { message: string } | null },
      storage: {
        local: {
          get: vi.fn((_keys: readonly string[], callback: (items: Record<string, unknown>) => void) =>
            callback({}),
          ),
          set: vi.fn((_items: Record<string, unknown>, callback: () => void) => {
            rawChromeApi.runtime.lastError = { message: 'blocked' };
            callback();
          }),
        },
      },
    };
    /** active jobs storage adapter. */
    const adapter = createActiveDownloadJobsStorageAdapter(rawChromeApi as unknown as typeof chrome);

    await expect(adapter.saveActiveJob(createRecord())).rejects.toThrow(
      'Could not save the tracked download job.',
    );
  });
});

/** 테스트용 Chrome API를 만든다. */
function createChromeApi({
  lastError = null,
  storedItems,
}: {
  /** chrome.runtime.lastError 값. */
  lastError?: { message: string } | null;
  /** chrome.storage.local.get가 반환할 저장 값. */
  storedItems: Record<string, unknown>;
}) {
  /** get이 호출될 때마다 최신 값을 돌려줄 수 있도록 참조를 보관한다. */
  let currentStoredItems = storedItems;

  return {
    runtime: { lastError },
    storage: {
      local: {
        get: vi.fn(
          (
            _keys: readonly string[],
            callback: (items: Record<string, unknown>) => void,
          ) => callback(currentStoredItems),
        ),
        set: vi.fn((items: Record<string, unknown>, callback: () => void) => {
          currentStoredItems = { ...currentStoredItems, ...items };
          callback();
        }),
      },
    },
  } as unknown as typeof chrome;
}
