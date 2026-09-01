import {
  JOB_STATUS_REFETCH_INTERVAL_MS,
  getDownloadJob,
  getSubtitleJob,
} from '../../api/mytube-extract.api';
import type { JobReceipt } from './job-receipt.util';

/** terminal 상태에서는 job 상태 polling을 중단한다. */
export function getJobStatusRefetchInterval(status?: string) {
  return status === 'completed' || status === 'failed' || status === 'expired'
    ? false
    : JOB_STATUS_REFETCH_INTERVAL_MS;
}

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
