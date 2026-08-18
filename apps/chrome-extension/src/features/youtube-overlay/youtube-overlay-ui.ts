import {
  type DownloadMode,
} from '../../domain/download-options/download-options';
import {
  getYoutubeOverlayQualityOptions,
  type YoutubeOverlayQuality,
} from './quality-options';
import { parseStandardYoutubeWatchUrl } from './youtube-card-url';
import {
  type YoutubeOverlayDownloadRequest,
  type YoutubeOverlayDownloadResponse,
  YOUTUBE_OVERLAY_DOWNLOAD_MESSAGE_TYPE,
} from './youtube-overlay-message';
import { isSupportedYoutubePagePath } from './youtube-page';

/** Overlay를 붙일 YouTube 일반 영상 카드 selector 목록. */
const YOUTUBE_CARD_SELECTORS = [
  'ytd-rich-item-renderer',
  'ytd-video-renderer',
  'ytd-compact-video-renderer',
];

/** 카드별 Overlay mount marker. */
const OVERLAY_MARKER_ATTRIBUTE = 'data-mytube-extract-overlay';

/** 페이지 전역 Toast mount marker. */
const TOAST_MARKER_ATTRIBUTE = 'data-mytube-extract-toast';

/** 한 페이지에 Overlay를 한 번만 mount하기 위한 Window key. */
const OVERLAY_MOUNTED_WINDOW_KEY = '__myTubeExtractOverlayMounted';

/** YouTube 카드에서 읽은 Overlay 대상 정보. */
type YoutubeCardInfo = {
  /** Overlay를 붙일 썸네일 element. */
  thumbnail: HTMLElement;
  /** YouTube 영상 제목. */
  title: string;
  /** YouTube 영상 ID. */
  videoId: string;
};

/** 페이지 전역 Toast controller. */
type ToastController = {
  /** 실패 상태와 재시도 행동을 표시한다. */
  showFailure(message: string, retry: () => void): void;
  /** 요청 중 상태를 표시한다. */
  showRequesting(): void;
  /** 다운로드 시작 상태를 표시한다. */
  showStarted(): void;
};

/** Overlay mount 여부를 보관하는 Window 확장 타입. */
type OverlayWindow = Window & {
  /** 현재 페이지에 Overlay가 mount되었는지 여부. */
  [OVERLAY_MOUNTED_WINDOW_KEY]?: boolean;
};

/** YouTube 페이지에 Overlay를 mount한다. */
export function mountYoutubeOverlay(): void {
  /** 현재 페이지의 Overlay mount 상태. */
  const overlayWindow = window as OverlayWindow;

  if (overlayWindow[OVERLAY_MOUNTED_WINDOW_KEY]) {
    return;
  }

  overlayWindow[OVERLAY_MOUNTED_WINDOW_KEY] = true;

  /** 페이지 전역 Toast. */
  const toast = createToastController();
  /** 카드 변경을 감시하는 observer. */
  const observer = new MutationObserver(scheduleScan);
  /** 예약된 카드 scan timer. */
  let scanTimer: number | undefined;

  /** 현재 DOM의 YouTube 카드에 Overlay를 붙인다. */
  function scanCards() {
    if (!isSupportedYoutubePagePath(window.location.pathname)) {
      document
        .querySelectorAll('[' + OVERLAY_MARKER_ATTRIBUTE + ']')
        .forEach((overlay) => overlay.remove());
      return;
    }

    document
      .querySelectorAll(YOUTUBE_CARD_SELECTORS.join(','))
      .forEach((card) => {
        /** Overlay 대상 카드 정보. */
        const cardInfo = readYoutubeCardInfo(card);

        if (cardInfo) {
          mountCardOverlay(cardInfo, toast);
        }
      });
  }

  /** 무한 스크롤·SPA navigation이 연속으로 발생할 때 scan을 묶는다. */
  function scheduleScan() {
    if (scanTimer !== undefined) {
      return;
    }

    scanTimer = window.setTimeout(() => {
      scanTimer = undefined;
      scanCards();
    }, 100);
  }

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  window.addEventListener('popstate', scheduleScan);
  window.addEventListener('yt-navigate-finish', scheduleScan);
  window.addEventListener('yt-page-data-updated', scheduleScan);

  scanCards();
}

