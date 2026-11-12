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
      'YouTube 권한 상태를 확인하지 못했어요.',
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
      'YouTube 권한을 요청하지 못했어요.',
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

  it('removes the optional YouTube host permission when the user turns the thumbnail button off', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({
      permissionGranted: true,
    });
    /** YouTube overlay adapter. */
    const adapter = createYoutubeOverlayAdapter(chromeApi);

    await expect(adapter.disable()).resolves.toBe(true);
    expect(chromeApi.permissions.remove).toHaveBeenCalledWith({
      origins: [YOUTUBE_HOST_PERMISSION],
    }, expect.any(Function));
    await expect(adapter.isEnabled()).resolves.toBe(false);
  });

  it('reports that the permission stayed when Chrome does not remove it', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({
      permissionGranted: true,
      permissionRemoved: false,
    });
    /** YouTube overlay adapter. */
    const adapter = createYoutubeOverlayAdapter(chromeApi);

    await expect(adapter.disable()).resolves.toBe(false);
    await expect(adapter.isEnabled()).resolves.toBe(true);
  });

  it('rejects disable when chrome.runtime.lastError is set on the permission removal', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({
      lastError: { message: 'blocked' },
      permissionGranted: true,
    });
    /** YouTube overlay adapter. */
    const adapter = createYoutubeOverlayAdapter(chromeApi);

    await expect(adapter.disable()).rejects.toThrow(
      '썸네일 버튼을 끄지 못했어요.',
    );
  });
});

/** 테스트용 Chrome API를 만든다. */
function createChromeApi({
  lastError = null,
  permissionGranted,
  permissionRequestGranted = permissionGranted,
  permissionRemoved = true,
  sendMessageResponse = { ok: true },
}: {
  /** chrome.runtime.lastError 값. */
  lastError?: { message: string } | null;
  /** 현재 권한 상태. */
  permissionGranted: boolean;
  /** 권한 요청 결과. */
  permissionRequestGranted?: boolean;
  /** 권한 해제 결과. */
  permissionRemoved?: boolean;
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

  /** 해제 뒤 contains가 바뀐 권한 상태를 돌려주도록 현재 권한을 들고 있는다. */
  let granted = permissionGranted;

  return {
    runtime,
    permissions: {
      contains: vi.fn(
        (
          _permissions: chrome.permissions.Permissions,
          callback: (result: boolean) => void,
        ) => callback(granted),
      ),
      remove: vi.fn(
        (
          _permissions: chrome.permissions.Permissions,
          callback: (removed: boolean) => void,
        ) => {
          if (permissionRemoved) {
            granted = false;
          }

          callback(permissionRemoved);
        },
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
