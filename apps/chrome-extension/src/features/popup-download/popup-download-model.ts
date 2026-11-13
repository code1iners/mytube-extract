import {
  type DownloadJobsBridge,
  type SubmitDownloadJobBridgeInput,
  DownloadJobSubmitError,
  createDownloadJobsBridge,
} from '../../adapters/chrome/download-jobs-bridge';
import { type DownloadsAdapter, createDownloadsAdapter } from '../../adapters/chrome/downloads';
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
  findLatestVideoJob,
  getDownloadJobVideoId,
  sortDownloadJobsNewestFirst,
} from '../../domain/download-job/download-job';
import {
  type DownloadMode,
  type DownloadOptions,
  type FileExtension,
  DEFAULT_DOWNLOAD_OPTIONS,
  getFileExtension,
  mergeStoredDownloadOptions,
  normalizeApiBaseUrl,
  normalizeSourceUrl,
  parseYoutubeVideoId,
} from '../../domain/download-options/download-options';
import {
  DEFAULT_QUALITY_OPTION,
  parseQualityOption,
  toDownloadQuality,
} from '../../domain/download-options/quality-options';
import {
  CHECKING_SERVER_STATUS,
  DOWNLOAD_STARTED_STATUS,
  INVALID_SOURCE_URL_STATUS,
  JOB_PROCESSING_STATUS,
  JOB_QUEUED_STATUS,
  MISSING_SOURCE_URL_STATUS,
  OPTIONS_SAVE_FAILED_STATUS,
  type PopupStatus,
  type PopupView,
  SERVER_UNREACHABLE_STATUS,
  type StagePhase,
  type StageSource,
  type TabVideo,
  createDownloadFailedStatus,
  createReadyStatus,
  deriveStageSource,
  hasStageVideo,
  isStagePhaseBusy,
  isStagePhaseProblem,
  parseYoutubeTabTitle,
} from '../../domain/popup-state/popup-state';
import { buildTitleFilenameStem, sanitizeFilenameStem } from '../../shared/sanitize-filename';
import {
  type PopupRecentRequest,
  type RecentActionResult,
  createPopupRecentRequestActions,
} from './popup-recent-requests';
import {
  type YoutubeOverlaySnapshot,
  createYoutubeOverlayPermission,
  createYoutubeOverlaySnapshot,
} from './youtube-overlay-permission';

export type { PopupRecentRequest, RecentActionResult } from './popup-recent-requests';
export type {
  YoutubeOverlayIndicator,
  YoutubeOverlaySnapshot,
  YoutubeOverlayStatus,
} from './youtube-overlay-permission';

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
  /** 최근 요청의 다시 내려받기에 쓰는 Chrome downloads adapter. */
  downloads: DownloadsAdapter;
};

/** job에 보관 일수가 없을 때 안내할 완료 파일 보관 일수. */
export const DEFAULT_RETENTION_DAYS = 7;

/** Popup 화면 snapshot. */
export type PopupDownloadSnapshot = {
  /** 지금 보이는 Popup 화면. */
  view: PopupView;
  /** 다운로드 가능 여부. */
  canDownload: boolean;
  /** 끝나지 않은 job이 하나라도 있는지 여부. 무대 영상과 관계없이 최근 요청 전체를 본다. */
  downloading: boolean;
  /** 무대 영상의 제출이 job 생성 응답을 기다리는지 여부. */
  submitting: boolean;
  /** 최근 job 목록. 최신순으로 정렬한다. */
  jobs: DownloadJob[];
  /** 최근 job 목록에서 도출한 최근 요청 표시 정보. jobs와 같은 순서다. */
  recentRequests: PopupRecentRequest[];
  /** 마지막 최근 요청 행동의 결과. 다음 행동을 시작하거나 화면을 바꾸면 비운다. */
  recentActionResult: RecentActionResult | null;
  /** 현재 form option. */
  options: DownloadOptions;
  /** 현재 상태. */
  status: PopupStatus;
  /** 무대에 올릴 원본. 원본 URL과 활성 탭 영상에서 도출한다. */
  stageSource: StageSource;
  /** 무대 위 진행 단계. 현재 무대 영상의 최신 job을 기준으로 도출한다. */
  stagePhase: StagePhase;
  /** 무대 아래 제목 줄에 보일 저장 파일명(확장자 제외). 편집값을 정리한 값이고, 없으면 기본 이름이다. 무대 영상이 없으면 빈 문자열이다. */
  stageFilename: string;
  /** 지금 형식으로 저장될 파일의 확장자. */
  fileExtension: FileExtension;
  /** YouTube 썸네일 Overlay 상태. */
  youtubeOverlay: YoutubeOverlaySnapshot;
  /** 설정 화면에 안내할 완료 파일 보관 일수. 최신 job의 보관 일수이고, job이 없으면 기본 7일이다. */
  retentionDays: number;
};

