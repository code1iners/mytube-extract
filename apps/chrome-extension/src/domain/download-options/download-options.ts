import { DEFAULT_API_BASE_URL } from '../../shared/constants';
import { DEFAULT_QUALITY_OPTION, parseQualityOption } from './quality-options';

/** 지원하는 다운로드 모드. */
export type DownloadMode = 'audio' | 'video';

/** 형식의 접근 가능한 이름. 형식 아이콘만 보이는 자리와 제목을 모르는 요청의 대체 제목에 쓴다. */
export const DOWNLOAD_MODE_LABELS: Record<DownloadMode, string> = {
  audio: '오디오 MP3',
  video: '비디오 MP4',
};

/** 저장 파일 확장자. 다운로드 모드와 1:1로 대응한다. */
export type FileExtension = 'mp3' | 'mp4';

/** 다운로드 모드에 맞는 저장 파일 확장자를 고른다. */
export function getFileExtension(mode: DownloadMode): FileExtension {
  return mode === 'audio' ? 'mp3' : 'mp4';
}

/** Popup form에서 관리하는 다운로드 옵션. */
export type DownloadOptions = {
  /** 고정 MyTube Extract API base URL. */
  apiBaseUrl: string;
  /** 오디오 bitrate option. */
  bitrate: string;
  /** 사용자가 고친 저장 파일명. 영상별 session-only 값이며 비어 있으면 기본 이름을 쓴다. */
  filename: string;
  /** 다운로드 모드. */
  mode: DownloadMode;
  /** 비디오 resolution option. */
  resolution: string;
  /** 추출할 원본 URL. */
  sourceUrl: string;
};

/** 저장소에서 읽은 다운로드 옵션. */
export type StoredDownloadOptions = Partial<
  Pick<DownloadOptions, 'bitrate' | 'mode' | 'resolution'>
>;

/** 기본 popup 다운로드 옵션. */
export const DEFAULT_DOWNLOAD_OPTIONS: DownloadOptions = {
  apiBaseUrl: DEFAULT_API_BASE_URL,
  bitrate: String(DEFAULT_QUALITY_OPTION.audio),
  filename: '',
  mode: 'audio',
  resolution: String(DEFAULT_QUALITY_OPTION.video),
  sourceUrl: '',
};

/** 선택 가능한 다운로드 모드 목록. */
const DOWNLOAD_MODES = new Set<DownloadMode>(['audio', 'video']);

/** 저장된 옵션과 기본 옵션을 호환성 있게 병합한다. */
export function mergeStoredDownloadOptions(
  storedOptions: StoredDownloadOptions & Record<string, unknown>,
): DownloadOptions {
  /** 저장된 다운로드 모드. */
  const storedMode = storedOptions.mode;

  return {
    ...DEFAULT_DOWNLOAD_OPTIONS,
    bitrate: resolveStoredQualityOption('audio', storedOptions.bitrate),
    resolution: resolveStoredQualityOption('video', storedOptions.resolution),
    mode: isDownloadMode(storedMode) ? storedMode : DEFAULT_DOWNLOAD_OPTIONS.mode,
  };
}

/** 저장된 비트레이트·해상도 값이 고정 선택지를 벗어나면 해당 모드 기본값으로 대체한다. */
function resolveStoredQualityOption(
  mode: DownloadMode,
  storedValue: string | undefined,
): string {
  /** 저장된 값을 고정 품질로 읽은 값. */
  const quality = typeof storedValue === 'string' ? parseQualityOption(mode, storedValue) : null;

  return String(quality ?? DEFAULT_QUALITY_OPTION[mode]);
}

/** API base URL을 fetch/download에 사용할 수 있는 형태로 정규화한다. */
export function normalizeApiBaseUrl(apiBaseUrl: string | undefined): string {
  /** 런타임에 전달된 API base URL. */
  const trimmedBaseUrl = apiBaseUrl?.trim() ?? '';

  if (!trimmedBaseUrl) {
    throw new Error('API 주소가 필요해요.');
  }

  /** URL 객체로 검증한 API base URL. */
  const url = new URL(trimmedBaseUrl);

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('API 주소는 http 또는 https여야 해요.');
  }

  return url.toString().replace(/\/$/, '');
}

