import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
/** 각 테스트가 새 탭처럼 독립된 메모리 선호를 사용한다. */
let preferences: typeof import('../../src/app/utils/request-preference.util');

beforeEach(async () => {
  vi.resetModules();
  preferences = await import('../../src/app/utils/request-preference.util');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('request preferences', () => {
  it('restores the last supported download format, quality, and Whisper model', () => {
    /** 저장된 요청 선호를 보관할 browser storage. */
    const storage = createStorage();

    vi.stubGlobal('window', { localStorage: storage });

    preferences.setDownloadPreferences({ mode: 'video', quality: '720' });
    preferences.setSubtitleWhisperModelPreference('small_en');

    expect(preferences.getRequestPreferences()).toEqual({
      download: { mode: 'video', quality: '720' },
      whisperModel: 'small_en',
    });
    expect(storage.getItem('mytube-extract-request-preferences')).not.toContain(
      'sourceUrl',
    );
    expect(storage.getItem('mytube-extract-request-preferences')).not.toContain(
      'fileName',
    );
  });

  it('falls back to product defaults for malformed or unsupported stored values', () => {
    /** 잘못된 값을 반환하는 browser storage. */
    const storage = createStorage('{"download":{"mode":"video","quality":"320"},"whisperModel":"large_en"}');

    vi.stubGlobal('window', { localStorage: storage });

    expect(preferences.getRequestPreferences()).toEqual({
      download: { mode: 'video', quality: '1080' },
      whisperModel: 'base_en',
    });
  });

  it('keeps newer selections when only writes fail and persists them when storage recovers', () => {
    /** 쓰기 실패 전에 저장돼 있던 선택. */
    const storage = createStorage('{"download":{"mode":"audio","quality":"128"},"whisperModel":"base_en"}');
    /** 저장 공간 부족을 재현하는 쓰기 경계. */
    const write = vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded.', 'QuotaExceededError');
    });
    vi.stubGlobal('window', { localStorage: storage });
    preferences.setDownloadPreferences({ mode: 'video', quality: '360' });
    expect(preferences.getRequestPreferences().download).toEqual({ mode: 'video', quality: '360' });
    write.mockRestore();
    preferences.setSubtitleWhisperModelPreference('small_en');
    expect(JSON.parse(storage.getItem('mytube-extract-request-preferences') ?? '{}')).toEqual({
      download: { mode: 'video', quality: '360' }, whisperModel: 'small_en',
    });
  });

  it('keeps request forms usable when browser storage is unavailable', () => {
    /** 접근 시 policy 오류를 내는 storage. */
    const unavailableStorage = {
      getItem() {
        throw new DOMException('Storage is disabled.', 'SecurityError');
      },
      setItem() {
        throw new DOMException('Storage is disabled.', 'SecurityError');
      },
    };

    vi.stubGlobal('window', { localStorage: unavailableStorage });

    expect(preferences.getRequestPreferences()).toEqual({
      download: { mode: 'audio', quality: '320' },
      whisperModel: 'base_en',
    });
    expect(() =>
      preferences.setDownloadPreferences({ mode: 'video', quality: '720' }),
    ).not.toThrow();
    expect(() => preferences.setSubtitleWhisperModelPreference('small_en')).not.toThrow();
    expect(preferences.getRequestPreferences()).toEqual({
      download: { mode: 'video', quality: '720' },
      whisperModel: 'small_en',
    });
  });
});

/** 테스트 전용 memory storage를 만든다. */
function createStorage(initialValue: string | null = null) {
  /** 현재 저장값. */
  let value = initialValue;

  return {
    getItem(_key: string) {
      return value;
    },
    setItem(_key: string, nextValue: string) {
      value = nextValue;
    },
  };
}
