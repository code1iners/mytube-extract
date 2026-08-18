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
});

/** 테스트용 Chrome API를 만든다. */
function createChromeApi({
  permissionGranted,
  permissionRequestGranted = permissionGranted,
}: {
  /** 현재 권한 상태. */
  permissionGranted: boolean;
  /** 권한 요청 결과. */
  permissionRequestGranted?: boolean;
}) {
  /** Chrome runtime lastError 값. */
  const runtime = {
    lastError: null,
    sendMessage: vi.fn(
      (
        _message: unknown,
        callback: (response: { ok: boolean }) => void,
      ) => callback({ ok: true }),
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
