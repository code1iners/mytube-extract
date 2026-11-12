import { getYoutubeThumbnailUrl, parseYoutubeVideoId } from '../download-options/download-options';

/** Popup 상태 종류. */
export type PopupStatusKind =
  | 'missing-source-url'
  | 'invalid-source-url'
  | 'ready'
  | 'checking-server'
  | 'job-queued'
  | 'job-processing'
  | 'download-started'
  | 'download-failed';

/** Popup 상태 메시지. */
export type PopupStatus = {
  /** 상태 종류. */
  kind: PopupStatusKind;
  /** 사용자에게 표시할 상태 메시지. */
  message: string;
};

/** URL 입력 대기 상태. */
export const MISSING_SOURCE_URL_STATUS: PopupStatus = {
  kind: 'missing-source-url',
  message: '추출할 URL을 입력하세요.',
};

/** URL 형식 오류 상태. */
export const INVALID_SOURCE_URL_STATUS: PopupStatus = {
  kind: 'invalid-source-url',
  message: '지원하는 YouTube URL을 입력하세요.',
};

/** 서버 확인 상태. */
export const CHECKING_SERVER_STATUS: PopupStatus = {
  kind: 'checking-server',
  message: 'API 서버를 확인하고 있습니다.',
};

/** 다운로드 시작 상태. */
export const DOWNLOAD_STARTED_STATUS: PopupStatus = {
  kind: 'download-started',
  message: '추출 요청을 시작했습니다.',
};

/** job 대기 중 상태를 만든다. */
export function createJobQueuedStatus(message: string): PopupStatus {
  return {
    kind: 'job-queued',
    message,
  };
}

/** job 처리 중 상태를 만든다. */
export function createJobProcessingStatus(message: string): PopupStatus {
  return {
    kind: 'job-processing',
    message,
  };
}

/** 원본 URL 준비 상태를 만든다. */
export function createReadyStatus(): PopupStatus {
  return {
    kind: 'ready',
    message: '추출할 URL이 준비되었습니다.',
  };
}

/** URL 형식 오류 상태를 만든다. */
export function createInvalidSourceUrlStatus(message: string): PopupStatus {
  return {
    kind: 'invalid-source-url',
    message,
  };
}

/** 실패 상태를 만든다. */
export function createDownloadFailedStatus(message: string): PopupStatus {
  return {
    kind: 'download-failed',
    message,
  };
}

/** 무대에 올릴 원본. 무대는 Popup 메인 화면 위쪽의 16:9 영역이다. */
export type StageSource =
  | {
      /** 활성 탭에서 자동 지정했는지(`tab`), 사용자가 붙여넣었는지(`pasted`). */
      kind: 'tab' | 'pasted';
      /** YouTube 영상 ID. */
      videoId: string;
      /** 영상 제목. 모르면 null이고 화면은 영상 ID를 대신 보여준다. */
      title: string | null;
      /** 영상 ID로 만든 YouTube 썸네일 주소. */
      thumbnailUrl: string;
    }
  | {
      /** 원본 주소가 없어 붙여넣기 칸을 보여주는 상태(missing-source-url). */
      kind: 'empty';
    }
  | {
      /** 지원하지 않는 주소를 넣은 상태(invalid-source-url). */
      kind: 'invalid';
      /** 사용자가 넣은 주소 원문. */
      input: string;
    };

/** 활성 탭에서 읽은 YouTube 영상. */
export type TabVideo = {
  /** YouTube 영상 ID. */
  videoId: string;
  /** 탭 제목에서 YouTube 접미사를 뗀 영상 제목. */
  title: string | null;
};

/** 탭 제목 끝의 YouTube 접미사. */
const YOUTUBE_TAB_TITLE_SUFFIX = /\s+-\s+YouTube$/;
/** 알림이 있을 때 YouTube가 탭 제목 앞에 붙이는 개수 표기. 예: `(3) `. */
const YOUTUBE_TAB_NOTIFICATION_PREFIX = /^\(\d+\+?\)\s+/;

/** YouTube 탭 제목에서 영상 제목만 남긴다. 남는 것이 없거나 YouTube 자체 이름뿐이면 null이다. */
export function parseYoutubeTabTitle(tabTitle: string | null | undefined): string | null {
  /** 접미사와 알림 개수를 뗀 제목. */
  const title = (tabTitle ?? '')
    .trim()
    .replace(YOUTUBE_TAB_TITLE_SUFFIX, '')
    .replace(YOUTUBE_TAB_NOTIFICATION_PREFIX, '')
    .trim();

  return title && title !== 'YouTube' ? title : null;
}

/** 현재 원본 주소와 활성 탭 영상으로 무대 원본을 도출한다. */
export function deriveStageSource(sourceUrl: string, tabVideo: TabVideo | null): StageSource {
  if (!sourceUrl.trim()) {
    return { kind: 'empty' };
  }

  /** 원본 주소의 YouTube 영상 ID. */
  const videoId = parseYoutubeVideoId(sourceUrl);

  if (!videoId) {
    return { input: sourceUrl, kind: 'invalid' };
  }

  /** 원본이 활성 탭 영상인지 여부. 붙여넣은 주소라도 탭과 같은 영상이면 탭 제목을 그대로 쓸 수 있어 `tab`으로 본다. */
  const isTabVideo = tabVideo?.videoId === videoId;

  return {
    kind: isTabVideo ? 'tab' : 'pasted',
    thumbnailUrl: getYoutubeThumbnailUrl(videoId),
    title: isTabVideo ? tabVideo.title : null,
    videoId,
  };
}

/** 무대에 영상이 올라와 있는지 확인한다. */
export function hasStageVideo(
  stageSource: StageSource,
): stageSource is Extract<StageSource, { kind: 'tab' | 'pasted' }> {
  return stageSource.kind === 'tab' || stageSource.kind === 'pasted';
}
