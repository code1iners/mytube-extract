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

/** 요청 내역 페이지의 flat layout·surface className. */
const HISTORY_PANEL_CLASS_NAME =
  'phase-panel history-panel grid min-w-0 w-full max-w-none m-0 gap-mytube-24 border-0 rounded-none bg-transparent p-0 [box-shadow:none]';
/** 요청 내역 제목에 programmatic focus를 표시하는 className. */
const HISTORY_FOCUSABLE_TITLE_CLASS_NAME =
  'focus:outline-2 focus:outline-mytube-focus focus:[outline-offset:2px]';
/** 요청 내역 설명의 Tailwind typography className. */
const HISTORY_DESCRIPTION_CLASS_NAME =
  'history-description m-0 text-mytube-text-secondary text-[16px] leading-[1.5]';
/** 저장 실패 안내의 Tailwind layout·surface className. */
const HISTORY_STORAGE_NOTICE_CLASS_NAME =
  'notice-box grid min-w-0 grid-cols-[28px_minmax(0,1fr)] gap-x-[10px] gap-y-mytube-4 p-[13px] border border-mytube-border rounded-mytube-md bg-mytube-surface-alt';
/** 저장 실패 안내 아이콘 영역의 Tailwind className. */
const HISTORY_STORAGE_NOTICE_ICON_CLASS_NAME =
  'row-span-2 grid size-6 place-items-center text-mytube-text-secondary';
/** 저장 실패 안내 문장의 Tailwind typography className. */
const HISTORY_STORAGE_NOTICE_MESSAGE_CLASS_NAME =
  'm-0 text-mytube-text-secondary text-[14px] leading-[1.4] break-keep';
/** 빈 요청 내역의 Tailwind layout className. */
const HISTORY_EMPTY_CLASS_NAME =
  'history-empty grid min-w-0 gap-mytube-16';
/** 빈 요청 내역의 시작 문구 className. */
const HISTORY_EMPTY_PROMPT_CLASS_NAME =
  'history-empty__prompt m-0 text-mytube-text-primary text-[18px] font-semibold leading-[1.4]';
/** 빈 요청 내역의 시작 링크 목록 className. */
const HISTORY_EMPTY_LINKS_CLASS_NAME =
  'history-empty__links grid min-w-0 grid-cols-2 gap-0 border-y border-mytube-border max-[561px]:grid-cols-1';
/** 빈 요청 내역 시작 링크의 공통 Tailwind className. */
const HISTORY_EMPTY_LINK_CLASS_NAME =
  'history-empty__link grid min-w-0 min-h-[96px] grid-cols-[28px_minmax(0,1fr)] items-start gap-mytube-12 py-mytube-16 pr-mytube-12 pl-0 border-0 bg-transparent text-mytube-text-primary no-underline hover:bg-mytube-surface-alt focus-visible:outline-2 focus-visible:outline-mytube-focus focus-visible:[outline-offset:2px] max-[561px]:px-0';
/** 두 번째 빈 요청 내역 시작 링크의 분리선 className. */
const HISTORY_EMPTY_SECOND_LINK_CLASS_NAME =
  'border-l border-mytube-border pl-mytube-16 max-[561px]:border-t max-[561px]:border-l-0 max-[561px]:border-t-mytube-border';
/** 빈 요청 내역 시작 링크의 텍스트 묶음 className. */
const HISTORY_EMPTY_LINK_COPY_CLASS_NAME =
  'history-empty__link-copy grid min-w-0 gap-mytube-8';
/** 빈 요청 내역 시작 링크 제목의 typography className. */
const HISTORY_EMPTY_LINK_TITLE_CLASS_NAME =
  'text-[18px] leading-[1.4]';
/** 빈 요청 내역 시작 링크 설명의 typography className. */
const HISTORY_EMPTY_LINK_DESCRIPTION_CLASS_NAME =
  'text-mytube-text-secondary text-[14px] leading-[1.5] break-keep';
