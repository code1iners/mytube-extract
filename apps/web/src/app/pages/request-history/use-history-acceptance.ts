import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation } from '../../components/navigation-context';
import {
  useExtractionRequestLifecycle,
  type RequestLifecycleAdapter,
  type RequestLifecycleJob,
} from '../../hooks/use-extraction-request-lifecycle';
import { acceptJobReceipt, listJobReceipts, removeJobReceipt, type JobReceipt, type JobReceiptKind } from '../../utils/job-receipt.util';

/** 저장에 실패한 접수증만 같은 탭의 메뉴 이동 동안 보존한다. */
const sessionReceipts = new Map<string, JobReceipt>();
/** 저장소가 막혀 정리하지 못한 보존 범위 밖 항목은 현재 세션에서도 제외한다. */
const prunedReceipts = new Set<string>();

/** 보존 범위 밖 항목이 저장소 복구나 메뉴 이동 뒤 되살아나는 것을 막는다. */
export function isHistoryReceiptPruned(receipt: Pick<JobReceipt, 'kind' | 'jobId'>) {
  return prunedReceipts.has(`${receipt.kind}:${receipt.jobId}`);
}

/** 새 접수 시 저장된 내역과 세션 내역을 합쳐 최신 20건만 보존한다. */
function pruneHistoryReceipts(previousReceipts: JobReceipt[]) {
  /** 저장소와 세션의 동일 접수증을 합친 최신순 목록. */
  const receipts = [...new Map([
    ...previousReceipts,
    ...listJobReceipts().receipts,
    ...sessionReceipts.values(),
  ].filter((receipt) => !isHistoryReceiptPruned(receipt))
    .map((receipt) => [`${receipt.kind}:${receipt.jobId}`, receipt])).values()]
    .sort((left, right) => right.acceptedAt.localeCompare(left.acceptedAt));
  for (const receipt of receipts.slice(20)) {
    /** 저장이 차단돼도 현재 탭에서는 보존 범위 밖 항목을 다시 표시하지 않는다. */
    const key = `${receipt.kind}:${receipt.jobId}`;
    sessionReceipts.delete(key);
    prunedReceipts.add(key);
    removeJobReceipt(receipt.kind, receipt.jobId);
  }
}

/** 브라우저 저장소와 합칠 현재 세션의 접수증. */
export function getHistorySessionReceipts() {
  return [...sessionReceipts.values()];
}

/** 삭제·404·다른 탭의 변경이 세션 접수증을 되살리지 않도록 정리한다. */
export function forgetHistorySessionReceipt(receipt: Pick<JobReceipt, 'kind' | 'jobId'>) {
  sessionReceipts.delete(`${receipt.kind}:${receipt.jobId}`);
}

/** 목록 전체에서 하나만 사용하는 접수 제어. 영상·자막 어댑터 모두 연결할 수 있다. */
export function useHistoryAcceptance<TRequest, TJob extends RequestLifecycleJob, TKind extends JobReceiptKind>(
  adapter: RequestLifecycleAdapter<TRequest, TJob, TKind>,
  onReceipt: (receipt: JobReceipt, storageFailed: boolean) => void,
) {
  /** 현재 접수 조작을 시작한 항목. */
  const [source, setSource] = useState<JobReceipt | null>(null);
  /** 렌더 전에 들어오는 다른 항목의 클릭도 즉시 차단한다. */
  const submittingRef = useRef(false);
  /** 화면을 떠난 뒤 늦은 응답은 저장만 하고 포커스를 옮기지 않는다. */
  const mountedRef = useRef(true);
  useEffect(function trackHistoryMount() {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  /** 비동기 저장 결과에 최신 목록 반영 함수를 사용한다. */
  const onReceiptRef = useRef(onReceipt);
  onReceiptRef.current = onReceipt;
  /** 기존 메뉴 이동 잠금과 현재 세션 내역 연결. */
  const { setHistoryDestination, setNavigationLocked } = useNavigation();
  /** 늦은 성공도 생명주기의 저장 경계를 지나 목록에 반영한다. */
  const receiptStore = useMemo(() => ({
    save(kind: JobReceiptKind, jobId: string, acceptedAt: string) {
      /** 서버가 실제 발급한 새 접수증. */
      const receipt = { kind, jobId, acceptedAt };
      /** 저장 함수가 먼저 정리할 오래된 접수증도 딥링크 복원에서 제외한다. */
      const previousReceipts = listJobReceipts().receipts;
      /** 영속 저장에 실패해도 서버 접수는 성공이다. */
      const result = acceptJobReceipt(kind, jobId, acceptedAt);
      if (result.storageFailed) sessionReceipts.set(`${kind}:${jobId}`, receipt);
      pruneHistoryReceipts(previousReceipts);
      if (mountedRef.current) onReceiptRef.current(receipt, result.storageFailed);
      return result;
    },
  }), []);
  /** 준비 확인·중복 차단·취소·늦은 응답은 기존 생명주기가 책임진다. */
  const lifecycle = useExtractionRequestLifecycle({
    adapter,
    receiptStore,
    trackAcceptedJob: false,
    navigation: { setHistoryDestination, setLocked: setNavigationLocked },
    messages: {
      unavailable: '현재 추출 서버가 준비되지 않았습니다. 다시 확인해 주세요.',
      cancelled: '접수를 중단했습니다. 기존 내역과 작성 중인 입력은 그대로입니다.',
    },
  });

  useEffect(function releaseSubmissionGuard() {
    if (lifecycle.phase !== 'accepting') submittingRef.current = false;
  }, [lifecycle.phase]);

  /** 같은 렌더의 반복 클릭도 생명주기의 동기 잠금으로 한 번만 접수한다. */
  function submit(receipt: JobReceipt, request: TRequest) {
    if (submittingRef.current || !lifecycle.actions.submit) return;
    submittingRef.current = true;
    setSource(receipt);
    lifecycle.actions.submit(request);
  }

  return { source, lifecycle, submit, isSubmitting: () => submittingRef.current };
}
