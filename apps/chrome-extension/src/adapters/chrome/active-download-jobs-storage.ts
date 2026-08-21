import { type DownloadJob } from '../../domain/download-job/download-job';

/** 진행 중(대기/처리 중) download job을 저장하는 chrome.storage.local key. */
export const ACTIVE_DOWNLOAD_JOBS_STORAGE_KEY = 'activeDownloadJobs';

/** service worker 재시작 후 폴링을 이어가는 데 필요한 job별 추적 기록. */
export type TrackedDownloadJobRecord = {
  /** job 생성 시 사용한 API base URL. */
  apiBaseUrl: string;
  /** 마지막으로 확인한 job 상태. */
  job: DownloadJob;
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

  return {
    async loadActiveJobs() {
      return Object.values(await loadRecordsByJobId());
    },
    async saveActiveJob(record) {
      /** 기존 기록에 새 기록을 병합한 결과. */
      const recordsByJobId = { ...(await loadRecordsByJobId()), [record.job.jobId]: record };

      await saveRecordsByJobId(recordsByJobId);
    },
    async removeActiveJob(jobId) {
      /** 대상 job을 제외한 나머지 기록. */
      const { [jobId]: _removed, ...remainingRecordsByJobId } = await loadRecordsByJobId();

      await saveRecordsByJobId(remainingRecordsByJobId);
    },
  };
}
