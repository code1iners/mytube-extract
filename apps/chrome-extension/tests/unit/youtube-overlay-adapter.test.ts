import { describe, expect, it, vi } from 'vitest';
import {
  YOUTUBE_HOST_PERMISSION,
  createYoutubeOverlayAdapter,
} from '../../src/adapters/chrome/youtube-overlay';

describe('YouTube overlay adapter', () => {
  it('reads whether the optional YouTube host permission is granted', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({
      permissionGranted: true,
    });
    /** YouTube overlay adapter. */
    const adapter = createYoutubeOverlayAdapter(chromeApi);

    await expect(adapter.isEnabled()).resolves.toBe(true);
    expect(chromeApi.permissions.contains).toHaveBeenCalledWith({
      origins: [YOUTUBE_HOST_PERMISSION],
    }, expect.any(Function));
  });

  it('requests permission from the popup gesture and activates the current tab', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({
      permissionGranted: false,
      permissionRequestGranted: true,
    });
    /** YouTube overlay adapter. */
    const adapter = createYoutubeOverlayAdapter(chromeApi);

    await expect(adapter.requestAndEnable()).resolves.toBe(true);
    expect(chromeApi.permissions.request).toHaveBeenCalledWith({
      origins: [YOUTUBE_HOST_PERMISSION],
    }, expect.any(Function));
    expect(chromeApi.runtime.sendMessage).toHaveBeenCalledWith(
      { type: 'youtube-overlay-enable' },
      expect.any(Function),
    );
  });

  it('does not activate the overlay when the user denies permission', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({
      permissionGranted: false,
      permissionRequestGranted: false,
    });
    /** YouTube overlay adapter. */
    const adapter = createYoutubeOverlayAdapter(chromeApi);

    await expect(adapter.requestAndEnable()).resolves.toBe(false);
    expect(chromeApi.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it('rejects isEnabled when chrome.runtime.lastError is set', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({
      lastError: { message: 'blocked' },
      permissionGranted: true,
    });
    /** YouTube overlay adapter. */
    const adapter = createYoutubeOverlayAdapter(chromeApi);

    await expect(adapter.isEnabled()).rejects.toThrow(
      'Could not read YouTube permission state.',
    );
  });

  it('rejects requestAndEnable when chrome.runtime.lastError is set on the permission request', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({
      lastError: { message: 'blocked' },
      permissionGranted: false,
      permissionRequestGranted: true,
    });
    /** YouTube overlay adapter. */
    const adapter = createYoutubeOverlayAdapter(chromeApi);

    await expect(adapter.requestAndEnable()).rejects.toThrow(
      'Could not request YouTube permission.',
    );
  });

  it('rejects requestAndEnable when the content script does not confirm activation', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({
      permissionGranted: false,
      permissionRequestGranted: true,
      sendMessageResponse: { message: 'overlay script unavailable', ok: false },
    });
    /** YouTube overlay adapter. */
    const adapter = createYoutubeOverlayAdapter(chromeApi);

    await expect(adapter.requestAndEnable()).rejects.toThrow(
      'overlay script unavailable',
    );
  });
});

/** 테스트용 Chrome API를 만든다. */
function createChromeApi({
  lastError = null,
  permissionGranted,
  permissionRequestGranted = permissionGranted,
  sendMessageResponse = { ok: true },
}: {
  /** chrome.runtime.lastError 값. */
  lastError?: { message: string } | null;
  /** 현재 권한 상태. */
  permissionGranted: boolean;
  /** 권한 요청 결과. */
  permissionRequestGranted?: boolean;
  /** content script activation 응답. */
  sendMessageResponse?: { message?: string; ok: boolean };
}) {
  /** Chrome runtime lastError 값. */
  const runtime = {
    lastError,
    sendMessage: vi.fn(
      (
        _message: unknown,
        callback: (response: { message?: string; ok: boolean }) => void,
      ) => callback(sendMessageResponse),
    ),
  };

  return {
    runtime,
    permissions: {
      contains: vi.fn(
        (
          _permissions: chrome.permissions.Permissions,
          callback: (result: boolean) => void,
        ) => callback(permissionGranted),
      ),
      request: vi.fn(
        (
          _permissions: chrome.permissions.Permissions,
          callback: (granted: boolean) => void,
        ) => callback(permissionRequestGranted),
      ),
    },
  } as unknown as typeof chrome;
}
