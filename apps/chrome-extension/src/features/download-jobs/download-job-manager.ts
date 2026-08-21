import { type DownloadsAdapter } from '../../adapters/chrome/downloads';
import { type CreateDownloadJobInput, type DownloadJob } from '../../domain/download-job/download-job';
import {
  type MyTubeExtractClient,
} from '../../services/mytube-extract/mytube-extract-client';

/** job 생성 직후 상태를 확인하는 간격(ms). */
export const FAST_POLL_INTERVAL_MS = 2500;

/** 실제 타이머 대신 주입해 폴링 시점을 통제할 수 있는 scheduler. */
export type JobPollingScheduler = {
  /** delayMs 이후 callback을 실행하도록 예약하고, 취소 함수를 반환한다. */
  scheduleDelay(callback: () => void, delayMs: number): () => void;
};

/** Download job manager 의존성. */
export type DownloadJobManagerDependencies = {
  /** MyTube Extract API client. */
  myTubeExtractClient: Pick<MyTubeExtractClient, 'createDownloadJob' | 'getDownloadJob'>;
  /** Chrome downloads adapter. */
  downloads: DownloadsAdapter;
  /** 폴링 예약 scheduler. */
  scheduler: JobPollingScheduler;
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
};

/** 폴링 루프 동안 함께 다니는 값들. */
type JobTrackingOptions = {
  /** API base URL. */
  apiBaseUrl: string;
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

  /** job 상태를 저장하고 구독자에게 알린다. */
  function setJob(job: DownloadJob): void {
    jobs.set(job.jobId, job);
    listeners.forEach((listener) => listener());
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

    while (currentJob.status === 'queued' || currentJob.status === 'processing') {
      await waitForNextPoll();

      currentJob = await dependencies.myTubeExtractClient.getDownloadJob(
        tracking.apiBaseUrl,
        currentJob.jobId,
      );
      setJob(currentJob);
      tracking.onStatusChange?.(currentJob);
    }

    if (currentJob.status === 'failed') {
      throw new DownloadJobFailedError(currentJob);
    }

    await dependencies.downloads.startDownload(currentJob.downloadUrl ?? '', tracking.localFilename);

    return currentJob;
  }

  return {
    getJobs() {
      return [...jobs.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    },
    subscribe(listener) {
      listeners.add(listener);

      return function unsubscribeDownloadJobManager() {
        listeners.delete(listener);
      };
    },
    async submitJob(input) {
      const { localFilename, onStatusChange, ...createInput } = input;
      /** 새로 생성된 job. */
      const job = await dependencies.myTubeExtractClient.createDownloadJob(createInput);

      setJob(job);
      onStatusChange?.(job);

      return trackJobUntilSettled(job, {
        apiBaseUrl: createInput.apiBaseUrl,
        localFilename,
        onStatusChange,
      });
    },
  };
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
