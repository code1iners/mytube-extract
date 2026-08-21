import {
  type CreateDownloadJobInput,
  type DownloadQuality,
} from '../../domain/download-job/download-job';
import { isYoutubeVideoId } from '../../domain/download-options/download-options';
import { isQualityOption } from '../../domain/download-options/quality-options';
import { DEFAULT_API_BASE_URL } from '../../shared/constants';
import { sanitizeFilenameSegment } from '../../shared/sanitize-filename';
import { type YoutubeOverlayDownloadRequest } from './youtube-overlay-message';

/** YouTube 썸네일에서 Background로 전달받는 다운로드 입력. */
export type YoutubeOverlayDownloadInput = Pick<
  YoutubeOverlayDownloadRequest,
  'mode' | 'quality' | 'title' | 'videoId'
>;

/** 오버레이 job 제출에 필요한 입력. localFilename은 서버가 아닌 로컬 저장 시점에만 사용한다. */
export type YoutubeOverlayDownloadJobInput = CreateDownloadJobInput & {
  /** 완료된 파일을 저장할 때 사용할 제목 기반 파일명. */
  localFilename: string;
};

/** YouTube 제목에서 로컬 저장에 사용할 안전한 파일명 segment를 만든다. */
export function sanitizeYoutubeOverlayFilename(title: string, videoId: string): string {
  /** 경로·제어 문자를 공백으로 바꾼 영상 제목. */
  const normalizedTitle = sanitizeFilenameSegment(title);

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

/** YouTube 썸네일 다운로드 요청을 공용 job manager 입력으로 변환한다. */
export function createYoutubeOverlayDownloadJobInput(
  input: YoutubeOverlayDownloadInput,
): YoutubeOverlayDownloadJobInput {
  if (!isYoutubeVideoId(input.videoId)) {
    throw new Error('A valid YouTube video ID is required.');
  }

  if (!isQualityOption(input.mode, input.quality)) {
    throw new Error('Unsupported YouTube overlay quality.');
  }

  /** 완료된 파일을 로컬에 저장할 때 사용할 안전한 제목과 확장자. */
  const localFilename = `${sanitizeYoutubeOverlayFilename(input.title, input.videoId)}.${input.mode === 'audio' ? 'mp3' : 'mp4'}`;
  /** job 생성 API에 전달할 canonical watch URL. */
  const sourceUrl = `https://www.youtube.com/watch?v=${input.videoId}`;

  return {
    apiBaseUrl: DEFAULT_API_BASE_URL,
    localFilename,
    quality: String(input.quality) as DownloadQuality,
    sourceUrl,
    type: input.mode,
  };
}