/** YouTube 카드에서 표준 watch URL과 제목·썸네일을 읽는다. */
function readYoutubeCardInfo(card: Element): YoutubeCardInfo | null {
  /** 카드의 표준 썸네일 링크. */
  const thumbnailLink = card.querySelector<HTMLAnchorElement>(
    'a#thumbnail[href], a[href*="/watch"]',
  );
  /** 표준 watch URL 정보. */
  const watchUrl = parseStandardYoutubeWatchUrl(thumbnailLink?.href);

  if (!thumbnailLink || !watchUrl) {
    return null;
  }

  /** 카드 안에서 우선적으로 읽을 제목 element. */
  const titleElement = card.querySelector<HTMLElement>(
    '#video-title, #video-title-link, a#video-title-link',
  );
  /** 카드에서 읽은 제목. */
  const title =
    titleElement?.textContent?.trim() ||
    thumbnailLink.getAttribute('aria-label')?.trim() ||
    '';
  /** Overlay를 mount할 썸네일 element. */
  const thumbnail =
    thumbnailLink.querySelector<HTMLElement>('ytd-thumbnail') ?? thumbnailLink;

  return {
    thumbnail,
    title,
    videoId: watchUrl.videoId,
  };
}

/** 단일 카드 썸네일에 Shadow Root 기반 Overlay를 붙인다. */
function mountCardOverlay(
  cardInfo: YoutubeCardInfo,
  toast: ToastController,
): void {
  if (
    cardInfo.thumbnail.querySelector(
      '[' + OVERLAY_MARKER_ATTRIBUTE + ']',
    )
  ) {
    return;
  }

  /** 썸네일 Overlay host element. */
  const host = document.createElement('span');

  host.setAttribute(OVERLAY_MARKER_ATTRIBUTE, 'true');
  host.style.position = 'absolute';
  host.style.top = '8px';
  host.style.right = '8px';
  host.style.zIndex = '2';

  if (window.getComputedStyle(cardInfo.thumbnail).position === 'static') {
    cardInfo.thumbnail.style.position = 'relative';
  }

  /** 카드별 Shadow Root. */
  const shadowRoot = host.attachShadow({ mode: 'open' });
  /** Overlay layout root. */
  const overlay = document.createElement('div');
  /** MP3/MP4 버튼 영역. */
  const modeButtons = document.createElement('div');
  /** 품질 선택 영역. */
  const qualityPanel = document.createElement('div');
  /** 품질 선택 panel 식별자. */
  const qualityPanelId = 'mytube-extract-quality-' + String(Date.now()) + Math.random();
  /** 현재 요청 중인 품질. */
  let pending = false;

  shadowRoot.append(createOverlayStyle(), overlay);
  overlay.className = 'overlay';
  modeButtons.className = 'mode-buttons';
  qualityPanel.className = 'quality-panel';
  qualityPanel.id = qualityPanelId;
  qualityPanel.hidden = true;
  overlay.append(modeButtons, qualityPanel);
  cardInfo.thumbnail.append(host);

  /** 품질 panel을 열고 선택지를 다시 만든다. */
  function openQualityPanel(
    mode: DownloadMode,
    trigger: HTMLButtonElement,
  ) {
    if (pending) {
      return;
    }

    qualityPanel.replaceChildren();
    qualityPanel.hidden = false;
    modeButtons.querySelectorAll('button').forEach((button) => {
      button.setAttribute('aria-expanded', String(button === trigger));
    });

    getYoutubeOverlayQualityOptions(mode).forEach((quality) => {
      qualityPanel.append(createQualityButton(mode, quality));
    });

    qualityPanel.setAttribute(
      'aria-label',
      mode === 'audio' ? '오디오 품질 선택' : '비디오 해상도 선택',
    );
  }

  /** 선택한 품질로 Background 다운로드를 시작한다. */
  function startDownload(mode: DownloadMode, quality: YoutubeOverlayQuality) {
    /** Background에 전달할 다운로드 요청. */
    const request: YoutubeOverlayDownloadRequest = {
      mode,
      quality,
      title: cardInfo.title,
      type: YOUTUBE_OVERLAY_DOWNLOAD_MESSAGE_TYPE,
      videoId: cardInfo.videoId,
    };

    pending = true;
    qualityPanel.hidden = true;
    setModeButtonsDisabled(true);
    toast.showRequesting();

    try {
      chrome.runtime.sendMessage(
        request,
        (response: YoutubeOverlayDownloadResponse | undefined) => {
          if (chrome.runtime.lastError) {
            finishFailure(
              request,
              chrome.runtime.lastError.message ?? '추출 요청에 실패했습니다.',
            );
            return;
          }

          if (!response?.ok) {
            finishFailure(request, response?.message ?? '추출 요청에 실패했습니다.');
            return;
          }

          pending = false;
          setModeButtonsDisabled(false);
          toast.showStarted();
        },
      );
    } catch (error) {
      finishFailure(
        request,
        error instanceof Error ? error.message : '추출 요청에 실패했습니다.',
      );
    }
  }

  /** 실패한 요청을 Toast 재시도로 다시 실행한다. */
  function finishFailure(
    request: YoutubeOverlayDownloadRequest,
    message: string,
  ) {
    pending = false;
    setModeButtonsDisabled(false);
    toast.showFailure(message, () => startDownload(request.mode, request.quality));
  }

  /** MP3/MP4 버튼의 disabled 상태를 일괄 변경한다. */
  function setModeButtonsDisabled(disabled: boolean) {
    modeButtons
      .querySelectorAll<HTMLButtonElement>('button')
      .forEach((button) => {
        button.disabled = disabled;
      });
  }

  /** MP3/MP4 버튼을 만든다. */
  function createModeButton(
    mode: DownloadMode,
    label: string,
    accessibleLabel: string,
  ): HTMLButtonElement {
    /** MP3 또는 MP4 버튼. */
    const button = document.createElement('button');

    button.className = 'mode-button';
    button.type = 'button';
    button.textContent = label;
    button.setAttribute('aria-controls', qualityPanelId);
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-label', accessibleLabel);
    button.addEventListener('click', function handleModeButtonClick(event) {
      event.preventDefault();
      event.stopPropagation();
      openQualityPanel(mode, button);
    });

    return button;
  }

  /** 품질 숫자 버튼을 만든다. */
  function createQualityButton(
    mode: DownloadMode,
    quality: YoutubeOverlayQuality,
  ): HTMLButtonElement {
    /** 품질 선택 버튼. */
    const button = document.createElement('button');

    button.className = 'quality-button';
    button.type = 'button';
    button.textContent = mode === 'audio' ? quality + ' kbps' : quality + 'p';
    button.addEventListener('click', function handleQualityButtonClick(event) {
      event.preventDefault();
      event.stopPropagation();
      startDownload(mode, quality);
    });

    return button;
  }

  modeButtons.append(
    createModeButton('audio', 'MP3', '오디오 추출 (MP3)'),
    createModeButton('video', 'MP4', '비디오 추출 (MP4)'),
  );
  shadowRoot.addEventListener('keydown', function handleOverlayKeydown(event) {
    /** Shadow Root에서 전달받은 keyboard event. */
    const keyboardEvent = event as KeyboardEvent;

    if (keyboardEvent.key === 'Escape') {
      qualityPanel.hidden = true;
      modeButtons
        .querySelectorAll('button')
        .forEach((button) => button.setAttribute('aria-expanded', 'false'));
    }
  });
}

