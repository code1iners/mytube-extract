import {
  type DownloadJobsBridge,
  createDownloadJobsBridge,
} from '../../adapters/chrome/download-jobs-bridge';
import { type StorageAdapter, createStorageAdapter } from '../../adapters/chrome/storage';
import { type TabsAdapter, createTabsAdapter } from '../../adapters/chrome/tabs';
import {
  type YoutubeOverlayAdapter,
  createYoutubeOverlayAdapter,
} from '../../adapters/chrome/youtube-overlay';
import {
  type DownloadJob,
  type DownloadJobStatus,
  type DownloadQuality,
} from '../../domain/download-job/download-job';
import {
  type DownloadOptions,
  DEFAULT_DOWNLOAD_OPTIONS,
  mergeStoredDownloadOptions,
  normalizeApiBaseUrl,
  normalizeSourceUrl,
} from '../../domain/download-options/download-options';
import {
  CHECKING_SERVER_STATUS,
  DOWNLOAD_STARTED_STATUS,
  INVALID_SOURCE_URL_STATUS,
  MISSING_SOURCE_URL_STATUS,
  type PopupStatus,
  createDownloadFailedStatus,
  createInvalidSourceUrlStatus,
  createJobProcessingStatus,
  createJobQueuedStatus,
  createReadyStatus,
} from '../../domain/popup-state/popup-state';
import { sanitizeFilenameSegment } from '../../shared/sanitize-filename';

/** Popup model dependency. */
export type PopupDownloadModelDependencies = {
  /** Storage adapter. */
  storage: StorageAdapter;
  /** Background의 download job 추적을 이용하는 창구. */
  downloadJobs: DownloadJobsBridge;
  /** Tabs adapter. */
  tabs: TabsAdapter;
  /** YouTube 썸네일 Overlay 권한 adapter. */
  youtubeOverlay: YoutubeOverlayAdapter;
};

/** YouTube 썸네일 Overlay 권한 상태. */
export type YoutubeOverlaySnapshot = {
  /** 선택 Host Permission 활성화 여부. */
  enabled: boolean;
  /** Overlay 권한 상태. */
  status: 'checking' | 'disabled' | 'enabled' | 'requesting' | 'denied' | 'error';
  /** 사용자에게 표시할 권한 상태 문구. */
  message: string;
};

/** Popup 화면 snapshot. */
export type PopupDownloadSnapshot = {
  /** 다운로드 가능 여부. */
  canDownload: boolean;
  /** 다운로드 진행 중 여부. */
  downloading: boolean;
  /** 현재 제출 요청의 job 생성 응답을 기다리는지 여부. */
  submitting: boolean;
  /** 최근 job 목록. 최신순으로 정렬한다. */
  jobs: DownloadJob[];
  /** 현재 form option. */
  options: DownloadOptions;
  /** 현재 상태. */
  status: PopupStatus;
  /** YouTube 썸네일 Overlay 상태. */
  youtubeOverlay: YoutubeOverlaySnapshot;
};

/** Popup model. */
export type PopupDownloadModel = {
  /** 현재 snapshot을 반환한다. */
  getSnapshot(): PopupDownloadSnapshot;
  /** Popup 초기화를 수행한다. */
  initialize(): Promise<void>;
  /** YouTube 썸네일 Overlay를 활성화한다. */
  activateYoutubeOverlay(): Promise<void>;
  /** 현재 탭 URL을 source URL 입력값으로 가져온다. */
  importCurrentTabUrl(): Promise<void>;
  /** 처리 결과 화면에서 요청 설정 화면으로 돌아간다. */
  returnToForm(): Promise<void>;
  /** Snapshot 변경 구독을 등록한다. */
  subscribe(listener: () => void): () => void;
  /** Download submit을 처리한다. */
  submitDownload(): Promise<void>;
  /** Form option 변경을 처리한다. */
  updateOption<Key extends keyof DownloadOptions>(
    key: Key,
    value: DownloadOptions[Key],
  ): Promise<void>;
};

/** 초기 popup snapshot. */
const INITIAL_SNAPSHOT: PopupDownloadSnapshot = {
  canDownload: false,
  downloading: false,
  submitting: false,
  jobs: [],
  options: DEFAULT_DOWNLOAD_OPTIONS,
  status: MISSING_SOURCE_URL_STATUS,
  youtubeOverlay: {
    enabled: false,
    message: 'YouTube 썸네일 버튼 권한을 확인하고 있습니다.',
    status: 'checking',
  },
};

/** job 진행 단계 순서. 낮은 값이 이전 단계다. completed/failed는 동일하게 최종 단계로 취급한다. */
const JOB_STATUS_RANK: Record<DownloadJobStatus, number> = {
  completed: 2,
  failed: 2,
  processing: 1,
  queued: 0,
};

