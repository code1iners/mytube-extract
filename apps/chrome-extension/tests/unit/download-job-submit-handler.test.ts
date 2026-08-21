import { describe, expect, it, vi } from 'vitest';
import { type DownloadJob } from '../../src/domain/download-job/download-job';
import { DOWNLOAD_JOB_SUBMIT_MESSAGE_TYPE, type DownloadJobSubmitRequest } from '../../src/features/download-jobs/download-job-message';
import {
  type DownloadJobSubmitHandlerDependencies,
  createDownloadJobSubmitHandler,
} from '../../src/features/download-jobs/download-job-submit-handler';

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

/** 테스트용 job 제출 요청을 만든다. */
function createRequest(overrides: Partial<DownloadJobSubmitRequest> = {}): DownloadJobSubmitRequest {
  return {
    type: DOWNLOAD_JOB_SUBMIT_MESSAGE_TYPE,
    apiBaseUrl: 'http://127.0.0.1:3030',
    localFilename: '',
    mode: 'audio',
    quality: '192',
    sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
    ...overrides,
  };
}

describe('download job submit handler', () => {
  it('responds as soon as the job is created, without waiting for it to settle', async () => {
    /** submitJob이 완료를 늦추는 resolve 함수. */
    let resolveSettled: (job: DownloadJob) => void = () => {};
    /** onStatusChange로 전달된 초기 job. */
    const initialJob = createJob();
    /** handler 의존성. */
    const dependencies: DownloadJobSubmitHandlerDependencies = {
      jobManager: {
        submitJob: vi.fn().mockImplementation((input) => {
          input.onStatusChange?.(initialJob);

          return new Promise((resolve) => {
            resolveSettled = resolve;
          });
        }),
      },
      myTubeExtractClient: {
        assertServerAvailable: vi.fn().mockResolvedValue(undefined),
      },
    };
    /** job 제출 handler. */
    const handleSubmit = createDownloadJobSubmitHandler(dependencies);

    await expect(handleSubmit(createRequest())).resolves.toEqual({ job: initialJob, ok: true });

    // 응답 이후 완료되어도 handler가 다시 응답을 시도하지 않는다(catch 경로가 조용히 무시됨).
    resolveSettled(createJob({ status: 'completed' }));
  });

  it('reports a server-unavailable failure without creating a job', async () => {
    /** handler 의존성. */
    const dependencies: DownloadJobSubmitHandlerDependencies = {
      jobManager: {
        submitJob: vi.fn(),
      },
      myTubeExtractClient: {
        assertServerAvailable: vi.fn().mockRejectedValue(new Error('Server is unavailable.')),
      },
    };
    /** job 제출 handler. */
    const handleSubmit = createDownloadJobSubmitHandler(dependencies);

    await expect(handleSubmit(createRequest())).resolves.toEqual({
      message: 'Server is unavailable.',
      ok: false,
    });
    expect(dependencies.jobManager.submitJob).not.toHaveBeenCalled();
  });

  it('reports a job creation failure that happens before any status change', async () => {
    /** handler 의존성. */
    const dependencies: DownloadJobSubmitHandlerDependencies = {
      jobManager: {
        submitJob: vi.fn().mockRejectedValue(new Error('Could not reach the server.')),
      },
      myTubeExtractClient: {
        assertServerAvailable: vi.fn().mockResolvedValue(undefined),
      },
    };
    /** job 제출 handler. */
    const handleSubmit = createDownloadJobSubmitHandler(dependencies);

    await expect(handleSubmit(createRequest())).resolves.toEqual({
      message: 'Could not reach the server.',
      ok: false,
    });
  });

  it('passes the request fields through to the job manager', async () => {
    /** job manager submitJob spy. */
    const submitJob = vi.fn().mockImplementation((input) => {
      input.onStatusChange?.(createJob());

      return new Promise(() => {});
    });
    /** handler 의존성. */
    const dependencies: DownloadJobSubmitHandlerDependencies = {
      jobManager: { submitJob },
      myTubeExtractClient: {
        assertServerAvailable: vi.fn().mockResolvedValue(undefined),
      },
    };
    /** job 제출 handler. */
    const handleSubmit = createDownloadJobSubmitHandler(dependencies);

    await handleSubmit(
      createRequest({
        localFilename: 'my clip',
        mode: 'video',
        quality: '720',
      }),
    );

    expect(submitJob).toHaveBeenCalledWith(
      expect.objectContaining({
        apiBaseUrl: 'http://127.0.0.1:3030',
        localFilename: 'my clip',
        quality: '720',
        sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
        type: 'video',
      }),
    );
  });
});
