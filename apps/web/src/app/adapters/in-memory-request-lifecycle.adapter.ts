import type { JobReceipt, JobReceiptKind } from '../utils/job-receipt.util';
import type {
  RequestLifecycleAdapter,
  RequestLifecycleJob,
  RequestReadinessResponse,
} from '../hooks/use-extraction-request-lifecycle';

/** in-memory lifecycle adapter 생성에 사용할 동작. */
export type InMemoryRequestLifecycleAdapterOptions<
  TRequest,
  TJob extends RequestLifecycleJob,
  TKind extends JobReceiptKind,
> = {
  /** adapter가 제공할 접수증 종류. */
  kind: TKind;
  /** readiness 결과 또는 제어 가능한 readiness 함수. */
  readiness:
    | RequestReadinessResponse
    | ((signal: AbortSignal) => Promise<RequestReadinessResponse>);
  /** 요청 생성 동작. */
  createRequest: (request: TRequest, signal: AbortSignal) => Promise<TJob>;
  /** 접수된 job 상태 조회 동작. */
  getStatus: (
    receipt: JobReceipt & { kind: TKind },
    signal: AbortSignal,
  ) => Promise<TJob>;
};

/** 운영 adapter와 같은 lifecycle seam을 사용하는 in-memory adapter를 만든다. */
export function createInMemoryRequestLifecycleAdapter<
  TRequest,
  TJob extends RequestLifecycleJob,
  TKind extends JobReceiptKind,
>(
  options: InMemoryRequestLifecycleAdapterOptions<TRequest, TJob, TKind>,
): RequestLifecycleAdapter<TRequest, TJob, TKind> {
  /** readiness 결과를 반환하는 in-memory 동작. */
  async function checkReadiness(signal: AbortSignal) {
    throwIfAborted(signal);

    if (typeof options.readiness === 'function') {
      return options.readiness(signal);
    }

    return options.readiness;
  }

  /** 요청 생성 결과를 반환하는 in-memory 동작. */
  async function createRequest(request: TRequest, signal: AbortSignal) {
    throwIfAborted(signal);
    return options.createRequest(request, signal);
  }

  /** 상태 조회 결과를 반환하는 in-memory 동작. */
  async function getStatus(
    receipt: JobReceipt & { kind: TKind },
    signal: AbortSignal,
  ) {
    throwIfAborted(signal);
    return options.getStatus(receipt, signal);
  }

  return {
    checkReadiness,
    createRequest,
    getStatus,
    kind: options.kind,
  };
}

/** 이미 중단된 in-memory 작업이 부작용을 만들지 않게 한다. */
function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }
}