/** 빈 요청 내역 보관 안내의 Tailwind surface className. */
const HISTORY_EMPTY_NOTE_CLASS_NAME =
  'history-empty__note flex min-w-0 items-start gap-mytube-8 m-0 p-mytube-12 border border-mytube-border rounded-mytube-md bg-mytube-surface-alt';
/** 빈 요청 내역 보관 안내 아이콘 className. */
const HISTORY_EMPTY_NOTE_ICON_CLASS_NAME = 'size-5 shrink-0';
/** 요청 내역 목록의 Tailwind layout className. */
const HISTORY_LIST_CLASS_NAME =
  'history-list grid min-w-0 gap-mytube-12 m-0 p-0 list-none';
/** 요청 내역 항목의 Tailwind surface className. */
const HISTORY_ITEM_CLASS_NAME =
  'history-item min-w-0 p-mytube-16 border border-mytube-border rounded-mytube-lg bg-mytube-surface';
/** deep link로 강조된 요청 내역 항목의 border className. */
const HISTORY_ITEM_HIGHLIGHTED_CLASS_NAME = 'border-mytube-focus';
/** 요청 내역 항목 내부의 Tailwind layout className. */
const HISTORY_ITEM_ARTICLE_CLASS_NAME =
  'grid min-w-0 gap-mytube-16';
/** 요청 내역 항목 header의 Tailwind responsive layout className. */
const HISTORY_ITEM_HEADER_CLASS_NAME =
  'history-item__header grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-mytube-12 max-[561px]:grid-cols-1';
/** 요청 내역 항목 제목의 typography·focus className. */
const HISTORY_ITEM_TITLE_CLASS_NAME =
  'm-0 text-[18px] font-semibold leading-[1.4] focus:outline-2 focus:outline-mytube-focus focus:[outline-offset:2px]';
/** 요청 내역 항목의 API 메타 className. */
const HISTORY_ITEM_DETAIL_CLASS_NAME =
  'history-item__header-detail m-0 mt-[4px] text-mytube-text-secondary text-[14px] leading-[1.5] [overflow-wrap:anywhere]';
/** 요청 내역 상태 label의 공통 Tailwind className. */
const HISTORY_STATUS_CLASS_NAME =
  'history-status inline-flex items-center gap-[6px] text-[14px] font-semibold leading-[1.4] whitespace-nowrap';
/** 요청 내역 상태 tone. */
type HistoryStatusTone =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'expired';
/** 요청 내역 상태별 semantic token className. */
const HISTORY_STATUS_TONE_CLASS_NAMES: Record<HistoryStatusTone, string> = {
  queued: 'text-mytube-status-queued',
  processing: 'text-mytube-status-processing',
  completed: 'text-mytube-status-completed',
  failed: 'text-mytube-status-failed',
  expired: 'text-mytube-status-expired',
};
/** 요청 내역 진행률의 Tailwind layout className. */
const HISTORY_PROGRESS_CLASS_NAME =
  'history-progress grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-[10px] text-mytube-text-secondary text-[14px]';
/** 요청 내역 진행률 native control의 Tailwind className. */
const HISTORY_PROGRESS_BAR_CLASS_NAME =
  'w-full [accent-color:var(--color-status-processing)]';
/** 요청 내역 상태 메시지의 typography·overflow className. */
const HISTORY_MESSAGE_CLASS_NAME =
  'history-message m-0 mt-[4px] text-mytube-text-secondary text-[14px] leading-[1.5] [overflow-wrap:anywhere]';
/** 요청 내역 오류 메시지의 semantic token className. */
const HISTORY_ERROR_MESSAGE_CLASS_NAME = 'text-mytube-status-failed';
/** 요청 내역 action row의 Tailwind layout className. */
const HISTORY_ACTIONS_CLASS_NAME =
  'history-actions flex min-w-0 flex-wrap items-stretch gap-mytube-8';
