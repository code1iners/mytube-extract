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
/** 저장에 실패한 접수증만 같은 탭의 메뉴 이동 동안 보존한다. */
const sessionReceipts = new Map<string, JobReceipt>();
/** 저장소가 막혀 정리하지 못한 보존 범위 밖 항목은 현재 세션에서도 제외한다. */
const prunedReceipts = new Set<string>();
/** 같은 탭에서 현재 열려 있는 내역 화면에 접수 성공을 알린다. */
const receiptListeners = new Set<(receipt: JobReceipt, storageFailed: boolean) => void>();
/** 다른 탭의 새 접수로 현재 탭의 보존 범위를 정리한 뒤 목록을 갱신한다. */
const retentionListeners = new Set<() => void>();
/** 메뉴를 떠나 있어도 저장 실패 접수증의 보존 범위를 동기화하는 탭 수명의 채널. */
let acceptanceChannel: BroadcastChannel | null = null;

/** 저장 형식이 같은 명시적 복원과 새 접수를 별도 신호로 구분한다. */
function getAcceptanceChannel() {
  if (acceptanceChannel) return acceptanceChannel;
  if (typeof window === 'undefined' || typeof window.BroadcastChannel === 'undefined') return null;
  try {
    acceptanceChannel = new window.BroadcastChannel('mytube-extract:accepted-job-receipts');
    acceptanceChannel.addEventListener('message', (event: MessageEvent<unknown>) => {
      if (event.data !== 'accepted' || sessionReceipts.size === 0) return;
      pruneAcceptedReceipts([]);
      retentionListeners.forEach((listener) => listener());
    });
    return acceptanceChannel;
  } catch {
    // 탭 통신이 막혀도 이미 생성된 서버 요청의 접수증은 그대로 보존한다.
    return null;
  }
}

/** 보존 범위 밖 항목이 저장소 복구나 메뉴 이동 뒤 되살아나는 것을 막는다. */
export function isJobReceiptPruned(receipt: Pick<JobReceipt, 'kind' | 'jobId'>) {
  return prunedReceipts.has(createReceiptKey(receipt.kind, receipt.jobId));
}

/** 브라우저 저장소와 합칠 현재 세션의 접수증. */
export function getSessionJobReceipts() {
  return [...sessionReceipts.values()];
}

/** 삭제·404·다른 탭의 변경이 세션 접수증을 되살리지 않도록 정리한다. */
export function forgetSessionJobReceipt(receipt: Pick<JobReceipt, 'kind' | 'jobId'>) {
  sessionReceipts.delete(createReceiptKey(receipt.kind, receipt.jobId));
}

/** 같은 탭에는 storage 이벤트가 없으므로 늦은 성공도 별도로 구독한다. */
export function subscribeToAcceptedJobReceipts(listener: (receipt: JobReceipt, storageFailed: boolean) => void) {
  receiptListeners.add(listener);
  return () => { receiptListeners.delete(listener); };
}

/** 다른 탭의 새 접수는 현재 화면의 포커스나 성공 안내를 바꾸지 않는다. */
export function subscribeToJobReceiptRetention(listener: () => void) {
  retentionListeners.add(listener);
  return () => { retentionListeners.delete(listener); };
}

/** 어느 화면에서 접수했든 저장된 내역과 세션 내역을 합쳐 최신 20건만 보존한다. */
function pruneAcceptedReceipts(previousReceipts: JobReceipt[]) {
  /** 저장 함수가 먼저 정리한 접수증도 딥링크 복원에서 제외할 최신순 목록. */
  const receipts = [...new Map([
    ...previousReceipts,
    ...listJobReceipts().receipts,
    ...sessionReceipts.values(),
  ].filter((receipt) => !isJobReceiptPruned(receipt))
    .map((receipt) => [createReceiptKey(receipt.kind, receipt.jobId), receipt])).values()]
    .sort((left, right) => right.acceptedAt.localeCompare(left.acceptedAt));
  for (const receipt of receipts.slice(MAX_JOB_RECEIPTS)) {
    /** 저장이 차단돼도 현재 탭에서는 보존 범위 밖 항목을 다시 표시하지 않는다. */
    const key = createReceiptKey(receipt.kind, receipt.jobId);
    sessionReceipts.delete(key);
    prunedReceipts.add(key);
    removeJobReceipt(receipt.kind, receipt.jobId);
  }
}

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
    storeJobReceipt({
      acceptedAt: parsedValue.data.acceptedAt,
      jobId: parsedJobId.data,
      kind,
    });

    for (const receipt of listJobReceipts().receipts.slice(MAX_JOB_RECEIPTS)) {
      localStorage.removeItem(createReceiptKey(receipt.kind, receipt.jobId));
    }

    return true;
  } catch {
    return false;
  }
}

/** 서버가 접수한 job을 저장하고 history 이동 정보를 만든다. */
export function acceptJobReceipt(
  kind: JobReceiptKind,
  jobId: string,
  acceptedAt = new Date().toISOString(),
) {
  /** addJobReceipt가 먼저 제거하는 오래된 접수증도 보존 범위에서 제외한다. */
  const previousReceipts = listJobReceipts().receipts;
  const result = {
    storageFailed: !addJobReceipt(kind, jobId, acceptedAt),
    to: `/history?kind=${kind}&jobId=${encodeURIComponent(jobId)}`,
  };
  /** 잘못된 서버 식별자는 세션 저장과 성공 알림에도 사용하지 않는다. */
  const parsedReceipt = jobReceiptSchema.safeParse({ kind, jobId, acceptedAt });
  if (parsedReceipt.success) {
    const receipt = parsedReceipt.data;
    const key = createReceiptKey(kind, jobId);
    if (result.storageFailed) sessionReceipts.set(key, receipt);
    else sessionReceipts.delete(key);
    pruneAcceptedReceipts(previousReceipts);
    // 저장과 정리가 끝난 뒤 현재 화면에만 성공을 알린다.
    receiptListeners.forEach((listener) => listener(receipt, result.storageFailed));
    getAcceptanceChannel()?.postMessage('accepted');
  }
  return result;
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

  try {
    // 복원은 동시 추가된 다른 접수증을 용량 정리 대상으로 만들지 않는다.
    storeJobReceipt(parsedReceipt.data);
  } catch {
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

/** 검증된 접수증을 정리 정책 없이 browser storage에 저장한다. */
function storeJobReceipt(receipt: JobReceipt) {
  localStorage.setItem(
    createReceiptKey(receipt.kind, receipt.jobId),
    JSON.stringify({ acceptedAt: receipt.acceptedAt }),
  );
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
