import { type UserVisibleErrorDetail } from '../../api/mytube-extract.api';
import { type WorkerHealthStatus } from '../utils/worker-health-notice.util';
import { SECONDARY_BUTTON_UTILITY_CLASS_NAME } from './button-class-names';
import { ErrorDetailsDisclosure } from './error-details-disclosure';

/** 입력을 유지하면서 제출 불가 사유와 복구 동작을 한곳에 표시한다. */
export function RequestReadinessNotice(props: {
  /** 제출 버튼이 참조하는 안내 id. */
  id: string;
  /** 최신 준비 상태. */
  status: WorkerHealthStatus;
  /** 재확인 중 중복 실행 차단 여부. */
  isFetching: boolean;
  /** 펼쳐 볼 기술 상세. */
  technicalDetail?: UserVisibleErrorDetail;
  /** 준비 상태 재확인. */
  onRetry: () => void;
}) {
  if (props.status.kind === 'ready') return null;

  return (
    <div className="request-readiness-notice">
      <p id={props.id} role={props.status.role} aria-atomic="true">
        <strong>{props.status.label}</strong> {props.status.message}
      </p>
      {props.status.kind !== 'checking' ? (
        <button
          className={SECONDARY_BUTTON_UTILITY_CLASS_NAME}
          aria-label="서비스 상태 다시 확인"
          disabled={props.isFetching}
          type="button"
          onClick={props.onRetry}
        >
          {props.isFetching ? '확인 중' : '다시 확인'}
        </button>
      ) : null}
      {props.technicalDetail ? (
        <ErrorDetailsDisclosure detail={props.technicalDetail} summary="상태 확인 정보" />
      ) : null}
    </div>
  );
}
