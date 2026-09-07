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

/** worker health notice의 compact·expanded 표시 방식. */
type WorkerHealthStatusPresentation = 'compact' | 'expanded';

/** worker health notice 표시 방식별 Tailwind layout className. */
const WORKER_HEALTH_STATUS_PRESENTATION_CLASS_NAMES: Record<
  WorkerHealthStatusPresentation,
  string
> = {
  compact:
    'worker-health-status--compact flex min-w-0 flex-wrap items-center justify-between gap-y-mytube-8 gap-x-mytube-12 p-0 max-[561px]:justify-start',
  expanded:
    'worker-health-status--expanded grid min-w-0 gap-mytube-12 p-mytube-12 border border-mytube-border rounded-mytube-md bg-mytube-surface-alt max-[561px]:gap-mytube-8 max-[561px]:p-mytube-8',
};

/** worker health 상태에 대응하는 semantic status 색상 className. */
const WORKER_HEALTH_STATUS_TONE_CLASS_NAMES: Record<
  WorkerHealthStatusKind,
  string
> = {
  checking: 'text-mytube-status-processing',
  failed: 'text-mytube-status-failed',
  ready: 'text-mytube-status-completed',
  unavailable: 'text-mytube-status-failed',
};

/** worker health notice 본문 grid의 기본 Tailwind className. */
const WORKER_HEALTH_STATUS_MAIN_CLASS_NAME =
  'worker-health-status__main grid min-w-0 gap-mytube-8';

/** worker health notice 메시지의 공통 Tailwind typography className. */
const WORKER_HEALTH_STATUS_MESSAGE_BASE_CLASS_NAME =
  'worker-health-status__message m-0 text-mytube-text-secondary text-[14px] leading-[1.4] break-keep';

/** worker health notice 메시지의 expanded Tailwind typography className. */
const WORKER_HEALTH_STATUS_EXPANDED_MESSAGE_CLASS_NAME =
  `${WORKER_HEALTH_STATUS_MESSAGE_BASE_CLASS_NAME} grid gap-mytube-4 mt-mytube-4`;

/** worker health notice 메시지의 compact Tailwind typography className. */
const WORKER_HEALTH_STATUS_COMPACT_MESSAGE_CLASS_NAME =
  `${WORKER_HEALTH_STATUS_MESSAGE_BASE_CLASS_NAME} flex items-center gap-mytube-8`;

/** worker health notice 보조 영역의 Tailwind layout className. */
const WORKER_HEALTH_STATUS_META_CLASS_NAME =
  'worker-health-status__meta flex min-w-0 flex-wrap items-center justify-end gap-y-mytube-8 gap-x-mytube-12';

/** worker health notice 장애 action 영역의 Tailwind layout className. */
const WORKER_HEALTH_STATUS_ACTIONS_CLASS_NAME =
  'worker-health-status__actions grid gap-mytube-12';

/** worker health 마지막 확인 시각의 Tailwind typography className. */
const WORKER_HEALTH_STATUS_LAST_CHECKED_CLASS_NAME =
  'worker-health-status__last-checked m-0 text-mytube-text-secondary text-[14px] leading-[1.4] whitespace-nowrap';

/** worker health 재확인 button의 공통 Tailwind className. */
const WORKER_HEALTH_STATUS_RETRY_CLASS_NAME =
  'worker-health-status__retry min-h-[44px] gap-mytube-8 px-mytube-12 !text-[14px]';

