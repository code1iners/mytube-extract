import { type UseQueryResult, useQueries } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import {
  JobStatusRequestError,
  buildApiUrl,
} from '../../../api/mytube-extract.api';
import type { DownloadResponse } from '../../../domain/download-request/download-request';
import type { SubtitleJobResponse } from '../../../domain/subtitle-request/subtitle-request';
import { AppIcon, type AppIconName } from '../../components/app-icon';
import { RequestFlow } from '../../components/request-flow';
import { ROUTE_PATHS } from '../../constants/route-paths.constant';
import {
  type JobReceipt,
  type JobReceiptKind,
  listJobReceipts,
  parseJobReceiptStorageKey,
  removeJobReceipt,
  restoreJobReceipt,
} from '../../utils/job-receipt.util';
import {
  createJobStatusQueryOptions,
  fetchJobStatus,
} from '../../utils/job-status-polling.util';
import {
  parseHistoryDeepLink,
  updateDismissedReceiptKeys,
} from './request-history.logic';
import { getRequestFlowStage } from '../../utils/request-flow.util';

type JobStatus = DownloadResponse | SubtitleJobResponse;

/** 삭제한 접수증을 되돌릴 수 있는 제한 시간. */
const HISTORY_UNDO_WINDOW_MS = 8_000;

/** 요청 내역 변경 결과를 전달할 live region 역할. */
type AnnouncementRole = 'status' | 'alert';

/** 요청 내역 변경 결과와 보조 기술 공지 역할. */
type HistoryAnnouncement = {
  /** 보조 기술에 전달할 변경 결과. */
  message: string;
  /** 공지의 긴급도. */
  role: AnnouncementRole;
};

