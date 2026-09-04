import { zodResolver } from '@hookform/resolvers/zod';
import { type ChangeEvent, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import {
  AUDIO_QUALITY_OPTIONS,
  type DownloadDraft,
  type DownloadDisplayStatus,
  type DownloadResponse,
  INITIAL_DOWNLOAD_DRAFT,
  VIDEO_QUALITY_OPTIONS,
  downloadDraftSchema,
  getDefaultDownloadQuality,
  validateDownloadDraft,
} from '../../../../domain/download-request/download-request';
import {
  type UserVisibleErrorDetail,
  WorkerUnavailableError,
  buildApiUrl,
} from '../../../../api/mytube-extract.api';
import { createVideoRequestAdapter } from '../../../adapters/video-request.adapter';
import { useNavigation } from '../../../components/navigation-context';
import { type AppIconName } from '../../../components/app-icon';
import { ROUTE_PATHS } from '../../../constants/route-paths.constant';
import {
  type RequestLifecyclePresentationInput,
  useExtractionRequestLifecycle,
} from '../../../hooks/use-extraction-request-lifecycle';
import {
  createJobStatusRequestErrorDetail,
  createTerminalJobErrorDetail,
} from '../../../utils/job-status-polling.util';
import {
  getRequestPreferences,
  setDownloadPreferences,
} from '../../../utils/request-preference.util';
import {
  getWorkerHealthSubmitReason,
} from '../../../utils/worker-health-notice.util';
import { isUnmodifiedShortcut } from '../../../utils/keyboard-shortcut.util';

/** worker 미가용 안내 문구. */
const WORKER_UNAVAILABLE_MESSAGE =
  '현재 추출 서버가 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.';

/** worker 미가용 상세 원인. */
const WORKER_UNAVAILABLE_DETAIL: UserVisibleErrorDetail = {
  code: 'WORKER_UNAVAILABLE',
  guidance: '추출 서버가 작업을 받을 수 없는 상태입니다.',
  location: '서비스 상태 확인',
  requestPath: '/health',
};

/** worker health 조회 실패 상세 원인. */
const WORKER_HEALTH_FAILED_DETAIL: UserVisibleErrorDetail = {
  code: 'SERVICE_STATUS_CHECK_FAILED',
  guidance: '서비스 상태를 확인할 수 없습니다.',
  location: '서비스 상태 확인',
  requestPath: '/health',
};

/** 영상 추출 route의 form, polling, 표시 상태를 조합한다. */
export function useVideoExtractLogic() {
  // Variables.

  /** 현재 API base URL. */
  const apiBaseUrl = getApiBaseUrl();

  // Hooks.

  /** 다운로드 입력 form 상태. */
  const {
    handleSubmit,
    register,
    setFocus,
    setValue,
    watch,
    formState: { isValid },
  } = useForm<DownloadDraft>({
    defaultValues: {
      ...INITIAL_DOWNLOAD_DRAFT,
      ...getRequestPreferences().download,
    },
    mode: 'onChange',
    resolver: zodResolver(downloadDraftSchema),
  });
  /** 추출 진행 중 route 이동 차단 상태를 갱신한다. */
  const { setHistoryDestination, setNavigationLocked } = useNavigation();
  /** 현재 form 입력값. */
  const draft = watch();
  /** 현재 입력 검증 결과. */
  const validation = validateDownloadDraft(draft);
  /** 영상 요청 통신을 lifecycle adapter seam에 연결한다. */
  const videoRequestAdapter = useMemo(
    () => createVideoRequestAdapter({ apiBaseUrl }),
    [apiBaseUrl],
  );
  /** 영상 route가 사용하는 추출 요청 생명주기 deep module. */
  const requestLifecycle = useExtractionRequestLifecycle({
    adapter: videoRequestAdapter,
    createPresentation: (lifecycle) =>
      createVideoLifecyclePresentation({
        apiBaseUrl,
        draft,
        isValid,
        lifecycle,
        validation,
      }),
    historyPath: ROUTE_PATHS.history,
    messages: {
      cancelled:
        '요청을 중단했습니다. 입력한 설정은 그대로입니다. 다시 요청할 수 있습니다.',
      unavailable: WORKER_UNAVAILABLE_MESSAGE,
    },
    navigation: {
      setHistoryDestination,
      setLocked: setNavigationLocked,
    },
  });

  // Computed.

  /** 현재 품질 선택지. */
  const qualityOptions =
    draft.mode === 'audio' ? AUDIO_QUALITY_OPTIONS : VIDEO_QUALITY_OPTIONS;
  /** lifecycle interface가 최종 우선순위를 적용한 영상 표시 모델. */
  const {
    canSubmit,
    createdTime,
    downloadHref,
    filledProgressCells,
    isSubmitting,
    progressLabel,
    requestNotice,
    statusErrorDetail,
    statusIconName,
    statusJob,
    statusMessage,
    statusQualityLabel,
    statusTitle,
    statusTone,
    statusTypeLabel,
    submitDisabledReason,
    viewPhase,
    workerHealthDetail,
    workerHealthFailed,
    workerHealthCheckedAt,
    workerHealthIsFetching,
    workerHealthIsRefreshing,
    workerHealthStatus,
  } = requestLifecycle.presentation;

  // Functions.

  /** API base URL 환경 설정을 반환한다. */
  function getApiBaseUrl() {
    return (
      import.meta.env.VITE_MYTUBE_EXTRACT_API_BASE_URL ??
      import.meta.env.VITE_MEDIA_NEST_API_BASE_URL
    );
  }

  /** 입력 변경 후 이전 실패 상태를 초기화한다. */
  function clearRequestError() {
    requestLifecycle.actions.clearRequestError();
  }

  /** 요청 중단 뒤 현재 화면의 첫 입력 또는 상태 재확인 control로 focus를 돌린다. */
  function focusRequestStart() {
    window.requestAnimationFrame(() => {
      const sourceUrlInput = document.querySelector<HTMLInputElement>(
        'input[name="sourceUrl"]',
      );

      if (sourceUrlInput) {
        sourceUrlInput.focus();
        return;
      }

      document
        .querySelector<HTMLButtonElement>('.worker-health-status__retry')
        ?.focus();
    });
  }

  /** 서버 job 생성 전 현재 요청만 중단하고 입력 상태를 유지한다. */
  function cancelRequest() {
    if (!requestLifecycle.actions.cancel?.()) {
      return;
    }

    focusRequestStart();
  }

  /** 요청 오류에서 기존 입력을 유지한 채 요청 화면으로 돌아간다. */
  function returnToRequest() {
    requestLifecycle.actions.reset?.();
    focusRequestStart();
  }

  // Effects.

  useEffect(
    function persistDownloadPreferences() {
      setDownloadPreferences({ mode: draft.mode, quality: draft.quality });
    },
    [draft.mode, draft.quality],
  );

  useEffect(
    function registerVideoRequestShortcut() {
      function handleShortcut(event: KeyboardEvent) {
        if (!isUnmodifiedShortcut(event, 'KeyU')) {
          return;
        }

        const sourceUrlInput = document.querySelector<HTMLInputElement>(
          'input[name="sourceUrl"]',
        );

        if (!sourceUrlInput) {
          return;
        }

        event.preventDefault();
        sourceUrlInput.focus();
      }

      window.addEventListener('keydown', handleShortcut);
      return () => window.removeEventListener('keydown', handleShortcut);
    },
  );

  // Handlers.

  /** 다운로드 형식 변경 이벤트를 처리한다. */
  function handleModeChange(event: ChangeEvent<HTMLInputElement>) {
    clearRequestError();
    setValue(
      'quality',
      getDefaultDownloadQuality(event.target.value as DownloadDraft['mode']),
      {
        shouldDirty: true,
        shouldValidate: true,
      },
    );
  }

  /** YouTube URL 입력값을 비우고 다시 입력할 수 있게 focus를 돌린다. */
  function handleSourceUrlReset() {
    clearRequestError();
    setValue('sourceUrl', '', {
      shouldDirty: true,
      shouldValidate: true,
    });
    setFocus('sourceUrl');
  }

  /** 다운로드 실행 submit 이벤트를 처리한다. */
  async function handleDownloadSubmit(validDraft: DownloadDraft) {
    if (requestLifecycle.actions.submit) {
      requestLifecycle.actions.submit(validDraft);
    }
  }

  return {
    canSubmit,
    clearRequestError,
    createdTime,
    downloadHref,
    draft,
    filledProgressCells,
    handleDownloadFormSubmit: handleSubmit(handleDownloadSubmit),
    handleModeChange,
    handleSourceUrlReset,
    isDownloadPending: isSubmitting,
    progressLabel,
    qualityOptions,
    register,
    retryWorkerHealth: () => requestLifecycle.actions.retryReadiness?.(),
    statusErrorDetail,
    statusIconName,
    statusJob,
    statusMessage,
    statusQualityLabel,
    statusTitle,
    statusTone,
    statusTypeLabel,
    submitDisabledReason,
    cancelRequest,
    requestNotice,
    returnToRequest,
    validation,
    viewPhase,
    workerHealthFailed,
    workerHealthCheckedAt,
    workerHealthDetail,
    workerHealthIsFetching,
    workerHealthIsRefreshing,
    workerHealthStatus,
  };
}

/** 정규화된 lifecycle 상태를 영상 화면의 최종 표시 모델로 만든다. */
function createVideoLifecyclePresentation(input: {
  /** 현재 API base URL. */
  apiBaseUrl: string | undefined;
  /** 현재 form 입력값. */
  draft: DownloadDraft;
  /** React Hook Form 검증 통과 여부. */
  isValid: boolean;
  /** deep module이 우선순위를 적용한 lifecycle 상태. */
  lifecycle: RequestLifecyclePresentationInput<DownloadResponse>;
  /** 현재 입력 검증 결과. */
  validation: ReturnType<typeof validateDownloadDraft>;
}) {
  /** 오른쪽 status panel에 표시할 최신 job. */
  const statusJob = input.lifecycle.job ?? createIdleJob(input.draft);
  /** 현재 readiness 상태. */
  const workerHealthStatus = input.lifecycle.readiness.status;
  /** 활성 job이 없어 worker health가 현재 화면을 결정하는지 여부. */
  const workerHealthAffectsView = input.lifecycle.job === null;
  /** worker health 확인 실패 여부. */
  const workerHealthFailed =
    workerHealthAffectsView && workerHealthStatus.kind === 'failed';
  /** worker가 작업을 받을 수 없는지 여부. */
  const workerUnavailable =
    workerHealthAffectsView && workerHealthStatus.kind === 'unavailable';
  /** lifecycle이 우선순위를 정한 현재 오류. */
  const lifecycleError = input.lifecycle.error;
  /** worker health 오류 상세 원인. */
  const workerHealthErrorDetail = createWorkerHealthErrorDetail(
    input.lifecycle.readiness.error instanceof Error
      ? input.lifecycle.readiness.error
      : null,
  );
  /** 영상 job 생성 요청 오류 안내. */
  const requestError =
    lifecycleError?.source === 'request'
      ? lifecycleError.cause instanceof WorkerUnavailableError
        ? WORKER_UNAVAILABLE_MESSAGE
        : '추출 요청에 실패했습니다. 다시 시도해 주세요.'
      : '';
  /** 영상 job 생성 요청 오류 상세 원인. */
  const requestErrorDetail =
    lifecycleError?.source === 'request'
      ? createVideoRequestErrorDetail(lifecycleError.cause, requestError)
      : undefined;
  /** 현재 영상 job 상태 조회 오류 상세 원인. */
  const jobStatusRequestErrorDetail =
    lifecycleError?.source === 'status' && input.lifecycle.receipt
      ? createJobStatusRequestErrorDetail(
          lifecycleError.cause,
          input.lifecycle.receipt,
        )
      : undefined;
  /** failed·expired 영상 job 상세 원인. */
  const terminalJobErrorDetail =
    lifecycleError?.source === 'terminal' && input.lifecycle.receipt
      ? createTerminalJobErrorDetail(statusJob, input.lifecycle.receipt)
      : undefined;
  /** 현재 readiness gate에서 열어 볼 health 상세 원인. */
  const workerHealthDetail = workerHealthAffectsView
    ? workerHealthStatus.kind === 'unavailable'
      ? WORKER_UNAVAILABLE_DETAIL
      : workerHealthStatus.kind === 'failed'
        ? workerHealthErrorDetail ?? WORKER_HEALTH_FAILED_DETAIL
        : undefined
    : undefined;
  /** 현재 상태 패널 상세 원인. */
  const statusErrorDetail =
    jobStatusRequestErrorDetail ??
    terminalJobErrorDetail ??
    requestErrorDetail ??
    workerHealthDetail;
  /** API job 생성 전 요청 처리 중인지 여부. */
  const isSubmitting = input.lifecycle.isSubmitting;
  /** 추출 요청 가능 여부. */
  const canSubmit =
    input.validation.kind === 'ready' &&
    input.isValid &&
    input.lifecycle.canSubmit;
  /** 제출 버튼이 비활성화된 이유. */
  const submitDisabledReason = getWorkerHealthSubmitReason({
    healthStatus: workerHealthStatus.kind,
    isSubmitting,
  });
  /** 현재 상태 제목. */
  const statusTitle =
    (isSubmitting ? '추출 요청을 준비하고 있습니다' : '') ||
    (requestError ? '추출 요청에 실패했습니다' : '') ||
    (jobStatusRequestErrorDetail ? '작업 상태를 확인할 수 없습니다' : '') ||
    (workerHealthAffectsView
      ? createWorkerHealthTitle({
          failed: workerHealthFailed,
          unavailable: workerUnavailable,
        })
      : '') ||
    createStatusTitle(statusJob);
  /** 현재 상태 문구. */
  const statusMessage =
    (isSubmitting ? '요청을 접수하고 있습니다.' : '') ||
    requestError ||
    jobStatusRequestErrorDetail?.guidance ||
    (workerHealthAffectsView && workerHealthStatus.kind !== 'ready'
      ? workerHealthStatus.message
      : '') ||
    statusJob.message ||
    input.validation.message;

  return {
    canSubmit,
    createdTime: formatTime(statusJob.createdAt),
    downloadHref: statusJob.downloadUrl
      ? buildApiUrl(statusJob.downloadUrl, input.apiBaseUrl)
      : '',
    filledProgressCells:
      statusJob.progress === null ? 0 : Math.round(statusJob.progress / 10),
    isSubmitting,
    progressLabel: createProgressLabel(statusJob),
    requestNotice: input.lifecycle.requestNotice,
    statusErrorDetail,
    statusIconName:
      isSubmitting
        ? 'processing'
        : jobStatusRequestErrorDetail ||
            requestErrorDetail ||
            (workerHealthAffectsView &&
              (workerHealthFailed || workerUnavailable))
          ? 'failed'
          : getStatusIconName(statusJob.displayStatus),
    statusJob,
    statusMessage,
    statusQualityLabel: formatQuality(statusJob),
    statusTitle,
    statusTone:
      isSubmitting
        ? 'processing'
        : jobStatusRequestErrorDetail ||
            requestErrorDetail ||
            (workerHealthAffectsView &&
              (workerHealthFailed || workerUnavailable))
          ? 'failed'
          : statusJob.displayStatus,
    statusTypeLabel: statusJob.type === 'audio' ? '오디오' : '비디오',
    submitDisabledReason,
    viewPhase: input.lifecycle.phase,
    workerHealthDetail,
    workerHealthFailed,
    workerHealthCheckedAt: input.lifecycle.readiness.lastCheckedAt,
    workerHealthIsFetching: input.lifecycle.readiness.isFetching,
    workerHealthIsRefreshing:
      input.lifecycle.readiness.isFetching &&
      workerHealthStatus.kind === 'ready',
    workerHealthStatus,
  };
}

/** 빈 화면용 임시 상태 job을 만든다. */
export function createIdleJob(draft: DownloadDraft): DownloadResponse {
  return {
    createdAt: new Date().toISOString(),
    displayStatus: 'queued',
    downloadUrl: null,
    errorCode: null,
    jobId: '',
    message: 'YouTube URL을 입력하고 추출을 요청해 주세요.',
    progress: 0,
    quality: draft.quality,
    retentionDays: 7,
    status: 'queued',
    type: draft.mode,
  };
}

/** 상태 제목을 만든다. */
export function createStatusTitle(job: DownloadResponse) {
  if (job.displayStatus === 'queued') {
    return '작업 대기 중입니다';
  }

  if (job.displayStatus === 'processing') {
    return '파일을 추출 중입니다';
  }

  if (job.displayStatus === 'completed') {
    return '파일이 준비되었습니다';
  }

  if (job.displayStatus === 'failed') {
    return '추출에 실패했습니다';
  }

  return '보관 기간이 지났습니다';
}

/** 표시 상태에 맞는 아이콘 이름을 반환한다. */
export function getStatusIconName(status: DownloadDisplayStatus): AppIconName {
  if (status === 'completed') {
    return 'completed';
  }

  if (status === 'failed') {
    return 'failed';
  }

  if (status === 'expired') {
    return 'expired';
  }

  if (status === 'processing') {
    return 'processing';
  }

  return 'queued';
}

/** 진행률 상태 문구를 만든다. */
export function createProgressLabel(job: DownloadResponse) {
  if (job.progress === null) {
    return '--';
  }

  if (job.displayStatus === 'queued') {
    return '대기 중';
  }

  return `${job.progress}%`;
}

/** worker health 상태 제목을 만든다. */
export function createWorkerHealthTitle(input: {
  /** worker health 확인 실패 여부. */
  failed: boolean;
  /** worker 미가용 여부. */
  unavailable: boolean;
}) {
  if (input.unavailable) {
    return '추출 기능을 사용할 수 없습니다';
  }

  if (input.failed) {
    return '서비스 상태를 확인할 수 없습니다';
  }

  return '';
}

/** 영상 job 생성 오류에서 사용자 열람용 상세 정보를 만든다. */
export function createVideoRequestErrorDetail(
  error: unknown,
  guidance: string,
): UserVisibleErrorDetail {
  if (hasUserVisibleErrorDetail(error)) {
    return error.detail;
  }

  return {
    code: 'VIDEO_REQUEST_FAILED',
    guidance,
    location: '영상 추출 요청',
  };
}

/** worker health 오류에서 사용자 열람용 상세 정보를 만든다. */
export function createWorkerHealthErrorDetail(
  error: Error | null,
): UserVisibleErrorDetail | undefined {
  if (!error) {
    return undefined;
  }

  if (hasUserVisibleErrorDetail(error)) {
    return error.detail;
  }

  return {
    code: 'SERVICE_STATUS_CHECK_FAILED',
    guidance: '서비스 상태를 확인할 수 없습니다.',
    location: '서비스 상태 확인',
    requestPath: '/health',
    responseBody: error.message,
  };
}

/** 오류 객체가 사용자 열람용 상세 정보를 포함하는지 확인한다. */
export function hasUserVisibleErrorDetail(
  error: unknown,
): error is { detail: UserVisibleErrorDetail } {
  return (
    !!error && typeof error === 'object' && 'detail' in error && !!error.detail
  );
}

/** 요청 시각을 HH:mm 형식으로 표시한다. */
export function formatTime(value: string) {
  /** 날짜 파싱 결과. */
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** 품질 표시값을 만든다. */
export function formatQuality(job: DownloadResponse) {
  return job.type === 'audio' ? `${job.quality} kbps` : `${job.quality}p`;
}
