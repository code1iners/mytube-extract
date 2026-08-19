import { describe, expect, it, vi } from 'vitest';
import { createStorageAdapter } from '../../src/adapters/chrome/storage';
import { STORAGE_KEYS } from '../../src/shared/constants';

describe('Chrome storage adapter', () => {
  it('loads stored options merged with defaults', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({
      lastError: null,
      storedItems: { bitrate: '192', mode: 'audio' },
    });
    /** storage adapter. */
    const adapter = createStorageAdapter(chromeApi);

    await expect(adapter.loadOptions()).resolves.toMatchObject({
      bitrate: '192',
      mode: 'audio',
    });
    expect(chromeApi.storage.local.get).toHaveBeenCalledWith(
      [...STORAGE_KEYS],
      expect.any(Function),
    );
  });

  it('rejects loadOptions when chrome.runtime.lastError is set', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({
      lastError: { message: 'blocked' },
      storedItems: {},
    });
    /** storage adapter. */
    const adapter = createStorageAdapter(chromeApi);

    await expect(adapter.loadOptions()).rejects.toThrow(
      'Could not load extension settings.',
    );
  });

  it('saves only the non-sensitive download options', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({ lastError: null, storedItems: {} });
    /** storage adapter. */
    const adapter = createStorageAdapter(chromeApi);

    await adapter.saveOptions({
      apiBaseUrl: 'https://api.example.invalid',
      bitrate: '192',
      filename: 'clip',
      mode: 'audio',
      resolution: '',
      sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
    });

    expect(chromeApi.storage.local.set).toHaveBeenCalledWith(
      { bitrate: '192', filename: 'clip', mode: 'audio', resolution: '' },
      expect.any(Function),
    );
  });

  it('rejects saveOptions when chrome.runtime.lastError is set', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({
      lastError: { message: 'blocked' },
      storedItems: {},
    });
    /** storage adapter. */
    const adapter = createStorageAdapter(chromeApi);

    await expect(
      adapter.saveOptions({
        apiBaseUrl: 'https://api.example.invalid',
        bitrate: '192',
        filename: 'clip',
        mode: 'audio',
        resolution: '',
        sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
      }),
    ).rejects.toThrow('Could not save extension settings.');
  });
});

/** 테스트용 Chrome API를 만든다. */
function createChromeApi({
  lastError,
  storedItems,
}: {
  /** chrome.runtime.lastError 값. */
  lastError: { message: string } | null;
  /** chrome.storage.local.get가 반환할 저장 값. */
  storedItems: Record<string, unknown>;
}) {
  return {
    runtime: { lastError },
    storage: {
      local: {
        get: vi.fn(
          (
            _keys: readonly string[],
            callback: (items: Record<string, unknown>) => void,
          ) => callback(storedItems),
        ),
        set: vi.fn((_items: Record<string, unknown>, callback: () => void) =>
          callback(),
        ),
      },
    },
  } as unknown as typeof chrome;
}
