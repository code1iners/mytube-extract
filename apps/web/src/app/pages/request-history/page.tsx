import { type UseQueryResult, useQueries } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import {
  JobStatusRequestError,
  buildApiUrl,
} from '../../../api/mytube-extract.api';
import { AUDIO_QUALITY_OPTIONS, VIDEO_QUALITY_OPTIONS, downloadDraftSchema, type DownloadDraft, type DownloadResponse } from '../../../domain/download-request/download-request';
import type { SubtitleJobResponse } from '../../../domain/subtitle-request/subtitle-request';
import { AppIcon, type AppIconName } from '../../components/app-icon';
import { createVideoRequestAdapter } from '../../adapters/video-request.adapter';
import { useNavigation } from '../../components/navigation-context';
import { RequestReadinessNotice } from '../../components/request-readiness-notice';
import { setDownloadPreferences } from '../../utils/request-preference.util';
import { useHistoryAcceptance, getHistorySessionReceipts, forgetHistorySessionReceipt, isHistoryReceiptPruned } from './use-history-acceptance';
import { PanelTitle } from '../../components/panel-title';
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

type JobStatus = DownloadResponse | SubtitleJobResponse;

/** 요청 내역 페이지의 flat layout·surface className. */
const HISTORY_PANEL_CLASS_NAME =
  'phase-panel history-panel grid min-w-0 w-full max-w-none m-0 gap-mytube-24 border-0 rounded-none bg-transparent p-0 [box-shadow:none] min-[821px]:self-start';
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
  'history-list grid min-w-0 m-0 p-0 list-none border-t border-mytube-border';
/** 요청 내역 항목의 Tailwind surface className. */
const HISTORY_ITEM_CLASS_NAME =
  'history-item min-w-0 py-mytube-24 border-b border-mytube-border';
/** deep link로 강조된 요청 내역 항목의 border className. */
const HISTORY_ITEM_HIGHLIGHTED_CLASS_NAME = 'outline-2 outline-mytube-focus [outline-offset:4px]';
/** 요청 내역 항목 내부의 Tailwind layout className. */
const HISTORY_ITEM_ARTICLE_CLASS_NAME =
  'grid min-w-0 gap-mytube-16';
/** 요청 내역 항목 header의 Tailwind responsive layout className. */
const HISTORY_ITEM_HEADER_CLASS_NAME =
  'history-item__header grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-mytube-12';
/** 요청 내역 항목 제목의 typography·focus className. */
const HISTORY_ITEM_TITLE_CLASS_NAME =
  'm-0 text-[18px] font-semibold leading-[1.4] [overflow-wrap:anywhere] focus:outline-2 focus:outline-mytube-focus focus:[outline-offset:2px]';
/** 제목이 없는 영상 요청의 원본 링크 className. */
const HISTORY_SOURCE_LINK_CLASS_NAME =
  'text-mytube-text-primary underline decoration-1 underline-offset-2 focus-visible:outline-2 focus-visible:outline-mytube-focus focus-visible:[outline-offset:2px] [overflow-wrap:anywhere]';
/** 요청 내역 항목의 API 메타 className. */
const HISTORY_ITEM_DETAIL_CLASS_NAME =
  'history-item__header-detail m-0 mt-[4px] text-mytube-text-secondary text-[14px] leading-[1.5] [overflow-wrap:anywhere]';
