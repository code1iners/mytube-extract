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

/** 뒤에 채널 ID나 이름이 한 조각 더 오는 채널 경로의 첫 조각. */
const CHANNEL_PREFIX_SEGMENTS = ['channel', 'c', 'user'];

/** Overlay를 붙일 채널 탭. 빈 값은 탭 없이 연 채널 홈이다. */
const SUPPORTED_CHANNEL_TABS = ['', 'featured', 'videos', 'search'];

/** YouTube SPA navigation에서 Overlay를 유지할 지원 경로인지 확인한다. */
export function isSupportedYoutubePagePath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname === '/results' ||
    pathname === '/watch' ||
    pathname === '/feed/subscriptions' ||
    isSupportedChannelPagePath(pathname)
  );
}

/** 채널 홈·동영상 탭·채널 안 검색 경로인지 확인한다. Shorts·라이브·재생목록 탭은 제외한다. */
function isSupportedChannelPagePath(pathname: string): boolean {
  /** 빈 조각을 뺀 경로 조각. 끝의 `/`는 무시한다. */
  const segments = pathname.split('/').filter(Boolean);
  /** 첫 조각. `@handle` 형식이면 그 자체가 채널이다. */
  const first = segments[0] ?? '';
  /** 채널을 가리키는 조각 뒤에 남은 탭 조각. 채널 경로가 아니면 null. */
  let tabSegments: string[] | null = null;

  // `/@handle` 형식.
  if (first.length > 1 && first.startsWith('@')) {
    tabSegments = segments.slice(1);
  }

  // `/channel/<id>`, `/c/<name>`, `/user/<name>` 형식.
  if (CHANNEL_PREFIX_SEGMENTS.includes(first) && segments.length >= 2) {
    tabSegments = segments.slice(2);
  }

  return (
    tabSegments !== null &&
    tabSegments.length <= 1 &&
    SUPPORTED_CHANNEL_TABS.includes(tabSegments[0] ?? '')
  );
}
