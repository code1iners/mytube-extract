import { useEffect, useRef, useState } from 'react';
import { useNavigation } from '../../components/navigation-context';
import {
  useExtractionRequestLifecycle,
  type RequestLifecycleAdapter,
  type RequestLifecycleJob,
} from '../../hooks/use-extraction-request-lifecycle';
import { subscribeToAcceptedJobReceipts, type JobReceipt, type JobReceiptKind } from '../../utils/job-receipt.util';

/** 목록 전체에서 하나만 사용하는 접수 제어. 영상·자막 어댑터 모두 연결할 수 있다. */
export function useHistoryAcceptance<TRequest, TJob extends RequestLifecycleJob, TKind extends JobReceiptKind>(
  adapter: RequestLifecycleAdapter<TRequest, TJob, TKind>,
  onReceipt: (receipt: JobReceipt, storageFailed: boolean) => void,
) {
  /** 현재 접수 조작을 시작한 항목. */
  const [source, setSource] = useState<JobReceipt | null>(null);
  /** 렌더 전에 들어오는 다른 항목의 클릭도 즉시 차단한다. */
  const submittingRef = useRef(false);
  /** 비동기 저장 결과에 최신 목록 반영 함수를 사용한다. */
  const onReceiptRef = useRef(onReceipt);
  onReceiptRef.current = onReceipt;
  useEffect(function subscribeToAcceptedReceipts() {
    /** 이전 화면에서 시작한 늦은 성공도 현재 화면에서만 반영한다. */
    return subscribeToAcceptedJobReceipts((receipt, storageFailed) => {
      onReceiptRef.current(receipt, storageFailed);
    });
  }, []);
  /** 기존 메뉴 이동 잠금과 현재 세션 내역 연결. */
  const { setHistoryDestination, setNavigationLocked } = useNavigation();
  /** 준비 확인·중복 차단·취소·늦은 응답은 기존 생명주기가 책임진다. */
  const lifecycle = useExtractionRequestLifecycle({
    adapter,
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
