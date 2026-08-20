import { type DownloadMode } from './download-options';

/** 오디오 모드에서 선택 가능한 고정 비트레이트(kbps) 목록. */
export const AUDIO_QUALITY_OPTIONS = [128, 192, 320] as const;

/** 비디오 모드에서 선택 가능한 고정 해상도(p) 목록. */
export const VIDEO_QUALITY_OPTIONS = [360, 720, 1080] as const;

/** 다운로드 모드별로 선택 가능한 고정 품질 값. */
export type QualityOption =
  | (typeof AUDIO_QUALITY_OPTIONS)[number]
  | (typeof VIDEO_QUALITY_OPTIONS)[number];

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
