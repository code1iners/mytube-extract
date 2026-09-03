import { useMutation } from '@tanstack/react-query';
import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  useEffect,
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
  abortSubtitleUpload,
  assertWorkerAvailable,
  buildApiUrl,
  completeSubtitleUpload,
  createSubtitleUpload,
  isAbortError,
  uploadSubtitleFileParts,
} from '../../../../api/mytube-extract.api';
import { useNavigation } from '../../../components/navigation-context';
import { type AppIconName } from '../../../components/app-icon';
import { ROUTE_PATHS } from '../../../constants/route-paths.constant';
import { useActiveJobStatus } from '../../../hooks/use-active-job-status';
import { useWorkerReadiness } from '../../../hooks/use-worker-readiness';
import { getExtractViewPhase } from '../../../utils/extract-view-phase.util';
import { acceptJobReceipt } from '../../../utils/job-receipt.util';
import {
  createJobStatusRequestErrorDetail,
  createTerminalJobErrorDetail,
  fetchJobStatus,
} from '../../../utils/job-status-polling.util';
import {
  getRequestPreferences,
  setSubtitleWhisperModelPreference,
} from '../../../utils/request-preference.util';
import {
  getWorkerHealthSubmitReason,
} from '../../../utils/worker-health-notice.util';
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

type SubtitleRequestAttempt = {
  /** 이번 요청을 중단할 controller. */
  controller: AbortController;
  /** 사용자가 서버 job 생성 전에 중단을 눌렀는지 여부. */
  cancelled: boolean;
};

