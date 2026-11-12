import { type YoutubeOverlayAdapter } from '../../adapters/chrome/youtube-overlay';
import { isSupportedYoutubePageUrl } from './youtube-page';

/** Background가 YouTube 탭에 Overlay를 주입할지 판단하고 주입하는 창구. */
export type YoutubeOverlayInjector = {
  /** Popup의 켜기 요청 직후 현재 활성 YouTube 탭에 주입한다. 권한이 없으면 실패한다. */
  activateActiveYoutubeTabs(): Promise<void>;
  /** service worker 시작 때 권한이 있으면 현재 활성 YouTube 탭에 주입한다. */
  injectActiveYoutubeTabs(): Promise<void>;
  /** 탭 이동·새로고침 때 권한이 있으면 그 탭에 주입한다. 권한을 해제했다면 주입하지 않는다. */
  injectTabIfEnabled(tabId: number, pageUrl: string | undefined): Promise<void>;
};

/** Overlay 주입기 dependency. */
export type YoutubeOverlayInjectorDependencies = {
  /** 선택 Host Permission 상태. 주입할 때마다 다시 읽어 해제를 바로 반영한다. */
  permission: Pick<YoutubeOverlayAdapter, 'isEnabled'>;
  /** 현재 활성 탭 목록을 읽는다. */
  queryActiveTabs(): Promise<chrome.tabs.Tab[]>;
  /** 지정한 탭에 Overlay script를 주입한다. */
  injectScript(tabId: number): Promise<void>;
};

/** Overlay 주입기를 만든다. */
export function createYoutubeOverlayInjector(
  dependencies: YoutubeOverlayInjectorDependencies,
): YoutubeOverlayInjector {
  /** 활성 탭 중 지원 YouTube 페이지에 주입한다. */
  async function injectIntoActiveYoutubeTabs(): Promise<void> {
    /** 현재 활성 탭 목록. */
    const tabs = await dependencies.queryActiveTabs();

    await Promise.all(
      tabs
        .filter(
          (tab): tab is chrome.tabs.Tab & { id: number } =>
            typeof tab.id === 'number' && isSupportedYoutubePageUrl(tab.url),
        )
        .map((tab) => dependencies.injectScript(tab.id)),
    );
  }

  return {
    async activateActiveYoutubeTabs() {
      if (!(await dependencies.permission.isEnabled())) {
        throw new Error('YouTube 권한이 허용되지 않았어요.');
      }

      await injectIntoActiveYoutubeTabs();
    },
    async injectActiveYoutubeTabs() {
      if (await dependencies.permission.isEnabled()) {
        await injectIntoActiveYoutubeTabs();
      }
    },
    async injectTabIfEnabled(tabId, pageUrl) {
      if (!isSupportedYoutubePageUrl(pageUrl)) {
        return;
      }

      if (await dependencies.permission.isEnabled()) {
        await dependencies.injectScript(tabId);
      }
    },
  };
}