/** 요청 내역 primary result link의 Tailwind button className. */
const HISTORY_PRIMARY_ACTION_CLASS_NAME =
  'history-primary-action inline-flex min-w-[44px] min-h-[44px] items-center justify-center gap-mytube-8 border border-mytube-action-primary rounded-mytube-md bg-mytube-action-primary px-[14px] text-mytube-on-primary cursor-pointer text-[14px] font-semibold leading-[1] no-underline shadow-mytube-soft focus-visible:outline-2 focus-visible:outline-mytube-focus focus-visible:[outline-offset:2px] [@media(hover:hover)]:hover:brightness-[0.92] active:brightness-[0.84]';
/** 요청 내역 secondary action이 공유하는 Tailwind button className. */
const HISTORY_SECONDARY_BUTTON_BASE_CLASS_NAME =
  'inline-flex min-w-[44px] min-h-[44px] items-center justify-center gap-mytube-8 border border-mytube-border rounded-mytube-md bg-mytube-surface text-mytube-text-primary cursor-pointer text-[14px] font-semibold leading-[1.4] no-underline focus-visible:outline-2 focus-visible:outline-mytube-focus focus-visible:[outline-offset:2px] [@media(hover:hover)]:hover:bg-mytube-surface-alt [@media(hover:hover)]:hover:text-mytube-text-primary disabled:text-mytube-text-disabled disabled:cursor-not-allowed';
/** 요청 상태 재확인 action의 Tailwind button className. */
const HISTORY_SECONDARY_ACTION_CLASS_NAME = `${HISTORY_SECONDARY_BUTTON_BASE_CLASS_NAME} history-secondary-action px-[14px]`;
/** 요청 내역 삭제 action의 Tailwind button className. */
const HISTORY_REMOVE_ACTION_CLASS_NAME = `${HISTORY_SECONDARY_BUTTON_BASE_CLASS_NAME} history-remove-button px-[14px]`;
/** 삭제 직후 표시하는 undo 안내의 Tailwind layout·surface className. */
const HISTORY_UNDO_CLASS_NAME =
  'history-undo flex min-w-0 items-center justify-between gap-mytube-12 p-mytube-12 border border-mytube-border rounded-mytube-md bg-mytube-surface-alt max-[561px]:items-stretch max-[561px]:flex-col';
/** 삭제 직후 표시하는 undo 안내 문장의 Tailwind typography className. */
const HISTORY_UNDO_MESSAGE_CLASS_NAME =
  'history-undo__message m-0 min-w-0 text-mytube-text-primary text-[14px] leading-[1.4]';
