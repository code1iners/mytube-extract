import {
  isDownloadMode,
  isYoutubeVideoId,
  type DownloadMode,
} from '../../domain/download-options/download-options';
import {
  isYoutubeOverlayQuality,
  type YoutubeOverlayQuality,
} from './quality-options';

/** Background에 다운로드를 요청하는 메시지 종류. */
export const YOUTUBE_OVERLAY_DOWNLOAD_MESSAGE_TYPE = 'youtube-overlay-download' as const;

/** Popup에서 현재 YouTube 탭 활성화를 요청하는 메시지 종류. */
export const YOUTUBE_OVERLAY_ENABLE_MESSAGE_TYPE = 'youtube-overlay-enable' as const;

/** Background가 주입할 unlisted script 파일명. */
export const YOUTUBE_OVERLAY_SCRIPT_FILE = 'youtube-overlay.js' as const;

/** YouTube 썸네일에서 Background로 전달하는 다운로드 요청. */
export type YoutubeOverlayDownloadRequest = {
  /** 다운로드 요청 종류. */
  type: typeof YOUTUBE_OVERLAY_DOWNLOAD_MESSAGE_TYPE;
  /** 오디오 또는 비디오 모드. */
  mode: DownloadMode;
  /** 선택한 비트레이트 또는 해상도. */
  quality: YoutubeOverlayQuality;
  /** 썸네일에서 읽은 영상 제목. */
  title: string;
  /** YouTube 영상 ID. */
  videoId: string;
};

/** Popup에서 Background로 전달하는 활성화 요청. */
export type YoutubeOverlayEnableRequest = {
  /** 활성화 요청 종류. */
  type: typeof YOUTUBE_OVERLAY_ENABLE_MESSAGE_TYPE;
};

/** Background 다운로드 결과. */
export type YoutubeOverlayDownloadResponse =
  | {
      /** 성공 여부. */
      ok: true;
      /** 결과 종류. */
      kind: 'download-started';
    }
  | {
      /** 성공 여부. */
      ok: false;
      /** 사용자에게 전달할 실패 메시지. */
      message: string;
    };

/** Background 활성화 결과. */
export type YoutubeOverlayEnableResponse =
  | {
      /** 성공 여부. */
      ok: true;
    }
  | {
      /** 성공 여부. */
      ok: false;
      /** 사용자에게 전달할 실패 메시지. */
      message: string;
    };

/** 알 수 없는 runtime message가 다운로드 요청인지 확인한다. */
export function isYoutubeOverlayDownloadRequest(
  message: unknown,
): message is YoutubeOverlayDownloadRequest {
  if (!isRecord(message)) {
    return false;
  }

  return (
    message.type === YOUTUBE_OVERLAY_DOWNLOAD_MESSAGE_TYPE &&
    isDownloadMode(message.mode) &&
    isYoutubeOverlayQuality(message.mode, message.quality) &&
    isYoutubeVideoId(message.videoId) &&
    typeof message.title === 'string' &&
    message.title.length <= 500
  );
}

/** 알 수 없는 runtime message가 활성화 요청인지 확인한다. */
export function isYoutubeOverlayEnableRequest(
  message: unknown,
): message is YoutubeOverlayEnableRequest {
  return isRecord(message) && message.type === YOUTUBE_OVERLAY_ENABLE_MESSAGE_TYPE;
}

/** 알 수 없는 값을 record 형태로 좁힌다. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
