import { type DownloadMode } from '../../domain/download-options/download-options';

/** YouTube 썸네일 오디오 품질 선택지. */
export const YOUTUBE_OVERLAY_AUDIO_QUALITY_OPTIONS = [128, 192, 320] as const;

/** YouTube 썸네일 비디오 해상도 선택지. */
export const YOUTUBE_OVERLAY_VIDEO_QUALITY_OPTIONS = [360, 720, 1080] as const;

/** YouTube 썸네일에서 선택할 수 있는 숫자 품질. */
export type YoutubeOverlayQuality =
  | (typeof YOUTUBE_OVERLAY_AUDIO_QUALITY_OPTIONS)[number]
  | (typeof YOUTUBE_OVERLAY_VIDEO_QUALITY_OPTIONS)[number];

/** 다운로드 모드별 YouTube 썸네일 품질 선택지를 반환한다. */
export function getYoutubeOverlayQualityOptions(
  mode: DownloadMode,
): readonly YoutubeOverlayQuality[] {
  return mode === 'audio'
    ? YOUTUBE_OVERLAY_AUDIO_QUALITY_OPTIONS
    : YOUTUBE_OVERLAY_VIDEO_QUALITY_OPTIONS;
}

/** 품질 값이 해당 다운로드 모드에서 허용되는지 확인한다. */
export function isYoutubeOverlayQuality(
  mode: DownloadMode,
  value: unknown,
): value is YoutubeOverlayQuality {
  return getYoutubeOverlayQualityOptions(mode).includes(
    value as YoutubeOverlayQuality,
  );
}