/** 삭제 직후 표시하는 undo button의 Tailwind button className. */
const HISTORY_UNDO_BUTTON_CLASS_NAME = `${HISTORY_SECONDARY_BUTTON_BASE_CLASS_NAME} history-undo__button flex-none px-mytube-12 max-[561px]:w-full`;
/** 삭제·복원 결과를 보조 기술에만 전달하는 live region utility className. */
const HISTORY_ANNOUNCEMENT_CLASS_NAME =
  'history-announcement absolute size-px overflow-hidden whitespace-nowrap [clip:rect(0_0_0_0)]';

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

      /** 같은 render 주기에 확인된 모든 요청 상태 전환 공지. */
      const transitionMessages: string[] = [];

      queries.forEach((query, index) => {
        const receipt = visibleReceipts[index];

        if (!query.data || !receipt) {
          return;
        }

        const key = getReceiptIdentity(receipt);
        const previous = previousStatuses.current.get(key);
        previousStatuses.current.set(key, query.data.displayStatus);

        if (previous && previous !== query.data.displayStatus) {
          transitionMessages.push(
            `${formatKind(receipt.kind)} 요청, 접수 ${formatDate(receipt.acceptedAt)} 상태가 ${formatStatus(query.data.displayStatus)}(으)로 변경되었습니다.`,
          );
        }
      });

      if (transitionMessages.length > 0) {
        announce(transitionMessages.join(' '));
      }
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
    <section className={HISTORY_PANEL_CLASS_NAME} aria-labelledby="history-title">
      <div className="panel-title-row">
        <h2
          className={HISTORY_FOCUSABLE_TITLE_CLASS_NAME}
          id="history-title"
          tabIndex={-1}
        >
          <AppIcon name="queued" />요청 내역
        </h2>
      </div>
      <p className={HISTORY_DESCRIPTION_CLASS_NAME}>
        이 브라우저가 접수한 최근 요청 20건을 API 응답의 최신 상태로 확인합니다.
      </p>
      {storageFailed ? (
        <div className={HISTORY_STORAGE_NOTICE_CLASS_NAME} role="status">
          <span
            aria-hidden="true"
            className={HISTORY_STORAGE_NOTICE_ICON_CLASS_NAME}
          >
            <AppIcon name="failed" />
          </span>
          <p className={HISTORY_STORAGE_NOTICE_MESSAGE_CLASS_NAME}>
            이 브라우저에 내역을 저장하지 못했습니다. 현재 링크의 요청은 계속 확인할 수 있습니다.
          </p>
        </div>
      ) : null}
      {undoReceipt ? (
        <div className={HISTORY_UNDO_CLASS_NAME}>
          <p className={HISTORY_UNDO_MESSAGE_CLASS_NAME}>
            {formatKind(undoReceipt.kind)} 요청을 삭제했습니다. 8초 동안 되돌릴 수
            있습니다.
          </p>
          <button
            aria-label={`삭제한 ${formatKind(undoReceipt.kind)} 요청 되돌리기`}
            className={HISTORY_UNDO_BUTTON_CLASS_NAME}
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
        className={HISTORY_ANNOUNCEMENT_CLASS_NAME}
        role={announcement.role}
      >
        {announcement.message}
      </p>
      {visibleReceipts.length === 0 ? (
        <HistoryEmptyState />
      ) : (
        <ul className={HISTORY_LIST_CLASS_NAME}>
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
    <div className={HISTORY_EMPTY_CLASS_NAME}>
      <h3 className={HISTORY_EMPTY_PROMPT_CLASS_NAME}>시작할 작업을 선택하세요.</h3>
      <RequestFlow current="source" />
      <div className={HISTORY_EMPTY_LINKS_CLASS_NAME}>
        <NavLink className={HISTORY_EMPTY_LINK_CLASS_NAME} to={ROUTE_PATHS.video}>
          <AppIcon className="size-7 text-mytube-action-primary" name="video" />
          <span className={HISTORY_EMPTY_LINK_COPY_CLASS_NAME}>
            <strong className={HISTORY_EMPTY_LINK_TITLE_CLASS_NAME}>영상 추출</strong>
            <span className={HISTORY_EMPTY_LINK_DESCRIPTION_CLASS_NAME}>
              YouTube URL로 영상(MP4) 또는 오디오(MP3)를 받습니다.
            </span>
          </span>
        </NavLink>
        <NavLink
          className={`${HISTORY_EMPTY_LINK_CLASS_NAME} ${HISTORY_EMPTY_SECOND_LINK_CLASS_NAME}`}
          to={ROUTE_PATHS.subtitles}
        >
          <AppIcon className="size-7 text-mytube-action-primary" name="subtitle" />
          <span className={HISTORY_EMPTY_LINK_COPY_CLASS_NAME}>
            <strong className={HISTORY_EMPTY_LINK_TITLE_CLASS_NAME}>자막 추출</strong>
            <span className={HISTORY_EMPTY_LINK_DESCRIPTION_CLASS_NAME}>
              로컬 영상으로 영어 자막 파일(SRT)을 만듭니다.
            </span>
          </span>
        </NavLink>
      </div>
      <p className={HISTORY_EMPTY_NOTE_CLASS_NAME}>
        <AppIcon className={HISTORY_EMPTY_NOTE_ICON_CLASS_NAME} name="info" />
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
  /** 현재 요청 항목의 상태 tone. */
  const statusTone = getStatusTone(job?.displayStatus);
  /** 현재 상태 tone에 대응하는 Tailwind color className. */
  const statusClassName = [
    HISTORY_STATUS_CLASS_NAME,
    `history-status--${statusTone}`,
    HISTORY_STATUS_TONE_CLASS_NAMES[statusTone],
  ].join(' ');

  return (
    <li
      className={`${HISTORY_ITEM_CLASS_NAME}${props.highlighted ? ` is-highlighted ${HISTORY_ITEM_HIGHLIGHTED_CLASS_NAME}` : ''}`}
    >
      <article className={HISTORY_ITEM_ARTICLE_CLASS_NAME} aria-labelledby={titleId}>
        <div className={HISTORY_ITEM_HEADER_CLASS_NAME}>
          <div className="min-w-0">
            <h3
              className={HISTORY_ITEM_TITLE_CLASS_NAME}
              id={titleId}
              tabIndex={-1}
            >
              {formatKind(receipt.kind)} 요청
            </h3>
            <p className={HISTORY_ITEM_DETAIL_CLASS_NAME}>
              {job
                ? formatJobDetail(receipt.kind, job)
                : `접수 ${formatDate(receipt.acceptedAt)}`}
            </p>
          </div>
          <span className={statusClassName}>
            <AppIcon name={getStatusIcon(job?.displayStatus)} />
            {query.isPending ? '상태 확인 중' : formatStatus(job?.displayStatus)}
          </span>
        </div>
        <RequestFlow current={getRequestFlowStage(job?.displayStatus)} />
        {job?.progress !== null && job?.progress !== undefined ? (
          <div className={HISTORY_PROGRESS_CLASS_NAME}>
            <progress
              className={HISTORY_PROGRESS_BAR_CLASS_NAME}
              max={100}
              value={job.progress}
            >
              {job.progress}%
            </progress>
            <span>{job.progress}%</span>
          </div>
        ) : null}
        {isConnectionError ? (
          <p className={HISTORY_MESSAGE_CLASS_NAME}>
            서버 연결이 불안정합니다. 내역을 유지하고 다시 확인합니다.
          </p>
        ) : job ? (
          <p className={HISTORY_MESSAGE_CLASS_NAME}>{job.message}</p>
        ) : null}
        {isCompletedWithoutUrl ? (
          <p
            className={`${HISTORY_MESSAGE_CLASS_NAME} history-message--error ${HISTORY_ERROR_MESSAGE_CLASS_NAME}`}
          >
            완료 파일 주소를 받지 못했습니다. 서버 상태를 다시 확인해 주세요.
          </p>
        ) : null}
        <div className={HISTORY_ACTIONS_CLASS_NAME}>
          {job?.displayStatus === 'completed' && job.downloadUrl ? (
            <a
              className={HISTORY_PRIMARY_ACTION_CLASS_NAME}
              download
              href={buildApiUrl(job.downloadUrl, getApiBaseUrl())}
            >
              <AppIcon name="download" />다운로드
            </a>
          ) : null}
          {job?.displayStatus === 'failed' || job?.displayStatus === 'expired' ? (
            <NavLink className={HISTORY_PRIMARY_ACTION_CLASS_NAME} to={retryPath}>
              다시 요청
            </NavLink>
          ) : null}
          {(query.isError || isCompletedWithoutUrl) &&
          !(query.error instanceof JobStatusRequestError && query.error.responseStatus === 404) ? (
            <button
              className={HISTORY_SECONDARY_ACTION_CLASS_NAME}
              type="button"
              onClick={() => void query.refetch()}
            >
              다시 확인
            </button>
          ) : null}
          <button
            aria-label={`${formatKind(receipt.kind)} 요청 내역에서 삭제`}
            className={HISTORY_REMOVE_ACTION_CLASS_NAME}
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

function getStatusTone(status?: string): HistoryStatusTone {
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