/** 자막 추출 route의 file upload, polling, 표시 상태를 조합한다. */
export function useSubtitlesExtractLogic() {
  // Variables.

  /** 현재 API base URL. */
  const apiBaseUrl = getApiBaseUrl();

  // Refs.

  /** 파일 input DOM 참조. */
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  /** 접근 가능한 파일 선택 버튼 DOM 참조. */
  const filePickerButtonRef = useRef<HTMLButtonElement | null>(null);
  /** 현재 upload/job 생성 요청을 중단하기 위한 컨트롤러. */
  const requestAttemptRef = useRef<SubtitleRequestAttempt | null>(null);

  // States.

  /** 사용자가 선택한 로컬 영상 파일. */
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  /** 사용자가 선택한 Whisper 모델. */
  const [selectedWhisperModel, setSelectedWhisperModel] =
    useState<SubtitleWhisperModel>(
      () => getRequestPreferences().whisperModel,
    );
  /** 요청 실패 메시지. */
  const [requestError, setRequestError] = useState('');
  /** 요청 중단 또는 늦은 접수 결과를 보조 기술에 알릴 문구. */
  const [requestNotice, setRequestNotice] = useState('');
  /** 중단 직후 mutation이 정리되기 전에도 navigation을 unlock할지 여부. */
  const [requestCancelled, setRequestCancelled] = useState(false);
  /** R2 direct upload 진행률. */
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  /** 이 화면에서 상태를 확인할 직전 접수 자막 job. */
  const [activeJob, setActiveJob] = useState<SubtitleJobResponse | null>(null);

  // Hooks.

  /** 요청 전 API·worker readiness 상태. */
  const {
    retryWorkerHealth,
    workerHealthCheckedAt,
    workerHealthFailed,
    workerHealthQuery,
    workerHealthStatus,
    workerUnavailable,
  } = useWorkerReadiness({
    apiBaseUrl,
    unavailableMessage: WORKER_UNAVAILABLE_MESSAGE,
  });
  /** 자막 job 생성 mutation. */
  const subtitleJobMutation = useMutation({
    mutationFn: async (input: {
      /** 업로드할 로컬 영상 파일. */
      file: File;
      /** 요청 중단 신호. */
      signal: AbortSignal;
    }) => {
      /** submit 직전 최신 worker health. */
      const workerHealth = await workerHealthQuery.refetch({
        cancelRefetch: false,
      });

      if (workerHealth.error) {
        throw workerHealth.error;
      }

      assertWorkerAvailable(workerHealth.data);

      /** 생성된 R2 direct upload session. */
      let upload: Awaited<ReturnType<typeof createSubtitleUpload>> | null =
        null;

      try {
        upload = await createSubtitleUpload(input.file, selectedWhisperModel, {
          apiBaseUrl,
          signal: input.signal,
        });
        setUploadProgress(0);

        /** R2에 직접 업로드한 multipart part 목록. */
        const parts = await uploadSubtitleFileParts(input.file, upload, {
          signal: input.signal,
          onProgress: (progress) => setUploadProgress(progress.percent),
        });

        return completeSubtitleUpload(upload, parts, {
          apiBaseUrl,
          signal: input.signal,
        });
      } catch (error) {
        if (upload) {
          void abortSubtitleUpload(upload, { apiBaseUrl }).catch(() => {
            // 실패한 multipart upload 정리는 best-effort로만 수행한다.
          });
        }

        throw error;
      } finally {
        setUploadProgress(null);
      }
    },
  });
  /** 현재 화면의 자막 job 접수증과 상태 query. */
  const { activeJobQuery, activeJobReceipt } = useActiveJobStatus({
    activeJob,
    apiBaseUrl,
    fetchStatus: (receipt, signal) =>
      fetchJobStatus(receipt, apiBaseUrl, signal),
    kind: 'subtitle',
  });
  /** 추출 진행 중 route 이동 차단 상태를 갱신한다. */
  const { setHistoryDestination, setNavigationLocked } = useNavigation();

  // Computed.

  /** 현재 파일 입력 검증 결과. */
  const validation = validateSubtitleFile(selectedFile);
  /** route를 벗어나면 안 되는 자막 요청/진행 상태 여부. */
  const subtitleNavigationLocked =
    subtitleJobMutation.isPending && !requestCancelled;
  /** R2 업로드 session 생성부터 자막 job 생성까지의 요청 처리 여부. */
  const isSubmitting = subtitleJobMutation.isPending;
  /** 오른쪽 status panel에 표시할 job. */
  const statusJob =
    activeJobQuery.data ?? activeJob ?? createIdleSubtitleJob(selectedFile);
  /** worker health 오류 상세 원인. */
  const workerHealthErrorDetail = createWorkerHealthErrorDetail(
    workerHealthQuery.error,
  );
  /** 자막 생성 요청 오류 상세 원인. */
  const requestErrorDetail = requestError
    ? createSubtitleRequestErrorDetail(
        subtitleJobMutation.error,
        requestError,
      )
    : undefined;
  /** 업로드 용량 오류를 파일 선택 오류로 유지할지 여부. */
  const hasSubtitleUploadTooLargeError =
    subtitleJobMutation.error instanceof SubtitleUploadTooLargeError;
  /** 파일 선택 control 옆에 표시할 안내 문구. */
  // 형식 오류와 업로드 용량 오류를 같은 파일 feedback 위치로 정규화한다.
  const fileFeedbackMessage = hasSubtitleUploadTooLargeError
    ? requestError
    : validation.kind !== 'ready'
      ? validation.message
      : '';
  /** 파일 선택 control이 오류 상태인지 여부. */
  const fileFeedbackIsError =
    validation.kind === 'invalid' || hasSubtitleUploadTooLargeError;
  /** 현재 자막 job 상태 조회 오류 상세 원인. */
  const jobStatusRequestErrorDetail = activeJobQuery.isError
    ? createJobStatusRequestErrorDetail(
        activeJobQuery.error,
        activeJobReceipt,
      )
    : undefined;
  /** failed·expired 자막 job 상세 원인. */
  const terminalJobErrorDetail = createTerminalJobErrorDetail(
    statusJob,
    activeJobReceipt,
  );
  /** 활성 job이 없어 worker health가 현재 화면을 결정하는지 여부. */
  const workerHealthAffectsView = activeJob === null;
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
  /** 자막 생성 요청 가능 여부. */
  const canSubmit =
    validation.kind === 'ready' &&
    !subtitleJobMutation.isPending &&
    workerHealthStatus.kind === 'ready';
  /** 제출 버튼이 비활성화된 이유. */
  const submitDisabledReason = getWorkerHealthSubmitReason({
    healthStatus: workerHealthStatus.kind,
    isSubmitting,
  });
  /** Whisper 모델 선택 가능 여부. */
  const canChangeWhisperModel =
    !subtitleJobMutation.isPending;
  /** 화면에 선택 표시할 처리 단계. */
  const currentStepKey = createSubtitleStepKey({
    selectedFile,
    statusJob,
    validationKind: validation.kind,
  });
  /** 10칸 진행률 bar 중 채울 칸 수. */
  const filledProgressCells =
    uploadProgress !== null
      ? Math.round(uploadProgress / 10)
      : statusJob.progress === null
        ? 0
        : Math.round(statusJob.progress / 10);
  /** 현재 상태 제목. */
  const statusTitle =
    (uploadProgress !== null ? '원본 영상을 업로드 중입니다' : '') ||
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
    (uploadProgress !== null
      ? `원본 영상을 준비하고 있습니다. (${uploadProgress}%)`
      : '') ||
    (isSubmitting ? '영어 SRT 생성 요청을 준비하고 있습니다.' : '') ||
    requestError ||
    jobStatusRequestErrorDetail?.guidance ||
    (workerHealthAffectsView && workerHealthStatus.kind !== 'ready'
      ? workerHealthStatus.message
      : '') ||
    statusJob.message ||
    validation.message;
  /** 현재 상태 아이콘 이름. */
  const statusIconName =
    uploadProgress !== null || isSubmitting
      ? 'processing'
      : jobStatusRequestErrorDetail ||
          (workerHealthAffectsView && (workerHealthFailed || workerUnavailable))
        ? 'failed'
        : getStatusIconName(statusJob.displayStatus);
  /** 현재 상태 표시 tone. */
  const statusTone =
    uploadProgress !== null || isSubmitting
      ? 'processing'
      : jobStatusRequestErrorDetail ||
          (workerHealthAffectsView && (workerHealthFailed || workerUnavailable))
        ? 'failed'
        : getStatusTone(statusJob.displayStatus);
  /** 완료 SRT 다운로드 href. */
  const downloadHref = statusJob.downloadUrl
    ? buildApiUrl(statusJob.downloadUrl, apiBaseUrl)
    : '';
  /** 선택 파일 메타 정보. */
  const selectedFileMeta = selectedFile
    ? `${formatFileSize(selectedFile.size)}`
    : '';
  /** 현재 화면에 단독으로 표시할 자막 추출 단계. */
  // 업로드 용량 오류는 파일 선택 feedback에서 복구하게 요청 화면을 유지한다.
  const viewPhase = getExtractViewPhase({
    hasRequestError: Boolean(
      (requestError && !hasSubtitleUploadTooLargeError) ||
        jobStatusRequestErrorDetail,
    ),
    isSubmitting,
    status:
      activeJobQuery.data?.displayStatus ?? activeJob?.displayStatus ?? null,
  });

  // Functions.

  /** API base URL 환경 설정을 반환한다. */
  function getApiBaseUrl() {
    return (
      import.meta.env.VITE_MYTUBE_EXTRACT_API_BASE_URL ??
      import.meta.env.VITE_MEDIA_NEST_API_BASE_URL
    );
  }

  /** 현재 upload/job 생성 요청만 중단한다. */
  function stopRequest() {
    requestAttemptRef.current?.controller.abort();
    requestAttemptRef.current = null;
  }

  /** 선택 파일과 이전 실패 상태를 초기화한다. */
  function clearSelectedFile() {
    setSelectedFile(null);
    setRequestError('');
    setRequestNotice('');
    setRequestCancelled(false);
    setUploadProgress(null);
    setActiveJob(null);
    subtitleJobMutation.reset();

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // 파일을 지운 뒤 다시 파일 선택 control에 포커스를 돌린다.
    filePickerButtonRef.current?.focus();
  }

  /** 파일 선택을 상태에 반영한다. */
  function selectFile(file: File | null) {
    setSelectedFile(file);
    setRequestError('');
    setRequestNotice('');
    setRequestCancelled(false);
    setUploadProgress(null);
    setActiveJob(null);
    subtitleJobMutation.reset();
  }

  /** 요청 오류에서 선택 파일을 유지한 채 요청 화면으로 돌아간다. */
  function returnToRequest() {
    stopRequest();
    setRequestCancelled(false);
    setRequestError('');
    setRequestNotice('');
    setUploadProgress(null);
    setActiveJob(null);
    subtitleJobMutation.reset();
  }

  /** 요청 중단 뒤 현재 화면의 파일 선택 또는 상태 재확인 control로 focus를 돌린다. */
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
    const attempt = requestAttemptRef.current;

    if (!attempt) {
      return;
    }

    attempt.cancelled = true;
    attempt.controller.abort();
    requestAttemptRef.current = null;
    setRequestCancelled(true);
    setRequestError('');
    setRequestNotice(
      '요청을 중단했습니다. 선택한 파일과 처리 방식은 그대로입니다. 다시 요청할 수 있습니다.',
    );
    setUploadProgress(null);
    setActiveJob(null);
    subtitleJobMutation.reset();
    setNavigationLocked(false);
    focusRequestStart();
  }

  // Effects.

  useEffect(
    function cleanupSubtitleRequest() {
      return () => {
        stopRequest();
        setNavigationLocked(false);
      };
    },
    [setNavigationLocked],
  );

  useEffect(
    function syncSubtitleNavigationLock() {
      setNavigationLocked(subtitleNavigationLocked);
    },
    [setNavigationLocked, subtitleNavigationLocked],
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
  async function handleSubtitleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile || !canSubmit) {
      return;
    }

    stopRequest();
    setRequestCancelled(false);
    setRequestError('');
    setRequestNotice('');
    subtitleJobMutation.reset();
    /** 새 자막 job 생성 요청 시도. */
    let attempt: SubtitleRequestAttempt | undefined;

    try {
      /** 새 자막 job 생성 요청 컨트롤러. */
      const abortController = new AbortController();
      attempt = {
        cancelled: false,
        controller: abortController,
      };
      requestAttemptRef.current = attempt;

      /** 생성된 자막 job. */
      const job = await subtitleJobMutation.mutateAsync({
        file: selectedFile,
        signal: abortController.signal,
      });

      /** 접수증 저장 결과와 해당 job의 요청 내역 deep link. */
      const receiptDestination = acceptJobReceipt('subtitle', job.jobId);
      const isCurrentAttempt = requestAttemptRef.current === attempt;

      if (attempt && (isCurrentAttempt || attempt.cancelled)) {
        setHistoryDestination(
          receiptDestination.storageFailed
            ? receiptDestination.to
            : ROUTE_PATHS.history,
        );
        setRequestCancelled(false);
        setRequestNotice(
          attempt.cancelled
            ? '요청을 중단하는 동안 서버 작업이 접수되어 요청 내역에 보존했습니다.'
            : '',
        );
        setActiveJob(job);
      }
    } catch (error) {
      if (
        attempt?.cancelled ||
        requestAttemptRef.current !== attempt ||
        isAbortError(error)
      ) {
        return;
      }

      setRequestError(
        error instanceof WorkerUnavailableError
          ? WORKER_UNAVAILABLE_MESSAGE
          : error instanceof SubtitleUploadTooLargeError
            ? createSubtitleUploadTooLargeMessage(selectedFile)
            : error instanceof Error && hasUserVisibleErrorDetail(error)
              ? error.detail.guidance
              : '영어 SRT 생성 요청에 실패했습니다. 다시 시도해 주세요.',
      );
    } finally {
      if (attempt && requestAttemptRef.current?.controller === attempt.controller) {
        requestAttemptRef.current = null;
      }
    }
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
    fileFeedbackIsError,
    fileFeedbackMessage,
    filledProgressCells,
    handleDropzoneDragOver,
    handleDropzoneDrop,
    handleFileInputChange,
    handleFilePickerOpen,
    handleSubtitleSubmit,
    isSubtitlePending: subtitleJobMutation.isPending,
    handleWhisperModelChange,
    retryWorkerHealth,
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
    requestNotice,
    returnToRequest,
    validation,
    viewPhase,
    workerHealthFailed: workerHealthAffectsView && workerHealthFailed,
    workerHealthCheckedAt,
    workerHealthDetail,
    workerHealthIsFetching: workerHealthQuery.isFetching,
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
    return '영어 SRT가 준비되었습니다';
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

/** worker health 오류에서 사용자 열람용 상세 정보를 만든다. */
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