/** 페이지 전역 Toast를 만들고 상태 갱신 함수를 반환한다. */
function createToastController(): ToastController {
  /** 기존 Toast host 또는 새로 만들 host. */
  const host =
    document.querySelector<HTMLElement>('[' + TOAST_MARKER_ATTRIBUTE + ']') ??
    document.createElement('span');

  host.setAttribute(TOAST_MARKER_ATTRIBUTE, 'true');
  host.style.position = 'fixed';
  host.style.top = '16px';
  host.style.right = '16px';
  host.style.zIndex = '2147483647';

  if (!host.isConnected) {
    document.body.append(host);
  }

  /** Toast Shadow Root. */
  const shadowRoot = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  /** Toast content root. */
  const content = document.createElement('div');

  shadowRoot.replaceChildren(createToastStyle(), content);
  content.className = 'toast';
  content.setAttribute('aria-live', 'polite');

  /** Toast 자동 닫힘 timer. */
  let dismissTimer: number | undefined;

  /** Toast 내용을 갱신한다. */
  function render(
    label: string,
    message: string,
    retry?: () => void,
  ) {
    if (dismissTimer !== undefined) {
      window.clearTimeout(dismissTimer);
      dismissTimer = undefined;
    }

    content.replaceChildren();
    content.dataset.tone = label === '실패' ? 'error' : 'info';

    /** Toast 상태 label. */
    const labelElement = document.createElement('strong');
    /** Toast 상태 설명. */
    const messageElement = document.createElement('span');

    labelElement.textContent = label;
    messageElement.textContent = message;
    content.append(labelElement, messageElement);

    if (retry) {
      /** Toast 재시도 버튼. */
      const retryButton = document.createElement('button');

      retryButton.type = 'button';
      retryButton.textContent = '다시 시도';
      retryButton.addEventListener('click', retry);
      content.append(retryButton);
    } else if (label === '다운로드 시작') {
      dismissTimer = window.setTimeout(() => content.replaceChildren(), 4000);
    }
  }

  return {
    showFailure(message, retry) {
      render('실패', message, retry);
    },
    showRequesting() {
      render('요청 중', '선택한 품질로 추출을 요청하고 있습니다.');
    },
    showStarted() {
      render('다운로드 시작', 'Chrome 다운로드를 시작했습니다.');
    },
  };
}