/** 아직 끝나지 않은 job인지 확인한다. */
function isUnsettledJob(job: DownloadJob): boolean {
  return job.status === 'queued' || job.status === 'processing';
}

/** Popup 목록을 최신 job부터 정렬한다. */
function sortJobs(jobs: readonly DownloadJob[]): DownloadJob[] {
  return [...jobs].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

/** Chrome runtime용 popup model을 만든다. */
export function createChromePopupDownloadModel(): PopupDownloadModel {
  return createPopupDownloadModel({
    storage: createStorageAdapter(),
    downloadJobs: createDownloadJobsBridge(),
    tabs: createTabsAdapter(),
    youtubeOverlay: createYoutubeOverlayAdapter(),
  });
}

/** Popup download model을 만든다. */
export function createPopupDownloadModel(
  dependencies: PopupDownloadModelDependencies,
): PopupDownloadModel {
  /** 현재 popup snapshot. */
  let snapshot = INITIAL_SNAPSHOT;
  /** Snapshot 변경 listener 목록. */
  const listeners = new Set<() => void>();
  /** 비동기 초기화가 사용자의 이미 입력한 값·제출 상태를 덮어쓰지 않게 한다. */
  let hasUserInteracted = false;

  /** Snapshot을 갱신하고 listener에게 알린다. */
  function setSnapshot(nextSnapshot: PopupDownloadSnapshot) {
    snapshot = nextSnapshot;
    listeners.forEach((listener) => listener());
  }

  /** 현재 옵션과 URL 입력 상태를 기준으로 ready state를 계산한다. */
  function renderReadyState(baseSnapshot: PopupDownloadSnapshot): PopupDownloadSnapshot {
    if (!baseSnapshot.options.sourceUrl.trim()) {
      return {
        ...baseSnapshot,
        canDownload: false,
        status: MISSING_SOURCE_URL_STATUS,
      };
    }

    try {
      normalizeApiBaseUrl(baseSnapshot.options.apiBaseUrl);
      normalizeSourceUrl(baseSnapshot.options.sourceUrl);

      return {
        ...baseSnapshot,
        canDownload: !baseSnapshot.submitting,
        status: createReadyStatus(),
      };
    } catch {
      return {
        ...baseSnapshot,
        canDownload: false,
        status: INVALID_SOURCE_URL_STATUS,
      };
    }
  }

  /** Background가 저장한 최근 job 목록을 snapshot에 반영한다. */
  function applyDownloadJobsStatus(
    baseSnapshot: PopupDownloadSnapshot,
    jobs: readonly DownloadJob[],
  ): PopupDownloadSnapshot {
    /** 화면에 표시할 정렬된 job 목록. */
    const sortedJobs = sortJobs(jobs);
    /** 가장 최근 job의 상태를 form 아래 안내에도 반영한다. */
    const latestJob = sortedJobs[0];
    /** 진행 중 job이 하나라도 있는지 여부. */
    const hasUnsettledJob = sortedJobs.some(isUnsettledJob);
    /** job 목록과 진행 상태를 반영한 기본 snapshot. */
    const nextSnapshot = renderReadyState({
      ...baseSnapshot,
      downloading: hasUnsettledJob,
      jobs: sortedJobs,
      submitting: baseSnapshot.submitting,
    });

    if (!latestJob) {
      return nextSnapshot;
    }

    return {
      ...nextSnapshot,
      status: getJobPopupStatus(latestJob),
    };
  }

  /** 한 job의 상태를 Popup 안내 상태로 바꾼다. */
  function getJobPopupStatus(job: DownloadJob): PopupStatus {
    if (job.status === 'queued') return createJobQueuedStatus(job.message);
    if (job.status === 'processing') return createJobProcessingStatus(job.message);
    if (job.status === 'completed') return DOWNLOAD_STARTED_STATUS;
    return createDownloadFailedStatus(job.message);
  }

  /** job별 마지막 상태. 제출 응답과 storage 구독이 서로 다른 시점에 도착해도 되돌리지 않는다. */
  const lastAppliedJobs = new Map<string, DownloadJob>();

  /** job 갱신이 같은 job의 더 이전 단계로 되돌아가는지 확인한다. */
  function acceptJobUpdate(job: DownloadJob): boolean {
    /** 같은 job에 대해 이미 반영한 최신 상태. */
    const lastAppliedJob = lastAppliedJobs.get(job.jobId);

    if (lastAppliedJob && JOB_STATUS_RANK[job.status] < JOB_STATUS_RANK[lastAppliedJob.status]) {
      return false;
    }

    lastAppliedJobs.set(job.jobId, job);

    return true;
  }

  /** 저장소에서 온 목록의 각 job을 순서 역행 없이 병합한다. */
  function mergeJobList(jobs: readonly DownloadJob[]): DownloadJob[] {
    return jobs.map((job) => {
      const accepted = acceptJobUpdate(job);

      return accepted ? job : lastAppliedJobs.get(job.jobId) ?? job;
    });
  }

  /** 현재 snapshot의 job 하나를 목록에 추가하거나 갱신한다. */
  function upsertJob(job: DownloadJob): DownloadJob[] {
    const jobsById = new Map(snapshot.jobs.map((item) => [item.jobId, item]));

    jobsById.set(job.jobId, job);

    return sortJobs([...jobsById.values()]);
  }

  // Popup이 열려 있는 동안 Background가 기록한 job 상태 변경을 새로고침 없이 반영한다.
  dependencies.downloadJobs.subscribeJobs((jobs) => {
    setSnapshot(applyDownloadJobsStatus(snapshot, mergeJobList(jobs)));
  });

  return {
    getSnapshot() {
      return snapshot;
    },
    async initialize() {
      /** 저장된 option. */
      let options = DEFAULT_DOWNLOAD_OPTIONS;
      /** YouTube 썸네일 Overlay 권한 상태. */
      let youtubeOverlay: YoutubeOverlaySnapshot = {
        enabled: false,
        message: 'YouTube 썸네일 버튼 권한을 확인하고 있습니다.',
        status: 'checking',
      };

      try {
        options = await dependencies.storage.loadOptions();
      } catch {
        // storage 자체가 실패해도 고정 품질 선택지가 유효한 기본값으로 채워지게 병합 경로를 그대로 탄다.
        options = mergeStoredDownloadOptions({});
      }

      try {
        /** 선택 Host Permission 활성화 여부. */
        const enabled = await dependencies.youtubeOverlay.isEnabled();

        youtubeOverlay = enabled
          ? {
              enabled: true,
              message: 'YouTube 썸네일 버튼이 활성화되어 있습니다.',
              status: 'enabled',
            }
          : {
              enabled: false,
              message: '권한을 허용하면 YouTube 썸네일에서 바로 추출할 수 있습니다.',
              status: 'disabled',
            };
      } catch {
        youtubeOverlay = {
          enabled: false,
          message: 'YouTube 썸네일 버튼 권한을 확인하지 못했습니다.',
          status: 'error',
        };
      }

      options = {
        ...options,
        sourceUrl: '',
      };

      /** Background가 저장해 둔 최근 job 목록. */
      let jobs: DownloadJob[] = [];

      try {
        jobs = await dependencies.downloadJobs.getJobs();
      } catch {
        jobs = [];
      }

      /** 옵션·권한 상태까지 반영한 기본 snapshot. */
      const baseSnapshot = renderReadyState({
        ...snapshot,
        options: hasUserInteracted ? snapshot.options : options,
        youtubeOverlay,
      });

      /** 초기화 중 먼저 반영된 job 목록이 있으면 그 목록을 유지한다. */
      const jobsToApply = snapshot.jobs.length ? snapshot.jobs : jobs;

      if (snapshot.submitting && jobsToApply.length === 0) {
        setSnapshot({
          ...baseSnapshot,
          canDownload: false,
          status: snapshot.status,
          submitting: true,
        });
        return;
      }

      if (
        hasUserInteracted &&
        snapshot.status.kind === 'download-failed' &&
        jobsToApply.length === 0
      ) {
        setSnapshot(baseSnapshot);
        return;
      }

      setSnapshot(applyDownloadJobsStatus(baseSnapshot, mergeJobList(jobsToApply)));
    },
    async activateYoutubeOverlay() {
      if (snapshot.youtubeOverlay.status === 'requesting') {
        return;
      }

      setSnapshot({
        ...snapshot,
        youtubeOverlay: {
          enabled: false,
          message: 'YouTube 썸네일 버튼을 활성화하는 중입니다.',
          status: 'requesting',
        },
      });

      try {
        /** 권한 요청과 현재 탭 Overlay 활성화 결과. */
        const enabled = await dependencies.youtubeOverlay.requestAndEnable();

        setSnapshot({
          ...snapshot,
          youtubeOverlay: enabled
            ? {
                enabled: true,
                message: 'YouTube 썸네일 버튼이 활성화되어 있습니다.',
                status: 'enabled',
              }
            : {
                enabled: false,
                message: '권한을 허용하지 않아 썸네일 버튼을 표시하지 않습니다.',
                status: 'denied',
              },
        });
      } catch {
        setSnapshot({
          ...snapshot,
          youtubeOverlay: {
            enabled: false,
            message: 'YouTube 썸네일 버튼을 활성화하지 못했습니다. 다시 시도하세요.',
            status: 'error',
          },
        });
      }
    },
    async importCurrentTabUrl() {
      hasUserInteracted = true;

      try {
        /** 현재 활성 탭 URL. */
        const currentTabUrl = await dependencies.tabs.getCurrentTabUrl();
        /** API에 전달할 정규화된 source URL. */
        const sourceUrl = normalizeSourceUrl(currentTabUrl);

        setSnapshot(
          renderReadyState({
            ...snapshot,
            options: {
              ...snapshot.options,
              sourceUrl,
            },
          }),
        );
      } catch {
        /** 현재 입력값 기준으로 재시도 가능 여부를 보존한 snapshot. */
        const fallbackSnapshot = renderReadyState(snapshot);

        setSnapshot({
          ...fallbackSnapshot,
          status: createInvalidSourceUrlStatus(
            '현재 탭에서 지원하는 YouTube URL을 찾을 수 없습니다.',
          ),
        });
      }
    },
    async returnToForm() {
      // 기존 URL과 옵션을 유지해 사용자가 설정만 고쳐 재요청할 수 있게 한다.
      setSnapshot(
        renderReadyState({
          ...snapshot,
          downloading: snapshot.jobs.some(isUnsettledJob),
          submitting: false,
        }),
      );
    },
    subscribe(listener) {
      listeners.add(listener);

      return function unsubscribePopupDownloadModel() {
        listeners.delete(listener);
      };
    },
    async submitDownload() {
      /** 제출 시점의 popup snapshot. */
      const submittedSnapshot = snapshot;

      hasUserInteracted = true;

      if (
        submittedSnapshot.submitting ||
        !submittedSnapshot.canDownload
      ) {
        return;
      }

      setSnapshot({
        ...submittedSnapshot,
        canDownload: false,
        submitting: true,
        status: CHECKING_SERVER_STATUS,
      });

      try {
        // job 생성과 상태 추적은 Background가 전담한다 — 여기서는 생성 직후 상태만 받고,
        // 이후 진행 상황은 subscribeJobs 구독으로 반영된다.
        const job = await dependencies.downloadJobs.submitJob({
          apiBaseUrl: submittedSnapshot.options.apiBaseUrl,
          localFilename: resolveLocalFilename(submittedSnapshot.options.filename),
          mode: submittedSnapshot.options.mode,
          quality: resolveJobQuality(submittedSnapshot.options),
          sourceUrl: submittedSnapshot.options.sourceUrl,
        });

        // 응답이 늦게 도착해 storage 구독이 이미 더 진행된 상태를 반영했다면 되돌리지 않는다.
        const accepted = acceptJobUpdate(job);

        setSnapshot(
          accepted
            ? applyDownloadJobsStatus(
                { ...snapshot, submitting: false },
                upsertJob(job),
              )
            : {
                ...renderReadyState({ ...snapshot, submitting: false }),
                status: snapshot.status,
              },
        );
      } catch (error) {
        /** 사용자에게 표시할 실패 메시지. */
        const errorMessage =
          error instanceof Error ? error.message : 'Download failed. Please try again.';
        /** 실패 후 재시도 가능한 snapshot. */
        const failedSnapshot = renderReadyState({
          ...snapshot,
          submitting: false,
        });

        setSnapshot({
          ...failedSnapshot,
          status: createDownloadFailedStatus(errorMessage),
        });
      }
    },
    async updateOption(key, value) {
      hasUserInteracted = true;

      /** 변경된 다운로드 옵션. */
      const options = {
        ...snapshot.options,
        [key]: value,
      };

      setSnapshot(
        renderReadyState({
          ...snapshot,
          options,
        }),
      );

      // sourceUrl은 session-only 입력이므로 Chrome storage 저장에서 제외한다.
      if (key === 'sourceUrl') {
        return;
      }

      try {
        await dependencies.storage.saveOptions(options);
      } catch {
        setSnapshot({
          ...snapshot,
          status: createDownloadFailedStatus('Could not save extension settings.'),
        });
      }
    },
  };
}

/** 현재 모드에 해당하는 고정 품질 값을 job 생성 입력값으로 바꾼다. 팝업은 서버가 지원하는 고정 선택지만 노출하므로 항상 유효한 값이다. */
function resolveJobQuality(options: DownloadOptions): DownloadQuality {
  return (options.mode === 'audio' ? options.bitrate : options.resolution) as DownloadQuality;
}

/** 사용자가 입력한 파일명을 로컬 저장에 안전한 형태로 정리한다. 정리 후 비어 있거나 상대 경로 표기만 남으면 override하지 않는다. */
function resolveLocalFilename(filename: string): string {
  /** 경로 구분자·제어 문자를 제거한 파일명. */
  const sanitized = sanitizeFilenameSegment(filename);

  return sanitized === '.' || sanitized === '..' ? '' : sanitized;
}
