import { useCallback, useEffect, useRef, useState } from 'react';
import { isAbortError } from '../../api/mytube-extract.api';

/** 서버 job 생성 전 브라우저 요청의 생명주기 상태. */
export type RequestAttempt = {
  /** 이번 요청을 중단할 controller. */
  controller: AbortController;
  /** 사용자가 서버 job 생성 전에 중단을 눌렀는지 여부. */
  cancelled: boolean;
};

/** 요청 attempt와 navigation lock을 함께 관리하는 입력. */
type UseRequestAttemptInput = {
  /** 현재 mutation이 route 이동을 막아야 하는지 여부. */
  navigationLocked: boolean;
  /** 앱 전역 navigation lock 갱신 함수. */
  setNavigationLocked: (locked: boolean) => void;
};

/** 영상·자막 job 생성 요청의 중단과 응답 경쟁 상태를 공유한다. */
export function useRequestAttempt(input: UseRequestAttemptInput) {
  /** 현재 서버 job 생성 요청. */
  const requestAttemptRef = useRef<RequestAttempt | null>(null);
  /** 중단 직후 mutation 정리 전에도 navigation을 해제할지 여부. */
  const [requestCancelled, setRequestCancelled] = useState(false);

  /** 현재 요청을 중단하고 attempt 참조를 비운다. */
  const stopRequestAttempt = useCallback(function stopRequestAttempt() {
    requestAttemptRef.current?.controller.abort();
    requestAttemptRef.current = null;
  }, []);

  /** 이전 요청을 정리하고 새 job 생성 요청을 시작한다. */
  const beginRequestAttempt = useCallback(function beginRequestAttempt() {
    stopRequestAttempt();
    setRequestCancelled(false);

    /** 새 요청에 전용으로 사용할 attempt. */
    const attempt: RequestAttempt = {
      cancelled: false,
      controller: new AbortController(),
    };
    requestAttemptRef.current = attempt;
    return attempt;
  }, [stopRequestAttempt]);

  /** 사용자가 현재 요청을 중단했음을 기록하고 navigation을 즉시 해제한다. */
  const cancelRequestAttempt = useCallback(function cancelRequestAttempt() {
    /** 중단할 현재 요청. */
    const attempt = requestAttemptRef.current;

    if (!attempt) {
      return false;
    }

    attempt.cancelled = true;
    attempt.controller.abort();
    requestAttemptRef.current = null;
    setRequestCancelled(true);
    input.setNavigationLocked(false);
    return true;
  }, [input.setNavigationLocked]);

  /** 오류 복구나 새 화면 전환 전에 요청과 중단 상태를 초기화한다. */
  const resetRequestAttempt = useCallback(function resetRequestAttempt() {
    stopRequestAttempt();
    setRequestCancelled(false);
  }, [stopRequestAttempt]);

  /** 현재 요청 또는 중단과 경쟁해 생성된 서버 job 응답을 보존할지 판단한다. */
  const acceptRequestResult = useCallback(function acceptRequestResult(
    attempt: RequestAttempt,
  ) {
    /** 현재 요청이거나 사용자가 중단한 뒤 도착한 응답인지 여부. */
    const shouldAccept =
      requestAttemptRef.current === attempt || attempt.cancelled;

    if (shouldAccept) {
      setRequestCancelled(false);
    }

    return shouldAccept;
  }, []);

  /** 중단되거나 이미 교체된 요청의 오류를 화면에서 무시할지 판단한다. */
  const shouldIgnoreRequestError = useCallback(function shouldIgnoreRequestError(
    attempt: RequestAttempt | undefined,
    error: unknown,
  ) {
    return (
      attempt?.cancelled === true ||
      requestAttemptRef.current !== attempt ||
      isAbortError(error)
    );
  }, []);

  /** 완료된 요청이 아직 현재 attempt라면 참조를 비운다. */
  const finishRequestAttempt = useCallback(function finishRequestAttempt(
    attempt: RequestAttempt | undefined,
  ) {
    if (
      attempt &&
      requestAttemptRef.current?.controller === attempt.controller
    ) {
      requestAttemptRef.current = null;
    }
  }, []);

  useEffect(
    function synchronizeRequestNavigationLock() {
      input.setNavigationLocked(input.navigationLocked && !requestCancelled);
    },
    [input.navigationLocked, input.setNavigationLocked, requestCancelled],
  );

  useEffect(
    function cleanupRequestAttempt() {
      return () => {
        stopRequestAttempt();
        input.setNavigationLocked(false);
      };
    },
    [input.setNavigationLocked, stopRequestAttempt],
  );

  return {
    acceptRequestResult,
    beginRequestAttempt,
    cancelRequestAttempt,
    finishRequestAttempt,
    resetRequestAttempt,
    shouldIgnoreRequestError,
  };
}