/** 카드 Overlay Shadow Root에 사용할 CSS를 만든다. */
function createOverlayStyle(): HTMLStyleElement {
  /** Overlay CSS style element. */
  const style = document.createElement('style');

  style.textContent = [
    ':host { --overlay-primary: #e60012; --overlay-surface: #ffffff; --overlay-surface-alt: #f8f8f8; --overlay-text-primary: #484848; --overlay-border: #e0e0e0; --overlay-focus: #4b5cce; --overlay-shadow: rgba(0, 0, 0, .07) 0px 2px 8px 0px; display: block; font-family: "Pretendard Variable", ui-sans-serif, system-ui, sans-serif; }',
    '@font-face { font-display: swap; font-family: "Pretendard Variable"; font-style: normal; font-weight: 45 920; src: url(\"' + chrome.runtime.getURL('fonts/PretendardVariable.woff2') + '\") format(\"woff2-variations\"); }',
    '.overlay { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }',
    '.mode-buttons { display: flex; gap: 4px; }',
    '.mode-button, .quality-button { border: 1px solid var(--overlay-border); border-radius: 8px; background: var(--overlay-surface); color: var(--overlay-text-primary); box-shadow: var(--overlay-shadow); cursor: pointer; font: 600 11px/1.2 "Pretendard Variable", ui-sans-serif, system-ui, sans-serif; }',
    '.mode-button { min-width: 38px; min-height: 28px; padding: 4px 6px; }',
    '.quality-panel { display: grid; grid-template-columns: repeat(3, max-content); gap: 4px; padding: 4px; border: 1px solid var(--overlay-border); border-radius: 8px; background: var(--overlay-surface-alt); box-shadow: var(--overlay-shadow); }',
    '.quality-button { min-height: 28px; padding: 4px 6px; background: var(--overlay-surface); }',
    'button:hover { border-color: var(--overlay-primary); }',
    'button:focus-visible { outline: 2px solid var(--overlay-focus); outline-offset: 2px; }',
    'button:disabled { cursor: not-allowed; opacity: .55; }',
  ].join('');

  return style;
}

/** 전역 Toast Shadow Root에 사용할 CSS를 만든다. */
function createToastStyle(): HTMLStyleElement {
  /** Toast CSS style element. */
  const style = document.createElement('style');

  style.textContent = [
    ':host { --toast-surface: #ffffff; --toast-text-primary: #484848; --toast-text-secondary: #727272; --toast-border: #e0e0e0; --toast-primary: #e60012; --toast-error: #c62828; --toast-shadow: rgba(0, 0, 0, .07) 0px 2px 8px 0px; display: block; font-family: "Pretendard Variable", ui-sans-serif, system-ui, sans-serif; }',
    '@font-face { font-display: swap; font-family: "Pretendard Variable"; font-style: normal; font-weight: 45 920; src: url(\"' + chrome.runtime.getURL('fonts/PretendardVariable.woff2') + '\") format(\"woff2-variations\"); }',
    '.toast { display: grid; gap: 4px; min-width: 220px; max-width: 360px; padding: 12px; border: 1px solid var(--toast-border); border-radius: 12px; background: var(--toast-surface); color: var(--toast-text-primary); box-shadow: var(--toast-shadow); font: 400 12px/1.45 "Pretendard Variable", ui-sans-serif, system-ui, sans-serif; }',
    '.toast[data-tone=\"error\"] { border-color: var(--toast-error); }',
    '.toast strong { font-size: 14px; font-weight: 600; }',
    '.toast span { color: var(--toast-text-secondary); overflow-wrap: anywhere; }',
    '.toast button { min-height: 28px; border: 1px solid var(--toast-primary); border-radius: 8px; background: var(--toast-surface); color: var(--toast-text-primary); cursor: pointer; font: inherit; }',
    '.toast button:focus-visible { outline: 2px solid var(--toast-primary); outline-offset: 2px; }',
  ].join('');

  return style;
}
