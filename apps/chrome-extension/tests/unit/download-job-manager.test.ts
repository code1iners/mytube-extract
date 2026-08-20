import { describe, expect, it, vi } from 'vitest';
import { type DownloadJob } from '../../src/domain/download-job/download-job';
import {
  DownloadJobFailedError,
  FAST_POLL_INTERVAL_MS,
  type DownloadJobManagerDependencies,
  type JobPollingScheduler,
  createDownloadJobManager,
} from '../../src/features/download-jobs/download-job-manager';

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

/** 테스트에서 폴링을 수동으로 진행시킬 수 있는 가짜 scheduler를 만든다. */
function createManualScheduler(): {
  scheduler: JobPollingScheduler;
  /** 대기 중인 예약이 몇 개 있는지. */
  pendingCount: () => number;
  /** 가장 먼저 예약된 콜백을 실행한다. */
  flushNext: () => void;
} {
  /** 예약된 콜백 목록. */
  const scheduled: { callback: () => void; delayMs: number }[] = [];

  return {
    scheduler: {
      scheduleDelay(callback, delayMs) {
        /** 이번 예약 항목. */
        const entry = { callback, delayMs };

        scheduled.push(entry);

        return function cancel() {
          /** 취소 대상 index. */
          const index = scheduled.indexOf(entry);

          if (index !== -1) {
            scheduled.splice(index, 1);
          }
        };
      },
    },
    pendingCount: () => scheduled.length,
    flushNext: () => {
      /** 실행할 가장 오래된 예약. */
      const next = scheduled.shift();

      next?.callback();
    },
  };
}

/** 대기 중인 promise 체인이 진행되도록 microtask queue를 여러 번 비운다. */
async function tick(times = 5): Promise<void> {
  for (let index = 0; index < times; index += 1) {
    await Promise.resolve();
  }
}

/** 테스트용 job manager dependency를 만든다. */
function createDependencies(
  overrides: Partial<DownloadJobManagerDependencies> = {},
): DownloadJobManagerDependencies {
  return {
    downloads: {
      startDownload: vi.fn().mockResolvedValue(1),
    },
    myTubeExtractClient: {
      createDownloadJob: vi.fn().mockResolvedValue(createJob()),
      getDownloadJob: vi.fn().mockResolvedValue(createJob()),
    },
    scheduler: createManualScheduler().scheduler,
    ...overrides,
  };
}