/** Popup model. */
export type PopupDownloadModel = {
  /** 현재 snapshot을 반환한다. */
  getSnapshot(): PopupDownloadSnapshot;
  /** Popup 초기화를 수행한다. */
  initialize(): Promise<void>;
  /** YouTube 썸네일 Overlay를 활성화한다. 거부·오류 뒤의 권한 다시 요청도 같은 동작이다. */
  activateYoutubeOverlay(): Promise<void>;
  /** YouTube 선택 Host Permission을 해제해 이후 썸네일 버튼 자동 주입을 멈춘다. */
  deactivateYoutubeOverlay(): Promise<void>;
  /** Popup 안의 화면을 바꾼다. */
  openView(view: PopupView): void;
  /** 무대에 남은 완료·실패 표시를 걷고 준비 상태로 돌아간다. */
  returnToForm(): Promise<void>;
  /** Snapshot 변경 구독을 등록한다. */
  subscribe(listener: () => void): () => void;
  /** 최근 요청 항목의 행동(다시 내려받기·다시 시도·다시 요청)을 실행한다. 행동이 없는 항목이면 아무것도 하지 않는다. */
  runRecentRequestAction(jobId: string): Promise<void>;
  /** 추출을 제출한다. 무대가 실패를 보여 주는 중이면 실패한 요청과 같은 조건으로 다시 제출한다. */
  submitDownload(): Promise<void>;
  /** Form option 변경을 처리한다. */
  updateOption<Key extends keyof DownloadOptions>(
    key: Key,
    value: DownloadOptions[Key],
  ): Promise<void>;
};

/** 초기 popup snapshot. */
const INITIAL_SNAPSHOT: PopupDownloadSnapshot = {
  view: 'main',
  canDownload: false,
  downloading: false,
  submitting: false,
  jobs: [],
  recentRequests: [],
  recentActionResult: null,
  options: DEFAULT_DOWNLOAD_OPTIONS,
  status: MISSING_SOURCE_URL_STATUS,
  stageSource: { kind: 'empty' },
  stagePhase: 'idle',
  stageFilename: '',
  fileExtension: 'mp3',
  youtubeOverlay: createYoutubeOverlaySnapshot('checking'),
  retentionDays: DEFAULT_RETENTION_DAYS,
};

/** 완료 덮개를 보여 준 뒤 준비 상태로 돌아가기까지의 시간(ms). */
export const STAGE_DONE_DISPLAY_MS = 1800;

/** job 진행 단계 순서. 낮은 값이 이전 단계다. completed/failed는 동일하게 최종 단계로 취급한다. */
const JOB_STATUS_RANK: Record<DownloadJobStatus, number> = {
  completed: 2,
  failed: 2,
  processing: 1,
  queued: 0,
};

/** job이 만들어지기 전에 끝난 제출 실패. job이 없어 저장소에 남지 않으므로 model이 직접 들고 있는다. */
type SubmitFailure = {
  /** 제출한 영상 ID. 무대 영상이 이 영상일 때만 보여준다. */
  videoId: string;
  /** 무대에 보일 실패 단계. */
  phase: Extract<StagePhase, 'failed' | 'unreachable'>;
  /** 서버나 확장이 알려 준 실패 이유. */
  message: string;
  /** 다시 시도할 때 그대로 보낼 제출 입력. */
  request: SubmitDownloadJobBridgeInput;
  /** 실패 당시 그 영상의 최신 job ID. 이후 다른 경로로 새 job이 생기면 실패 대신 그 job을 보여준다. */
  latestJobId: string | null;
};

/** 무대 영상 기준으로 도출한 진행 상황. */
type StageProgress = {
  /** 무대 진행 단계. */
  phase: StagePhase;
  /** 실패 단계일 때 보여 줄 이유. */
  failureMessage: string | null;
  /** 단계의 근거가 된 무대 영상의 최신 job. job과 무관한 단계면 null이다. */
  job: DownloadJob | null;
};

