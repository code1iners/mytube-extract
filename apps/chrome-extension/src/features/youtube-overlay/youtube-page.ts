/** YouTube 일반 영상 Overlay를 허용할 host. */
const YOUTUBE_HOST = 'www.youtube.com';

/** YouTube 썸네일 Overlay를 주입할 페이지인지 확인한다. */
export function isSupportedYoutubePageUrl(pageUrl: string | undefined): boolean {
  if (!pageUrl) {
    return false;
  }

  try {
    /** 확인할 YouTube 페이지 URL. */
    const url = new URL(pageUrl);

    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.hostname !== YOUTUBE_HOST
    ) {
      return false;
    }

    return isSupportedYoutubePagePath(url.pathname);
  } catch {
    return false;
  }
}

/** YouTube SPA navigation에서 Overlay를 유지할 지원 경로인지 확인한다. */
export function isSupportedYoutubePagePath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname === '/results' ||
    pathname === '/watch' ||
    pathname === '/feed/subscriptions'
  );
}
