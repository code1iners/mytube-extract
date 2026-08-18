import {
  type DownloadOptions,
  DEFAULT_DOWNLOAD_OPTIONS,
  isYoutubeVideoId,
} from '../../domain/download-options/download-options';
import {
  isYoutubeOverlayQuality,
} from './quality-options';
import { type YoutubeOverlayDownloadRequest } from './youtube-overlay-message';

/** YouTube 썸네일에서 Background로 전달받는 다운로드 입력. */
export type YoutubeOverlayDownloadInput = Pick<
  YoutubeOverlayDownloadRequest,
  'mode' | 'quality' | 'title' | 'videoId'
>;

/** YouTube 제목에서 API 파일명으로 사용할 안전한 문자열을 만든다. */
export function sanitizeYoutubeOverlayFilename(title: string, videoId: string): string {
  /** 경로·제어 문자를 공백으로 바꾼 영상 제목. */
  const normalizedTitle = title
    .replace(/[\\/\0\r\n]/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (
    !normalizedTitle ||
    normalizedTitle === '.' ||
    normalizedTitle === '..' ||
    !isYoutubeVideoId(videoId)
  ) {
    return videoId;
  }

  return normalizedTitle;
}

/** YouTube 썸네일 다운로드 요청을 기존 Popup API option으로 변환한다. */
export function createYoutubeOverlayDownloadOptions(
  input: YoutubeOverlayDownloadInput,
): DownloadOptions {
  if (!isYoutubeVideoId(input.videoId)) {
    throw new Error('A valid YouTube video ID is required.');
  }

  if (!isYoutubeOverlayQuality(input.mode, input.quality)) {
    throw new Error('Unsupported YouTube overlay quality.');
  }

  /** 제목 기반으로 안전하게 만든 API filename. */
  const filename = sanitizeYoutubeOverlayFilename(input.title, input.videoId);
  /** YouTube API에 전달할 canonical watch URL. */
  const sourceUrl = `https://www.youtube.com/watch?v=${input.videoId}`;

  return {
    ...DEFAULT_DOWNLOAD_OPTIONS,
    bitrate: input.mode === 'audio' ? String(input.quality) : '',
    filename,
    mode: input.mode,
    resolution: input.mode === 'video' ? String(input.quality) : '',
    sourceUrl,
  };
}
