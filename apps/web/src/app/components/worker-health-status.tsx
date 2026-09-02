import { AppIcon, type AppIconName } from './app-icon';
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
  /** health 상태 재확인 동작. */
  onRetry: () => void;
};

/** 요청 설정 흐름에서 API 연결과 worker 준비 상태를 알린다. */
export function WorkerHealthStatusNotice({
  id,
  isFetching,
  lastCheckedAt,
  status,
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
          <h3 id={id}>서버 연결·worker 준비 상태</h3>
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
          aria-label="서버와 worker 상태 다시 확인"
          className="secondary-button worker-health-status__retry"
          disabled={isFetching}
          type="button"
          onClick={onRetry}
        >
          <AppIcon name="processing" />
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
