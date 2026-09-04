import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  type SubtitleJobResponse,
  type SubtitleWhisperModel,
  validateSubtitleFile,
} from '../../../../domain/subtitle-request/subtitle-request';
import {
  type UserVisibleErrorDetail,
  SubtitleUploadTooLargeError,
  WorkerUnavailableError,
  buildApiUrl,
} from '../../../../api/mytube-extract.api';
import {
  createSubtitleRequestAdapter,
  type SubtitleRequest,
} from '../../../adapters/subtitle-request.adapter';
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
  setSubtitleWhisperModelPreference,
} from '../../../utils/request-preference.util';
import { getWorkerHealthSubmitReason } from '../../../utils/worker-health-notice.util';
import { isUnmodifiedShortcut } from '../../../utils/keyboard-shortcut.util';

/** worker 미가용 안내 문구. */
const WORKER_UNAVAILABLE_MESSAGE =
  '현재 자막 추출 서버가 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.';

/** worker 미가용 상세 원인. */
const WORKER_UNAVAILABLE_DETAIL: UserVisibleErrorDetail = {
  code: 'WORKER_UNAVAILABLE',
  guidance: '자막 추출 서버가 작업을 받을 수 없는 상태입니다.',
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

/** 기본 Whisper 모델. */
const DEFAULT_WHISPER_MODEL: SubtitleWhisperModel = 'base_en';

/** 화면에 표시하는 자막 처리 단계. */
export type SubtitleStepKey = 'file_select' | SubtitleJobResponse['stage'];

/** 자막 추출 route의 file upload, polling, 표시 상태를 lifecycle interface로 정규화한다. */
export function useSubtitlesExtractLogic() {
  // Variables.

  /** 현재 API base URL. */
  const apiBaseUrl = getApiBaseUrl();

  // Refs.

  /** 파일 input DOM 참조. */
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  /** 접근 가능한 파일 선택 버튼 DOM 참조. */
  const filePickerButtonRef = useRef<HTMLButtonElement | null>(null);

  // States.

  /** 사용자가 선택한 로컬 영상 파일. */
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  /** 사용자가 선택한 Whisper 모델. */
  const [selectedWhisperModel, setSelectedWhisperModel] =
    useState<SubtitleWhisperModel>(
      () => getRequestPreferences().whisperModel,
    );
  /** multipart 원본 업로드 진행률. */
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  /** 업로드 용량 초과를 파일 feedback으로 유지할 안내. */
  const [fileUploadErrorMessage, setFileUploadErrorMessage] = useState('');

  // Hooks.

  /** 자막 요청 통신과 multipart 세부를 감싼 adapter. */
  const subtitleRequestAdapter = useMemo(
    () =>
      createSubtitleRequestAdapter({
        apiBaseUrl,
        onProgress: (progress) =>
          setUploadProgress(progress ? progress.percent : null),
      }),
    [apiBaseUrl],
  );
  /** 추출 진행 중 route 이동 차단 상태를 갱신한다. */
  const { setHistoryDestination, setNavigationLocked } = useNavigation();
  /** 현재 파일 입력 검증 결과. */
  const validation = validateSubtitleFile(selectedFile);
  /** 자막 route가 사용하는 추출 요청 생명주기 deep module. */
  const requestLifecycle = useExtractionRequestLifecycle<
    SubtitleRequest,
    SubtitleJobResponse,
    'subtitle',
    ReturnType<typeof createSubtitleLifecyclePresentation>
  >({
    adapter: subtitleRequestAdapter,
    createPresentation: (lifecycle) =>
      createSubtitleLifecyclePresentation({
        apiBaseUrl,
        fileUploadErrorMessage,
        lifecycle,
        selectedFile,
        uploadProgress,
        validation,
      }),
    historyPath: ROUTE_PATHS.history,
    messages: {
      cancelled:
        '요청을 중단했습니다. 선택한 파일과 처리 방식은 그대로입니다. 다시 요청할 수 있습니다.',
      unavailable: WORKER_UNAVAILABLE_MESSAGE,
    },
    navigation: {
      setHistoryDestination,
      setLocked: setNavigationLocked,
    },
  });

  // Computed.

  /** lifecycle interface가 최종 우선순위를 적용한 자막 표시 모델. */
  const {
    canSubmit,
    downloadHref,
    filledProgressCells,
    hasSubtitleUploadTooLargeError,
    isSubmitting,
    requestError,
    requestErrorCause,
    requestNotice,
    statusErrorDetail,
    statusIconName,
    statusJob,
    statusMessage,
    statusTitle,
    statusTone,
    submitDisabledReason,
    viewPhase,
    workerHealthDetail,
    workerHealthFailed,
    workerHealthCheckedAt,
    workerHealthIsFetching,
    workerHealthIsRefreshing,
    workerHealthStatus,
  } = requestLifecycle.presentation;
  /** Whisper 모델 선택 가능 여부. */
  const canChangeWhisperModel = !isSubmitting;
  /** 화면에 선택 표시할 처리 단계. */
  const currentStepKey = createSubtitleStepKey({
    selectedFile,
    statusJob,
    validationKind: validation.kind,
  });
  /** 선택 파일 메타 정보. */
  const selectedFileMeta = selectedFile
    ? `${formatFileSize(selectedFile.size)}`
    : '';

  // Effects.

  useEffect(
    function preserveUploadLimitErrorAsFileFeedback() {
      if (
        !(requestErrorCause instanceof SubtitleUploadTooLargeError) ||
        !selectedFile
      ) {
        return;
      }

      setFileUploadErrorMessage(createSubtitleUploadTooLargeMessage(selectedFile));
      // 파일 선택 오류는 route form에서 복구할 수 있도록 lifecycle을 요청 상태로 되돌린다.
      requestLifecycle.actions.reset?.();
    },
    [requestErrorCause, requestLifecycle.actions.reset, selectedFile],
  );

  useEffect(
    function persistWhisperModelPreference() {
      setSubtitleWhisperModelPreference(selectedWhisperModel);
    },
    [selectedWhisperModel],
  );

  useEffect(
    function registerSubtitleRequestShortcut() {
      function handleShortcut(event: KeyboardEvent) {
        if (!isUnmodifiedShortcut(event, 'KeyF')) {
          return;
        }

        const filePickerButton = filePickerButtonRef.current;

        if (!filePickerButton) {
          return;
        }

        event.preventDefault();
        filePickerButton.focus();
      }

      window.addEventListener('keydown', handleShortcut);
      return () => window.removeEventListener('keydown', handleShortcut);
    },
  );

  // Functions.

  /** API base URL 환경 설정을 반환한다. */
  function getApiBaseUrl() {
    return (
      import.meta.env.VITE_MYTUBE_EXTRACT_API_BASE_URL ??
      import.meta.env.VITE_MEDIA_NEST_API_BASE_URL
    );
  }

  /** 선택 파일과 현재 lifecycle 결과를 초기화한다. */
  function clearSelectedFile() {
    setSelectedFile(null);
    setFileUploadErrorMessage('');
    setUploadProgress(null);
    requestLifecycle.actions.reset?.();

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // 파일을 지운 뒤 다시 파일 선택 control에 포커스를 돌린다.
    filePickerButtonRef.current?.focus();
  }

  /** 파일 선택과 이전 요청 오류를 상태에 반영한다. */
  function selectFile(file: File | null) {
    setSelectedFile(file);
    setFileUploadErrorMessage('');
    setUploadProgress(null);
    requestLifecycle.actions.clearRequestError();
  }

  /** 요청 오류에서 선택 파일을 유지한 채 요청 화면으로 돌아간다. */
  function returnToRequest() {
    requestLifecycle.actions.reset?.();
    setFileUploadErrorMessage('');
    setUploadProgress(null);
    focusRequestStart();
  }

  /** 요청 중단 뒤 파일 선택 또는 상태 재확인 control로 focus를 돌린다. */
  function focusRequestStart() {
    window.requestAnimationFrame(() => {
      const filePickerButton = filePickerButtonRef.current;

      if (filePickerButton) {
        filePickerButton.focus();
        return;
      }

      document
        .querySelector<HTMLButtonElement>('.worker-health-status__retry')
        ?.focus();
    });
  }

  /** 서버 job 생성 전 현재 요청만 중단하고 선택 파일을 유지한다. */
  function cancelRequest() {
    if (!requestLifecycle.actions.cancel?.()) {
      return;
    }

    setUploadProgress(null);
    focusRequestStart();
  }

  // Handlers.

  /** 숨겨진 file input을 연다. */
  function handleFilePickerOpen() {
    fileInputRef.current?.click();
  }

  /** 파일 input 변경 이벤트를 처리한다. */
  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0] ?? null);
  }

  /** dropzone dragover 기본 동작을 막는다. */
  function handleDropzoneDragOver(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
  }

  /** dropzone 파일 drop 이벤트를 처리한다. */
  function handleDropzoneDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    selectFile(event.dataTransfer.files[0] ?? null);
  }

  /** 영어 SRT 생성 submit 이벤트를 처리한다. */
  function handleSubtitleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile || !canSubmit) {
      return;
    }

    setFileUploadErrorMessage('');
    setUploadProgress(null);
    requestLifecycle.actions.clearRequestError();

    /** 검증된 자막 요청 입력. */
    const request: SubtitleRequest = {
      file: selectedFile,
      whisperModel: selectedWhisperModel,
    };

    if (requestLifecycle.actions.submit) {
      requestLifecycle.actions.submit(request);
      return;
    }

    // 파일 feedback 직후의 stale render를 복구해 다음 submit에서 요청을 다시 열 수 있게 한다.
    requestLifecycle.actions.reset?.();
  }

  /** Whisper 모델 변경 이벤트를 처리한다. */
  function handleWhisperModelChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedWhisperModel(event.target.value as SubtitleWhisperModel);
  }

  return {
    canSubmit,
    canChangeWhisperModel,
    clearSelectedFile,
    currentStepKey,
    downloadHref,
    fileInputRef,
    filePickerButtonRef,
    fileFeedbackIsError:
      validation.kind === 'invalid' || hasSubtitleUploadTooLargeError,
    fileFeedbackMessage:
      hasSubtitleUploadTooLargeError
        ? requestError
        : validation.kind !== 'ready'
          ? validation.message
          : '',
    filledProgressCells,
    handleDropzoneDragOver,
    handleDropzoneDrop,
    handleFileInputChange,
    handleFilePickerOpen,
    handleSubtitleSubmit,
    handleWhisperModelChange,
    isSubtitlePending: isSubmitting,
    requestNotice,
    retryWorkerHealth: () => requestLifecycle.actions.retryReadiness?.(),
    selectedFile,
    selectedFileMeta,
    selectedWhisperModel,
    statusErrorDetail,
    statusIconName,
    statusJob,
    statusMessage,
    statusTitle,
    statusTone,
    submitDisabledReason,
    cancelRequest,
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

/** 정규화된 lifecycle 상태를 자막 화면의 최종 표시 모델로 만든다. */
function createSubtitleLifecyclePresentation(input: {
  /** 현재 API base URL. */
  apiBaseUrl: string | undefined;
  /** route가 보존한 업로드 용량 오류 안내. */
  fileUploadErrorMessage: string;
  /** deep module이 우선순위를 적용한 lifecycle 상태. */
  lifecycle: RequestLifecyclePresentationInput<SubtitleJobResponse>;
  /** 사용자가 선택한 로컬 영상 파일. */
  selectedFile: File | null;
  /** multipart 원본 업로드 진행률. */
  uploadProgress: number | null;
  /** 현재 파일 입력 검증 결과. */
  validation: ReturnType<typeof validateSubtitleFile>;
}) {
  /** 오른쪽 status panel에 표시할 최신 job. */
  const statusJob =
    input.lifecycle.job ?? createIdleSubtitleJob(input.selectedFile);
  /** 현재 readiness 상태. */
  const workerHealthStatus = input.lifecycle.readiness.status;
  /** 활성 job이 없어 worker health가 현재 화면을 결정하는지 여부. */
  const workerHealthAffectsView = input.lifecycle.job === null;
  /** worker health 확인 실패 여부. */
  const workerHealthFailed =
    workerHealthAffectsView && workerHealthStatus.kind === 'failed';
  /** worker가 미가용 상태인지 여부. */
  const workerUnavailable =
    workerHealthAffectsView && workerHealthStatus.kind === 'unavailable';
  /** lifecycle이 우선순위를 정한 현재 오류. */
  const lifecycleError = input.lifecycle.error;
  /** 자막 요청 오류의 원래 cause. */
  const requestErrorCause =
    lifecycleError?.source === 'request' ? lifecycleError.cause : null;
  /** 업로드 용량 오류를 파일 선택 feedback으로 정규화할지 여부. */
  const hasSubtitleUploadTooLargeError =
    requestErrorCause instanceof SubtitleUploadTooLargeError ||
    Boolean(input.fileUploadErrorMessage);
  /** 자막 생성 요청 오류 안내 문구. */
  const requestError = hasSubtitleUploadTooLargeError
    ? input.selectedFile
      ? createSubtitleUploadTooLargeMessage(input.selectedFile)
      : input.fileUploadErrorMessage
    : lifecycleError?.source === 'request'
      ? lifecycleError.cause instanceof WorkerUnavailableError
        ? WORKER_UNAVAILABLE_MESSAGE
        : lifecycleError.cause instanceof Error &&
            hasUserVisibleErrorDetail(lifecycleError.cause)
          ? lifecycleError.cause.detail.guidance
          : '영어 SRT 생성 요청에 실패했습니다. 다시 시도해 주세요.'
      : '';
  /** 자막 job 생성 요청 오류 상세 원인. */
  const requestErrorDetail =
    lifecycleError?.source === 'request' && !hasSubtitleUploadTooLargeError
      ? createSubtitleRequestErrorDetail(lifecycleError.cause, requestError)
      : undefined;
  /** worker health 오류 상세 원인. */
  const workerHealthErrorDetail = createWorkerHealthErrorDetail(
    input.lifecycle.readiness.error instanceof Error
      ? input.lifecycle.readiness.error
      : null,
  );
  /** 현재 자막 job 상태 조회 오류 상세 원인. */
  const jobStatusRequestErrorDetail =
    lifecycleError?.source === 'status' && input.lifecycle.receipt
      ? createJobStatusRequestErrorDetail(
          lifecycleError.cause,
          input.lifecycle.receipt,
        )
      : undefined;
  /** failed·expired 자막 job 상세 원인. */
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
  /** 자막 생성 요청 가능 여부. */
  const canSubmit =
    input.validation.kind === 'ready' &&
    workerHealthStatus.kind === 'ready' &&
    (input.lifecycle.canSubmit || hasSubtitleUploadTooLargeError);
  /** 제출 버튼이 비활성화된 이유. */
  const submitDisabledReason = getWorkerHealthSubmitReason({
    healthStatus: workerHealthStatus.kind,
    isSubmitting,
  });
  /** 현재 상태 제목. */
  const statusTitle =
    (input.uploadProgress !== null ? '원본 영상을 업로드 중입니다' : '') ||
    (isSubmitting ? '영어 SRT 생성 요청을 준비하고 있습니다' : '') ||
    (requestError ? '영어 SRT 생성 요청에 실패했습니다' : '') ||
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
    (input.uploadProgress !== null
      ? `원본 영상을 준비하고 있습니다. (${input.uploadProgress}%)`
      : '') ||
    (isSubmitting ? '영어 SRT 생성 요청을 준비하고 있습니다.' : '') ||
    requestError ||
    jobStatusRequestErrorDetail?.guidance ||
    (workerHealthAffectsView && workerHealthStatus.kind !== 'ready'
      ? workerHealthStatus.message
      : '') ||
    statusJob.message ||
    input.validation.message;

  return {
    canSubmit,
    downloadHref: statusJob.downloadUrl
      ? buildApiUrl(statusJob.downloadUrl, input.apiBaseUrl)
      : '',
    filledProgressCells:
      input.uploadProgress !== null
        ? Math.round(input.uploadProgress / 10)
        : statusJob.progress === null
          ? 0
          : Math.round(statusJob.progress / 10),
    hasSubtitleUploadTooLargeError,
    isSubmitting,
    requestError,
    requestErrorCause,
    requestNotice: input.lifecycle.requestNotice,
    statusErrorDetail,
    statusIconName:
      input.uploadProgress !== null || isSubmitting
        ? 'processing'
        : jobStatusRequestErrorDetail ||
            (workerHealthAffectsView &&
              (workerHealthFailed || workerUnavailable))
          ? 'failed'
          : getStatusIconName(statusJob.displayStatus),
    statusJob,
    statusMessage,
    statusTitle,
    statusTone:
      input.uploadProgress !== null || isSubmitting
        ? 'processing'
        : jobStatusRequestErrorDetail ||
            (workerHealthAffectsView &&
              (workerHealthFailed || workerUnavailable))
          ? 'failed'
          : getStatusTone(statusJob.displayStatus),
    submitDisabledReason,
    viewPhase: hasSubtitleUploadTooLargeError
      ? ('request' as const)
      : input.lifecycle.phase,
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

/** 현재 화면 상태에서 선택 표시할 단계를 만든다. */
export function createSubtitleStepKey(input: {
  /** 현재 활성 job. */
  statusJob: SubtitleJobResponse;
  /** 사용자가 선택한 파일. */
  selectedFile: File | null;
  /** 현재 파일 검증 상태. */
  validationKind: ReturnType<typeof validateSubtitleFile>['kind'];
}): SubtitleStepKey {
  if (!input.statusJob.jobId && input.validationKind !== 'ready') {
    return 'file_select';
  }

  return input.statusJob.stage;
}

/** 빈 화면용 임시 상태 job을 만든다. */
function createIdleSubtitleJob(file: File | null): SubtitleJobResponse {
  return {
    createdAt: new Date().toISOString(),
    displayStatus: 'queued',
    downloadUrl: null,
    errorCode: null,
    fileName: file?.name ?? '',
    jobId: '',
    message: file
      ? '영어 SRT 생성 버튼을 누르면 작업이 시작됩니다.'
      : '영상 파일을 선택해 주세요.',
    progress: 0,
    retentionDays: 7,
    stage: 'queued',
    status: 'queued',
    whisperModel: DEFAULT_WHISPER_MODEL,
  };
}

/** 상태 제목을 만든다. */
function createStatusTitle(job: SubtitleJobResponse) {
  if (job.displayStatus === 'queued') {
    return '작업 대기 중입니다';
  }

  if (job.displayStatus === 'extracting_audio') {
    return '음성을 추출 중입니다';
  }

  if (job.displayStatus === 'transcribing') {
    return '영어 SRT를 생성 중입니다';
  }

  if (job.displayStatus === 'completed') {
    return '영어 자막 파일이 준비되었습니다';
  }

  if (job.displayStatus === 'failed') {
    return '영어 SRT 생성에 실패했습니다';
  }

  return '영어 SRT 보관 기간이 지났습니다';
}

/** 표시 상태에 맞는 아이콘 이름을 반환한다. */
function getStatusIconName(
  status: SubtitleJobResponse['displayStatus'],
): AppIconName {
  if (status === 'completed') {
    return 'completed';
  }

  if (status === 'failed') {
    return 'failed';
  }

  if (status === 'expired') {
    return 'expired';
  }

  if (status === 'extracting_audio' || status === 'transcribing') {
    return 'processing';
  }

  return 'queued';
}

/** 기존 status CSS tone에 맞춰 자막 상태를 변환한다. */
function getStatusTone(status: SubtitleJobResponse['displayStatus']) {
  if (status === 'extracting_audio' || status === 'transcribing') {
    return 'processing';
  }

  return status;
}

/** worker health 상태 제목을 만든다. */
function createWorkerHealthTitle(input: {
  /** worker health 확인 실패 여부. */
  failed: boolean;
  /** worker 미가용 여부. */
  unavailable: boolean;
}) {
  if (input.unavailable) {
    return '자막 추출 기능을 사용할 수 없습니다';
  }

  if (input.failed) {
    return '서비스 상태를 확인할 수 없습니다';
  }

  return '';
}

/** 자막 job 생성 오류에서 사용자 열람용 상세 정보를 만든다. */
export function createSubtitleRequestErrorDetail(
  error: unknown,
  guidance: string,
): UserVisibleErrorDetail {
  if (error instanceof Error && hasUserVisibleErrorDetail(error)) {
    return error.detail;
  }

  return {
    code: 'SUBTITLE_REQUEST_FAILED',
    guidance,
    location: '영어 SRT 생성 요청',
  };
}

/** worker health 오류에서 사용자 열람용 상세 원인을 만든다. */
function createWorkerHealthErrorDetail(
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
  };
}

/** 오류가 사용자 열람용 상세 정보를 포함하는지 확인한다. */
function hasUserVisibleErrorDetail(
  error: Error,
): error is Error & { detail: UserVisibleErrorDetail } {
  return (
    'detail' in error &&
    typeof (error as { detail?: unknown }).detail === 'object' &&
    (error as { detail?: unknown }).detail !== null
  );
}

/** 업로드 용량 초과 안내 문구를 만든다. */
function createSubtitleUploadTooLargeMessage(file: File) {
  return `파일이 너무 큽니다. 선택한 파일: ${formatFileSize(file.size)}. 더 작은 영상 파일을 선택해 주세요.`;
}

/** byte 크기를 화면 표시용으로 줄인다. */
function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))}KB`;
  }

  return `${Math.round(size / 1024 / 1024)}MB`;
}
