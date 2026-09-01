/** 앱 route 절대 경로. */
export const ROUTE_PATHS = {
  history: '/history',
  root: '/',
  settings: '/settings',
  subtitles: '/subtitles',
  video: '/video',
} as const;

/** React Router route segment. */
export const ROUTE_SEGMENTS = {
  history: 'history',
  settings: 'settings',
  subtitles: 'subtitles',
  video: 'video',
} as const;
