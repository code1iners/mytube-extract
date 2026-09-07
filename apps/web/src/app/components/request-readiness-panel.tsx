import { AppIcon, type AppIconName } from './app-icon';
import { RequestFlow } from './request-flow';
import { WorkerHealthStatusNotice } from './worker-health-status';
import type { UserVisibleErrorDetail } from '../../api/mytube-extract.api';
import type { WorkerHealthStatus } from '../utils/worker-health-notice.util';

/** 요청 readiness gate 속성. */
type RequestReadinessPanelProps = {
  /** panel heading에 사용할 아이콘. */
  icon: AppIconName;
  /** readiness heading id. */
  id: string;
  /** health heading id. */
  healthId?: string;
  /** health 확인 중 여부. */
  isFetching: boolean;
  /** 마지막 health 확인 시각(epoch milliseconds). */
  lastCheckedAt: number;
  /** route에 맞는 작업 이름. */
  title: string;
  /** worker health 사용자 표시값. */
  status: WorkerHealthStatus;
  /** 필요할 때 열어 볼 검증된 기술 상세. */
  technicalDetail?: UserVisibleErrorDetail;
  /** health 상태 재확인 동작. */
  onRetry: () => void;
};

/** readiness gate panel의 Tailwind layout className. */
const READINESS_PANEL_CLASS_NAME =
  'readiness-panel grid gap-mytube-24 p-0';

/** readiness gate 보조 안내의 Tailwind typography className. */
const READINESS_NOTE_CLASS_NAME =
  'm-0 text-mytube-text-secondary text-[14px] leading-[1.5]';

/** 서버가 준비될 때까지 폼 대신 상태와 복구 동작을 먼저 표시한다. */
export function RequestReadinessPanel({
  icon,
  healthId,
  id,
  isFetching,
  lastCheckedAt,
  onRetry,
  status,
  technicalDetail,
  title,
}: RequestReadinessPanelProps) {
  return (
    <section
      aria-labelledby={id}
      className={`phase-panel ${READINESS_PANEL_CLASS_NAME}`}
    >
      <div className="panel-title-row">
        <h2 id={id}>
          <AppIcon name={icon} />
          {title}
        </h2>
      </div>
      <RequestFlow current="source" />
      <WorkerHealthStatusNotice
        id={healthId ?? `${id}-health-title`}
        isFetching={isFetching}
        lastCheckedAt={lastCheckedAt}
        status={status}
        technicalDetail={technicalDetail}
        onRetry={onRetry}
      />
      {status.kind === 'checking' ? (
        <p
          className={`readiness-panel__next ${READINESS_NOTE_CLASS_NAME}`}
          role="status"
        >
          서버가 준비되면 요청 입력 화면이 표시됩니다.
        </p>
      ) : null}
      {status.kind === 'failed' || status.kind === 'unavailable' ? (
        <p
          className={`readiness-panel__preserved ${READINESS_NOTE_CLASS_NAME}`}
          role="status"
        >
          입력한 내용은 그대로 보존됩니다. 다시 확인 후 이어서 요청할 수 있습니다.
        </p>
      ) : null}
    </section>
  );
}
