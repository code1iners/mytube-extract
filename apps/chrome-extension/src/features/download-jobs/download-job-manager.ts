import {
  type ActiveDownloadJobsStorageAdapter,
  type TrackedDownloadJobRecord,
} from '../../adapters/chrome/active-download-jobs-storage';
import { type DownloadsAdapter } from '../../adapters/chrome/downloads';
import {
  type DownloadJobRetryInput,
  type DownloadNotificationsAdapter,
} from '../../adapters/chrome/notifications';
import {
  type CreateDownloadJobInput,
  type DownloadJob,
} from '../../domain/download-job/download-job';
import {
  type MyTubeExtractClient,
} from '../../services/mytube-extract/mytube-extract-client';

/** job 생성 직후 상태를 확인하는 간격(ms). */
export const FAST_POLL_INTERVAL_MS = 2500;
/** Popup에 보관하는 settled job의 최대 목록 길이. 진행 중 job은 이 상한으로 제거하지 않는다. */
export const MAX_RECENT_DOWNLOAD_JOBS = 5;

/** 실제 타이머 대신 주입해 폴링 시점을 통제할 수 있는 scheduler. */
export type JobPollingScheduler = {
  /** delayMs 이후 callback을 실행하도록 예약하고, 취소 함수를 반환한다. */
  scheduleDelay(callback: () => void, delayMs: number): () => void;
};

/** Popup이 다시 열려도 최근 job 목록을 복원·저장하는 의존성. */
export type RecentDownloadJobsStore = {
  /** 저장된 최근 job 목록을 읽는다. */
  loadJobs(): Promise<DownloadJob[]>;
  /** 최근 job 목록을 저장한다. */
  saveJobs(jobs: readonly DownloadJob[]): Promise<void>;
};

/** Download job manager 의존성. */
export type DownloadJobManagerDependencies = {
  /** MyTube Extract API client. */
  myTubeExtractClient: Pick<MyTubeExtractClient, 'createDownloadJob' | 'getDownloadJob'>;
  /** Chrome downloads adapter. */
  downloads: DownloadsAdapter;
  /** 완료·실패 데스크톱 알림 adapter. */
  notifications: DownloadNotificationsAdapter;
  /** 폴링 예약 scheduler. */
  scheduler: JobPollingScheduler;
  /** service worker 재시작 후 추적을 재개할 수 있도록 진행 중 job을 영속 저장하는 store. */
  activeJobsStore: Pick<
    ActiveDownloadJobsStorageAdapter,
    'loadActiveJobs' | 'removeActiveJob' | 'saveActiveJob'
  >;
  /** Popup 재오픈 후에도 최근 job 목록을 보여 주기 위한 영속 저장소. */
  recentJobsStore?: RecentDownloadJobsStore;
};

/** 다운로드 job 제출 입력. */
export type SubmitDownloadJobInput = CreateDownloadJobInput & {
  /** 완료 시 로컬 저장에 사용할 파일명. 비어 있으면 서버가 내려준 기본 파일명을 사용한다. */
  localFilename?: string;
  /** 대기/처리 중 상태가 바뀔 때마다 호출된다. */
  onStatusChange?: (job: DownloadJob) => void;
};

/** Download job 관리 모듈. job 생성부터 폴링, 완료 시 자동 다운로드까지 전담한다. */
export type DownloadJobManager = {
  /** 현재 추적 중인 job 목록을 최신순으로 반환한다. */
  getJobs(): DownloadJob[];
  /** 새 다운로드 job을 생성하고 완료(또는 실패)할 때까지 추적한다. */
  submitJob(input: SubmitDownloadJobInput): Promise<DownloadJob>;
  /** 추적 중인 job 목록 변경을 구독한다. */
  subscribe(listener: () => void): () => void;
  /** 영속 저장소에 남아 있는 진행 중 job의 추적을 재개한다. 이미 추적 중인 job은 건너뛴다. */
  resumeTracking(): Promise<void>;
};