/** 요청 내역 상태 label의 공통 Tailwind className. */
const HISTORY_STATUS_CLASS_NAME =
  'history-status inline-flex items-center gap-[6px] text-[14px] font-semibold leading-[1.4]';
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
  expired: 'text-mytube-text-secondary',
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
  /** 삭제한 접수증으로 메뉴의 저장 실패 연결이 다시 향하지 않게 한다. */
  const { historyDestination, setHistoryDestination } = useNavigation();
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
  /** 내역의 원래 조건만 사용하고 작성 중 초안에는 접근하지 않는다. */
  const retryAdapter = useMemo(() => {
    /** 기존 영상 통신과 입력 검증을 그대로 재사용한다. */
    const adapter = createVideoRequestAdapter({ apiBaseUrl });
    return {
      ...adapter,
      async createRequest(input: DownloadDraft, signal: AbortSignal) {
        /** 서버 접수가 확인된 뒤에만 이후 기본값을 기억한다. */
        const job = await adapter.createRequest(input, signal);
        setDownloadPreferences({ mode: input.mode, quality: input.quality });
        return job;
      },
    };
  }, [apiBaseUrl]);
  /** 영상·오디오 전체가 공유하는 한 번의 접수 제어. */
  const acceptance = useHistoryAcceptance(retryAdapter, (receipt, storageFailed) => {
    setReceipts(readReceipts(deepReceipt).receipts);
    if (storageFailed) setStorageAvailable(false);
    announce(storageFailed
      ? '새 요청을 접수했습니다. 내역 저장에 실패했지만 현재 세션에서는 계속 확인할 수 있습니다.'
      : '새 요청을 접수했습니다. 기존 요청은 그대로입니다.');
    window.requestAnimationFrame(() => document.getElementById(getHistoryTitleId(receipt))?.focus());
  });
  /** 조회 실패와 별개로 현재 접수 조작만 잠근다. */
  const accepting = acceptance.lifecycle.phase === 'accepting';
  /** 비활성화된 실행 버튼에서 실패 안내의 시작 위치로 포커스를 복구한다. */
  const wasAccepting = useRef(false);
  useEffect(function focusFailedAcceptance() {
    if (wasAccepting.current && !accepting && acceptance.lifecycle.error && acceptance.source) {
      document.getElementById(getHistoryTitleId(acceptance.source))?.focus();
    }
    wasAccepting.current = accepting;
  }, [accepting, acceptance.lifecycle.error, acceptance.source]);
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
    (!storageAvailable && deepReceipt !== null) || getHistorySessionReceipts().length > 0;

  useEffect(
    function synchronizeOtherTabs() {
      function handleStorageChange(event?: StorageEvent) {
        if (event) {
          setDismissedKeys((current) =>
            updateDismissedReceiptKeys(current, event.key, event.newValue),
          );

          /** 다른 탭에서 변경된 접수증의 storage identity. */
          const changedReceipt = parseJobReceiptStorageKey(event.key);

          if (changedReceipt) forgetHistorySessionReceipt(changedReceipt);
          if (event.key === null) getHistorySessionReceipts().forEach(forgetHistorySessionReceipt);

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
          forgetHistorySessionReceipt(receipt);
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

    forgetHistorySessionReceipt(receipt);
    /** 마지막 접수증이 삭제되면 내역 메뉴도 일반 목록으로 복귀한다. */
    const linkedReceipt = parseHistoryDeepLink(historyDestination.split('?')[1] ?? '', receipt.acceptedAt);
    if (linkedReceipt && getReceiptIdentity(linkedReceipt) === getReceiptIdentity(receipt)) {
      setHistoryDestination(ROUTE_PATHS.history);
    }
    setDismissedKeys((current) =>
      new Set(current).add(getReceiptIdentity(receipt)),
    );
    setUndoReceipt(receipt);
    announce(
      `${formatKind(receipt.kind)} 요청을 내역에서 삭제했습니다. 8초 동안 되돌릴 수 있습니다.`,
    );

    window.requestAnimationFrame(function focusAfterHistoryRemoval() {
      /** 삭제 뒤 실제 목록 순서의 다음 항목, 없으면 이전 항목. */
      const items = document.querySelectorAll<HTMLElement>('.history-item');
      /** 닫힌 상세 안의 삭제 버튼을 건너뛰고 항상 노출된 조작을 찾는다. */
      const adjacentItem = items[index] ?? items[index - 1];
      /** 주요 행동이 없으면 상세 펼치기로 이동한다. */
      const nextFocusTarget = adjacentItem?.querySelector<HTMLElement>(
        '.history-actions a, .history-actions button:not(:disabled)',
      ) ?? adjacentItem?.querySelector<HTMLElement>('.history-details-toggle');

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
      <PanelTitle
        icon="queued"
        id="history-title"
        tabIndex={-1}
        titleClassName={HISTORY_FOCUSABLE_TITLE_CLASS_NAME}
      >
        요청 내역
      </PanelTitle>
      <p className={HISTORY_DESCRIPTION_CLASS_NAME}>
        이 브라우저에서 접수한 최근 요청 20건입니다.
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
            이 브라우저에 내역을 저장하지 못했습니다. 현재 세션의 요청은 계속 확인할 수 있습니다. 새로고침 후에는 복구되지 않을 수 있습니다.
          </p>
        </div>
      ) : null}
      {!visibleReceipts.some((receipt) => acceptance.source && getReceiptIdentity(receipt) === getReceiptIdentity(acceptance.source)) ? (
        <RequestReadinessNotice
          id="history-readiness"
          status={acceptance.lifecycle.readiness.status}
          isFetching={acceptance.lifecycle.readiness.isFetching}
          onRetry={() => acceptance.lifecycle.actions.retryReadiness?.()}
        />
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
              acceptance={acceptance}
              accepting={accepting}
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

/** 접힌 목록에서도 요청 식별 정보와 상태별 주요 행동을 제공한다. */
function HistoryItem(props: {
  /** 직접 연결된 항목의 시각적 강조 여부. */
  highlighted: boolean;
  /** 기존 주기적 상태 조회 결과. */
  query: UseQueryResult<JobStatus, Error>;
  /** 브라우저에 저장된 접수증. */
  receipt: JobReceipt;
  /** 목록 공통 접수 상태와 조작. */
  acceptance: ReturnType<typeof useHistoryAcceptance<DownloadDraft, DownloadResponse, 'video'>>;
  /** 접수 중에는 다른 재요청과 원래 항목 삭제를 막는다. */
  accepting: boolean;
  /** 접수증만 삭제하는 동작. */
  onRemove: () => void;
}) {
  /** 목록 식별자와 서버 상태 조회 결과. */
  const { query, receipt } = props;
  /** 상태 갱신과 독립적으로 유지할 상세 열림 상태. */
  const [detailsOpen, setDetailsOpen] = useState(false);
  /** 마지막으로 확인한 서버 작업. */
  const job = query.data;
  /** 작업 실패와 별개인 조회 연결 오류. */
  const isConnectionError =
    query.isError || query.failureCount > 0 || query.fetchStatus === 'paused';
  /** 완료 응답에 다운로드 주소가 없어 재조회해야 하는 상태. */
  const isCompletedWithoutUrl =
    job?.displayStatus === 'completed' && !job.downloadUrl;
  /** 이 항목에서 시작한 접수 시도에만 상태와 취소를 표시한다. */
  const isRetrySource = props.acceptance.source !== null &&
    getReceiptIdentity(props.acceptance.source) === getReceiptIdentity(receipt);
  /** 서버 응답의 조건도 기존 입력 검증을 통과해야 한다. */
  const retryDraft = job && 'sourceUrl' in job ? downloadDraftSchema.safeParse({
    sourceUrl: job.sourceUrl, mode: job.type, quality: job.quality,
  }) : null;
  /** 형식과 품질 조합까지 확인해 잘못된 서버 조건을 임의로 보정하지 않는다. */
  const validRetryDraft = retryDraft?.success && (
    retryDraft.data.mode === 'audio' ? AUDIO_QUALITY_OPTIONS : VIDEO_QUALITY_OPTIONS
  ).some((option) => option.value === retryDraft.data.quality) ? retryDraft.data : null;
  /** 재요청 가능한 종료 상태에서만 조건 복구를 요구한다. */
  const needsRetryConditions = receipt.kind === 'video' &&
    (job?.displayStatus === 'failed' || job?.displayStatus === 'expired') && !validRetryDraft;
  /** 해당 항목의 공통 접수 제어. */
  const lifecycle = props.acceptance.lifecycle;
  /** 제목과 상세 영역의 접근성 연결 기준. */
  const titleId = getHistoryTitleId(receipt);
  /** 조회 복구가 필요한 경우 실제 작업 실패로 표현하지 않는다. */
  const statusTone =
    isConnectionError || isCompletedWithoutUrl
      ? 'failed'
      : getStatusTone(job?.displayStatus);
  /** 화면 상태의 텍스트·아이콘과 함께 사용할 색. */
  const statusClassName = [
    HISTORY_STATUS_CLASS_NAME,
    `history-status--${statusTone}`,
    HISTORY_STATUS_TONE_CLASS_NAMES[statusTone],
  ].join(' ');
  /** 종료된 요청에는 서버의 마지막 진행률도 표시하지 않는다. */
  const isActive =
    job &&
    ['queued', 'processing', 'extracting_audio', 'transcribing'].includes(
      job.displayStatus,
    );
  /** 서버가 확인해 준 유효 범위의 진행률만 사용한다. */
  const progress =
    isActive &&
    !isConnectionError &&
    typeof job.progress === 'number' &&
    Number.isFinite(job.progress) &&
    job.progress >= 0 &&
    job.progress <= 100
      ? job.progress
      : null;

  return (
    <li
      className={`${HISTORY_ITEM_CLASS_NAME}${props.highlighted ? ` is-highlighted ${HISTORY_ITEM_HIGHLIGHTED_CLASS_NAME}` : ''}`}
    >
      <article
        className={HISTORY_ITEM_ARTICLE_CLASS_NAME}
        aria-labelledby={titleId}
      >
        <div className={HISTORY_ITEM_HEADER_CLASS_NAME}>
          <div className="min-w-0">
            <h3
              className={HISTORY_ITEM_TITLE_CLASS_NAME}
              id={titleId}
              tabIndex={-1}
            >
              {renderHistoryTitle(receipt.kind, job)}
            </h3>
            <p className={HISTORY_ITEM_DETAIL_CLASS_NAME}>
              {job
                ? formatJobDetail(receipt.kind, job)
                : `${formatKind(receipt.kind)} · 접수 ${formatDate(receipt.acceptedAt)}`}
            </p>
          </div>
          <button
            aria-controls={`${titleId}-details`}
            aria-expanded={detailsOpen}
            aria-labelledby={`${titleId} ${titleId}-toggle-label`}
            className="history-details-toggle grid size-11 shrink-0 place-items-center border-0 bg-transparent rounded-mytube-md text-mytube-text-primary cursor-pointer hover:bg-mytube-surface-alt focus-visible:outline-2 focus-visible:outline-mytube-focus focus-visible:[outline-offset:2px]"
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
          >
            <span className="sr-only" id={`${titleId}-toggle-label`}>
              상세
            </span>
            <svg
              aria-hidden="true"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d={detailsOpen ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} />
            </svg>
          </button>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-mytube-12">
          <span className={statusClassName}>
            <AppIcon
              name={
                isConnectionError || isCompletedWithoutUrl
                  ? 'info'
                  : getStatusIcon(job?.displayStatus)
              }
            />
            {isConnectionError
              ? '조회 오류'
              : isCompletedWithoutUrl
                ? '파일 확인 필요'
                : query.isPending
                  ? '상태 확인 중'
                  : formatStatus(job?.displayStatus)}
          </span>
          <div className={HISTORY_ACTIONS_CLASS_NAME}>
            {job?.displayStatus === 'completed' && job.downloadUrl ? (
              <a
                className={HISTORY_PRIMARY_ACTION_CLASS_NAME}
                download
                href={buildApiUrl(job.downloadUrl, getApiBaseUrl())}
              >
                <AppIcon name="download" />
                다운로드
              </a>
            ) : null}
            {!isConnectionError && (job?.displayStatus === 'failed' ||
            job?.displayStatus === 'expired') ? (
              receipt.kind === 'video' ? (
                <button
                  className={`${HISTORY_PRIMARY_ACTION_CLASS_NAME} disabled:opacity-60 disabled:cursor-not-allowed`}
                  type="button"
                  disabled={props.accepting || !lifecycle.canSubmit || !validRetryDraft}
                  aria-describedby={isRetrySource ? `${titleId}-acceptance` : lifecycle.readiness.status.kind !== 'ready' ? 'history-readiness' : undefined}
                  onClick={() => { if (validRetryDraft) props.acceptance.submit(receipt, validRetryDraft); }}
                >
                  {isRetrySource && props.accepting ? '접수 중' : '다시 요청'}
                </button>
              ) : (
                <NavLink
                  className={HISTORY_PRIMARY_ACTION_CLASS_NAME}
                  to={ROUTE_PATHS.subtitles}
                  aria-disabled={props.accepting || undefined}
                  onClick={(event) => { if (props.accepting) event.preventDefault(); }}
                >다시 요청</NavLink>
              )
            ) : null}
            {(isConnectionError || isCompletedWithoutUrl || needsRetryConditions) &&
            !(
              query.error instanceof JobStatusRequestError &&
              query.error.responseStatus === 404
            ) ? (
              <button
                className={HISTORY_SECONDARY_ACTION_CLASS_NAME}
                type="button"
                onClick={() => void query.refetch()}
              >
                다시 확인
              </button>
            ) : null}
          </div>
        </div>
        {isRetrySource ? (
          <div id={`${titleId}-acceptance`} className="grid min-w-0 gap-mytube-8">
            {props.accepting ? (
              <>
                <p className={HISTORY_MESSAGE_CLASS_NAME} role="status">새 요청을 접수하고 있습니다. 접수 전에는 취소할 수 있습니다.</p>
                <button
                  className={`${HISTORY_SECONDARY_ACTION_CLASS_NAME} justify-self-start`}
                  type="button"
                  onClick={() => {
                    lifecycle.actions.cancel?.();
                    window.requestAnimationFrame(() => document.getElementById(titleId)?.focus());
                  }}
                >접수 취소</button>
              </>
            ) : (
              <>
                <RequestReadinessNotice
                  id="history-readiness"
                  status={lifecycle.readiness.status}
                  isFetching={lifecycle.readiness.isFetching}
                  onRetry={() => lifecycle.actions.retryReadiness?.()}
                />
                {lifecycle.error?.source === 'request' ? (
                  <p className={`${HISTORY_MESSAGE_CLASS_NAME} ${HISTORY_ERROR_MESSAGE_CLASS_NAME}`} role="alert">
                    요청을 접수하지 못했습니다. 기존 내역과 입력은 그대로입니다. 다시 요청해 주세요.
                  </p>
                ) : lifecycle.requestNotice ? (
                  <p className={HISTORY_MESSAGE_CLASS_NAME} role="status">{lifecycle.requestNotice}</p>
                ) : null}
              </>
            )}
          </div>
        ) : null}
        {needsRetryConditions && !isConnectionError ? (
          <p className={HISTORY_MESSAGE_CLASS_NAME} role="alert">재요청 조건을 확인할 수 없습니다. 상태를 다시 확인해 주세요.</p>
        ) : null}
        {progress !== null ? (
          <div className={HISTORY_PROGRESS_CLASS_NAME}>
            <progress
              aria-label="처리 진행률"
              className={HISTORY_PROGRESS_BAR_CLASS_NAME}
              max={100}
              value={progress}
            >
              {progress}%
            </progress>
            <span>{progress}%</span>
          </div>
        ) : null}
        {isConnectionError ? (
          <p className={HISTORY_MESSAGE_CLASS_NAME}>
            서버 연결이 불안정합니다. 내역을 유지하고 다시 확인합니다.
          </p>
        ) : isCompletedWithoutUrl ? (
          <p
            className={`${HISTORY_MESSAGE_CLASS_NAME} ${HISTORY_ERROR_MESSAGE_CLASS_NAME}`}
          >
            완료 파일 주소를 받지 못했습니다. 서버 상태를 다시 확인해 주세요.
          </p>
        ) : job?.displayStatus === 'completed' ? (
          <p className={HISTORY_MESSAGE_CLASS_NAME}>
            {receipt.kind === 'subtitle' ? '영어 SRT · ' : ''}완료 파일은{' '}
            {job.retentionDays}일 동안 보관됩니다.
          </p>
        ) : job ? (
          <p className={HISTORY_MESSAGE_CLASS_NAME}>{job.message}</p>
        ) : null}
        <div
          className="history-details min-w-0"
          hidden={!detailsOpen}
          id={`${titleId}-details`}
        >
          <div className="grid min-w-0 gap-mytube-12">
            {job && 'sourceUrl' in job && job.title?.trim() ? (
              <p className={HISTORY_MESSAGE_CLASS_NAME}>
                원본:{' '}
                <a
                  className={HISTORY_SOURCE_LINK_CLASS_NAME}
                  href={job.sourceUrl}
                >
                  {job.sourceUrl}
                </a>
              </p>
            ) : null}
            <p className={HISTORY_MESSAGE_CLASS_NAME}>
              작업 식별자: {receipt.jobId}
            </p>
            <p className={HISTORY_MESSAGE_CLASS_NAME}>
              접수 {formatDate(receipt.acceptedAt)}
            </p>
            <p className={HISTORY_MESSAGE_CLASS_NAME}>
              내역에서만 삭제하며 서버 작업은 취소하지 않습니다.
            </p>
            <button
              aria-label={`${formatKind(receipt.kind)} 요청 내역에서 삭제`}
              className={`${HISTORY_REMOVE_ACTION_CLASS_NAME} justify-self-start`}
              type="button"
              disabled={props.accepting}
              onClick={props.onRemove}
            >
              내역에서 삭제
            </button>
          </div>
        </div>
      </article>
    </li>
  );
}

function readReceipts(deepReceipt: JobReceipt | null) {
  const stored = listJobReceipts();
  /** 저장 실패 접수증은 메뉴 복귀에도 보존하며 영속 저장을 주장하지 않는다. */
  const session = getHistorySessionReceipts();
  /** 중복을 제거하고 기존 최신 20건 보존 규칙을 적용한다. */
  const merged = new Map([...stored.receipts, ...session].map((receipt) => [getReceiptIdentity(receipt), receipt]));
  const result = {
    storageAvailable: stored.storageAvailable,
    receipts: [...merged.values()].filter((receipt) => !isHistoryReceiptPruned(receipt)).sort((left, right) => right.acceptedAt.localeCompare(left.acceptedAt)).slice(0, 20),
  };

  return {
    ...result,
    receipts:
      deepReceipt &&
      !isHistoryReceiptPruned(deepReceipt) &&
      !result.receipts.some(
        (receipt) => getReceiptIdentity(receipt) === getReceiptIdentity(deepReceipt),
      )
        ? [deepReceipt, ...result.receipts].slice(0, 20)
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
  if (status === 'extracting_audio') return '오디오 추출 중';
  if (status === 'transcribing') return '자막 생성 중';
  if (status === 'processing') return '처리 중';
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
    : `자막 · ${'whisperModel' in job && job.whisperModel === 'small_en' ? '정확도 우선' : '속도 우선'} · ${formatDate(job.createdAt)}`;
}

/** 제목이 있으면 일반 텍스트로, 없으면 식별 가능한 원본 링크로 표시한다. */
function renderHistoryTitle(kind: JobReceiptKind, job: JobStatus | undefined) {
  if (kind === 'subtitle' && job && 'fileName' in job && job.fileName.trim()) {
    return job.fileName;
  }

  if (kind !== 'video' || !job || !('type' in job)) {
    return `${formatKind(kind)} 요청`;
  }

  /** 응답에서 확보한 요청 영상 제목. */
  const title = job.title?.trim();

  if (title) {
    return title;
  }

  /** 제목이 없을 때 요청을 식별할 원본 영상 링크. */
  const sourceUrl = job.sourceUrl?.trim();

  if (!sourceUrl) {
    return `${formatKind(kind)} 요청`;
  }

  return (
    <a className={HISTORY_SOURCE_LINK_CLASS_NAME} href={sourceUrl}>
      {sourceUrl}
    </a>
  );
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
