import {
  JOB_STATUS_REFETCH_INTERVAL_MS,
  getJobStatusRetryDelay,
  getDownloadJob,
  getSubtitleJob,
  shouldRetryJobStatus,
} from '../../api/mytube-extract.api';
import type { DownloadResponse } from '../../domain/download-request/download-request';
import type { SubtitleJobResponse } from '../../domain/subtitle-request/subtitle-request';
import type { JobReceipt } from './job-receipt.util';

/** terminal 상태에서는 job 상태 polling을 중단한다. */
export function getJobStatusRefetchInterval(status?: string) {
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
    refetchInterval: (query: { state: { data?: TJobStatus } }) =>
      getJobStatusRefetchInterval(getDisplayStatus(query.state.data)),
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

/** job 응답에서 polling 중단 판단에 필요한 표시 상태를 읽는다. */
function getDisplayStatus(value: unknown) {
  if (!value || typeof value !== 'object' || !('displayStatus' in value)) {
    return undefined;
  }

  return typeof value.displayStatus === 'string'
    ? value.displayStatus
    : undefined;
}