/** YouTube watch URL video ID 형식. */
const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/** 허용하는 YouTube host 목록. */
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com']);

/** YouTube short URL host 목록. */
const YOUTUBE_SHORT_HOSTS = new Set(['youtu.be', 'www.youtu.be']);

/** 원본 YouTube URL을 API에 전달 가능한 형태로 정규화한다. */
export function normalizeSourceUrl(sourceUrl: string | undefined): string {
  /** 사용자가 입력한 source URL. */
  const trimmedSourceUrl = sourceUrl?.trim() ?? '';

  if (!trimmedSourceUrl) {
    throw new Error('올바른 원본 주소가 필요해요.');
  }

  /** URL 객체로 검증한 source URL. */
  let url: URL;

  try {
    url = new URL(trimmedSourceUrl);
  } catch {
    throw new Error('올바른 원본 주소가 필요해요.');
  }

  /** 원본 URL에서 추출한 YouTube video ID. */
  const videoId = getYoutubeVideoId(url);

  if (!videoId) {
    throw new Error('지원하는 YouTube 영상 주소가 필요해요.');
  }

  if (isYoutubeWatchUrl(url)) {
    return url.toString();
  }

  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** 지원 YouTube 주소 문자열에서 영상 ID를 읽는다. 주소가 아니거나 지원 형식이 아니면 null을 돌려준다. */
export function parseYoutubeVideoId(sourceUrl: string): string | null {
  try {
    return getYoutubeVideoId(new URL(sourceUrl.trim())) || null;
  } catch {
    return null;
  }
}

/** 영상 ID로 YouTube 썸네일 이미지 주소를 만든다. 4:3 이미지라 16:9 칸에서는 위아래를 잘라 보여준다. */
export function getYoutubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/** YouTube watch URL인지 확인한다. */
function isYoutubeWatchUrl(url: URL): boolean {
  /** YouTube video ID query 값. */
  const videoId = url.searchParams.get('v') ?? '';

  return (
    ['http:', 'https:'].includes(url.protocol) &&
    YOUTUBE_HOSTS.has(url.hostname) &&
    url.pathname === '/watch' &&
    YOUTUBE_VIDEO_ID_PATTERN.test(videoId)
  );
}

/** 지원 URL에서 YouTube video ID를 추출한다. */
function getYoutubeVideoId(url: URL): string {
  if (!['http:', 'https:'].includes(url.protocol)) {
    return '';
  }

  if (YOUTUBE_HOSTS.has(url.hostname) && url.pathname === '/watch') {
    /** YouTube watch URL video ID. */
    const videoId = url.searchParams.get('v') ?? '';

    return YOUTUBE_VIDEO_ID_PATTERN.test(videoId) ? videoId : '';
  }

  if (YOUTUBE_SHORT_HOSTS.has(url.hostname)) {
    /** youtu.be path video ID. */
    const videoId = url.pathname.split('/').filter(Boolean)[0] ?? '';

    return YOUTUBE_VIDEO_ID_PATTERN.test(videoId) ? videoId : '';
  }

  if (YOUTUBE_HOSTS.has(url.hostname) && url.pathname.startsWith('/shorts/')) {
    /** YouTube Shorts path video ID. */
    const videoId = url.pathname.split('/').filter(Boolean)[1] ?? '';

    return YOUTUBE_VIDEO_ID_PATTERN.test(videoId) ? videoId : '';
  }

  return '';
}

/** YouTube video ID 형식인지 확인한다. */
export function isYoutubeVideoId(videoId: unknown): videoId is string {
  return typeof videoId === 'string' && YOUTUBE_VIDEO_ID_PATTERN.test(videoId);
}

/** 다운로드 모드 값인지 확인한다. */
export function isDownloadMode(mode: unknown): mode is DownloadMode {
  return mode === 'audio' || mode === 'video';
}

/** 지원하지 않는 다운로드 모드면 오류를 던진다. */
export function assertDownloadMode(mode: unknown): asserts mode is DownloadMode {
  if (!DOWNLOAD_MODES.has(mode as DownloadMode)) {
    throw new Error('지원하지 않는 형식이에요.');
  }
}
