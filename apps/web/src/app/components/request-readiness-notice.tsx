import { type UserVisibleErrorDetail } from '../../api/mytube-extract.api';
import {
  WORKER_HEALTH_RECHECK_LABEL,
  WORKER_HEALTH_RECHECKING_LABEL,
  type WorkerHealthStatus,
} from '../utils/worker-health-notice.util';
import { SECONDARY_BUTTON_UTILITY_CLASS_NAME } from './button-class-names';
import { ErrorDetailsDisclosure } from './error-details-disclosure';
import { LoadingSpinner } from './loading-spinner';

/** 재확인 버튼의 Tailwind className. 문구가 바뀌어도 폭이 흔들리지 않게 최소 폭을 잡는다. */
const READINESS_RETRY_BUTTON_CLASS_NAME =
  `request-readiness-notice__retry min-w-[7rem] gap-mytube-8 ${SECONDARY_BUTTON_UTILITY_CLASS_NAME}`;

/**
 * 입력을 유지하면서 제출 불가 사유와 복구 동작을 한곳에 표시한다.
 * 최초 확인 중에는 자리를 차지하지 않고 보조 기술에만 알린다. 눈에 보이는 표시는 요청 버튼이 맡는다.
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

  /** 확인 중 한 줄이 생겼다 사라지면 제출 버튼이 밀리므로 화면에는 그리지 않는지 여부. */
  const isVisuallyHidden = props.status.kind === 'checking';
  /** 제출 버튼이 `aria-describedby`로 가리키는 상태 문장. */
  const message = (
    <p
      aria-atomic="true"
      className={isVisuallyHidden ? 'visually-hidden' : undefined}
      id={props.id}
      role={props.status.role}
    >
      <strong>{props.status.label}</strong> {props.status.message}
    </p>
  );

  // 흐름 안에 wrapper를 남기면 form의 gap만큼 자리를 차지하므로 문장만 돌려준다.
  if (isVisuallyHidden) return message;

  return (
    <div className="request-readiness-notice">
      {message}
      <button
        aria-busy={props.isFetching}
        aria-label="서비스 상태 다시 확인"
        className={READINESS_RETRY_BUTTON_CLASS_NAME}
        disabled={props.isFetching}
        type="button"
        onClick={props.onRetry}
      >
        {props.isFetching ? (
          <>
            <LoadingSpinner />
            {WORKER_HEALTH_RECHECKING_LABEL}
          </>
        ) : (
          WORKER_HEALTH_RECHECK_LABEL
        )}
      </button>
      {props.technicalDetail ? (
        <ErrorDetailsDisclosure detail={props.technicalDetail} summary="상태 확인 정보" />
      ) : null}
    </div>
  );
}