/** job이 아직 끝나지 않았는지(대기 또는 처리 중인지) 판별한다. */
function isUnsettled(job: DownloadJob): boolean {
  return job.status === 'queued' || job.status === 'processing';
}

/** 폴링 루프 동안 함께 다니는 값들. */
type JobTrackingOptions = {
  /** API base URL. */
  apiBaseUrl: string;
  /** 실패 알림 재시도에 사용할 원본 YouTube URL. */
  sourceUrl: string;
  /** 실패 알림 재시도에 사용할 다운로드 형식. */
  type: CreateDownloadJobInput['type'];
  /** 실패 알림 재시도에 사용할 화질. */
  quality: CreateDownloadJobInput['quality'];
  /** 완료 시 로컬 저장에 사용할 파일명. */
  localFilename: string | undefined;
  /** 대기/처리 중 상태가 바뀔 때마다 호출된다. */
  onStatusChange: ((job: DownloadJob) => void) | undefined;
};

/** job이 실패 상태로 끝났을 때 던지는 오류. 실패 사유와 원본 job을 함께 전달한다. */
export class DownloadJobFailedError extends Error {
  constructor(job: DownloadJob) {
    super(job.message || 'Download job failed.');
    this.name = 'DownloadJobFailedError';
    this.job = job;
  }

  /** 실패한 job snapshot. */
  job: DownloadJob;
}

/** setTimeout 기반 기본 폴링 scheduler를 만든다. */
export function createTimeoutPollingScheduler(): JobPollingScheduler {
  return {
    scheduleDelay(callback, delayMs) {
      /** 예약된 setTimeout handle. */
      const timeoutHandle = setTimeout(callback, delayMs);

      return function cancel() {
        clearTimeout(timeoutHandle);
      };
    },
  };
}

