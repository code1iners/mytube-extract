import {
  type DownloadJob,
  type DownloadQuality,
  getDownloadJobVideoId,
} from '../download-job/download-job';
import { type DownloadMode, getYoutubeThumbnailUrl } from '../download-options/download-options';

/** 무대 아래 최근 요청 줄에 보이는 썸네일 최대 개수. 나머지는 더보기로 `recent` 화면에서 본다. */
export const RECENT_REQUEST_STRIP_LIMIT = 3;

/** 하루의 길이(ms). 보관 기간 일수를 시각으로 바꿀 때 쓴다. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** 최근 요청의 상태 배지. 만료는 job 상태가 아니라 보관 기간에서 도출한다. */
export type RecentRequestState = 'queued' | 'processing' | 'completed' | 'failed' | 'expired';

/** 최근 요청 항목마다 하나씩 두는 행동. 완료는 다시 내려받기, 실패는 다시 시도, 만료는 다시 요청이다. */
export type RecentRequestAction = 'redownload' | 'retry' | 'rerequest';

/** 최근 요청 하나의 표시 정보. job에서 도출하며 화면은 이 값만 그린다. */
export type RecentRequest = {
  /** 원본 job ID. 행동을 실행할 때 job을 찾는 데 쓴다. */
  jobId: string;
  /** 상태 배지. */
  state: RecentRequestState;
  /** 상태명(대기 중·처리 중·완료·실패·만료됨). */
  stateLabel: string;
  /** 이 항목에서 할 수 있는 행동. 대기·처리 중이거나 다시 보낼 원본이 없으면 null이다. */
  action: RecentRequestAction | null;
  /** 원본 영상 ID. 원본 주소가 없는 예전 job이면 null이다. */
  videoId: string | null;
  /** 썸네일 주소. 영상 ID를 모르면 null이고 화면은 중립 배경과 형식 아이콘을 그린다. */
  thumbnailUrl: string | null;
  /** 요청 영상 제목. 모르면 영상 ID, 영상 ID도 모르면 형식 이름이다. */
  title: string;
  /** 요청 형식. */
  mode: DownloadMode;
  /** 요청 품질. */
  quality: DownloadQuality;
  /** 요청 시각. */
  createdAt: string;
};

/** 상태별 상태명. */
const STATE_LABELS: Record<RecentRequestState, string> = {
  completed: '완료',
  expired: '만료됨',
  failed: '실패',
  processing: '처리 중',
  queued: '대기 중',
};

/**
 * 완료 파일의 보관 기간이 지났는지 확인한다.
 * Background는 완료 뒤 job을 다시 조회하지 않아 저장된 job이 `completed`로 남는다.
 * 그래서 서버의 `expired` 외에 생성 시각 + 보관 기간으로도 판정한다. 완료 시각이 아닌 생성 시각을
 * 기준으로 하므로 서버보다 조금 일찍 만료로 볼 수 있지만, 이미 지워진 주소를 내미는 것보다 낫다.
 */
export function isDownloadJobExpired(job: DownloadJob, now: number): boolean {
  if (job.displayStatus === 'expired') {
    return true;
  }

  if (job.status !== 'completed') {
    return false;
  }

  /** 요청 생성 시각(ms). */
  const createdAt = Date.parse(job.createdAt);

  return Number.isFinite(createdAt) && createdAt + job.retentionDays * DAY_MS <= now;
}

/** job의 상태 배지를 정한다. */
function deriveRecentRequestState(job: DownloadJob, now: number): RecentRequestState {
  return isDownloadJobExpired(job, now) ? 'expired' : job.status;
}

/** 상태와 남은 원본 정보로 행동을 정한다. */
function deriveRecentRequestAction(
  job: DownloadJob,
  state: RecentRequestState,
): RecentRequestAction | null {
  switch (state) {
    case 'completed':
      return job.downloadUrl ? 'redownload' : null;
    case 'failed':
      return job.sourceUrl ? 'retry' : null;
    case 'expired':
      return job.sourceUrl ? 'rerequest' : null;
    default:
      return null;
  }
}

/** job 하나를 최근 요청 표시 정보로 바꾼다. */
export function deriveRecentRequest(job: DownloadJob, now: number): RecentRequest {
  /** 원본 영상 ID. */
  const videoId = getDownloadJobVideoId(job);
  /** 상태 배지. */
  const state = deriveRecentRequestState(job, now);

  return {
    action: deriveRecentRequestAction(job, state),
    createdAt: job.createdAt,
    jobId: job.jobId,
    mode: job.type,
    quality: job.quality,
    state,
    stateLabel: STATE_LABELS[state],
    thumbnailUrl: videoId ? getYoutubeThumbnailUrl(videoId) : null,
    title: job.title ?? videoId ?? (job.type === 'audio' ? '오디오 MP3' : '비디오 MP4'),
    videoId,
  };
}
