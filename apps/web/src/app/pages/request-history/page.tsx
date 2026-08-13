import { type UseQueryResult, useQueries } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import {
  JobStatusRequestError,
  buildApiUrl,
  getJobStatusRetryDelay,
  shouldRetryJobStatus,
} from '../../../api/mytube-extract.api';
import type { DownloadResponse } from '../../../domain/download-request/download-request';
import type { SubtitleJobResponse } from '../../../domain/subtitle-request/subtitle-request';
import { AppIcon, type AppIconName } from '../../components/app-icon';
import { ROUTE_PATHS } from '../../constants/route-paths.constant';
import {
  type JobReceipt,
  type JobReceiptKind,
  listJobReceipts,
  removeJobReceipt,
} from '../../utils/job-receipt.util';
import {
  fetchHistoryJobStatus,
  getHistoryRefetchInterval,
  parseHistoryDeepLink,
  updateDismissedReceiptKeys,
} from './request-history.logic';

type JobStatus = DownloadResponse | SubtitleJobResponse;

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
  const [announcement, setAnnouncement] = useState('');
  const previousStatuses = useRef(new Map<string, string>());
  const apiBaseUrl = getApiBaseUrl();
  const visibleReceipts = receipts.filter(
    (receipt) => !dismissedKeys.has(getReceiptIdentity(receipt)),
  );
  const queries = useQueries({
    queries: visibleReceipts.map((receipt) => ({
      queryKey: ['job-status', receipt.kind, receipt.jobId],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchHistoryJobStatus(receipt, apiBaseUrl, signal),
      refetchInterval: (query: { state: { data?: JobStatus } }) =>
        getHistoryRefetchInterval(query.state.data?.displayStatus),
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
      retry: shouldRetryJobStatus,
      retryDelay: getJobStatusRetryDelay,
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
        }

        const next = readReceipts(deepReceipt);
        setReceipts(next.receipts);
        setStorageAvailable(next.storageAvailable);
      }

      handleStorageChange();
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    },
    [deepReceipt],
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
      setAnnouncement('더 이상 조회할 수 없는 요청을 내역에서 제거했습니다.');
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
          setAnnouncement(
            `요청 상태가 ${formatStatus(query.data.displayStatus)}(으)로 변경되었습니다.`,
          );
        }
      });
    },
    [statusSignature],
  );

  function handleRemove(receipt: JobReceipt, index: number) {
    removeJobReceipt(receipt.kind, receipt.jobId);
    setDismissedKeys((current) =>
      new Set(current).add(getReceiptIdentity(receipt)),
    );
    setAnnouncement(`${formatKind(receipt.kind)} 요청을 내역에서 삭제했습니다.`);

    window.requestAnimationFrame(() => {
      const buttons = document.querySelectorAll<HTMLButtonElement>(
        '.history-remove-button',
      );
      (buttons[index] ?? buttons[index - 1])?.focus();

      if (buttons.length === 0) {
        document.querySelector<HTMLElement>('#history-title')?.focus();
      }
    });
  }

  return (
    <section className="console-panel history-panel" aria-labelledby="history-title">
      <div className="panel-title-row">
        <h2 id="history-title" tabIndex={-1}>
          <AppIcon name="queued" />이 브라우저의 요청 내역
        </h2>
        <span className="title-dots" aria-hidden="true" />
      </div>
      <p className="history-description">
        이 브라우저에서 접수한 최근 요청 20건을 서버의 최신 상태로 확인합니다.
      </p>
      {storageFailed ? (
        <div className="notice-box" role="status">
          <span aria-hidden="true"><AppIcon name="failed" /></span>
          <p>이 브라우저에 내역을 저장하지 못했습니다. 현재 링크의 요청은 계속 확인할 수 있습니다.</p>
        </div>
      ) : null}
      <p className="visually-hidden" aria-live="polite" role="status">
        {announcement}
      </p>
      {visibleReceipts.length === 0 ? (
        <div className="history-empty">
          <p>아직 이 브라우저에서 접수한 요청이 없습니다.</p>
          <NavLink className="primary-button" to={ROUTE_PATHS.video}>영상 요청하기</NavLink>
        </div>
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
  const titleId = `history-item-${receipt.kind}-${receipt.jobId}`;

  return (
    <li className={props.highlighted ? 'history-item is-highlighted' : 'history-item'}>
      <article aria-labelledby={titleId}>
        <div className="history-item__header">
          <div>
            <h3 id={titleId}>{formatKind(receipt.kind)} 요청</h3>
            <p>{job ? formatJobDetail(receipt.kind, job) : `접수 ${formatDate(receipt.acceptedAt)}`}</p>
          </div>
          <span className={`history-status history-status--${getStatusTone(job?.displayStatus)}`}>
            <AppIcon name={getStatusIcon(job?.displayStatus)} />
            {query.isPending ? '상태 확인 중' : formatStatus(job?.displayStatus)}
          </span>
        </div>
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
