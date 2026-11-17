import { type UserVisibleErrorDetail } from '../../api/mytube-extract.api';
import { type WorkerHealthStatus } from '../utils/worker-health-notice.util';
import { SECONDARY_BUTTON_UTILITY_CLASS_NAME } from './button-class-names';
import { ErrorDetailsDisclosure } from './error-details-disclosure';
import { LoadingSpinner } from './loading-spinner';

/** 준비 확인 중인 제출 버튼이 원래 이름 대신 보여 주는 내용. 버튼 크기는 그대로라 주변이 밀리지 않는다. */
export function RequestReadinessCheckingLabel() {
  return (
    <>
      <LoadingSpinner />
      서비스 확인 중
    </>
  );
}

/**
 * 입력을 유지하면서 제출 불가 사유와 복구 동작을 한곳에 표시한다.
 * 확인 중에는 자리를 차지하지 않고 보조 기술에만 알린다. 눈에 보이는 표시는 제출 버튼이 맡는다.
 */
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

  // 확인 중 한 줄이 생겼다 사라지면 제출 버튼이 밀리므로 화면에는 그리지 않는다.
  if (props.status.kind === 'checking') {
    return (
      <p className="visually-hidden" id={props.id} role={props.status.role} aria-atomic="true">
        <strong>{props.status.label}</strong> {props.status.message}
      </p>
    );
  }

  return (
    <div className="request-readiness-notice">
      <p id={props.id} role={props.status.role} aria-atomic="true">
        <strong>{props.status.label}</strong> {props.status.message}
      </p>
      <button
        className={SECONDARY_BUTTON_UTILITY_CLASS_NAME}
        aria-label="서비스 상태 다시 확인"
        disabled={props.isFetching}
        type="button"
        onClick={props.onRetry}
      >
        {props.isFetching ? '확인 중' : '다시 확인'}
      </button>
      {props.technicalDetail ? (
        <ErrorDetailsDisclosure detail={props.technicalDetail} summary="상태 확인 정보" />
      ) : null}
    </div>
  );
}
