import { isYoutubeVideoId } from '../../domain/download-options/download-options';

/** YouTube 일반 영상 카드 URL 정보. */
export type StandardYoutubeWatchUrl = {
  /** API에 전달할 canonical watch URL. */
  sourceUrl: string;
  /** YouTube 영상 ID. */
  videoId: string;
};

/** 일반 영상 카드의 watch URL만 파싱한다. */
export function parseStandardYoutubeWatchUrl(
  href: string | undefined,
): StandardYoutubeWatchUrl | null {
  if (!href) {
    return null;
  }

  try {
    /** 카드 썸네일 링크 URL. */
    const url = new URL(href, 'https://www.youtube.com/');
    /** watch URL의 video ID. */
    const videoId = url.searchParams.get('v') ?? '';

    if (
      !['http:', 'https:'].includes(url.protocol) ||
      !['youtube.com', 'www.youtube.com'].includes(url.hostname) ||
      url.pathname !== '/watch' ||
      !isYoutubeVideoId(videoId)
    ) {
      return null;
    }

    return {
      sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
      videoId,
    };
  } catch {
    return null;
  }
}
