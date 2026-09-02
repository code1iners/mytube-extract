import { z } from 'zod';

export type JobReceiptKind = 'video' | 'subtitle';

export type JobReceipt = {
  kind: JobReceiptKind;
  jobId: string;
  acceptedAt: string;
};

const JOB_RECEIPT_PREFIX = 'mytube-extract:job-receipt:v2:';
const MAX_JOB_RECEIPTS = 20;
const jobIdSchema = z.string().uuid();
/** 브라우저에 저장 가능한 접수증 전체 형식. */
const jobReceiptSchema = z.object({
  kind: z.enum(['video', 'subtitle']),
  jobId: jobIdSchema,
  acceptedAt: z.iso.datetime(),
});
/** 접수증 storage value 형식. */
const receiptValueSchema = jobReceiptSchema.pick({ acceptedAt: true });

/** 유효한 접수증을 최신순으로 읽고 손상된 접수증만 정리한다. */
export function listJobReceipts(): {
  receipts: JobReceipt[];
  storageAvailable: boolean;
} {
  try {
    const receipts: JobReceipt[] = [];
    const invalidKeys: string[] = [];

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);

      if (!key?.startsWith(JOB_RECEIPT_PREFIX)) {
        continue;
      }

      const receipt = parseReceipt(key, localStorage.getItem(key));

      if (receipt) {
        receipts.push(receipt);
      } else {
        invalidKeys.push(key);
      }
    }

    invalidKeys.forEach((key) => localStorage.removeItem(key));
    receipts.sort((left, right) => right.acceptedAt.localeCompare(left.acceptedAt));

    return { receipts, storageAvailable: true };
  } catch {
    return { receipts: [], storageAvailable: false };
  }
}

/** 접수증 하나를 저장하고 최신 20건만 유지한다. */
export function addJobReceipt(
  kind: JobReceiptKind,
  jobId: string,
  acceptedAt = new Date().toISOString(),
) {
  const parsedJobId = jobIdSchema.safeParse(jobId);
  const parsedValue = receiptValueSchema.safeParse({ acceptedAt });

  if (!parsedJobId.success || !parsedValue.success) {
    return false;
  }

  try {
    localStorage.setItem(
      createReceiptKey(kind, parsedJobId.data),
      JSON.stringify(parsedValue.data),
    );

    for (const receipt of listJobReceipts().receipts.slice(MAX_JOB_RECEIPTS)) {
      localStorage.removeItem(createReceiptKey(receipt.kind, receipt.jobId));
    }

    return true;
  } catch {
    return false;
  }
}

/** 서버가 접수한 job을 저장하고 history 이동 정보를 만든다. */
export function acceptJobReceipt(kind: JobReceiptKind, jobId: string) {
  return {
    storageFailed: !addJobReceipt(kind, jobId),
    to: `/history?kind=${kind}&jobId=${encodeURIComponent(jobId)}`,
  };
}

/** 종류와 UUID가 모두 일치하는 접수증 하나만 제거한다. */
export function removeJobReceipt(kind: JobReceiptKind, jobId: string) {
  if (!jobIdSchema.safeParse(jobId).success) {
    return false;
  }

  try {
    localStorage.removeItem(createReceiptKey(kind, jobId));
    return true;
  } catch {
    return false;
  }
}

/** 삭제한 접수증을 같은 정체성과 접수 시각으로 복원한다. */
export function restoreJobReceipt(receipt: JobReceipt) {
  /** 복원 요청으로 전달된 접수증의 유효성 결과. */
  const parsedReceipt = jobReceiptSchema.safeParse(receipt);

  if (!parsedReceipt.success) {
    return false;
  }

  // 기존 접수증 추가 seam으로 동일한 key와 acceptedAt을 저장한다.
  if (
    !addJobReceipt(
      parsedReceipt.data.kind,
      parsedReceipt.data.jobId,
      parsedReceipt.data.acceptedAt,
    )
  ) {
    return false;
  }

  // 저장 직후 다시 읽어 실제 복원 결과를 확인한다.
  /** 복원 직후 storage에서 읽은 접수증 목록. */
  const storedReceipts = listJobReceipts();

  return (
    storedReceipts.storageAvailable &&
    storedReceipts.receipts.some(
      (storedReceipt) =>
        storedReceipt.kind === parsedReceipt.data.kind &&
        storedReceipt.jobId === parsedReceipt.data.jobId &&
        storedReceipt.acceptedAt === parsedReceipt.data.acceptedAt,
    )
  );
}

function createReceiptKey(kind: JobReceiptKind, jobId: string) {
  return `${JOB_RECEIPT_PREFIX}${kind}:${jobId}`;
}

/** storage event key에서 유효한 접수증 종류와 job ID를 읽는다. */
export function parseJobReceiptStorageKey(
  key: string | null,
): Pick<JobReceipt, 'kind' | 'jobId'> | null {
  if (!key?.startsWith(JOB_RECEIPT_PREFIX)) {
    return null;
  }

  const [kind, jobId, ...rest] = key.slice(JOB_RECEIPT_PREFIX.length).split(':');
  const parsedJobId = jobIdSchema.safeParse(jobId);

  return rest.length === 0 &&
    (kind === 'video' || kind === 'subtitle') &&
    parsedJobId.success
    ? { kind, jobId: parsedJobId.data }
    : null;
}

function parseReceipt(key: string, value: string | null): JobReceipt | null {
  const parsedKey = parseJobReceiptStorageKey(key);

  if (!parsedKey || value === null) {
    return null;
  }

  try {
    const parsedValue = receiptValueSchema.safeParse(JSON.parse(value));

    return parsedValue.success
      ? { ...parsedKey, acceptedAt: parsedValue.data.acceptedAt }
      : null;
  } catch {
    return null;
  }
}
