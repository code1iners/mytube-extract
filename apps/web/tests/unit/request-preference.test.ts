import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getRequestPreferences,
  setDownloadPreferences,
  setSubtitleWhisperModelPreference,
} from '../../src/app/utils/request-preference.util';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('request preferences', () => {
  it('restores the last supported download format, quality, and Whisper model', () => {
    /** 저장된 요청 선호를 보관할 browser storage. */
    const storage = createStorage();

    vi.stubGlobal('window', { localStorage: storage });

    setDownloadPreferences({ mode: 'video', quality: '720' });
    setSubtitleWhisperModelPreference('small_en');

    expect(getRequestPreferences()).toEqual({
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

    expect(getRequestPreferences()).toEqual({
      download: { mode: 'video', quality: '1080' },
      whisperModel: 'base_en',
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

    expect(getRequestPreferences()).toEqual({
      download: { mode: 'audio', quality: '320' },
      whisperModel: 'base_en',
    });
    expect(() =>
      setDownloadPreferences({ mode: 'video', quality: '720' }),
    ).not.toThrow();
    expect(() => setSubtitleWhisperModelPreference('small_en')).not.toThrow();
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