/** worker health 정상 상태 재확인 button의 저강조 Tailwind className. */
const WORKER_HEALTH_STATUS_QUIET_RETRY_CLASS_NAME =
  'worker-health-status__retry--quiet !min-w-[44px] !border-transparent !bg-transparent !text-mytube-text-secondary !shadow-none underline decoration-mytube-text-secondary underline-offset-[3px]';

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
  /** 기존 응답을 유지한 채 백그라운드에서 상태를 갱신하는지 여부. */
  const isBackgroundRefreshing = isFetching && status.kind === 'ready';
  /** 장애 상태를 expanded layout으로 표시할지 결정한 presentation key. */
  const presentation: WorkerHealthStatusPresentation = isExpandedStatus
    ? 'expanded'
    : 'compact';
  /** worker health 상태에 맞춘 semantic status 색상 className. */
  const toneClassName = WORKER_HEALTH_STATUS_TONE_CLASS_NAMES[status.kind];
  /** worker health notice의 layout과 상태 className. */
  const statusClassName = [
    'worker-health-status',
    `worker-health-status--${status.kind}`,
    WORKER_HEALTH_STATUS_PRESENTATION_CLASS_NAMES[presentation],
  ].join(' ');
  /** worker health notice 본문의 반응형 grid className. */
  const mainClassName = [
    WORKER_HEALTH_STATUS_MAIN_CLASS_NAME,
    isExpandedStatus
      ? 'items-start grid-cols-[28px_minmax(0,1fr)]'
      : 'items-center grid-cols-[24px_minmax(0,1fr)] flex-[1_1_180px]',
  ].join(' ');
  /** worker health 상태 icon의 크기·색상 className. */
  const iconClassName = [
    'worker-health-status__icon grid place-items-center rounded-mytube-full',
    isExpandedStatus ? 'size-7 border' : 'size-6',
    toneClassName,
  ].join(' ');
  /** worker health 상태 메시지의 표시 className. */
  const messageClassName = isExpandedStatus
    ? WORKER_HEALTH_STATUS_EXPANDED_MESSAGE_CLASS_NAME
    : WORKER_HEALTH_STATUS_COMPACT_MESSAGE_CLASS_NAME;
  /** worker health 상태별 action 영역 className. */
  const actionsClassName = isExpandedStatus
    ? WORKER_HEALTH_STATUS_ACTIONS_CLASS_NAME
    : WORKER_HEALTH_STATUS_META_CLASS_NAME;
  /** health 상태에 맞춘 재확인 control className. */
  const retryClassName = [
    isExpandedStatus ? 'primary-button' : 'secondary-button',
    WORKER_HEALTH_STATUS_RETRY_CLASS_NAME,
    isExpandedStatus ? 'w-full justify-center' : '',
    isQuietRetry ? WORKER_HEALTH_STATUS_QUIET_RETRY_CLASS_NAME : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section
      aria-busy={isFetching}
      aria-labelledby={id}
      className={statusClassName}
      data-health-presentation={isExpandedStatus ? 'expanded' : 'compact'}
      data-health-status={status.kind}
    >
      <div className={mainClassName}>
        <span aria-hidden="true" className={iconClassName}>
          <AppIcon className="size-[20px]" name={iconName} />
        </span>
        <div>
          <h3
            className="m-0 text-mytube-text-primary text-[16px] font-semibold leading-[1.4]"
            id={id}
          >
            서비스 상태
          </h3>
          <p
            aria-atomic="true"
            aria-live={
              isBackgroundRefreshing
                ? 'off'
                : status.role === 'alert'
                  ? 'assertive'
                  : 'polite'
            }
            className={messageClassName}
            id={messageId}
            role={isBackgroundRefreshing ? undefined : status.role}
          >
            <strong className={`font-semibold ${toneClassName}`}>
              {status.label}
            </strong>
            <span className={isExpandedStatus ? undefined : 'visually-hidden'}>
              {status.message}
            </span>
          </p>
        </div>
      </div>
      <div className={actionsClassName}>
        {status.kind === 'ready' ? (
          <p className={WORKER_HEALTH_STATUS_LAST_CHECKED_CLASS_NAME}>
            마지막 확인:{' '}
            <time
              className="text-mytube-text-secondary font-semibold"
              dateTime={checkedAtDate?.toISOString()}
            >
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
          {isQuietRetry ? null : (
            <AppIcon className="size-[18px]" name="processing" />
          )}
          다시 확인
        </button>
        {isExpandedStatus && technicalDetail ? (
          <ErrorDetailsDisclosure
            detail={technicalDetail}
            summary="상태 확인 정보"
          />
        ) : null}
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