/** 이 브라우저에서 접수한 최근 요청을 서버 상태와 함께 표시한다. */
export function RequestHistoryPage() {
  const location = useLocation();
  const deepAcceptedAt = useRef(new Date().toISOString());
  const deepReceipt = useMemo(
    () => parseHistoryDeepLink(location.search, deepAcceptedAt.current),
    [location.search],
  );
  const [initial] = useState(() => readReceipts(deepReceipt));
  const [receipts, setReceipts] = useState(initial.receipts);
  const [storageAvailable, setStorageAvailable] = useState(
    initial.storageAvailable,
  );
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());
  const [undoReceipt, setUndoReceipt] = useState<JobReceipt | null>(null);
  const [announcement, setAnnouncement] = useState<HistoryAnnouncement>({
    message: '',
    role: 'status',
  });
  const previousStatuses = useRef(new Map<string, string>());
  const apiBaseUrl = getApiBaseUrl();
  const visibleReceipts = receipts.filter(
    (receipt) => !dismissedKeys.has(getReceiptIdentity(receipt)),
  );
  const queries = useQueries({
    queries: visibleReceipts.map((receipt) => ({
      ...createJobStatusQueryOptions({
        receipt,
        fetchStatus: (signal) => fetchJobStatus(receipt, apiBaseUrl, signal),
      }),
    })),
  });
  const notFoundKeys = queries
    .map((query, index) =>
      query.error instanceof JobStatusRequestError &&
      query.error.responseStatus === 404
        ? getReceiptIdentity(visibleReceipts[index]!)
        : '',
    )
    .filter(Boolean)
    .join('|');
  const statusSignature = queries
    .map((query, index) => {
      const receipt = visibleReceipts[index];
      return receipt && query.data
        ? `${getReceiptIdentity(receipt)}:${query.data.displayStatus}`
        : '';
    })
    .filter(Boolean)
    .join('|');
  const storageFailed =
    (location.state as { storageFailed?: boolean } | null)?.storageFailed ===
      true ||
    (!storageAvailable && deepReceipt !== null);

  useEffect(
    function synchronizeOtherTabs() {
      function handleStorageChange(event?: StorageEvent) {
        if (event) {
          setDismissedKeys((current) =>
            updateDismissedReceiptKeys(current, event.key, event.newValue),
          );

          /** 다른 탭에서 변경된 접수증의 storage identity. */
          const changedReceipt = parseJobReceiptStorageKey(event.key);

          if (
            changedReceipt &&
            undoReceipt &&
            getReceiptIdentity(undoReceipt) === getReceiptIdentity(changedReceipt)
          ) {
            setUndoReceipt(null);
          }
        }

        const next = readReceipts(deepReceipt);
        setReceipts(next.receipts);
        setStorageAvailable(next.storageAvailable);
      }

      handleStorageChange();
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    },
    [deepReceipt, undoReceipt],
  );

  useEffect(
    function expireHistoryUndo() {
      if (!undoReceipt) {
        return;
      }

      /** 현재 삭제의 undo 동작을 닫을 timer ID. */
      const timeoutId = window.setTimeout(() => {
        // 만료된 삭제가 최신 undo 상태를 덮어쓰지 않도록 identity를 확인한다.
        setUndoReceipt((current) =>
          current &&
          getReceiptIdentity(current) === getReceiptIdentity(undoReceipt)
            ? null
            : current,
        );
      }, HISTORY_UNDO_WINDOW_MS);

      return () => window.clearTimeout(timeoutId);
    },
    [undoReceipt],
  );

  useEffect(
    function removeMissingReceipts() {
      if (!notFoundKeys) {
        return;
      }

      const keys = new Set(notFoundKeys.split('|'));
      for (const receipt of visibleReceipts) {
        if (keys.has(getReceiptIdentity(receipt))) {
          removeJobReceipt(receipt.kind, receipt.jobId);
        }
      }
      setDismissedKeys((current) => new Set([...current, ...keys]));
      announce('더 이상 조회할 수 없는 요청을 내역에서 제거했습니다.');
    },
    [notFoundKeys],
  );

  useEffect(
    function announceStatusTransitions() {
      if (!statusSignature) {
        return;
      }

      queries.forEach((query, index) => {
        const receipt = visibleReceipts[index];

        if (!query.data || !receipt) {
          return;
        }

        const key = getReceiptIdentity(receipt);
        const previous = previousStatuses.current.get(key);
        previousStatuses.current.set(key, query.data.displayStatus);

        if (previous && previous !== query.data.displayStatus) {
          announce(
            `요청 상태가 ${formatStatus(query.data.displayStatus)}(으)로 변경되었습니다.`,
          );
        }
      });
    },
    [statusSignature],
  );

  function handleRemove(receipt: JobReceipt, index: number) {
    /** storage에서 실제로 삭제했는지 여부. */
    const removed = removeJobReceipt(receipt.kind, receipt.jobId);

    if (!removed) {
      announce(
        `${formatKind(receipt.kind)} 요청 내역을 삭제하지 못했습니다. 다시 시도해 주세요.`,
        'alert',
      );
      return;
    }

    setDismissedKeys((current) =>
      new Set(current).add(getReceiptIdentity(receipt)),
    );
    setUndoReceipt(receipt);
    announce(
      `${formatKind(receipt.kind)} 요청을 내역에서 삭제했습니다. 8초 동안 되돌릴 수 있습니다.`,
    );

    window.requestAnimationFrame(function focusAfterHistoryRemoval() {
      const buttons = document.querySelectorAll<HTMLButtonElement>(
        '.history-remove-button',
      );
      /** 삭제 후 우선 focus할 다음 또는 이전 삭제 button. */
      const nextFocusTarget = buttons[index] ?? buttons[index - 1];

      if (nextFocusTarget) {
        nextFocusTarget.focus();
        return;
      }

      document.querySelector<HTMLElement>('#history-title')?.focus();
    });
  }

  /** 가장 최근 삭제 접수증을 검증한 뒤 목록과 focus를 복원한다. */
  function handleUndo() {
    if (!undoReceipt) {
      return;
    }

    /** 사용자가 되돌리기를 누른 삭제 접수증. */
    const receipt = undoReceipt;

    // 저장과 재조회가 모두 성공한 경우에만 복원을 사용자에게 알린다.
    if (!restoreJobReceipt(receipt)) {
      handleUndoFailure(receipt);
      return;
    }

    /** 복원 뒤 다시 읽은 접수증과 storage 상태. */
    const next = readReceipts(deepReceipt);
    /** 재조회 결과에 동일한 접수증이 실제로 포함됐는지 여부. */
    const restored =
      next.storageAvailable &&
      next.receipts.some(
        (candidate) =>
          getReceiptIdentity(candidate) === getReceiptIdentity(receipt) &&
          candidate.acceptedAt === receipt.acceptedAt,
      );

    if (!restored) {
      handleUndoFailure(receipt);
      return;
    }

    setReceipts(next.receipts);
    setStorageAvailable(next.storageAvailable);
    setDismissedKeys((current) => {
      const updated = new Set(current);
      updated.delete(getReceiptIdentity(receipt));
      return updated;
    });
    setUndoReceipt(null);
    announce(`${formatKind(receipt.kind)} 요청 내역을 복원했습니다.`);

    window.requestAnimationFrame(function focusRestoredHistoryItem() {
      const title = document.getElementById(getHistoryTitleId(receipt));
      const firstAction = title
        ?.closest('article')
        ?.querySelector<HTMLElement>('a, button');
      (title ?? firstAction)?.focus();
    });
  }

  /** 복원 검증 실패를 알리고 삭제 상태를 유지한다. */
  function handleUndoFailure(receipt: JobReceipt) {
    setUndoReceipt(null);
    announce(
      `${formatKind(receipt.kind)} 요청 내역을 복원하지 못했습니다. 삭제된 상태로 유지됩니다.`,
      'alert',
    );
  }

  /** 요청 내역의 단일 live region에 변경 결과를 전달한다. */
  function announce(message: string, role: AnnouncementRole = 'status') {
    setAnnouncement({ message, role });
  }

  return (
    <section className="phase-panel history-panel" aria-labelledby="history-title">
      <div className="panel-title-row">
        <h2 id="history-title" tabIndex={-1}>
          <AppIcon name="queued" />요청 내역
        </h2>
      </div>
      <p className="history-description">
        최근 요청 20건을 서버의 최신 상태로 확인합니다.
      </p>
      {storageFailed ? (
        <div className="notice-box" role="status">
          <span aria-hidden="true"><AppIcon name="failed" /></span>
          <p>이 브라우저에 내역을 저장하지 못했습니다. 현재 링크의 요청은 계속 확인할 수 있습니다.</p>
        </div>
      ) : null}
      {undoReceipt ? (
        <div className="history-undo">
          <p>
            {formatKind(undoReceipt.kind)} 요청을 삭제했습니다. 8초 동안 되돌릴 수
            있습니다.
          </p>
          <button
            aria-label={`삭제한 ${formatKind(undoReceipt.kind)} 요청 되돌리기`}
            className="secondary-button history-undo__button"
            type="button"
            onClick={handleUndo}
          >
            되돌리기
          </button>
        </div>
      ) : null}
      <p
        aria-atomic="true"
        aria-live={announcement.role === 'status' ? 'polite' : undefined}
        className="visually-hidden"
        role={announcement.role}
      >
        {announcement.message}
      </p>
      {visibleReceipts.length === 0 ? (
        <HistoryEmptyState />
      ) : (
        <ul className="history-list">
          {visibleReceipts.map((receipt, index) => (
            <HistoryItem
              highlighted={
                deepReceipt !== null &&
                getReceiptIdentity(receipt) === getReceiptIdentity(deepReceipt)
              }
              key={getReceiptIdentity(receipt)}
              query={queries[index]!}
              receipt={receipt}
              onRemove={() => handleRemove(receipt, index)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/** 요청 내역이 비어 있을 때 두 작업의 시작점과 보관 모델을 안내한다. */
function HistoryEmptyState() {
  return (
    <div className="history-empty">
      <h3 className="history-empty__prompt">시작할 작업을 선택하세요.</h3>
      <div className="history-empty__links">
        <NavLink className="history-empty__link" to={ROUTE_PATHS.video}>
          <AppIcon name="video" />
          <span className="history-empty__link-copy">
            <strong>영상 추출</strong>
            <span>
              YouTube URL로 영상(MP4) 또는 오디오(MP3)를 받습니다.
            </span>
          </span>
        </NavLink>
        <NavLink className="history-empty__link" to={ROUTE_PATHS.subtitles}>
          <AppIcon name="subtitle" />
          <span className="history-empty__link-copy">
            <strong>자막 추출</strong>
            <span>로컬 영상으로 영어 SRT 자막을 만듭니다.</span>
          </span>
        </NavLink>
      </div>
      <p className="history-empty__note">
        <AppIcon name="info" />
        <span>
          이력은 이 브라우저에만 저장되며, 완료 파일은 7일 동안 보관됩니다.
        </span>
      </p>
    </div>
  );
}

function HistoryItem(props: {
  highlighted: boolean;
  query: UseQueryResult<JobStatus, Error>;
  receipt: JobReceipt;
  onRemove: () => void;
}) {
  const { query, receipt } = props;
  const job = query.data as JobStatus | undefined;
  const isConnectionError =
    query.failureCount > 0 || query.fetchStatus === 'paused';
  const isCompletedWithoutUrl =
    job?.displayStatus === 'completed' && !job.downloadUrl;
  const retryPath =
    receipt.kind === 'video' ? ROUTE_PATHS.video : ROUTE_PATHS.subtitles;
  const titleId = getHistoryTitleId(receipt);

  return (
    <li className={props.highlighted ? 'history-item is-highlighted' : 'history-item'}>
      <article aria-labelledby={titleId}>
        <div className="history-item__header">
          <div>
            <h3 id={titleId} tabIndex={-1}>
              {formatKind(receipt.kind)} 요청
            </h3>
            <p>{job ? formatJobDetail(receipt.kind, job) : `접수 ${formatDate(receipt.acceptedAt)}`}</p>
          </div>
          <span className={`history-status history-status--${getStatusTone(job?.displayStatus)}`}>
            <AppIcon name={getStatusIcon(job?.displayStatus)} />
            {query.isPending ? '상태 확인 중' : formatStatus(job?.displayStatus)}
          </span>
        </div>
        <RequestFlow current={getRequestFlowStage(job?.displayStatus)} />
        {job?.progress !== null && job?.progress !== undefined ? (
          <div className="history-progress">
            <progress max={100} value={job.progress}>{job.progress}%</progress>
            <span>{job.progress}%</span>
          </div>
        ) : null}
        {isConnectionError ? (
          <p className="history-message">서버 연결이 불안정합니다. 내역을 유지하고 다시 확인합니다.</p>
        ) : job ? (
          <p className="history-message">{job.message}</p>
        ) : null}
        {isCompletedWithoutUrl ? (
          <p className="history-message history-message--error">완료 파일 주소를 받지 못했습니다. 서버 상태를 다시 확인해 주세요.</p>
        ) : null}
        <div className="history-actions">
          {job?.displayStatus === 'completed' && job.downloadUrl ? (
            <a className="primary-button" download href={buildApiUrl(job.downloadUrl, getApiBaseUrl())}>
              <AppIcon name="download" />다운로드
            </a>
          ) : null}
          {job?.displayStatus === 'failed' || job?.displayStatus === 'expired' ? (
            <NavLink className="primary-button" to={retryPath}>다시 요청</NavLink>
          ) : null}
          {(query.isError || isCompletedWithoutUrl) &&
          !(query.error instanceof JobStatusRequestError && query.error.responseStatus === 404) ? (
            <button className="secondary-button" type="button" onClick={() => void query.refetch()}>다시 확인</button>
          ) : null}
          <button
            aria-label={`${formatKind(receipt.kind)} 요청 내역에서 삭제`}
            className="secondary-button history-remove-button"
            type="button"
            onClick={props.onRemove}
          >
            내역에서 삭제
          </button>
        </div>
      </article>
    </li>
  );
}

function readReceipts(deepReceipt: JobReceipt | null) {
  const result = listJobReceipts();

  return {
    ...result,
    receipts:
      deepReceipt &&
      !result.receipts.some(
        (receipt) => getReceiptIdentity(receipt) === getReceiptIdentity(deepReceipt),
      )
        ? [deepReceipt, ...result.receipts]
        : result.receipts,
  };
}

function getApiBaseUrl() {
  return (
    import.meta.env.VITE_MYTUBE_EXTRACT_API_BASE_URL ??
    import.meta.env.VITE_MEDIA_NEST_API_BASE_URL
  );
}

function getReceiptIdentity(receipt: Pick<JobReceipt, 'kind' | 'jobId'>) {
  return `${receipt.kind}:${receipt.jobId}`;
}

/** 접수증 복원 후 focus를 이동할 제목 id를 만든다. */
function getHistoryTitleId(receipt: Pick<JobReceipt, 'kind' | 'jobId'>) {
  return `history-item-${receipt.kind}-${receipt.jobId}`;
}

function formatKind(kind: JobReceiptKind) {
  return kind === 'video' ? '영상' : '자막';
}

function formatStatus(status?: string) {
  if (status === 'completed') return '완료';
  if (status === 'failed') return '실패';
  if (status === 'expired') return '만료';
  if (status === 'processing' || status === 'extracting_audio' || status === 'transcribing') return '처리 중';
  return status === 'queued' ? '대기 중' : '상태 확인 중';
}

function getStatusTone(status?: string) {
  if (status === 'completed' || status === 'failed' || status === 'expired') return status;
  return status === 'queued' ? 'queued' : 'processing';
}

function getStatusIcon(status?: string): AppIconName {
  const tone = getStatusTone(status);
  return tone === 'completed' || tone === 'failed' || tone === 'expired'
    ? tone
    : tone === 'queued'
      ? 'queued'
      : 'processing';
}

function formatJobDetail(kind: JobReceiptKind, job: JobStatus) {
  return kind === 'video' && 'type' in job
    ? `${job.type === 'audio' ? '오디오' : '비디오'} · ${job.type === 'audio' ? `${job.quality} kbps` : `${job.quality}p`} · ${formatDate(job.createdAt)}`
    : `${'fileName' in job ? job.fileName : '자막'} · ${formatDate(job.createdAt)}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '시각 확인 불가'
    : new Intl.DateTimeFormat('ko-KR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(date);
}
