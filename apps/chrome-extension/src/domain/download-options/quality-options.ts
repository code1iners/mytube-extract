import { type DownloadMode } from './download-options';

/** 오디오 모드에서 선택 가능한 고정 비트레이트(kbps) 목록. */
export const AUDIO_QUALITY_OPTIONS = [128, 192, 320] as const;

/** 비디오 모드에서 선택 가능한 고정 해상도(p) 목록. */
export const VIDEO_QUALITY_OPTIONS = [360, 720, 1080] as const;

/** 다운로드 모드별로 선택 가능한 고정 품질 값. */
export type QualityOption =
  | (typeof AUDIO_QUALITY_OPTIONS)[number]
  | (typeof VIDEO_QUALITY_OPTIONS)[number];

/** job에 저장하고 API에 보내는 품질 문자열. 고정 품질 값을 그대로 문자열로 쓴다. */
export type DownloadQuality = `${QualityOption}`;

/** 다운로드 형식과 그 형식의 고정 품질 한 쌍. */
export type QualitySelection = {
  /** 다운로드 형식. */
  mode: DownloadMode;
  /** 형식에 맞는 고정 품질 값. */
  quality: QualityOption;
};

/** 다운로드 모드별 기본 품질 값. */
export const DEFAULT_QUALITY_OPTION: Record<DownloadMode, QualityOption> = {
  audio: 192,
  video: 720,
};

/** 다운로드 모드별 고정 품질 선택지를 반환한다. */
export function getQualityOptions(mode: DownloadMode): readonly QualityOption[] {
  return mode === 'audio' ? AUDIO_QUALITY_OPTIONS : VIDEO_QUALITY_OPTIONS;
}

/** 값이 해당 다운로드 모드에서 허용되는 고정 품질인지 확인한다. */
export function isQualityOption(mode: DownloadMode, value: unknown): value is QualityOption {
  return getQualityOptions(mode).includes(value as QualityOption);
}

/** 품질 숫자 뒤에 붙여 읽을 단위. 오디오는 비트레이트, 비디오는 해상도다. */
export function getQualityUnit(mode: DownloadMode): ' kbps' | 'p' {
  return mode === 'audio' ? ' kbps' : 'p';
}

/** 저장 옵션·job의 품질 문자열을 그 형식의 고정 품질 값으로 읽는다. 지원하지 않는 값이면 null이다. */
export function parseQualityOption(mode: DownloadMode, value: string): QualityOption | null {
  /** 문자열을 숫자로 바꾼 값. */
  const numericValue = Number(value);

  return isQualityOption(mode, numericValue) ? numericValue : null;
}

/** 고정 품질 값을 job·API 품질 문자열로 바꾼다. */
export function toDownloadQuality(quality: QualityOption): DownloadQuality {
  return `${quality}`;
}
