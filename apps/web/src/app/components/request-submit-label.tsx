import type { ReactNode } from 'react';
import {
  WORKER_HEALTH_CHECKING_SUBMIT_LABEL,
  type WorkerHealthStatus,
} from '../utils/worker-health-notice.util';
import { LoadingSpinner } from './loading-spinner';

/** RequestSubmitLabel 속성. */
type RequestSubmitLabelProps = {
  /** 최신 준비 상태. */
  status: WorkerHealthStatus;
  /** 준비 확인이 끝난 뒤 보여 줄 버튼의 원래 내용. */
  children: ReactNode;
};

/**
 * 준비 상태에 따라 요청 버튼 안에 넣을 내용을 고른다.
 * 최초 확인 중에는 원래 내용 대신 진행 표시를 보여 준다. 버튼 밖에 줄을 만들지 않아 주변이 밀리지 않는다.
 */
export function RequestSubmitLabel({ status, children }: RequestSubmitLabelProps) {
  if (status.kind !== 'checking') return <>{children}</>;

  return (
    <>
      <LoadingSpinner />
      {WORKER_HEALTH_CHECKING_SUBMIT_LABEL}
    </>
  );
}
