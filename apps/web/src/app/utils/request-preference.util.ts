import {
  type DownloadMode,
  type DownloadQuality,
  getDefaultDownloadQuality,
} from '../../domain/download-request/download-request';
import { type SubtitleWhisperModel } from '../../domain/subtitle-request/subtitle-request';

/** 요청 화면 선택값을 보관하는 browser storage key. */
const REQUEST_PREFERENCES_KEY = 'mytube-extract-request-preferences';

/** 저장 가능한 다운로드 요청 선택값. */
export type DownloadPreferences = {
  /** 추출 형식. */
  mode: DownloadMode;
  /** 형식에 맞는 품질. */
  quality: DownloadQuality;
};

/** 저장 가능한 요청 화면 선택값. */
export type RequestPreferences = {
  /** 다운로드 요청 선택값. */
  download: DownloadPreferences;
  /** Whisper 모델 선택값. */
  whisperModel: SubtitleWhisperModel;
};

/** 저장값이 없거나 손상됐을 때의 제품 기본 선호. */
const DEFAULT_REQUEST_PREFERENCES: RequestPreferences = {
  download: {
    mode: 'audio',
    quality: '320',
  },
  whisperModel: 'base_en',
};

/** 같은 browser에서 마지막으로 선택한 요청 선호를 복원한다. */
export function getRequestPreferences(): RequestPreferences {
  /** browser storage에 보관된 원본 JSON. */
  const storedValue = readStoredValue();

  if (!storedValue) {
    return DEFAULT_REQUEST_PREFERENCES;
  }

  try {
    /** JSON으로 해석한 저장값. */
    const parsedValue: unknown = JSON.parse(storedValue);

    return normalizeRequestPreferences(parsedValue);
  } catch {
    // 손상된 storage 값은 요청 화면을 막지 않고 제품 기본값으로 되돌린다.
    return DEFAULT_REQUEST_PREFERENCES;
  }
}

/** 마지막 다운로드 형식과 형식에 맞는 품질을 저장한다. */
export function setDownloadPreferences(preferences: DownloadPreferences) {
  /** 기존 Whisper 모델을 유지한 전체 요청 선호. */
  const currentPreferences = getRequestPreferences();

  writeRequestPreferences({
    ...currentPreferences,
    download: normalizeDownloadPreferences(preferences),
  });
}

/** 마지막 Whisper 모델을 저장한다. */
export function setSubtitleWhisperModelPreference(
  whisperModel: SubtitleWhisperModel,
) {
  /** 기존 다운로드 선택을 유지한 전체 요청 선호. */
  const currentPreferences = getRequestPreferences();

  writeRequestPreferences({
    ...currentPreferences,
    whisperModel: isSubtitleWhisperModel(whisperModel)
      ? whisperModel
      : DEFAULT_REQUEST_PREFERENCES.whisperModel,
  });
}

/** browser storage에서 요청 선호 원본값을 안전하게 읽는다. */
function readStoredValue() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage.getItem(REQUEST_PREFERENCES_KEY);
  } catch {
    // privacy 정책 등으로 storage가 차단돼도 폼은 현재 선택으로 동작한다.
    return null;
  }
}

/** 요청 선호를 browser storage에 안전하게 쓴다. */
function writeRequestPreferences(preferences: RequestPreferences) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(REQUEST_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // 영속화만 생략하고 현재 화면의 선택은 계속 반영한다.
  }
}

/** 저장된 알 수 없는 값을 지원하는 요청 선호로 정규화한다. */
function normalizeRequestPreferences(value: unknown): RequestPreferences {
  if (!isRecord(value)) {
    return DEFAULT_REQUEST_PREFERENCES;
  }

  return {
    download: normalizeDownloadPreferences(value.download),
    whisperModel: isSubtitleWhisperModel(value.whisperModel)
      ? value.whisperModel
      : DEFAULT_REQUEST_PREFERENCES.whisperModel,
  };
}

/** 저장된 알 수 없는 값을 지원하는 다운로드 선택으로 정규화한다. */
function normalizeDownloadPreferences(value: unknown): DownloadPreferences {
  if (!isRecord(value) || !isDownloadMode(value.mode)) {
    return DEFAULT_REQUEST_PREFERENCES.download;
  }

  return {
    mode: value.mode,
    quality: isDownloadQualityForMode(value.quality, value.mode)
      ? value.quality
      : getDefaultDownloadQuality(value.mode),
  };
}

/** object 형태의 값인지 확인한다. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** 지원 다운로드 형식인지 확인한다. */
function isDownloadMode(value: unknown): value is DownloadMode {
  return value === 'audio' || value === 'video';
}

/** 형식별 서버 지원 품질인지 확인한다. */
function isDownloadQualityForMode(
  value: unknown,
  mode: DownloadMode,
): value is DownloadQuality {
  if (mode === 'audio') {
    return value === '128' || value === '192' || value === '320';
  }

  return value === '360' || value === '720' || value === '1080';
}

/** 지원 Whisper 모델인지 확인한다. */
function isSubtitleWhisperModel(value: unknown): value is SubtitleWhisperModel {
  return value === 'base_en' || value === 'small_en';
}
