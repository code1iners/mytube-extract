import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { getWorkerHealth } from '../../api/mytube-extract.api';
import { getWorkerHealthStatus } from '../utils/worker-health-notice.util';

/** worker health query polling 간격. */
const WORKER_HEALTH_REFETCH_INTERVAL_MS = 15_000;

/** 요청 route별 worker readiness 입력. */
type WorkerReadinessInput = {
  /** API base URL. */
  apiBaseUrl: string | undefined;
  /** worker 미가용 시 표시할 route별 안내 문구. */
  unavailableMessage: string;
};

/** 영상·자막 요청 전에 공유하는 API·worker readiness 상태를 관리한다. */
export function useWorkerReadiness(input: WorkerReadinessInput) {
  /** 마지막 worker health 확인 시작 시각(epoch milliseconds). */
  const [workerHealthCheckedAt, setWorkerHealthCheckedAt] = useState(0);
  /** worker health query. */
  const workerHealthQuery = useQuery({
    queryKey: ['worker-health', input.apiBaseUrl],
    queryFn: () => getWorkerHealth({ apiBaseUrl: input.apiBaseUrl }),
    refetchInterval: WORKER_HEALTH_REFETCH_INTERVAL_MS,
    retry: false,
  });
  /** worker가 미가용 상태인지 여부. */
  const workerUnavailable =
    workerHealthQuery.data?.worker?.available === false;
  /** worker health 확인에 실패했는지 여부. */
  const workerHealthFailed = workerHealthQuery.isError;
  /** 요청 설정 화면에 표시할 worker health 상태. */
  const workerHealthStatus = getWorkerHealthStatus({
    apiReady: workerHealthQuery.data?.ok,
    hasError: workerHealthFailed,
    isFetching: workerHealthQuery.isFetching,
    unavailableMessage: input.unavailableMessage,
    workerAvailable: workerHealthQuery.data?.worker?.available,
  });

  /** worker health를 중복 요청 없이 다시 확인한다. */
  function retryWorkerHealth() {
    if (workerHealthQuery.isFetching) {
      return;
    }

    void workerHealthQuery.refetch({ cancelRefetch: false });
  }

  useEffect(
    function recordWorkerHealthCheckTimestamp() {
      if (workerHealthQuery.isFetching) {
        setWorkerHealthCheckedAt(Date.now());
      }
    },
    [workerHealthQuery.isFetching],
  );

  return {
    retryWorkerHealth,
    workerHealthCheckedAt,
    workerHealthFailed,
    workerHealthQuery,
    workerHealthStatus,
    workerUnavailable,
  };
}
