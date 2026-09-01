import {
  JOB_STATUS_REFETCH_INTERVAL_MS,
  JobStatusRequestError,
  type UserVisibleErrorDetail,
  getJobStatusRetryDelay,
  getDownloadJob,
  getSubtitleJob,
  shouldRetryJobStatus,
} from '../../api/mytube-extract.api';
import type { DownloadResponse } from '../../domain/download-request/download-request';
import type { SubtitleJobResponse } from '../../domain/subtitle-request/subtitle-request';
import type { JobReceipt } from './job-receipt.util';

/** 오류 상세 생성에 필요한 최소 job 상태. */
type TerminalJobStatus = {
  /** 화면에 표시할 terminal 상태. */
  displayStatus: string;
  /** 서버가 제공한 실패 코드. */
  errorCode: string | null;
  /** 사용자 안내 문구. */
  message: string;
};

/** terminal 상태나 재시도 불가 오류에서는 job 상태 polling을 중단한다. */
export function getJobStatusRefetchInterval(status?: string, error?: unknown) {
  if (error && !shouldRetryJobStatus(0, error)) {
    return false;
  }

  return status === 'completed' || status === 'failed' || status === 'expired'
    ? false
    : JOB_STATUS_REFETCH_INTERVAL_MS;
}

/** job 상태 query에 공통으로 적용할 polling 정책을 만든다. */
export function createJobStatusQueryOptions<TJobStatus>(input: {
  /** 상태를 조회할 접수증. */
  receipt: JobReceipt;
  /** 접수증에 해당하는 상태 조회 함수. */
  fetchStatus: (signal: AbortSignal) => Promise<TJobStatus>;
}) {
  return {
    queryKey: ['job-status', input.receipt.kind, input.receipt.jobId],
    queryFn: ({ signal }: { signal: AbortSignal }) => input.fetchStatus(signal),
    refetchInterval: (query: {
      state: { data?: TJobStatus; error?: unknown };
    }) =>
      getJobStatusRefetchInterval(
        getDisplayStatus(query.state.data),
        query.state.error,
      ),
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    retry: shouldRetryJobStatus,
    retryDelay: getJobStatusRetryDelay,
  };
}

/** 접수증 종류에 맞는 API에서 job 상태를 조회한다. */
export function fetchJobStatus(
  receipt: JobReceipt & { kind: 'video' },
  apiBaseUrl: string | undefined,
  signal: AbortSignal,
): Promise<DownloadResponse>;
/** 접수증 종류에 맞는 API에서 job 상태를 조회한다. */
export function fetchJobStatus(
  receipt: JobReceipt & { kind: 'subtitle' },
  apiBaseUrl: string | undefined,
  signal: AbortSignal,
): Promise<SubtitleJobResponse>;
/** 종류를 알 수 없는 접수증의 job 상태를 조회한다. */
export function fetchJobStatus(
  receipt: JobReceipt,
  apiBaseUrl: string | undefined,
  signal: AbortSignal,
): Promise<DownloadResponse | SubtitleJobResponse>;
/** 접수증 종류에 맞는 API에서 job 상태를 조회한다. */
export function fetchJobStatus(
  receipt: JobReceipt,
  apiBaseUrl: string | undefined,
  signal: AbortSignal,
) {
  return receipt.kind === 'video'
    ? getDownloadJob(receipt.jobId, { apiBaseUrl, signal })
    : getSubtitleJob(receipt.jobId, { apiBaseUrl, signal });
}

/** job 상태 조회 실패를 사용자 열람용 상세 정보로 바꾼다. */
export function createJobStatusRequestErrorDetail(
  error: unknown,
  receipt: JobReceipt,
): UserVisibleErrorDetail | undefined {
  if (!error) {
    return undefined;
  }

  /** 조회 실패 HTTP 상태 코드. */
  const responseStatus =
    error instanceof JobStatusRequestError ? error.responseStatus : undefined;
  /** 다시 요청할 job 상태 endpoint. */
  const requestPath = createJobStatusRequestPath(receipt);

  return {
    code:
      responseStatus === 404 ? 'JOB_STATUS_NOT_FOUND' : 'JOB_STATUS_REQUEST_FAILED',
    guidance:
      responseStatus === 404
        ? '접수한 작업을 더 이상 찾을 수 없습니다. 같은 종류의 요청을 다시 접수해 주세요.'
        : '작업 상태를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    location: '작업 상태 확인',
    requestPath,
    responseStatus,
  };
}

/** failed·expired job을 사용자 열람용 상세 정보로 바꾼다. */
export function createTerminalJobErrorDetail(
  job: TerminalJobStatus,
  receipt: JobReceipt,
): UserVisibleErrorDetail | undefined {
  if (job.displayStatus !== 'failed' && job.displayStatus !== 'expired') {
    return undefined;
  }

  return {
    code:
      job.errorCode ??
      (job.displayStatus === 'expired' ? 'JOB_ASSET_EXPIRED' : 'JOB_FAILED'),
    guidance: job.message,
    location: receipt.kind === 'video' ? '영상 추출 상태' : '자막 생성 상태',
    requestPath: createJobStatusRequestPath(receipt),
  };
}

/** 접수증 종류에 맞는 job 상태 endpoint path를 만든다. */
function createJobStatusRequestPath(receipt: JobReceipt) {
  return receipt.kind === 'video'
    ? `/downloads/${receipt.jobId}`
    : `/subtitles/jobs/${receipt.jobId}`;
}

/** job 응답에서 polling 중단 판단에 필요한 표시 상태를 읽는다. */
function getDisplayStatus(value: unknown) {
  if (!value || typeof value !== 'object' || !('displayStatus' in value)) {
    return undefined;
  }

  return typeof value.displayStatus === 'string'
    ? value.displayStatus
    : undefined;
}