/** Download job manager를 만든다. */
export function createDownloadJobManager(
  dependencies: DownloadJobManagerDependencies,
): DownloadJobManager {
  /** jobId 기준으로 추적 중인 job 상태. */
  const jobs = new Map<string, DownloadJob>();
  /** job 목록 변경 listener 목록. */
  const listeners = new Set<() => void>();
  /** 최근 job 저장소를 한 번만 읽기 위한 promise. */
  let recentJobsReady: Promise<void> | null = null;
  /** 연속된 상태 변경이 오래된 목록을 덮어쓰지 않도록 저장을 직렬화한다. */
  let recentJobsSaveQueue = Promise.resolve();

  /** 최근 job을 생성 시각 기준 최신순으로 정렬한다. */
  function getSortedJobs(): DownloadJob[] {
    return [...jobs.values()].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  }

  /** 완료·실패 상태인지 판별한다. */
  function isSettled(job: DownloadJob): boolean {
    return job.status === 'completed' || job.status === 'failed';
  }

  /** 목록이 가득 찼을 때 가장 오래된 settled job부터 제거한다. */
  function retainRecentJobs(): void {
    while (jobs.size > MAX_RECENT_DOWNLOAD_JOBS) {
      /** 제거 후보가 될 수 있는 settled job. */
      const oldestSettledJob = [...jobs.values()]
        .filter(isSettled)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0];

      if (!oldestSettledJob) {
        // 진행 중 job만 남아 있으면 상태를 잃지 않도록 목록 길이를 초과해 보관한다.
        return;
      }

      jobs.delete(oldestSettledJob.jobId);
    }
  }

  /** job을 목록에 반영하고 보관 정책을 적용한다. */
  function rememberJob(job: DownloadJob): void {
    jobs.set(job.jobId, job);
    retainRecentJobs();
  }

  /** job 상태를 저장하고 구독자에게 알린다. */
  function setJob(job: DownloadJob): void {
    rememberJob(job);
    listeners.forEach((listener) => listener());
  }

  /** 저장된 최근 job을 manager에 복원한다. 읽기 실패는 다운로드 흐름을 막지 않는다. */
  function ensureRecentJobsLoaded(): Promise<void> {
    if (!dependencies.recentJobsStore) {
      return Promise.resolve();
    }

    if (!recentJobsReady) {
      recentJobsReady = dependencies.recentJobsStore
        .loadJobs()
        .then((storedJobs) => {
          storedJobs.forEach(rememberJob);
        })
        .catch(() => {
          // 최근 이력 저장소가 일시적으로 unavailable이어도 새 다운로드는 계속 허용한다.
        });
    }

    return recentJobsReady;
  }

  /** 현재 목록을 저장한다. 저장 실패가 job 추적이나 다운로드를 막지는 않는다. */
  function persistRecentJobs(): Promise<void> {
    if (!dependencies.recentJobsStore) {
      return Promise.resolve();
    }

    /** 이번 상태 변경 시점의 최근 job snapshot. */
    const jobsSnapshot = getSortedJobs();

    recentJobsSaveQueue = recentJobsSaveQueue.then(async () => {
      try {
        await dependencies.recentJobsStore?.saveJobs(jobsSnapshot);
      } catch {
        // Popup 이력 저장 실패가 실제 job 처리 결과를 바꾸지 않게 한다.
      }
    });

    return recentJobsSaveQueue;
  }

  // 완료 처리(자동 다운로드)나 다음 폴링으로 넘어가기 전에 항상 이 저장을 기다린다 — 그래야
  // service worker가 중간에 죽어도 마지막으로 확인한 상태가 반드시 먼저 영속화된다.
  /** job 추적 상태를 영속 저장소에 반영한다. 끝난 job은 다음 재개 대상에서 제외되도록 지운다. */
  async function persistTracking(job: DownloadJob, tracking: JobTrackingOptions): Promise<void> {
    if (isUnsettled(job)) {
      await dependencies.activeJobsStore.saveActiveJob({
        apiBaseUrl: tracking.apiBaseUrl,
        job,
        localFilename: tracking.localFilename,
        sourceUrl: tracking.sourceUrl,
      });
      return;
    }

    await dependencies.activeJobsStore.removeActiveJob(job.jobId);
  }

  /** 다음 폴링 예약까지 대기한다. */
  function waitForNextPoll(): Promise<void> {
    return new Promise((resolve) => {
      dependencies.scheduler.scheduleDelay(() => resolve(), FAST_POLL_INTERVAL_MS);
    });
  }

  /** job이 완료 또는 실패로 끝날 때까지 짧은 간격으로 상태를 확인한다. */
  async function trackJobUntilSettled(
    initialJob: DownloadJob,
    tracking: JobTrackingOptions,
  ): Promise<DownloadJob> {
    /** 폴링 루프에서 참조하는 최신 job 상태. */
    let currentJob = initialJob;

    while (isUnsettled(currentJob)) {
      await waitForNextPoll();

      currentJob = await dependencies.myTubeExtractClient.getDownloadJob(
        tracking.apiBaseUrl,
        currentJob.jobId,
      );
      setJob(currentJob);
      if (dependencies.recentJobsStore) {
        await persistRecentJobs();
      }
      await persistTracking(currentJob, tracking);
      tracking.onStatusChange?.(currentJob);
    }

    if (currentJob.status === 'failed') {
      await notifySafely(() =>
        dependencies.notifications.showFailed(currentJob, {
          apiBaseUrl: tracking.apiBaseUrl,
          localFilename: tracking.localFilename,
          quality: tracking.quality,
          sourceUrl: tracking.sourceUrl,
          type: tracking.type,
        }),
      );
      throw new DownloadJobFailedError(currentJob);
    }

    await notifySafely(() => dependencies.notifications.showCompleted(currentJob));
    await dependencies.downloads.startDownload(currentJob.downloadUrl ?? '', tracking.localFilename);

    return currentJob;
  }

  /** 저장돼 있던 진행 중 job 기록 하나의 추적을 재개한다. 대기 없이 즉시 한 번 확인부터 다시 시작한다. */
  async function resumeRecord(record: TrackedDownloadJobRecord): Promise<void> {
    if (jobs.has(record.job.jobId)) {
      return;
    }

    /** 재개 시점에 참조할 추적 옵션. */
    const tracking: JobTrackingOptions = {
      apiBaseUrl: record.apiBaseUrl,
      localFilename: record.localFilename,
      onStatusChange: undefined,
      quality: record.job.quality,
      sourceUrl: record.sourceUrl,
      type: record.job.type,
    };

    if (!isUnsettled(record.job)) {
      await persistTracking(record.job, tracking);
      return;
    }

    setJob(record.job);
    if (dependencies.recentJobsStore) {
      await persistRecentJobs();
    }

    /** 재시작 전 상태는 오래됐을 수 있으므로, 대기 없이 즉시 한 번 다시 확인한다. */
    const refreshedJob = await dependencies.myTubeExtractClient.getDownloadJob(
      tracking.apiBaseUrl,
      record.job.jobId,
    );

    setJob(refreshedJob);
    if (dependencies.recentJobsStore) {
      await persistRecentJobs();
    }
    await persistTracking(refreshedJob, tracking);

    await trackJobUntilSettled(refreshedJob, tracking).catch(() => {
      // 실패는 이미 job 상태에 기록되어 있고, 재개 흐름에는 결과를 기다리는 호출자가 없다.
    });
  }

  /** 새 job을 생성하고 상태 추적을 시작한다. 실패 알림의 재시도도 이 경계를 재사용한다. */
  async function submitJob(input: SubmitDownloadJobInput): Promise<DownloadJob> {
    if (dependencies.recentJobsStore) {
      await ensureRecentJobsLoaded();
    }

    const { localFilename, onStatusChange, ...createInput } = input;
    /** 새로 생성된 job. */
    const job = await dependencies.myTubeExtractClient.createDownloadJob(createInput);
    /** 이번 job 추적에 사용할 옵션. */
    const tracking: JobTrackingOptions = {
      apiBaseUrl: createInput.apiBaseUrl,
      localFilename,
      onStatusChange,
      quality: createInput.quality,
      sourceUrl: createInput.sourceUrl,
      type: createInput.type,
    };

    setJob(job);
    if (dependencies.recentJobsStore) {
      await persistRecentJobs();
    }
    await persistTracking(job, tracking);
    onStatusChange?.(job);

    return trackJobUntilSettled(job, tracking);
  }

  dependencies.notifications.subscribeRetry((retryInput: DownloadJobRetryInput) =>
    submitJob(retryInput),
  );

  return {
    getJobs() {
      return getSortedJobs();
    },
    subscribe(listener) {
      listeners.add(listener);

      return function unsubscribeDownloadJobManager() {
        listeners.delete(listener);
      };
    },
    submitJob,
    async resumeTracking() {
      if (dependencies.recentJobsStore) {
        await ensureRecentJobsLoaded();
      }

      /** 영속 저장소에 남아 있던 진행 중 job 기록들. */
      const records = await dependencies.activeJobsStore.loadActiveJobs();

      await Promise.all(records.map((record) => resumeRecord(record)));
    },
  };
}

/** 알림이 실패해도 job 상태 처리와 자동 다운로드 결과를 가리지 않게 한다. */
async function notifySafely(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch {
    // OS 알림은 부수효과이므로 권한 거부나 Chrome API 오류가 job 결과를 바꾸지 않게 한다.
  }
}

/** job 상태가 바뀔 때마다 가장 최근 job을 save로 넘긴다. Background와 dev preview가 동일하게 사용한다. */
export function persistLatestJob(
  jobManager: Pick<DownloadJobManager, 'getJobs' | 'subscribe'>,
  save: (job: DownloadJob) => void,
): () => void {
  return jobManager.subscribe(() => {
    /** 가장 최근에 갱신된 job. */
    const [latestJob] = jobManager.getJobs();

    if (latestJob) {
      save(latestJob);
    }
  });
}
