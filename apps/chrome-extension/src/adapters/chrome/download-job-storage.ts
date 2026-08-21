import { type DownloadJob } from '../../domain/download-job/download-job';

/** 최근 다운로드 job을 저장하는 chrome.storage.local key. */
export const LATEST_DOWNLOAD_JOB_STORAGE_KEY = 'latestDownloadJob';
/** 최근 다운로드 job 목록을 저장하는 chrome.storage.local key. */
export const RECENT_DOWNLOAD_JOBS_STORAGE_KEY = 'recentDownloadJobs';

/** 최근 다운로드 job 영속 저장 adapter. Popup이 닫혀 있어도 Background가 기록한 최신 상태를 읽고 구독할 수 있게 한다. */
export type DownloadJobStorageAdapter = {
  /** 저장된 최근 job 목록을 읽는다. 최신순으로 반환한다. */
  loadJobs(): Promise<DownloadJob[]>;
  /** 최근 job 목록을 저장한다. */
  saveJobs(jobs: readonly DownloadJob[]): Promise<void>;
  /** 최근 job 목록이 바뀔 때마다 호출된다. */
  subscribeJobs(listener: (jobs: DownloadJob[]) => void): () => void;
  /** 저장된 최근 job을 읽는다. 저장된 값이 없으면 null을 반환한다. */
  loadLatestJob(): Promise<DownloadJob | null>;
  /** 최근 job을 저장한다. */
  saveLatestJob(job: DownloadJob): Promise<void>;
  /** 저장된 최근 job이 바뀔 때마다 호출된다. */
  subscribeLatestJob(listener: (job: DownloadJob) => void): () => void;
};

/** Chrome download job storage adapter를 만든다. */
export function createDownloadJobStorageAdapter(
  chromeApi: typeof chrome = chrome,
): DownloadJobStorageAdapter {
  return {
    loadJobs() {
      return new Promise((resolve, reject) => {
        chromeApi.storage.local.get(
          [RECENT_DOWNLOAD_JOBS_STORAGE_KEY, LATEST_DOWNLOAD_JOB_STORAGE_KEY],
          (items) => {
            if (chromeApi.runtime.lastError) {
              reject(new Error('Could not load recent download jobs.'));
              return;
            }

            /** 새 목록 key에 저장된 job. */
            const storedJobs = items[RECENT_DOWNLOAD_JOBS_STORAGE_KEY];

            if (Array.isArray(storedJobs)) {
              resolve(storedJobs as DownloadJob[]);
              return;
            }

            /** 이전 버전의 단일 latest job. */
            const legacyJob = items[LATEST_DOWNLOAD_JOB_STORAGE_KEY] as DownloadJob | undefined;

            resolve(legacyJob ? [legacyJob] : []);
          },
        );
      });
    },
    saveJobs(jobs) {
      return new Promise((resolve, reject) => {
        chromeApi.storage.local.set(
          { [RECENT_DOWNLOAD_JOBS_STORAGE_KEY]: [...jobs] },
          () => {
            if (chromeApi.runtime.lastError) {
              reject(new Error('Could not save recent download jobs.'));
              return;
            }

            resolve();
          },
        );
      });
    },
    subscribeJobs(listener) {
      /** chrome.storage.onChanged listener. */
      function handleStorageChange(
        changes: Record<string, chrome.storage.StorageChange>,
        areaName: string,
      ) {
        if (areaName !== 'local') {
          return;
        }

        /** 최근 job 목록 변경 내역. */
        const jobsChange = changes[RECENT_DOWNLOAD_JOBS_STORAGE_KEY];

        if (jobsChange) {
          listener(
            Array.isArray(jobsChange.newValue)
              ? (jobsChange.newValue as DownloadJob[])
              : [],
          );
          return;
        }

        // 이전 버전에서 갱신한 단일 key도 Popup이 놓치지 않도록 목록 형태로 변환한다.
        /** 이전 버전 latest job 변경 내역. */
        const legacyChange = changes[LATEST_DOWNLOAD_JOB_STORAGE_KEY];

        if (legacyChange) {
          const legacyJob = legacyChange.newValue as DownloadJob | undefined;

          listener(legacyJob ? [legacyJob] : []);
        }
      }

      chromeApi.storage.onChanged.addListener(handleStorageChange);

      return function unsubscribeDownloadJobsStorage() {
        chromeApi.storage.onChanged.removeListener(handleStorageChange);
      };
    },
    loadLatestJob() {
      return new Promise((resolve, reject) => {
        chromeApi.storage.local.get([LATEST_DOWNLOAD_JOB_STORAGE_KEY], (items) => {
          if (chromeApi.runtime.lastError) {
            reject(new Error('Could not load the latest download job.'));
            return;
          }

          /** 저장된 최근 job. */
          const storedJob = items[LATEST_DOWNLOAD_JOB_STORAGE_KEY] as DownloadJob | undefined;

          resolve(storedJob ?? null);
        });
      });
    },
    saveLatestJob(job) {
      return new Promise((resolve, reject) => {
        chromeApi.storage.local.set({ [LATEST_DOWNLOAD_JOB_STORAGE_KEY]: job }, () => {
          if (chromeApi.runtime.lastError) {
            reject(new Error('Could not save the latest download job.'));
            return;
          }

          resolve();
        });
      });
    },
    subscribeLatestJob(listener) {
      /** chrome.storage.onChanged listener. */
      function handleStorageChange(
        changes: Record<string, chrome.storage.StorageChange>,
        areaName: string,
      ) {
        if (areaName !== 'local') {
          return;
        }

        /** 최근 job storage key 변경 내역. */
        const change = changes[LATEST_DOWNLOAD_JOB_STORAGE_KEY];

        if (!change) {
          return;
        }

        listener(change.newValue as DownloadJob);
      }

      chromeApi.storage.onChanged.addListener(handleStorageChange);

      return function unsubscribeDownloadJobStorage() {
        chromeApi.storage.onChanged.removeListener(handleStorageChange);
      };
    },
  };
}
