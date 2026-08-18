import { defineBackground } from 'wxt/utils/define-background';
import { createDownloadsAdapter } from '../src/adapters/chrome/downloads';
import { createYoutubeOverlayAdapter } from '../src/adapters/chrome/youtube-overlay';
import { createMyTubeExtractClient } from '../src/services/mytube-extract/mytube-extract-client';
import { buildDownloadUrl } from '../src/services/mytube-extract/download-url';
import {
  createYoutubeOverlayDownloadOptions,
} from '../src/features/youtube-overlay/youtube-overlay-download';
import {
  isYoutubeOverlayDownloadRequest,
  isYoutubeOverlayEnableRequest,
  type YoutubeOverlayDownloadResponse,
  type YoutubeOverlayEnableResponse,
  YOUTUBE_OVERLAY_SCRIPT_FILE,
} from '../src/features/youtube-overlay/youtube-overlay-message';
import { isSupportedYoutubePageUrl } from '../src/features/youtube-overlay/youtube-page';

/** Background에서 사용하는 MyTube Extract API client. */
const myTubeExtractClient = createMyTubeExtractClient();

/** Background에서 사용하는 Chrome downloads adapter. */
const downloads = createDownloadsAdapter();

/** Background에서 사용하는 YouTube permission adapter. */
const youtubeOverlay = createYoutubeOverlayAdapter();

/** YouTube 일반 영상 Overlay Background service worker. */
export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (isYoutubeOverlayEnableRequest(message)) {
      void activateCurrentYoutubeTab()
        .then<YoutubeOverlayEnableResponse>(() => ({ ok: true }))
        .catch((error: unknown) => ({
          message: getErrorMessage(
            error,
            'YouTube 썸네일 버튼을 활성화하지 못했습니다.',
          ),
          ok: false,
        }))
        .then(sendResponse);

      return true;
    }

    if (isYoutubeOverlayDownloadRequest(message)) {
      void handleOverlayDownload(message, sender.tab?.id, sender.tab?.url)
        .then<YoutubeOverlayDownloadResponse>(() => ({
          kind: 'download-started',
          ok: true,
        }))
        .catch((error: unknown) => ({
          message: getErrorMessage(error, '추출 요청에 실패했습니다.'),
          ok: false,
        }))
        .then(sendResponse);

      return true;
    }

    return undefined;
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete' && !changeInfo.url) {
      return;
    }

    /** YouTube SPA navigation 또는 새 페이지 로드 후 Overlay를 주입한다. */
    void injectTabIfEnabled(tabId, changeInfo.url ?? tab.url);
  });

  // 이미 권한을 허용한 사용자가 service worker 재시작 후에도 현재 탭에서 바로 사용할 수 있게 한다.
  void injectExistingYoutubeTabs();
});

/** Popup 활성화 요청 이후 현재 활성 탭에 Overlay를 주입한다. */
async function activateCurrentYoutubeTab(): Promise<void> {
  if (!(await youtubeOverlay.isEnabled())) {
    throw new Error('YouTube permission is not granted.');
  }

  /** 현재 활성 탭 목록. */
  const tabs = await queryActiveTabs();

  await Promise.all(
    tabs
      .filter(
        (tab): tab is chrome.tabs.Tab & { id: number } =>
          typeof tab.id === 'number' && isSupportedYoutubePageUrl(tab.url),
      )
      .map((tab) => injectOverlayIntoTab(tab.id)),
  );
}

/** service worker 시작 시 권한이 이미 있는 YouTube 탭에 Overlay를 주입한다. */
async function injectExistingYoutubeTabs(): Promise<void> {
  try {
    if (!(await youtubeOverlay.isEnabled())) {
      return;
    }

    /** 현재 브라우저의 활성 탭 목록. */
    const tabs = await queryActiveTabs();

    await Promise.all(
      tabs
        .filter(
          (tab): tab is chrome.tabs.Tab & { id: number } =>
            typeof tab.id === 'number' && isSupportedYoutubePageUrl(tab.url),
        )
        .map((tab) => injectOverlayIntoTab(tab.id)),
    );
  } catch {
    // 브라우저 시작 직후 탭 정보가 아직 준비되지 않은 경우 다음 탭 이벤트에서 재시도한다.
  }
}

/** YouTube 페이지 이동 시 권한이 있는 탭에 Overlay를 주입한다. */
async function injectTabIfEnabled(
  tabId: number,
  pageUrl: string | undefined,
): Promise<void> {
  if (!isSupportedYoutubePageUrl(pageUrl)) {
    return;
  }

  try {
    if (await youtubeOverlay.isEnabled()) {
      await injectOverlayIntoTab(tabId);
    }
  } catch {
    // chrome:// 페이지 전환, 탭 종료 등 주입할 수 없는 상태는 다음 navigation에서 재시도한다.
  }
}

/** 지정한 탭에 WXT unlisted Overlay script를 주입한다. */
async function injectOverlayIntoTab(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    files: [YOUTUBE_OVERLAY_SCRIPT_FILE],
    target: { tabId },
  });
}

/** 현재 활성 탭을 읽는다. */
function queryActiveTabs(): Promise<chrome.tabs.Tab[]> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(new Error('Could not read the current browser tab.'));
        return;
      }

      resolve(tabs);
    });
  });
}

/** Content Script에서 전달받은 다운로드 요청을 검증하고 실행한다. */
async function handleOverlayDownload(
  request: Parameters<typeof createYoutubeOverlayDownloadOptions>[0],
  senderTabId: number | undefined,
  senderTabUrl: string | undefined,
): Promise<void> {
  if (
    senderTabId === undefined ||
    !isSupportedYoutubePageUrl(senderTabUrl)
  ) {
    throw new Error('A YouTube tab is required for overlay downloads.');
  }

  /** 기존 API client에 전달할 다운로드 option. */
  const options = createYoutubeOverlayDownloadOptions(request);

  await myTubeExtractClient.assertServerAvailable(options.apiBaseUrl);
  await downloads.startDownload(buildDownloadUrl(options));
}

/** 다양한 오류 값을 사용자 메시지로 변환한다. */
function getErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof Error && error.message ? error.message : fallbackMessage;
}
