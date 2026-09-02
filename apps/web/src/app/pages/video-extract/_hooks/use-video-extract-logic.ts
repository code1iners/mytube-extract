import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { type ChangeEvent, useEffect, useRef, useState } from 'react';
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
  assertWorkerAvailable,
  buildApiUrl,
  createDownloadJob,
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
  setDownloadPreferences,
} from '../../../utils/request-preference.util';
import {
  getWorkerHealthSubmitReason,
} from '../../../utils/worker-health-notice.util';

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

/** 영상 추출 route의 form, polling, 표시 상태를 조합한다. */
export function useVideoExtractLogic() {
  // Variables.

  /** 현재 API base URL. */
  const apiBaseUrl = getApiBaseUrl();

  // Refs.

  /** 현재 job 생성 요청을 중단하기 위한 컨트롤러. */
  const requestAbortControllerRef = useRef<AbortController | null>(null);

  // States.

  /** 요청 실패 메시지. */
  const [requestError, setRequestError] = useState('');
  /** 이 화면에서 상태를 확인할 직전 접수 job. */
  const [activeJob, setActiveJob] = useState<DownloadResponse | null>(null);

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
  /** 다운로드 job 생성 mutation. */
  const downloadJobMutation = useMutation({
    mutationFn: async (input: {
      /** 다운로드 입력값. */
      draft: DownloadDraft;
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

      return createDownloadJob(input.draft, {
        apiBaseUrl,
        signal: input.signal,
      });
    },
  });
  /** 현재 화면의 다운로드 job 접수증과 상태 query. */
  const { activeJobQuery, activeJobReceipt } = useActiveJobStatus({
    activeJob,
    apiBaseUrl,
    fetchStatus: (receipt, signal) =>
      fetchJobStatus(receipt, apiBaseUrl, signal),
    kind: 'video',
  });
  /** 추출 진행 중 route 이동 차단 상태를 갱신한다. */
  const { setHistoryDestination, setNavigationLocked } = useNavigation();

  // Computed.

  /** 현재 form 입력값. */
  const draft = watch();
  /** 현재 입력 검증 결과. */
  const validation = validateDownloadDraft(draft);
  /** 현재 품질 선택지. */
  const qualityOptions =
    draft.mode === 'audio' ? AUDIO_QUALITY_OPTIONS : VIDEO_QUALITY_OPTIONS;
  /** route를 벗어나면 안 되는 추출 요청 접수 상태 여부. */
  const extractionNavigationLocked = downloadJobMutation.isPending;
  /** API job 생성 전 요청 처리 중인지 여부. */
  const isSubmitting = downloadJobMutation.isPending;
  /** 오른쪽 status panel에 표시할 최신 job. */
  const statusJob = activeJobQuery.data ?? activeJob ?? createIdleJob(draft);
  /** worker health 오류 상세 원인. */
  const workerHealthErrorDetail = createWorkerHealthErrorDetail(
    workerHealthQuery.error,
  );
  /** 영상 job 생성 요청 오류 상세 원인. */
  const requestErrorDetail = requestError
    ? createVideoRequestErrorDetail(downloadJobMutation.error, requestError)
    : undefined;
  /** 현재 영상 job 상태 조회 오류 상세 원인. */
  const jobStatusRequestErrorDetail = activeJobQuery.isError
    ? createJobStatusRequestErrorDetail(
        activeJobQuery.error,
        activeJobReceipt,
      )
    : undefined;
  /** failed·expired 영상 job 상세 원인. */
  const terminalJobErrorDetail = createTerminalJobErrorDetail(
    statusJob,
    activeJobReceipt,
  );
  /** 활성 job이 없어 worker health가 현재 화면을 결정하는지 여부. */
  const workerHealthAffectsView = activeJob === null;
  /** 현재 상태 패널 상세 원인. */
  const statusErrorDetail =
    jobStatusRequestErrorDetail ??
    terminalJobErrorDetail ??
    requestErrorDetail ??
    (workerHealthAffectsView && workerUnavailable
      ? WORKER_UNAVAILABLE_DETAIL
      : undefined) ??
    (workerHealthAffectsView ? workerHealthErrorDetail : undefined);
  /** 추출 요청 가능 여부. */
  const canSubmit =
    validation.kind === 'ready' &&
    isValid &&
    !downloadJobMutation.isPending &&
    workerHealthStatus.kind === 'ready';
  /** 제출 버튼이 비활성화된 이유. */
  const submitDisabledReason = getWorkerHealthSubmitReason({
    healthStatus: workerHealthStatus.kind,
    isSubmitting,
    validationMessage:
      validation.kind === 'ready' ? '입력값을 확인해 주세요.' : validation.message,
    validationReady: validation.kind === 'ready' && isValid,
  });
  /** 10칸 진행률 bar 중 채울 칸 수. */
  const filledProgressCells =
    statusJob.progress === null ? 0 : Math.round(statusJob.progress / 10);
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
    (isSubmitting ? '추출 서버 상태를 확인하고 작업을 생성 중입니다.' : '') ||
    requestError ||
    jobStatusRequestErrorDetail?.guidance ||
    (workerHealthAffectsView && workerHealthStatus.kind !== 'ready'
      ? workerHealthStatus.message
      : '') ||
    statusJob.message ||
    validation.message;
  /** 요청 시작 시각 표시값. */
  const createdTime = formatTime(statusJob.createdAt);
  /** 현재 상태 아이콘 이름. */
  const statusIconName =
    isSubmitting
      ? 'processing'
      : jobStatusRequestErrorDetail ||
          (workerHealthAffectsView && (workerHealthFailed || workerUnavailable))
        ? 'failed'
        : getStatusIconName(statusJob.displayStatus);
  /** 현재 상태 표시 tone. */
  const statusTone =
    isSubmitting
      ? 'processing'
      : jobStatusRequestErrorDetail ||
          (workerHealthAffectsView && (workerHealthFailed || workerUnavailable))
        ? 'failed'
        : statusJob.displayStatus;
  /** 현재 진행률 표시 문구. */
  const progressLabel = createProgressLabel(statusJob);
  /** 상태 패널 형식 표시값. */
  const statusTypeLabel = statusJob.type === 'audio' ? '오디오' : '비디오';
  /** 상태 패널 품질 표시값. */
  const statusQualityLabel = formatQuality(statusJob);
  /** 완료 asset 다운로드 href. */
  const downloadHref = statusJob.downloadUrl
    ? buildApiUrl(statusJob.downloadUrl, apiBaseUrl)
    : '';
  /** 현재 화면에 단독으로 표시할 추출 단계. */
  const viewPhase = getExtractViewPhase({
    hasRequestError: Boolean(requestError || jobStatusRequestErrorDetail),
    isSubmitting,
    status: activeJobQuery.data?.displayStatus ?? activeJob?.displayStatus ?? null,
  });

  // Functions.

  /** API base URL 환경 설정을 반환한다. */
  function getApiBaseUrl() {
    return (
      import.meta.env.VITE_MYTUBE_EXTRACT_API_BASE_URL ??
      import.meta.env.VITE_MEDIA_NEST_API_BASE_URL
    );
  }

  /** 현재 job 생성 요청만 중단한다. */
  function stopRequest() {
    requestAbortControllerRef.current?.abort();
    requestAbortControllerRef.current = null;
  }

  /** 입력 변경 후 이전 실패 상태를 초기화한다. */
  function clearRequestError() {
    setRequestError('');
  }

  /** 요청 오류에서 기존 입력을 유지한 채 요청 화면으로 돌아간다. */
  function returnToRequest() {
    stopRequest();
    setRequestError('');
    setActiveJob(null);
    downloadJobMutation.reset();
  }

  // Effects.

  useEffect(
    function cleanupDownloadRequest() {
      return () => {
        stopRequest();
        setNavigationLocked(false);
      };
    },
    [setNavigationLocked],
  );

  useEffect(
    function syncExtractionNavigationLock() {
      setNavigationLocked(extractionNavigationLocked);
    },
    [extractionNavigationLocked, setNavigationLocked],
  );

  useEffect(
    function persistDownloadPreferences() {
      setDownloadPreferences({ mode: draft.mode, quality: draft.quality });
    },
    [draft.mode, draft.quality],
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
    stopRequest();
    setRequestError('');

    try {
      /** 새 다운로드 job 생성 요청 컨트롤러. */
      const abortController = new AbortController();
      requestAbortControllerRef.current = abortController;

      /** 생성된 다운로드 job. */
      const job = await downloadJobMutation.mutateAsync({
        draft: validDraft,
        signal: abortController.signal,
      });

      requestAbortControllerRef.current = null;
      /** 접수증 저장 결과와 해당 job의 요청 내역 deep link. */
      const receiptDestination = acceptJobReceipt('video', job.jobId);
      setHistoryDestination(
        receiptDestination.storageFailed
          ? receiptDestination.to
          : ROUTE_PATHS.history,
      );
      setActiveJob(job);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      setRequestError(
        error instanceof WorkerUnavailableError
          ? WORKER_UNAVAILABLE_MESSAGE
          : '추출 요청에 실패했습니다. 다시 시도해 주세요.',
      );
    } finally {
      requestAbortControllerRef.current = null;
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
    isDownloadPending: downloadJobMutation.isPending,
    progressLabel,
    qualityOptions,
    register,
    retryWorkerHealth,
    statusErrorDetail,
    statusIconName,
    statusJob,
    statusMessage,
    statusQualityLabel,
    statusTitle,
    statusTone,
    statusTypeLabel,
    submitDisabledReason,
    returnToRequest,
    validation,
    viewPhase,
    workerHealthFailed: workerHealthAffectsView && workerHealthFailed,
    workerHealthCheckedAt,
    workerHealthIsFetching: workerHealthQuery.isFetching,
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
