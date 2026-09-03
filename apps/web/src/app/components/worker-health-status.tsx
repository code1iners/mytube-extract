import { AppIcon, type AppIconName } from './app-icon';
import { ErrorDetailsDisclosure } from './error-details-disclosure';
import type { UserVisibleErrorDetail } from '../../api/mytube-extract.api';
import {
  formatWorkerHealthCheckedAt,
  getWorkerHealthStatusMessageId,
  type WorkerHealthStatus,
  type WorkerHealthStatusKind,
} from '../utils/worker-health-notice.util';

/** worker health 상태별 보조 아이콘. */
const WORKER_HEALTH_STATUS_ICONS: Record<
  WorkerHealthStatusKind,
  AppIconName
> = {
  checking: 'processing',
  failed: 'failed',
  ready: 'completed',
  unavailable: 'server',
};

/** WorkerHealthStatusNotice 속성. */
type WorkerHealthStatusNoticeProps = {
  /** 상태 제목에 연결할 고유 id. */
  id: string;
  /** 현재 health 요청 또는 재확인 요청 진행 여부. */
  isFetching: boolean;
  /** 마지막 health 확인을 시작한 시각(epoch milliseconds). */
  lastCheckedAt: number;
  /** 화면에 표시할 worker health 상태. */
  status: WorkerHealthStatus;
  /** 필요할 때 열어 볼 검증된 기술 상세. */
  technicalDetail?: UserVisibleErrorDetail;
  /** health 상태 재확인 동작. */
  onRetry: () => void;
};

/** 요청 설정 흐름에서 API 연결과 worker 준비 상태를 알린다. */
export function WorkerHealthStatusNotice({
  id,
  isFetching,
  lastCheckedAt,
  status,
  technicalDetail,
  onRetry,
}: WorkerHealthStatusNoticeProps) {
  /** 상태에 대응하는 아이콘 이름. */
  const iconName = WORKER_HEALTH_STATUS_ICONS[status.kind];
  /** 장애 상태 안내를 확장해서 표시할지 여부. */
  const isExpandedStatus =
    status.kind === 'failed' || status.kind === 'unavailable';
  /** 유효한 마지막 health 확인 시각. */
  const checkedAtDate = createCheckedAtDate(lastCheckedAt);
  /** 제출 control이 참조할 health 상태 설명 id. */
  const messageId = getWorkerHealthStatusMessageId(id);
  /** 정상 상태에서 낮은 강조도로 보여 줄 재확인 동작인지 여부. */
  const isQuietRetry = status.kind === 'ready';
  /** health 상태에 맞춘 재확인 control className. */
  const retryClassName = [
    'secondary-button',
    'worker-health-status__retry',
    isQuietRetry ? 'worker-health-status__retry--quiet' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section
      aria-busy={isFetching}
      aria-labelledby={id}
      className={
        'worker-health-status worker-health-status--' +
        status.kind +
        (isExpandedStatus
          ? ' worker-health-status--expanded'
          : ' worker-health-status--compact')
      }
      data-health-presentation={isExpandedStatus ? 'expanded' : 'compact'}
      data-health-status={status.kind}
    >
      <div className="worker-health-status__main">
        <span aria-hidden="true" className="worker-health-status__icon">
          <AppIcon name={iconName} />
        </span>
        <div>
          <h3 id={id}>서비스 상태</h3>
          <p
            aria-atomic="true"
            aria-live={status.role === 'alert' ? 'assertive' : 'polite'}
            className="worker-health-status__message"
            id={messageId}
            role={status.role}
          >
            <strong>{status.label}</strong>
            <span className={isExpandedStatus ? undefined : 'visually-hidden'}>
              {status.message}
            </span>
          </p>
        </div>
      </div>
      {technicalDetail ? (
        <ErrorDetailsDisclosure
          detail={technicalDetail}
          summary="상태 확인 정보"
        />
      ) : null}
      <div className="worker-health-status__meta">
        {status.kind === 'ready' ? (
          <p className="worker-health-status__last-checked">
            마지막 확인:{' '}
            <time dateTime={checkedAtDate?.toISOString()}>
              {formatWorkerHealthCheckedAt(lastCheckedAt)}
            </time>
          </p>
        ) : null}
        <button
          aria-busy={isFetching}
          aria-label="서비스 상태 다시 확인"
          className={retryClassName}
          disabled={isFetching}
          type="button"
          onClick={onRetry}
        >
          {isQuietRetry ? null : <AppIcon name="processing" />}
          다시 확인
        </button>
      </div>
    </section>
  );
}

/** epoch milliseconds를 유효한 Date로 바꾼다. */
function createCheckedAtDate(timestamp: number) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return undefined;
  }

  /** 마지막 health 확인 시각 후보. */
  const date = new Date(timestamp);

  return Number.isNaN(date.getTime()) ? undefined : date;
}
