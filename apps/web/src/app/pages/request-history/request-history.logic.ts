import { z } from 'zod';
import {
  JOB_STATUS_REFETCH_INTERVAL_MS,
  getDownloadJob,
  getSubtitleJob,
} from '../../../api/mytube-extract.api';
import {
  type JobReceipt,
  parseJobReceiptStorageKey,
} from '../../utils/job-receipt.util';

const deepLinkSchema = z.object({
  kind: z.enum(['video', 'subtitle']),
  jobId: z.string().uuid(),
});

export function parseHistoryDeepLink(
  search: string,
  acceptedAt = new Date().toISOString(),
): JobReceipt | null {
  const params = new URLSearchParams(search);
  const parsed = deepLinkSchema.safeParse({
    kind: params.get('kind'),
    jobId: params.get('jobId'),
  });

  return parsed.success ? { ...parsed.data, acceptedAt } : null;
}

export function getHistoryRefetchInterval(status?: string) {
  return status === 'completed' || status === 'failed' || status === 'expired'
    ? false
    : JOB_STATUS_REFETCH_INTERVAL_MS;
}

export function fetchHistoryJobStatus(
  receipt: JobReceipt,
  apiBaseUrl: string | undefined,
  signal: AbortSignal,
) {
  return receipt.kind === 'video'
    ? getDownloadJob(receipt.jobId, { apiBaseUrl, signal })
    : getSubtitleJob(receipt.jobId, { apiBaseUrl, signal });
}

/** 다른 탭의 접수증 삭제·재추가를 deep-link fallback보다 우선한다. */
export function updateDismissedReceiptKeys(
  current: Set<string>,
  storageKey: string | null,
  newValue: string | null,
) {
  const receipt = parseJobReceiptStorageKey(storageKey);

  if (!receipt) {
    return current;
  }

  const next = new Set(current);
  const identity = `${receipt.kind}:${receipt.jobId}`;

  if (newValue === null) {
    next.add(identity);
  } else {
    next.delete(identity);
  }

  return next;
}
