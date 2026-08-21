import { type DownloadJob } from '../../domain/download-job/download-job';

/** 진행 중(대기/처리 중) download job을 저장하는 chrome.storage.local key. */
export const ACTIVE_DOWNLOAD_JOBS_STORAGE_KEY = 'activeDownloadJobs';

/** service worker 재시작 후 폴링을 이어가는 데 필요한 job별 추적 기록. */
export type TrackedDownloadJobRecord = {
  /** job 생성 시 사용한 API base URL. */
  apiBaseUrl: string;
  /** 마지막으로 확인한 job 상태. */
  job: DownloadJob;
  /** 실패 알림에서 동일한 입력으로 재시도할 원본 YouTube URL. */
  sourceUrl: string;
  /** 완료 시 로컬 저장에 사용할 파일명. */
  localFilename?: string;
};

/** jobId를 key로 하는 저장 형태. */
type TrackedDownloadJobRecordsByJobId = Record<string, TrackedDownloadJobRecord>;

/** 진행 중 download job 영속 저장 adapter. service worker가 재시작돼도 아직 끝나지 않은 job을 다시 찾아 추적을 재개할 수 있게 한다. */
export type ActiveDownloadJobsStorageAdapter = {
  /** 저장된 진행 중 job 기록을 모두 읽는다. */
  loadActiveJobs(): Promise<TrackedDownloadJobRecord[]>;
  /** job 추적 기록을 저장한다(이미 있으면 덮어쓴다). */
  saveActiveJob(record: TrackedDownloadJobRecord): Promise<void>;
  /** 완료·실패해 더 이상 추적할 필요가 없는 job 기록을 지운다. */
  removeActiveJob(jobId: string): Promise<void>;
};

/** Chrome active download jobs storage adapter를 만든다. */
export function createActiveDownloadJobsStorageAdapter(
  chromeApi: typeof chrome = chrome,
): ActiveDownloadJobsStorageAdapter {
  /** 여러 job의 read-modify-write가 서로의 변경을 덮어쓰지 않도록 직렬화한다. */
  let storageMutation = Promise.resolve();

  /** 저장된 기록 전체를 읽는다. */
  function loadRecordsByJobId(): Promise<TrackedDownloadJobRecordsByJobId> {
    return new Promise((resolve, reject) => {
      chromeApi.storage.local.get([ACTIVE_DOWNLOAD_JOBS_STORAGE_KEY], (items) => {
        if (chromeApi.runtime.lastError) {
          reject(new Error('Could not load the tracked download jobs.'));
          return;
        }

        resolve(
          (items[ACTIVE_DOWNLOAD_JOBS_STORAGE_KEY] as
            | TrackedDownloadJobRecordsByJobId
            | undefined) ?? {},
        );
      });
    });
  }

  /** 기록 전체를 저장한다. */
  function saveRecordsByJobId(recordsByJobId: TrackedDownloadJobRecordsByJobId): Promise<void> {
    return new Promise((resolve, reject) => {
      chromeApi.storage.local.set(
        { [ACTIVE_DOWNLOAD_JOBS_STORAGE_KEY]: recordsByJobId },
        () => {
          if (chromeApi.runtime.lastError) {
            reject(new Error('Could not save the tracked download job.'));
            return;
          }

          resolve();
        },
      );
    });
  }

  /** active job 저장소의 read-modify-write 작업을 직렬화한다. */
  function enqueueStorageMutation(
    mutation: (
      recordsByJobId: TrackedDownloadJobRecordsByJobId,
    ) => Promise<TrackedDownloadJobRecordsByJobId>,
  ): Promise<void> {
    const nextMutation = storageMutation.then(async () => {
      const recordsByJobId = await loadRecordsByJobId();
      const nextRecordsByJobId = await mutation(recordsByJobId);

      await saveRecordsByJobId(nextRecordsByJobId);
    });

    storageMutation = nextMutation.then(
      () => undefined,
      () => undefined,
    );

    return nextMutation;
  }

  return {
    async loadActiveJobs() {
      return Object.values(await loadRecordsByJobId());
    },
    saveActiveJob(record) {
      return enqueueStorageMutation(async (recordsByJobId) => ({
        ...recordsByJobId,
        [record.job.jobId]: record,
      }));
    },
    removeActiveJob(jobId) {
      return enqueueStorageMutation(async (recordsByJobId) => {
        /** 대상 job을 제외한 나머지 기록. */
        const { [jobId]: _removed, ...remainingRecordsByJobId } = recordsByJobId;

        return remainingRecordsByJobId;
      });
    },
  };
}