/** 아직 끝나지 않은 job인지 확인한다. */
function isUnsettledJob(job: DownloadJob): boolean {
  return job.status === 'queued' || job.status === 'processing';
}

/** Chrome runtime용 popup model을 만든다. */
export function createChromePopupDownloadModel(): PopupDownloadModel {
  return createPopupDownloadModel({
    storage: createStorageAdapter(),
    downloadJobs: createDownloadJobsBridge(),
    tabs: createTabsAdapter(),
    youtubeOverlay: createYoutubeOverlayAdapter(),
    downloads: createDownloadsAdapter(),
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
  /** 초기화로 저장된 job 목록을 처음 읽었는지 여부. 이후 새로 나타난 job은 이번 Popup에서 지켜본 job이다. */
  let isInitialized = false;
  /** Popup을 열 때 활성 탭에서 읽은 YouTube 영상. YouTube 영상 탭이 아니면 null이다. */
  let tabVideo: TabVideo | null = null;
  /** job 생성 응답을 기다리는 제출의 영상 ID. 같은 영상의 중복 제출만 막는다. */
  const submittingVideoIds = new Set<string>();
  /** job 없이 끝난 마지막 제출 실패. */
  let submitFailure: SubmitFailure | null = null;
  /** 형식·품질 저장에 실패했는지 여부. 다음 옵션 변경까지 알린다. */
  let optionsSaveFailed = false;
  /** 지금까지 본 job ID. 초기화 뒤 처음 보이는 job을 가려내는 데 쓴다. */
  const knownJobIds = new Set<string>();
  /** 이번 Popup에서 진행을 지켜본 job ID. 이 job이 끝나야만 완료·실패를 무대에 띄운다. */
  const observedJobIds = new Set<string>();
  /** 완료·실패 표시를 이미 걷어 낸 job ID. job 상태는 그대로 두고 무대만 준비 상태로 돌린다. */
  const acknowledgedJobIds = new Set<string>();
  /** 완료 덮개를 걷어 낼 timer를 이미 건 job ID. */
  const scheduledDoneJobIds = new Set<string>();
  /** job별 마지막 상태. 제출 응답과 storage 구독이 서로 다른 시점에 도착해도 되돌리지 않는다. */
  const lastAppliedJobs = new Map<string, DownloadJob>();
  /** 최근 요청 표시 정보와 항목 행동. */
  const recentRequestActions = createPopupRecentRequestActions(dependencies);
  /** 썸네일 버튼 권한 창구. 바뀐 권한 상태를 바로 화면에 반영한다. */
  const youtubeOverlayPermission = createYoutubeOverlayPermission(dependencies.youtubeOverlay, (youtubeOverlay) =>
    refresh({ youtubeOverlay }),
  );

  /** 한 영상의 요청이 제출 중이거나 아직 끝나지 않았는지 확인한다. 같은 영상의 중복 제출을 막는 데 쓴다. */
  function isVideoInProgress(videoId: string | null, jobs: readonly DownloadJob[]): boolean {
    if (!videoId) {
      return false;
    }

    return (
      submittingVideoIds.has(videoId) ||
      jobs.some((job) => isUnsettledJob(job) && getDownloadJobVideoId(job) === videoId)
    );
  }

  /** 무대 영상의 최신 job과 이번 Popup의 제출 상태로 무대 단계를 도출한다. */
  function deriveStageProgress(
    stageVideoId: string | null,
    jobs: readonly DownloadJob[],
  ): StageProgress {
    if (!stageVideoId) {
      return { failureMessage: null, job: null, phase: 'idle' };
    }

    if (submittingVideoIds.has(stageVideoId)) {
      return { failureMessage: null, job: null, phase: 'checking' };
    }

    /** 무대 영상의 최신 job. 목록은 최신순이다. */
    const job = findLatestVideoJob(jobs, stageVideoId);

    if (submitFailure?.videoId === stageVideoId && submitFailure.latestJobId === (job?.jobId ?? null)) {
      return { failureMessage: submitFailure.message, job: null, phase: submitFailure.phase };
    }

    if (!job) {
      return { failureMessage: null, job: null, phase: 'idle' };
    }

    if (job.status === 'queued') return { failureMessage: null, job, phase: 'queued' };
    if (job.status === 'processing') return { failureMessage: null, job, phase: 'processing' };

    // Popup을 열기 전에 이미 끝난 job이나 표시를 걷어 낸 job은 무대에 다시 띄우지 않는다.
    if (
      !observedJobIds.has(job.jobId) ||
      acknowledgedJobIds.has(job.jobId) ||
      job.displayStatus === 'expired'
    ) {
      return { failureMessage: null, job, phase: 'idle' };
    }

    return job.status === 'completed'
      ? { failureMessage: null, job, phase: 'done' }
      : { failureMessage: job.message, job, phase: 'failed' };
  }

  /** 원본 주소와 API 주소가 제출 가능한 값인지 확인한다. */
  function isSubmittableSource(options: DownloadOptions): boolean {
    try {
      normalizeApiBaseUrl(options.apiBaseUrl);
      normalizeSourceUrl(options.sourceUrl);

      return true;
    } catch {
      return false;
    }
  }

  /** 원본 상태와 무대 단계를 Popup 안내 상태로 바꾼다. */
  function derivePopupStatus(
    stageSource: StageSource,
    progress: StageProgress,
  ): PopupStatus {
    if (stageSource.kind === 'empty') return MISSING_SOURCE_URL_STATUS;
    if (stageSource.kind === 'invalid') return INVALID_SOURCE_URL_STATUS;

    switch (progress.phase) {
      case 'checking':
        return CHECKING_SERVER_STATUS;
      case 'queued':
        return JOB_QUEUED_STATUS;
      case 'processing':
        return JOB_PROCESSING_STATUS;
      case 'done':
        return DOWNLOAD_STARTED_STATUS;
      case 'failed':
        return createDownloadFailedStatus(progress.failureMessage ?? '추출하지 못했어요.');
      case 'unreachable':
        return SERVER_UNREACHABLE_STATUS;
      default:
        return optionsSaveFailed ? OPTIONS_SAVE_FAILED_STATUS : createReadyStatus();
    }
  }

  /** 현재 무대 영상의 진행 상황을 다시 계산한다. */
  function getCurrentStageProgress(): StageProgress {
    return deriveStageProgress(getStageVideoId(snapshot.stageSource), snapshot.jobs);
  }

  /** 입력 상태를 바꾸고 도출 값(무대 원본·단계·제출 가능 여부·안내 상태)을 모두 다시 계산한다. */
  function refresh(
    changes: Partial<
      Pick<
        PopupDownloadSnapshot,
        'jobs' | 'options' | 'recentActionResult' | 'view' | 'youtubeOverlay'
      >
    > = {},
  ) {
    /** 바뀐 입력 상태. */
    const base = { ...snapshot, ...changes };
    /** 원본 URL과 활성 탭 영상, 그 영상의 최신 job 제목으로 도출한 무대 원본. */
    const stageSource = deriveStageSource(
      base.options.sourceUrl,
      tabVideo,
      (videoId) => findLatestVideoJob(base.jobs, videoId)?.title ?? null,
    );
    /** 무대 영상 ID. */
    const stageVideoId = getStageVideoId(stageSource);
    /** 무대 진행 상황. */
    const progress = deriveStageProgress(stageVideoId, base.jobs);

    snapshot = {
      ...base,
      canDownload:
        stageVideoId !== null &&
        isSubmittableSource(base.options) &&
        !isStagePhaseBusy(progress.phase),
      downloading: base.jobs.some(isUnsettledJob),
      retentionDays: base.jobs[0]?.retentionDays ?? DEFAULT_RETENTION_DAYS,
      fileExtension: getFileExtension(base.options.mode),
      recentRequests: recentRequestActions.describe(
        base.jobs,
        (videoId) => isVideoInProgress(videoId, base.jobs),
        Date.now(),
      ),
      stageFilename: resolveStageFilename(
        base.options.filename,
        stageSource,
        getFileExtension(base.options.mode),
      ),
      stagePhase: progress.phase,
      stageSource,
      status: derivePopupStatus(stageSource, progress),
      submitting: stageVideoId !== null && submittingVideoIds.has(stageVideoId),
    };

    if (progress.phase === 'done' && progress.job) {
      scheduleDoneDismissal(progress.job.jobId);
    }

    listeners.forEach((listener) => listener());
  }

  /** 완료 덮개를 잠시 보여 준 뒤 걷어 낸다. job 상태는 바꾸지 않는다. */
  function scheduleDoneDismissal(jobId: string) {
    if (scheduledDoneJobIds.has(jobId)) {
      return;
    }

    scheduledDoneJobIds.add(jobId);
    setTimeout(function dismissDoneStage() {
      acknowledgedJobIds.add(jobId);
      refresh();
    }, STAGE_DONE_DISPLAY_MS);
  }

  /** 무대에 남은 실패·완료 표시를 걷는다. 사용자가 조건을 바꾸거나 다시 제출할 때 쓴다. */
  function dismissStageResult() {
    /** 걷어 내기 전 무대 진행 상황. */
    const progress = getCurrentStageProgress();

    submitFailure = null;

    if (progress.job && (progress.phase === 'failed' || progress.phase === 'done')) {
      acknowledgedJobIds.add(progress.job.jobId);
    }
  }

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

  /** job을 이번 Popup에서 지켜볼 대상인지 기록한다. 진행 중이었거나 초기화 뒤 새로 생긴 job이 대상이다. */
  function observeJob(job: DownloadJob) {
    if (isUnsettledJob(job) || (isInitialized && !knownJobIds.has(job.jobId))) {
      observedJobIds.add(job.jobId);
    }

    knownJobIds.add(job.jobId);
  }

  /** 저장소에서 온 목록의 각 job을 순서 역행 없이 병합한다. */
  function mergeJobList(jobs: readonly DownloadJob[]): DownloadJob[] {
    return sortDownloadJobsNewestFirst(
      jobs.map((job) => {
        observeJob(job);

        return acceptJobUpdate(job) ? job : lastAppliedJobs.get(job.jobId) ?? job;
      }),
    );
  }

  /** 현재 snapshot의 job 하나를 목록에 추가하거나 갱신한다. */
  function upsertJob(job: DownloadJob): DownloadJob[] {
    const jobsById = new Map(snapshot.jobs.map((item) => [item.jobId, item]));

    jobsById.set(job.jobId, job);

    return sortDownloadJobsNewestFirst([...jobsById.values()]);
  }

  /** 지금 무대에서 보낼 제출 입력을 만든다. 실패를 다시 시도하면 실패한 요청의 조건을 그대로 쓴다. */
  function buildSubmitRequest(progress: StageProgress): SubmitDownloadJobBridgeInput {
    /** 제출 시점의 옵션. */
    const options = snapshot.options;

    if (!isStagePhaseProblem(progress.phase)) {
      return {
        apiBaseUrl: options.apiBaseUrl,
        localFilename: buildLocalFilename(snapshot.stageFilename, options.mode),
        mode: options.mode,
        quality: resolveJobQuality(options),
        sourceUrl: options.sourceUrl,
      };
    }

    // job 없이 끝난 실패는 보냈던 입력을 그대로 다시 보낸다.
    if (!progress.job && submitFailure) {
      return submitFailure.request;
    }

    /** 다시 시도할 형식. */
    const mode = progress.job?.type ?? options.mode;

    // 접수 뒤 실패한 job은 그 job의 원본·형식·품질로 다시 보낸다. Popup을 다시 열어 옵션이 달라졌어도 같은 조건이 된다.
    return {
      apiBaseUrl: options.apiBaseUrl,
      localFilename: buildLocalFilename(snapshot.stageFilename, mode),
      mode,
      quality: progress.job?.quality ?? resolveJobQuality(options),
      sourceUrl: progress.job?.sourceUrl ?? options.sourceUrl,
    };
  }

  // Popup이 열려 있는 동안 Background가 기록한 job 상태 변경을 새로고침 없이 반영한다.
  dependencies.downloadJobs.subscribeJobs((jobs) => {
    refresh({ jobs: mergeJobList(jobs) });
  });

  return {
    getSnapshot() {
      return snapshot;
    },
    async initialize() {
      /** 저장된 option. */
      let options = DEFAULT_DOWNLOAD_OPTIONS;

      try {
        options = await dependencies.storage.loadOptions();
      } catch {
        // storage 자체가 실패해도 고정 품질 선택지가 유효한 기본값으로 채워지게 병합 경로를 그대로 탄다.
        options = mergeStoredDownloadOptions({});
      }

      /** YouTube 썸네일 Overlay 권한 상태. */
      const youtubeOverlay = await youtubeOverlayPermission.readInitial();

      /** 활성 탭에서 자동 지정할 원본 URL. YouTube 영상 탭이 아니거나 읽지 못하면 비운다. */
      let tabSourceUrl = '';

      try {
        /** 현재 활성 탭. */
        const currentTab = await dependencies.tabs.getCurrentTab();
        /** 활성 탭 주소의 YouTube 영상 ID. */
        const videoId = parseYoutubeVideoId(currentTab.url);

        if (videoId) {
          tabSourceUrl = normalizeSourceUrl(currentTab.url);
          tabVideo = { title: parseYoutubeTabTitle(currentTab.title), videoId };
        }
      } catch {
        // 탭을 읽지 못하면 원본 없이 붙여넣기 칸에서 시작한다.
      }

      // 원본 URL과 파일명은 저장하지 않으므로 활성 탭에서 매번 새로 정한다.
      // 예전 버전이 저장해 둔 파일명이 섞여 들어와도 버린다.
      options = {
        ...options,
        filename: '',
        sourceUrl: tabSourceUrl,
      };

      /** Background가 저장해 둔 최근 job 목록. */
      let jobs: DownloadJob[] = [];

      try {
        jobs = await dependencies.downloadJobs.getJobs();
      } catch {
        jobs = [];
      }

      /** 초기화 중 먼저 반영된 job 목록이 있으면 그 목록을 유지한다. */
      const jobsToApply = snapshot.jobs.length ? snapshot.jobs : jobs;

      refresh({
        jobs: mergeJobList(jobsToApply),
        options: hasUserInteracted ? snapshot.options : options,
        // 초기화 중 사용자가 이미 권한을 바꿨다면 그 결과가 더 최신이다.
        youtubeOverlay: snapshot.youtubeOverlay.status !== 'checking' ? snapshot.youtubeOverlay : youtubeOverlay,
      });
      isInitialized = true;
    },
    activateYoutubeOverlay() {
      return youtubeOverlayPermission.activate();
    },
    deactivateYoutubeOverlay() {
      return youtubeOverlayPermission.deactivate();
    },
    openView(view) {
      // 이전 화면에서 실패한 최근 요청 행동의 이유는 다른 화면으로 옮겨 가면 의미가 없다.
      refresh({ recentActionResult: null, view });
    },
    async returnToForm() {
      // 원본과 옵션은 그대로 두어 사용자가 설정만 고쳐 재요청할 수 있게 한다.
      dismissStageResult();
      refresh();
    },
    async runRecentRequestAction(jobId) {
      /** 행동을 실행할 최근 요청. */
      const request = snapshot.recentRequests.find((item) => item.jobId === jobId);
      /** 그 요청의 원본 job. */
      const job = snapshot.jobs.find((item) => item.jobId === jobId);

      if (!recentRequestActions.canRun(request) || !job) {
        return;
      }

      /** 행동 결과와 새로 생긴 job. */
      const { result, submittedJob } = await recentRequestActions.run(
        request,
        job,
        snapshot.options.apiBaseUrl,
        () => refresh({ recentActionResult: null }),
      );

      if (submittedJob) {
        // 이번 Popup이 보낸 job이므로 무대 영상과 같으면 완료·실패 덮개까지 지켜본다.
        observedJobIds.add(submittedJob.jobId);
        knownJobIds.add(submittedJob.jobId);
      }

      refresh({
        jobs: submittedJob && acceptJobUpdate(submittedJob) ? upsertJob(submittedJob) : snapshot.jobs,
        recentActionResult: result,
      });
    },
    subscribe(listener) {
      listeners.add(listener);

      return function unsubscribePopupDownloadModel() {
        listeners.delete(listener);
      };
    },
    async submitDownload() {
      hasUserInteracted = true;

      /** 제출할 무대 영상 ID. */
      const videoId = getStageVideoId(snapshot.stageSource);

      if (!snapshot.canDownload || !videoId || submittingVideoIds.has(videoId)) {
        return;
      }

      /** 제출 입력. 실패 다시 시도면 실패한 요청과 같은 조건이다. */
      const request = buildSubmitRequest(getCurrentStageProgress());

      dismissStageResult();
      submittingVideoIds.add(videoId);
      refresh();

      try {
        // job 생성과 상태 추적은 Background가 전담한다 — 여기서는 생성 직후 상태만 받고,
        // 이후 진행 상황은 subscribeJobs 구독으로 반영된다.
        const job = await dependencies.downloadJobs.submitJob(request);

        submittingVideoIds.delete(videoId);
        // 이번 Popup이 보낸 job이므로 응답이 이미 완료 상태여도 완료 덮개를 띄운다.
        observedJobIds.add(job.jobId);
        knownJobIds.add(job.jobId);

        // 응답이 늦게 도착해 storage 구독이 이미 더 진행된 상태를 반영했다면 되돌리지 않는다.
        refresh({ jobs: acceptJobUpdate(job) ? upsertJob(job) : snapshot.jobs });
      } catch (error) {
        submittingVideoIds.delete(videoId);
        submitFailure = {
          latestJobId: findLatestVideoJob(snapshot.jobs, videoId)?.jobId ?? null,
          message:
            error instanceof Error && error.message ? error.message : '추출 요청에 실패했어요.',
          phase:
            error instanceof DownloadJobSubmitError && error.failure === 'unreachable'
              ? 'unreachable'
              : 'failed',
          request,
          videoId,
        };
        refresh();
      }
    },
    async updateOption(key, value) {
      // 진행 중에 이름을 바꾸면 이미 보낸 요청의 저장 이름과 화면이 어긋나므로 받지 않는다.
      if (key === 'filename' && isStagePhaseBusy(snapshot.stagePhase)) {
        return;
      }

      hasUserInteracted = true;
      // 조건이 바뀌면 이전 실패·완료 표시는 더 이상 이 요청의 결과가 아니다.
      dismissStageResult();
      optionsSaveFailed = false;

      /** 변경된 다운로드 옵션. */
      const options = {
        ...snapshot.options,
        [key]: value,
      };

      // 파일명은 영상별 값이라 원본 영상이 바뀌면 이전 영상에서 고친 이름을 버린다.
      if (
        key === 'sourceUrl' &&
        parseYoutubeVideoId(options.sourceUrl) !== getStageVideoId(snapshot.stageSource)
      ) {
        options.filename = '';
      }

      refresh({ options });

      // 원본 URL과 파일명은 session-only 입력이므로 Chrome storage 저장에서 제외한다.
      if (key === 'sourceUrl' || key === 'filename') {
        return;
      }

      try {
        await dependencies.storage.saveOptions(options);
      } catch {
        optionsSaveFailed = true;
        refresh();
      }
    },
  };
}

/** 무대에 올라온 영상 ID를 얻는다. 붙여넣기 칸 상태면 null이다. */
function getStageVideoId(stageSource: StageSource): string | null {
  return hasStageVideo(stageSource) ? stageSource.videoId : null;
}

/** 현재 모드에 해당하는 고정 품질 값을 job 생성 입력값으로 바꾼다. 팝업은 서버가 지원하는 고정 선택지만 노출하므로 기본값으로 돌아가는 일은 없다. */
function resolveJobQuality(options: DownloadOptions): DownloadQuality {
  /** 현재 모드의 선택 품질 문자열. */
  const selectedQuality = options.mode === 'audio' ? options.bitrate : options.resolution;

  return toDownloadQuality(parseQualityOption(options.mode, selectedQuality) ?? DEFAULT_QUALITY_OPTION[options.mode]);
}

/** 무대 영상의 저장 파일명(확장자 제외)을 정한다. 편집값을 정리해 쓰고, 비거나 상대 경로 표기만 남으면 제목 기반 기본 이름(실패 시 영상 ID)으로 돌아간다. */
function resolveStageFilename(
  editedFilename: string,
  stageSource: StageSource,
  extension: FileExtension,
): string {
  if (!hasStageVideo(stageSource)) {
    return '';
  }

  /** 입력칸 옆에 이미 보이는 확장자까지 입력했다면 떼어 내 확장자가 두 번 붙지 않게 한다. */
  const withoutExtension = editedFilename.trim().replace(new RegExp(`\\.${extension}$`, 'i'), '');
  /** 경로 구분자·제어 문자를 정리한 편집값. */
  const sanitized = sanitizeFilenameStem(withoutExtension);

  return sanitized || buildTitleFilenameStem(stageSource.title ?? '', stageSource.videoId);
}

/** 로컬 저장에 넘길 파일명. 입력칸 옆에 보인 확장자를 그대로 붙인다. */
function buildLocalFilename(stageFilename: string, mode: DownloadMode): string {
  return `${stageFilename}.${getFileExtension(mode)}`;
}
