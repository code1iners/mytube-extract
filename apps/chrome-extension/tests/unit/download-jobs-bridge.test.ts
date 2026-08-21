import { describe, expect, it, vi } from 'vitest';
import { type DownloadJob } from '../../src/domain/download-job/download-job';
import { createDownloadJobsBridge } from '../../src/adapters/chrome/download-jobs-bridge';
import { DOWNLOAD_JOB_SUBMIT_MESSAGE_TYPE } from '../../src/features/download-jobs/download-job-message';

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

describe('download jobs bridge', () => {
  it('submits a job through runtime messaging and resolves with the created job', async () => {
    /** 생성된 job. */
    const job = createJob();
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({ sendMessageResponse: { job, ok: true } });
    /** download jobs bridge. */
    const bridge = createDownloadJobsBridge(chromeApi, createStorage());

    await expect(
      bridge.submitJob({
        apiBaseUrl: 'http://127.0.0.1:3030',
        localFilename: 'my clip',
        mode: 'audio',
        quality: '192',
        sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
      }),
    ).resolves.toEqual(job);

    expect(chromeApi.runtime.sendMessage).toHaveBeenCalledWith(
      {
        apiBaseUrl: 'http://127.0.0.1:3030',
        localFilename: 'my clip',
        mode: 'audio',
        quality: '192',
        sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
        type: DOWNLOAD_JOB_SUBMIT_MESSAGE_TYPE,
      },
      expect.any(Function),
    );
  });

  it('rejects submitJob with the background failure message', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({
      sendMessageResponse: { message: 'Server is unavailable.', ok: false },
    });
    /** download jobs bridge. */
    const bridge = createDownloadJobsBridge(chromeApi, createStorage());

    await expect(
      bridge.submitJob({
        apiBaseUrl: 'http://127.0.0.1:3030',
        localFilename: '',
        mode: 'audio',
        quality: '192',
        sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
      }),
    ).rejects.toThrow('Server is unavailable.');
  });

  it('rejects submitJob when chrome.runtime.lastError is set', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({
      lastError: { message: 'blocked' },
      sendMessageResponse: { job: createJob(), ok: true },
    });
    /** download jobs bridge. */
    const bridge = createDownloadJobsBridge(chromeApi, createStorage());

    await expect(
      bridge.submitJob({
        apiBaseUrl: 'http://127.0.0.1:3030',
        localFilename: '',
        mode: 'audio',
        quality: '192',
        sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
      }),
    ).rejects.toThrow('Could not reach the extension background.');
  });

  it('reads the latest job from the storage adapter', async () => {
    /** 저장된 job. */
    const job = createJob({ status: 'processing' });
    /** 테스트용 storage adapter. */
    const storage = createStorage({ latestJob: job });
    /** download jobs bridge. */
    const bridge = createDownloadJobsBridge(createChromeApi({}), storage);

    await expect(bridge.getLatestJob()).resolves.toEqual(job);
  });

  it('delegates subscribeLatestJob to the storage adapter', () => {
    /** 테스트용 storage adapter. */
    const storage = createStorage();
    /** download jobs bridge. */
    const bridge = createDownloadJobsBridge(createChromeApi({}), storage);
    /** 구독 listener. */
    const listener = vi.fn();

    bridge.subscribeLatestJob(listener);

    expect(storage.subscribeLatestJob).toHaveBeenCalledWith(listener);
  });
});

/** 테스트용 Chrome API를 만든다. */
function createChromeApi({
  lastError = null,
  sendMessageResponse = { job: createJob(), ok: true },
}: {
  /** chrome.runtime.lastError 값. */
  lastError?: { message: string } | null;
  /** background sendMessage 응답. */
  sendMessageResponse?: unknown;
}) {
  return {
    runtime: {
      lastError,
      sendMessage: vi.fn((_message: unknown, callback: (response: unknown) => void) =>
        callback(sendMessageResponse),
      ),
    },
  } as unknown as typeof chrome;
}

/** 테스트용 download job storage adapter를 만든다. */
function createStorage({ latestJob = null }: { latestJob?: DownloadJob | null } = {}) {
  return {
    loadLatestJob: vi.fn().mockResolvedValue(latestJob),
    saveLatestJob: vi.fn().mockResolvedValue(undefined),
    subscribeLatestJob: vi.fn().mockReturnValue(() => {}),
  };
}