describe('download job manager', () => {
  it('resolves immediately and auto-downloads when the job completes on creation', async () => {
    /** 생성 즉시 완료로 응답하는 job. */
    const completedJob = createJob({
      displayStatus: 'completed',
      downloadUrl: '/downloads/job-1/file',
      progress: 100,
      status: 'completed',
    });
    /** job manager dependency. */
    const dependencies = createDependencies({
      myTubeExtractClient: {
        createDownloadJob: vi.fn().mockResolvedValue(completedJob),
        getDownloadJob: vi.fn(),
      },
    });
    /** job manager. */
    const manager = createDownloadJobManager(dependencies);

    /** 완료된 job 결과. */
    const result = await manager.submitJob({
      apiBaseUrl: 'http://127.0.0.1:3030',
      localFilename: 'my clip.mp3',
      quality: '192',
      sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
      type: 'audio',
    });

    expect(result.status).toBe('completed');
    expect(dependencies.myTubeExtractClient.getDownloadJob).not.toHaveBeenCalled();
    expect(dependencies.downloads.startDownload).toHaveBeenCalledWith(
      '/downloads/job-1/file',
      'my clip.mp3',
    );
  });

  it('starts the local download without a filename when none is given', async () => {
    /** 생성 즉시 완료로 응답하는 job. */
    const completedJob = createJob({
      downloadUrl: '/downloads/job-1/file',
      status: 'completed',
    });
    /** job manager dependency. */
    const dependencies = createDependencies({
      myTubeExtractClient: {
        createDownloadJob: vi.fn().mockResolvedValue(completedJob),
        getDownloadJob: vi.fn(),
      },
    });
    /** job manager. */
    const manager = createDownloadJobManager(dependencies);

    await manager.submitJob({
      apiBaseUrl: 'http://127.0.0.1:3030',
      quality: '192',
      sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
      type: 'audio',
    });

    expect(dependencies.downloads.startDownload).toHaveBeenCalledWith(
      '/downloads/job-1/file',
      undefined,
    );
  });

  it('polls at the fast interval and reports every status change until completion', async () => {
    /** 폴링을 수동으로 진행시키는 가짜 scheduler. */
    const manualScheduler = createManualScheduler();
    /** 순서대로 반환할 job 상태 목록. */
    const jobStatuses = [
      createJob({ status: 'processing' }),
      createJob({
        downloadUrl: '/downloads/job-1/file',
        status: 'completed',
      }),
    ];
    /** job manager dependency. */
    const dependencies = createDependencies({
      myTubeExtractClient: {
        createDownloadJob: vi.fn().mockResolvedValue(createJob({ status: 'queued' })),
        getDownloadJob: vi.fn(() => Promise.resolve(jobStatuses.shift()!)),
      },
      scheduler: manualScheduler.scheduler,
    });
    /** job manager. */
    const manager = createDownloadJobManager(dependencies);
    /** onStatusChange로 전달된 상태 목록. */
    const observedStatuses: string[] = [];

    /** 완료까지 이어지는 job 요청. */
    const submitPromise = manager.submitJob({
      apiBaseUrl: 'http://127.0.0.1:3030',
      onStatusChange: (job) => observedStatuses.push(job.status),
      quality: '192',
      sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
      type: 'audio',
    });

    // 생성 직후에는 아직 폴링 요청을 보내지 않고, 짧은 간격으로 예약만 해 둔다.
    await tick();
    expect(dependencies.myTubeExtractClient.getDownloadJob).not.toHaveBeenCalled();
    expect(manualScheduler.pendingCount()).toBe(1);

    manualScheduler.flushNext();
    await tick();
    expect(manualScheduler.pendingCount()).toBe(1);
    manualScheduler.flushNext();

    /** 완료된 job. */
    const result = await submitPromise;

    expect(result.status).toBe('completed');
    expect(observedStatuses).toEqual(['queued', 'processing', 'completed']);
    expect(dependencies.myTubeExtractClient.getDownloadJob).toHaveBeenCalledTimes(2);
    expect(dependencies.downloads.startDownload).toHaveBeenCalledWith(
      '/downloads/job-1/file',
      undefined,
    );
  });

  it('schedules the next poll at the fast interval', async () => {
    /** 폴링을 수동으로 진행시키는 가짜 scheduler. */
    const manualScheduler = createManualScheduler();
    /** scheduleDelay 호출을 관찰할 spy. */
    const scheduleDelaySpy = vi.fn(manualScheduler.scheduler.scheduleDelay);
    /** job manager dependency. */
    const dependencies = createDependencies({
      myTubeExtractClient: {
        createDownloadJob: vi.fn().mockResolvedValue(createJob({ status: 'queued' })),
        getDownloadJob: vi.fn().mockResolvedValue(createJob({ status: 'completed' })),
      },
      scheduler: { scheduleDelay: scheduleDelaySpy },
    });
    /** job manager. */
    const manager = createDownloadJobManager(dependencies);

    /** 완료까지 이어지는 job 요청. */
    const submitPromise = manager.submitJob({
      apiBaseUrl: 'http://127.0.0.1:3030',
      quality: '192',
      sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
      type: 'audio',
    });

    await tick();
    manualScheduler.flushNext();
    await submitPromise;

    expect(scheduleDelaySpy).toHaveBeenCalledWith(expect.any(Function), FAST_POLL_INTERVAL_MS);
  });

  it('throws a distinguishable error carrying the failed job and does not start a download', async () => {
    /** 실패로 응답하는 job. */
    const failedJob = createJob({
      displayStatus: 'failed',
      errorCode: 'YOUTUBE_AUTH_REQUIRED',
      message: '로그인이 필요한 영상입니다.',
      status: 'failed',
    });
    /** job manager dependency. */
    const dependencies = createDependencies({
      myTubeExtractClient: {
        createDownloadJob: vi.fn().mockResolvedValue(failedJob),
        getDownloadJob: vi.fn(),
      },
    });
    /** job manager. */
    const manager = createDownloadJobManager(dependencies);

    /** 실제로 던져진 오류. */
    const thrownError = await manager
      .submitJob({
        apiBaseUrl: 'http://127.0.0.1:3030',
        quality: '192',
        sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
        type: 'audio',
      })
      .catch((error: unknown) => error);

    expect(thrownError).toBeInstanceOf(DownloadJobFailedError);
    expect((thrownError as DownloadJobFailedError).message).toBe('로그인이 필요한 영상입니다.');
    expect((thrownError as DownloadJobFailedError).job).toBe(failedJob);
    expect(dependencies.downloads.startDownload).not.toHaveBeenCalled();
  });

  it('tracks multiple concurrently submitted jobs independently', async () => {
    /** 폴링을 수동으로 진행시키는 가짜 scheduler. */
    const manualScheduler = createManualScheduler();
    /** job별 응답. */
    const jobsById: Record<string, DownloadJob> = {
      'job-a': createJob({ jobId: 'job-a', status: 'queued' }),
      'job-b': createJob({ jobId: 'job-b', status: 'queued' }),
    };
    /** job manager dependency. */
    const dependencies = createDependencies({
      myTubeExtractClient: {
        createDownloadJob: vi
          .fn()
          .mockResolvedValueOnce(jobsById['job-a'])
          .mockResolvedValueOnce(jobsById['job-b']),
        getDownloadJob: vi.fn((_apiBaseUrl: string, jobId: string) =>
          Promise.resolve(jobsById[jobId]!),
        ),
      },
      scheduler: manualScheduler.scheduler,
    });
    /** job manager. */
    const manager = createDownloadJobManager(dependencies);

    void manager.submitJob({
      apiBaseUrl: 'http://127.0.0.1:3030',
      quality: '192',
      sourceUrl: 'https://www.youtube.com/watch?v=job-a',
      type: 'audio',
    });
    void manager.submitJob({
      apiBaseUrl: 'http://127.0.0.1:3030',
      quality: '192',
      sourceUrl: 'https://www.youtube.com/watch?v=job-b',
      type: 'audio',
    });
    await tick();

    expect(manager.getJobs().map((job) => job.jobId).sort()).toEqual(['job-a', 'job-b']);

    // job-a만 완료 상태로 갱신되면, job-b는 계속 대기 중 상태로 남는다.
    jobsById['job-a'] = createJob({
      downloadUrl: '/downloads/job-a/file',
      jobId: 'job-a',
      status: 'completed',
    });
    manualScheduler.flushNext();
    await tick();

    /** job-a, job-b 상태 map. */
    const jobs = new Map(manager.getJobs().map((job) => [job.jobId, job]));

    expect(jobs.get('job-a')?.status).toBe('completed');
    expect(jobs.get('job-b')?.status).toBe('queued');
  });

  it('notifies subscribers whenever a tracked job changes', async () => {
    /** 완료로 응답하는 job. */
    const completedJob = createJob({
      downloadUrl: '/downloads/job-1/file',
      status: 'completed',
    });
    /** job manager dependency. */
    const dependencies = createDependencies({
      myTubeExtractClient: {
        createDownloadJob: vi.fn().mockResolvedValue(completedJob),
        getDownloadJob: vi.fn(),
      },
    });
    /** job manager. */
    const manager = createDownloadJobManager(dependencies);
    /** 구독 listener. */
    const listener = vi.fn();

    manager.subscribe(listener);
    await manager.submitJob({
      apiBaseUrl: 'http://127.0.0.1:3030',
      quality: '192',
      sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
      type: 'audio',
    });

    expect(listener).toHaveBeenCalled();
  });

  it('stops notifying after unsubscribe', async () => {
    /** 완료로 응답하는 job. */
    const completedJob = createJob({
      downloadUrl: '/downloads/job-1/file',
      status: 'completed',
    });
    /** job manager dependency. */
    const dependencies = createDependencies({
      myTubeExtractClient: {
        createDownloadJob: vi.fn().mockResolvedValue(completedJob),
        getDownloadJob: vi.fn(),
      },
    });
    /** job manager. */
    const manager = createDownloadJobManager(dependencies);
    /** 구독 listener. */
    const listener = vi.fn();
    /** 구독 해제 함수. */
    const unsubscribe = manager.subscribe(listener);

    unsubscribe();
    await manager.submitJob({
      apiBaseUrl: 'http://127.0.0.1:3030',
      quality: '192',
      sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
      type: 'audio',
    });

    expect(listener).not.toHaveBeenCalled();
  });

  it('propagates a network/HTTP error from job creation without starting a download', async () => {
    /** job manager dependency. */
    const dependencies = createDependencies({
      myTubeExtractClient: {
        createDownloadJob: vi.fn().mockRejectedValue(new Error('Could not reach the server.')),
        getDownloadJob: vi.fn(),
      },
    });
    /** job manager. */
    const manager = createDownloadJobManager(dependencies);

    await expect(
      manager.submitJob({
        apiBaseUrl: 'http://127.0.0.1:3030',
        quality: '192',
        sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
        type: 'audio',
      }),
    ).rejects.toThrow('Could not reach the server.');
    expect(dependencies.downloads.startDownload).not.toHaveBeenCalled();
  });
});
