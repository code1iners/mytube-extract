import { describe, expect, it, vi } from 'vitest';
import { createYoutubeOverlayAdapter } from '../../src/adapters/chrome/youtube-overlay';
import { createYoutubeOverlayInjector } from '../../src/features/youtube-overlay/youtube-overlay-injection';

/** YouTube 일반 영상 탭 주소. */
const YOUTUBE_WATCH_URL = 'https://www.youtube.com/watch?v=abc123_DEF0';

describe('YouTube overlay injection', () => {
  it('injects the overlay on YouTube navigation while the permission is granted', async () => {
    /** 테스트 환경. */
    const { injectScript, injector } = createInjectionEnvironment({ permissionGranted: true });

    await injector.injectTabIfEnabled(7, YOUTUBE_WATCH_URL);

    expect(injectScript).toHaveBeenCalledWith(7);
  });

  it('stops injecting into YouTube tabs after the permission is removed', async () => {
    /** 테스트 환경. */
    const { adapter, injectScript, injector } = createInjectionEnvironment({ permissionGranted: true });

    await adapter.disable();
    await injector.injectTabIfEnabled(7, YOUTUBE_WATCH_URL);
    await injector.injectActiveYoutubeTabs();

    expect(injectScript).not.toHaveBeenCalled();
  });

  it('injects into active YouTube tabs only, skipping other pages', async () => {
    /** 테스트 환경. */
    const { injectScript, injector } = createInjectionEnvironment({
      activeTabs: [
        { id: 1, url: YOUTUBE_WATCH_URL },
        { id: 2, url: 'https://example.com/' },
        { url: YOUTUBE_WATCH_URL },
      ],
      permissionGranted: true,
    });

    await injector.injectActiveYoutubeTabs();

    expect(injectScript).toHaveBeenCalledTimes(1);
    expect(injectScript).toHaveBeenCalledWith(1);
  });

  it('does not inject into pages that are not supported YouTube pages', async () => {
    /** 테스트 환경. */
    const { injectScript, injector } = createInjectionEnvironment({ permissionGranted: true });

    await injector.injectTabIfEnabled(7, 'https://example.com/');

    expect(injectScript).not.toHaveBeenCalled();
  });

  it('refuses popup activation when the permission is not granted', async () => {
    /** 테스트 환경. */
    const { injectScript, injector } = createInjectionEnvironment({ permissionGranted: false });

    await expect(injector.activateActiveYoutubeTabs()).rejects.toThrow('YouTube 권한이 허용되지 않았어요.');
    expect(injectScript).not.toHaveBeenCalled();
  });
});

/** 실제 권한 adapter에 가짜 Chrome 권한 API를 붙여 주입기를 만든다. */
function createInjectionEnvironment({
  activeTabs = [{ id: 1, url: YOUTUBE_WATCH_URL }],
  permissionGranted,
}: {
  /** 현재 활성 탭 목록. */
  activeTabs?: Array<Pick<chrome.tabs.Tab, 'id' | 'url'>>;
  /** 처음 권한 상태. */
  permissionGranted: boolean;
}) {
  /** 해제 뒤 contains가 바뀐 상태를 돌려주도록 현재 권한을 들고 있는다. */
  let granted = permissionGranted;
  /** 테스트용 Chrome API. */
  const chromeApi = {
    permissions: {
      contains: vi.fn((_permissions: unknown, callback: (result: boolean) => void) => callback(granted)),
      remove: vi.fn((_permissions: unknown, callback: (removed: boolean) => void) => {
        granted = false;
        callback(true);
      }),
    },
    runtime: { lastError: null },
  } as unknown as typeof chrome;
  /** 권한 adapter. */
  const adapter = createYoutubeOverlayAdapter(chromeApi);
  /** 스크립트 주입 기록. */
  const injectScript = vi.fn<(tabId: number) => Promise<void>>().mockResolvedValue(undefined);
  /** Overlay 주입기. */
  const injector = createYoutubeOverlayInjector({
    injectScript,
    permission: adapter,
    queryActiveTabs: () => Promise.resolve(activeTabs as chrome.tabs.Tab[]),
  });

  return { adapter, injectScript, injector };
}
