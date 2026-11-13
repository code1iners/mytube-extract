import { createDownloadJobStorageAdapter } from '../../adapters/chrome/download-job-storage';
import {
  getYoutubeThumbnailUrl,
  type DownloadMode,
} from '../../domain/download-options/download-options';
import {
  DEFAULT_QUALITY_OPTION,
  getQualityOptions,
  type QualityOption,
} from '../../domain/download-options/quality-options';
import { parseStandardYoutubeWatchUrl } from './youtube-card-url';
import {
  createOverlayCardStatusTracker,
  type OverlayCardStatus,
  type OverlayCardStatusTracker,
  subscribeOverlayRecentJobs,
} from './youtube-overlay-card-status';
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

/** 페이지에서 처음 보여줄 형식. 승인 시안의 호버 기본값을 따른다. */
const DEFAULT_OVERLAY_MODE: DownloadMode = 'video';

/** 접수 Toast가 자동으로 닫히기까지의 시간(ms). */
const ACCEPTED_TOAST_DISMISS_MS = 4000;

/** 형식 버튼의 접근 가능한 이름. */
const MODE_LABELS: Record<DownloadMode, string> = {
  audio: '오디오 MP3',
  video: '비디오 MP4',
};

/** 카드 상태별 접근 가능한 이름. 승인 시안의 문장을 따른다. */
const STATUS_LABELS: Record<OverlayCardStatus['state'], string> = {
  completed: '다운로드 시작',
  failed: '실패, 다시 시도',
  processing: '처리 중',
  queued: '접수됨, 대기 중',
};

/** Overlay에서 쓰는 선 아이콘 이름. 모양은 Popup 아이콘(승인 시안)과 같다. */
type OverlayIconName = 'alert' | 'audio' | 'check' | 'clock' | 'retry' | 'video' | 'x';

/** SVG 도형 하나의 태그와 속성. */
type OverlayIconShape = [tag: 'circle' | 'path' | 'rect', attributes: Record<string, string>];

/** 아이콘별 SVG 도형. viewBox는 모두 `0 0 24 24`다. */
const OVERLAY_ICON_SHAPES: Record<OverlayIconName, OverlayIconShape[]> = {
  alert: [['path', { d: 'M12 6v8M12 18.5v.01' }]],
  audio: [['path', { d: 'M4 10v4M8 6v12M12 3v18M16 8v8M20 10.5v3' }]],
  check: [['path', { d: 'M5 12.5l4.5 4.5L19 7' }]],
  clock: [
    ['circle', { cx: '12', cy: '12', r: '8.5' }],
    ['path', { d: 'M12 7.5V12l3 2' }],
  ],
  retry: [['path', { d: 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v4.5H9' }]],
  video: [
    ['rect', { height: '14', rx: '3', width: '18', x: '3', y: '5' }],
    ['path', { d: 'M10 9.2v5.6l4.8-2.8z', fill: 'currentColor' }],
  ],
  x: [['path', { d: 'M6 6l12 12M18 6L6 18' }]],
};

/** SVG element namespace. */
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/** YouTube 카드에서 읽은 Overlay 대상 정보. */
type YoutubeCardInfo = {
  /** 호버·포커스를 감지할 썸네일 링크. */
  hoverTarget: HTMLElement;
  /** Overlay를 붙일 썸네일 element. */
  thumbnail: HTMLElement;
  /** YouTube 영상 제목. */
  title: string;
  /** YouTube 영상 ID. */
  videoId: string;
};

/** 같은 페이지의 카드 Overlay가 함께 쓰는 상태. 저장소에 남기지 않는다. */
type OverlayPageState = {
  /** 마지막으로 고른 형식. */
  mode: DownloadMode;
  /** 형식이 바뀌면 다시 그릴 카드별 render 함수. */
  renderers: Set<() => void>;
  /** 저장된 최근 job으로 고른 카드별 상태. */
  statuses: OverlayCardStatusTracker;
  /** 최근 job 목록이 바뀌면 다시 그릴 카드별 상태 render 함수. */
  statusRenderers: Set<() => void>;
};

/** 페이지 전역 Toast controller. */
type ToastController = {
  /** 실패 상태와 재시도 행동을 표시한다. */
  showFailure(
    request: YoutubeOverlayDownloadRequest,
    message: string,
    retry: () => void,
  ): void;
  /** 품질 막대를 눌러 요청을 보냈고 Background 응답을 기다리는 중임을 표시한다. 접수 여부는 아직 단정하지 않는다. */
  showPending(request: YoutubeOverlayDownloadRequest): void;
  /** Background가 요청을 접수했음을 표시한다. */
  showAccepted(request: YoutubeOverlayDownloadRequest): void;
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
  /** 카드 Overlay가 공유하는 형식 선택. */
  const pageState: OverlayPageState = {
    mode: DEFAULT_OVERLAY_MODE,
    renderers: new Set(),
    statuses: createOverlayCardStatusTracker(),
    statusRenderers: new Set(),
  };
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
          mountCardOverlay(cardInfo, pageState, toast);
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
  subscribeRecentJobs(pageState);
}

/**
 * Popup과 같은 storage 변경 이벤트로 최근 job 목록을 구독해 카드 상태를 갱신한다.
 * Background가 content script에 따로 메시지를 보내지 않으므로 최근 5건 보관 목록에 있는 job만 보인다.
 */
function subscribeRecentJobs(pageState: OverlayPageState): void {
  // 검사용 페이지처럼 storage가 없는 환경에서는 호버 UI만 동작한다.
  if (!chrome.storage?.local || !chrome.storage.onChanged) {
    return;
  }

  /** 최근 job storage adapter. */
  const storage = createDownloadJobStorageAdapter(chrome);
  /** 완료 배지를 지우려고 예약한 timer. */
  let expiryTimer: number | undefined;

  /** 모든 카드의 상태 배지를 다시 그리고, 완료 배지가 사라질 때 한 번 더 그리도록 예약한다. */
  function renderStatuses() {
    pageState.statusRenderers.forEach((renderStatus) => renderStatus());

    if (expiryTimer !== undefined) {
      window.clearTimeout(expiryTimer);
      expiryTimer = undefined;
    }

    /** 다음 완료 배지가 사라질 때까지 남은 시간. */
    const delay = pageState.statuses.getNextChangeDelay(Date.now());

    if (delay !== null) {
      expiryTimer = window.setTimeout(renderStatuses, delay);
    }
  }

  /** 받은 최근 job 목록을 반영한다. */
  function applyJobs(jobs: Parameters<OverlayCardStatusTracker['update']>[0]) {
    pageState.statuses.update(jobs, Date.now());
    renderStatuses();
  }

  try {
    subscribeOverlayRecentJobs(storage, applyJobs);
  } catch {
    // 연결이 끊긴 확장 context에서는 storage 호출 자체가 예외를 던진다.
  }
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
    hoverTarget: thumbnailLink,
    thumbnail,
    title,
    videoId: watchUrl.videoId,
  };
}

/** 단일 카드 썸네일에 Shadow Root 기반 호버 UI를 붙인다. */
function mountCardOverlay(
  cardInfo: YoutubeCardInfo,
  pageState: OverlayPageState,
  toast: ToastController,
): void {
  /** 이 썸네일에 이미 붙은 Overlay host. */
  const existingHost = cardInfo.thumbnail.querySelector<HTMLElement>(
    '[' + OVERLAY_MARKER_ATTRIBUTE + ']',
  );

  if (existingHost?.dataset.videoId === cardInfo.videoId) {
    return;
  }

  // YouTube가 카드 element를 다른 영상에 재사용하면 이전 영상의 Overlay와 상태를 떼고 다시 붙인다.
  existingHost?.remove();

  /** 썸네일 전체를 덮는 Overlay host. 빈 영역의 pointer는 YouTube 썸네일로 통과시킨다. */
  const host = document.createElement('span');

  host.setAttribute(OVERLAY_MARKER_ATTRIBUTE, 'true');
  host.dataset.videoId = cardInfo.videoId;
  host.style.position = 'absolute';
  host.style.inset = '0';
  host.style.display = 'block';
  host.style.pointerEvents = 'none';
  host.style.zIndex = '2';
  // 작은 썸네일(사이드바 카드)에서 control 크기를 줄이기 위한 container query 기준이다.
  host.style.containerType = 'size';

  if (window.getComputedStyle(cardInfo.thumbnail).position === 'static') {
    cardInfo.thumbnail.style.position = 'relative';
  }

  /** 카드별 Shadow Root. */
  const shadowRoot = host.attachShadow({ mode: 'open' });
  /** 호버 UI layout root. */
  const overlay = document.createElement('div');
  /** 형식 원형 버튼 묶음. */
  const formats = document.createElement('div');
  /** 품질 막대 묶음. 누르면 바로 제출한다. */
  const levels = document.createElement('div');
  /** 호버와 관계없이 보이는 job 상태 자리. 상태가 바뀌면 읽어 주도록 live region으로 둔다. */
  const status = document.createElement('div');
  /** 마지막으로 그린 상태 key. 같은 상태를 다시 그려 포커스나 낭독이 반복되지 않게 한다. */
  let renderedStatusKey = '';
  /** 카드가 사라졌을 때 이 카드의 page 리스너를 한 번에 떼기 위한 controller. */
  const listeners = new AbortController();
  /** 형식별 원형 버튼. */
  const modeButtons: Record<DownloadMode, HTMLButtonElement> = {
    audio: createModeButton('audio'),
    video: createModeButton('video'),
  };
  /** 썸네일 위에 pointer가 있는지 여부. */
  let hovered = false;
  /** Background 응답을 기다리는 중인지 여부. */
  let pending = false;

  shadowRoot.append(createOverlayStyle(), overlay, status);
  overlay.className = 'overlay';
  status.className = 'status';
  status.setAttribute('role', 'status');
  formats.className = 'formats';
  formats.setAttribute('role', 'group');
  formats.setAttribute('aria-label', '형식');
  levels.className = 'levels';
  levels.setAttribute('role', 'group');
  levels.setAttribute('aria-label', '품질을 누르면 바로 추출');
  formats.append(modeButtons.audio, modeButtons.video);
  overlay.append(formats, levels);
  cardInfo.thumbnail.append(host);

  /** 호버나 포커스가 썸네일 안에 있을 때만 호버 UI를 보인다. */
  function updateVisibility() {
    // YouTube가 카드를 제거하면 리스너가 누적되지 않도록 함께 해제한다.
    if (!host.isConnected) {
      detach();
      return;
    }

    /** 키보드 포커스가 썸네일 링크나 Overlay 안에 있는지 여부. */
    const focused = cardInfo.hoverTarget.matches(':focus-within');

    overlay.toggleAttribute('data-visible', hovered || focused);
  }

  /** 페이지 형식 선택에 맞춰 형식 버튼과 품질 막대를 다시 그린다. */
  function render() {
    if (!host.isConnected) {
      detach();
      return;
    }

    /** 현재 페이지 형식. */
    const mode = pageState.mode;
    /** 현재 형식의 품질 선택지. */
    const qualities = getQualityOptions(mode);

    (Object.keys(modeButtons) as DownloadMode[]).forEach((buttonMode) => {
      modeButtons[buttonMode].setAttribute('aria-pressed', String(buttonMode === mode));
    });

    /** 기본 품질 막대의 순서. 승인 시안처럼 기본 품질 이하 막대를 채워 높낮이를 보여준다. */
    const defaultLevel = qualities.indexOf(DEFAULT_QUALITY_OPTION[mode]);

    levels.replaceChildren(
      ...qualities.map((quality, index) =>
        createLevelButton(mode, quality, index <= defaultLevel),
      ),
    );
    setControlsDisabled(pending);
  }

  /** 저장된 최근 job 중 이 카드 영상의 상태를 썸네일 위에 그린다. */
  function renderStatus() {
    if (!host.isConnected) {
      detach();
      return;
    }

    /** 이 카드 영상의 현재 상태. */
    const cardStatus = pageState.statuses.getStatus(cardInfo.videoId, Date.now());
    /** 상태와 재시도 조건을 묶은 비교 key. */
    const statusKey = cardStatus ? JSON.stringify(cardStatus) : '';

    if (statusKey === renderedStatusKey) {
      return;
    }

    renderedStatusKey = statusKey;

    if (!cardStatus) {
      status.replaceChildren();
      status.removeAttribute('data-state');
      return;
    }

    status.dataset.state = cardStatus.state;
    status.replaceChildren(createStatusContent(cardStatus));
  }

  /** 상태별 배지를 만든다. 실패 배지만 누를 수 있다. */
  function createStatusContent(cardStatus: OverlayCardStatus): HTMLElement {
    /** 상태의 접근 가능한 이름. */
    const label = STATUS_LABELS[cardStatus.state];

    if (cardStatus.state === 'failed') {
      /** 같은 형식·품질로 다시 제출하는 버튼 배지. */
      const button = document.createElement('button');

      button.className = 'status__badge status__retry';
      button.type = 'button';
      button.disabled = pending;
      button.setAttribute('aria-label', label);
      button.append(createIcon('retry'));
      button.addEventListener('click', function handleStatusRetryClick(event) {
        event.preventDefault();
        event.stopPropagation();
        startDownload(cardStatus.mode, cardStatus.quality);
      });

      return button;
    }

    /** 대기·처리 링 또는 완료 배지. 이름은 화면에 보이지 않는 문장으로 읽힌다. */
    const badge = document.createElement('span');
    /** 상태 이름. */
    const text = document.createElement('span');

    text.className = 'sr-only';
    text.textContent = label;

    if (cardStatus.state === 'completed') {
      badge.className = 'status__badge status__done';
      badge.append(createIcon('check'), text);
      return badge;
    }

    // 대기는 시계와 회전 링, 처리는 숫자 없이 회전 링만 둔다.
    badge.className = 'status__ring';
    badge.append(createSpinnerRing());

    if (cardStatus.state === 'queued') {
      badge.append(createIcon('clock'));
    }

    badge.append(text);

    return badge;
  }

  /** 이 카드의 page 리스너와 형식·상태 render 구독을 해제한다. */
  function detach() {
    listeners.abort();
    pageState.renderers.delete(render);
    pageState.statusRenderers.delete(renderStatus);
  }

  /** 선택한 품질로 Background 다운로드를 시작한다. */
  function startDownload(mode: DownloadMode, quality: QualityOption) {
    /** Background에 전달할 다운로드 요청. */
    const request: YoutubeOverlayDownloadRequest = {
      mode,
      quality,
      title: cardInfo.title,
      type: YOUTUBE_OVERLAY_DOWNLOAD_MESSAGE_TYPE,
      videoId: cardInfo.videoId,
    };

    pending = true;
    setControlsDisabled(true);
    toast.showPending(request);

    try {
      chrome.runtime.sendMessage(
        request,
        (response: YoutubeOverlayDownloadResponse | undefined) => {
          // 확장 연결 오류 원문은 영어라 사용자에게는 고정 한국어 문장으로 알린다.
          if (chrome.runtime.lastError) {
            finishFailure(request, '확장 프로그램에 연결할 수 없어요.');
            return;
          }

          if (!response?.ok) {
            finishFailure(request, response?.message ?? '');
            return;
          }

          pending = false;
          setControlsDisabled(false);
          toast.showAccepted(request);
        },
      );
    } catch {
      finishFailure(request, '확장 프로그램에 연결할 수 없어요.');
    }
  }

  /** 실패한 요청을 Toast 재시도로 다시 실행할 수 있게 한다. */
  function finishFailure(
    request: YoutubeOverlayDownloadRequest,
    message: string,
  ) {
    pending = false;
    setControlsDisabled(false);
    toast.showFailure(request, message, () => startDownload(request.mode, request.quality));
  }

  /** 형식 버튼·품질 막대·재시도 배지의 disabled 상태를 일괄 변경한다. */
  function setControlsDisabled(disabled: boolean) {
    shadowRoot
      .querySelectorAll<HTMLButtonElement>('button')
      .forEach((button) => {
        button.disabled = disabled;
      });
  }

  /** 형식 원형 아이콘 버튼을 만든다. */
  function createModeButton(mode: DownloadMode): HTMLButtonElement {
    /** 오디오 또는 비디오 형식 버튼. */
    const button = document.createElement('button');

    button.className = 'format';
    button.type = 'button';
    button.setAttribute('aria-label', MODE_LABELS[mode]);
    button.append(createIcon(mode));
    button.addEventListener('click', function handleModeButtonClick(event) {
      // 썸네일 링크 안에 있으므로 영상 페이지로 이동하지 않게 막는다.
      event.preventDefault();
      event.stopPropagation();

      if (pageState.mode === mode) {
        return;
      }

      // 같은 페이지의 다른 카드에도 형식 선택을 이어 준다.
      pageState.mode = mode;
      pageState.renderers.forEach((renderCard) => renderCard());
    });

    return button;
  }

  /** 품질 막대 버튼을 만든다. */
  function createLevelButton(
    mode: DownloadMode,
    quality: QualityOption,
    filled: boolean,
  ): HTMLButtonElement {
    /** 품질 막대 버튼. */
    const button = document.createElement('button');
    /** 높이로 품질 수준을 보여주는 막대. */
    const bar = document.createElement('i');
    /** 막대 아래 품질 숫자. */
    const value = document.createElement('span');

    button.className = 'level';
    button.type = 'button';
    button.toggleAttribute('data-filled', filled);
    button.setAttribute(
      'aria-label',
      String(quality) + (mode === 'audio' ? ' kbps' : 'p') + ' 추출',
    );
    bar.setAttribute('aria-hidden', 'true');
    value.textContent = String(quality);
    button.append(bar, value);
    button.addEventListener('click', function handleLevelButtonClick(event) {
      event.preventDefault();
      event.stopPropagation();
      startDownload(mode, quality);
    });

    return button;
  }

  cardInfo.hoverTarget.addEventListener(
    'pointerenter',
    () => {
      hovered = true;
      updateVisibility();
    },
    { signal: listeners.signal },
  );
  cardInfo.hoverTarget.addEventListener(
    'pointerleave',
    () => {
      hovered = false;
      updateVisibility();
    },
    { signal: listeners.signal },
  );
  cardInfo.hoverTarget.addEventListener('focusin', updateVisibility, {
    signal: listeners.signal,
  });
  // focusout 시점에는 다음 포커스 대상이 아직 정해지지 않아 한 tick 뒤에 판정한다.
  cardInfo.hoverTarget.addEventListener(
    'focusout',
    () => window.setTimeout(updateVisibility, 0),
    { signal: listeners.signal },
  );

  pageState.renderers.add(render);
  pageState.statusRenderers.add(renderStatus);
  render();
  renderStatus();
}

/** 대기·처리 상태에 쓰는 흰 회전 링을 만든다. 진행률 숫자는 두지 않는다. */
function createSpinnerRing(): SVGSVGElement {
  /** 링 SVG element. */
  const ring = document.createElementNS(SVG_NAMESPACE, 'svg');
  /** 흐린 바탕 원. */
  const track = document.createElementNS(SVG_NAMESPACE, 'circle');
  /** 회전하는 짧은 호. */
  const arc = document.createElementNS(SVG_NAMESPACE, 'circle');

  ring.setAttribute('aria-hidden', 'true');
  ring.setAttribute('class', 'ring');
  ring.setAttribute('focusable', 'false');
  ring.setAttribute('viewBox', '0 0 40 40');
  [track, arc].forEach((circle) => {
    circle.setAttribute('cx', '20');
    circle.setAttribute('cy', '20');
    circle.setAttribute('r', '17');
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke-width', '3');
  });
  track.setAttribute('class', 'ring__track');
  arc.setAttribute('class', 'ring__arc');
  arc.setAttribute('stroke-linecap', 'round');
  arc.setAttribute('pathLength', '100');
  arc.setAttribute('stroke-dasharray', '22 78');
  ring.append(track, arc);

  return ring;
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
  /** 화면에 보이는 Toast 박스. 문장 없이 썸네일·아이콘·품질·버튼만 둔다. */
  const content = document.createElement('div');
  /** 접수 결과를 읽어 주는 live region. */
  const statusRegion = createLiveRegion('status');
  /** 실패 결과를 바로 읽어 주는 live region. */
  const alertRegion = createLiveRegion('alert');

  shadowRoot.replaceChildren(createToastStyle(), content, statusRegion, alertRegion);
  content.className = 'toast';

  /** Toast 자동 닫힘 timer. */
  let dismissTimer: number | undefined;

  /** Toast 박스를 비워 화면에서 숨긴다. */
  function hide() {
    if (dismissTimer !== undefined) {
      window.clearTimeout(dismissTimer);
      dismissTimer = undefined;
    }

    content.replaceChildren();
    content.removeAttribute('data-kind');
  }

  /** Toast 박스를 요청 정보와 결과 종류로 다시 그린다. */
  function render(
    kind: 'pending' | 'accepted' | 'failed',
    request: YoutubeOverlayDownloadRequest,
    retry?: () => void,
  ) {
    hide();
    content.dataset.kind = kind;

    /** 요청 영상 미니 썸네일 자리. 이미지를 못 불러오면 중립 배경만 남는다. */
    const thumbnailFrame = document.createElement('span');
    /** 요청 영상 미니 썸네일. */
    const thumbnail = document.createElement('img');
    /** 결과 상태 아이콘. */
    const statusIcon = document.createElement('span');
    /** 형식 아이콘과 품질 숫자. */
    const quality = document.createElement('span');
    /** 품질 숫자. */
    const qualityValue = document.createElement('span');

    thumbnailFrame.className = 'toast__thumb';
    thumbnail.alt = '';
    thumbnail.src = getYoutubeThumbnailUrl(request.videoId);
    thumbnail.addEventListener('error', () => thumbnail.remove(), { once: true });
    thumbnailFrame.append(thumbnail);
    statusIcon.className = 'toast__status';
    // 응답을 기다리는 동안은 체크 대신 숫자 없는 회전 링만 둔다.
    statusIcon.append(
      kind === 'pending' ? createSpinnerRing() : createIcon(kind === 'accepted' ? 'check' : 'alert'),
    );
    quality.className = 'toast__quality';
    qualityValue.textContent = String(request.quality);
    quality.append(createIcon(request.mode), qualityValue);
    content.append(thumbnailFrame, statusIcon, quality);

    if (retry) {
      content.append(
        createToastButton('retry', '다시 시도', () => {
          hide();
          retry();
        }),
      );
    }

    content.append(createToastButton('x', '닫기', hide));
  }

  return {
    showFailure(request, message, retry) {
      render('failed', request, retry);
      announce(
        alertRegion,
        message ? '추출 요청에 실패했어요. ' + message : '추출 요청에 실패했어요.',
      );
    },
    showPending(request) {
      render('pending', request);
      announce(statusRegion, '요청을 보내고 있어요');
    },
    showAccepted(request) {
      render('accepted', request);
      announce(statusRegion, '요청을 접수했어요');
      dismissTimer = window.setTimeout(hide, ACCEPTED_TOAST_DISMISS_MS);
    },
  };
}

/** 화면에 보이지 않는 live region을 만든다. */
function createLiveRegion(role: 'alert' | 'status'): HTMLSpanElement {
  /** live region element. */
  const region = document.createElement('span');

  region.className = 'sr-only';
  region.setAttribute('role', role);

  return region;
}

/** live region 문장을 바꾼다. 같은 문장이 반복돼도 다시 읽히도록 한 번 비운 뒤 채운다. */
function announce(region: HTMLElement, message: string): void {
  region.textContent = '';
  window.requestAnimationFrame(() => {
    region.textContent = message;
  });
}

/** Toast 원형 아이콘 버튼을 만든다. */
function createToastButton(
  icon: OverlayIconName,
  label: string,
  onClick: () => void,
): HTMLButtonElement {
  /** Toast 행동 버튼. */
  const button = document.createElement('button');

  button.className = 'toast__button';
  button.type = 'button';
  button.dataset.action = icon;
  button.setAttribute('aria-label', label);
  button.append(createIcon(icon));
  button.addEventListener('click', onClick);

  return button;
}

/** 장식용 선 아이콘을 만든다. 의미는 감싼 control의 접근 가능한 이름이 전달한다. */
function createIcon(name: OverlayIconName): SVGSVGElement {
  /** 아이콘 SVG element. */
  const icon = document.createElementNS(SVG_NAMESPACE, 'svg');

  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('class', 'icon');
  icon.setAttribute('focusable', 'false');
  icon.setAttribute('viewBox', '0 0 24 24');

  // YouTube의 Trusted Types 정책에 걸리지 않도록 innerHTML 대신 도형 element를 직접 만든다.
  OVERLAY_ICON_SHAPES[name].forEach(([tag, attributes]) => {
    /** 아이콘 도형 element. */
    const shape = document.createElementNS(SVG_NAMESPACE, tag);

    Object.entries(attributes).forEach(([key, value]) => shape.setAttribute(key, value));
    icon.append(shape);
  });

  return icon;
}

/** Pretendard 글꼴 선언. Shadow Root마다 같은 확장 리소스를 쓴다. */
function createFontFaceRule(): string {
  return (
    '@font-face { font-display: swap; font-family: "Pretendard Variable"; font-style: normal; font-weight: 45 920; src: url("' +
    chrome.runtime.getURL('fonts/PretendardVariable.woff2') +
    '") format("woff2-variations"); }'
  );
}

/** 카드 Overlay Shadow Root에 사용할 CSS를 만든다. */
function createOverlayStyle(): HTMLStyleElement {
  /** Overlay CSS style element. */
  const style = document.createElement('style');

  // 썸네일 위에 놓이므로 YouTube 테마와 상관없이 어두운 scrim 위 흰 아이콘을 쓴다.
  style.textContent = [
    ':host { --overlay-primary: #e60012; --overlay-scrim: rgba(18, 18, 20, .74); --overlay-scrim-strong: rgba(0, 0, 0, .9); --overlay-bar: rgba(255, 255, 255, .4); --overlay-focus: #4b5cce; --overlay-ok: #356b43; --overlay-bad: #c62828; --overlay-on-scrim: #ffffff; --overlay-hover: rgba(255, 255, 255, .14); --overlay-ring: var(--overlay-on-scrim); --overlay-ring-track: rgba(255, 255, 255, .25); display: block; font-family: "Pretendard Variable", ui-sans-serif, system-ui, sans-serif; }',
    createFontFaceRule(),
    '.overlay { position: absolute; top: 8px; right: 8px; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; opacity: 0; pointer-events: none; transition: opacity .12s ease-out; }',
    '.overlay[data-visible] { opacity: 1; pointer-events: auto; }',
    '.formats { display: flex; gap: 6px; }',
    'button { margin: 0; padding: 0; border: 0; color: var(--overlay-on-scrim); cursor: pointer; font: inherit; }',
    '.icon { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }',
    '.format { display: grid; width: 44px; height: 44px; place-items: center; border-radius: 9999px; background: var(--overlay-scrim); }',
    '.format:hover { background: var(--overlay-scrim-strong); }',
    // 선택을 색만으로 전달하지 않도록 흰 테두리를 함께 둔다.
    '.format[aria-pressed="true"] { background: var(--overlay-primary); box-shadow: inset 0 0 0 2px var(--overlay-on-scrim); }',
    '.levels { display: flex; gap: 4px; padding: 4px; border-radius: 10px; background: var(--overlay-scrim); }',
    '.level { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 3px; width: 44px; height: 48px; padding-bottom: 4px; border-radius: 6px; background: transparent; }',
    '.level:hover { background: var(--overlay-hover); }',
    '.level i { display: block; width: 8px; border-radius: 2px; background: var(--overlay-bar); }',
    '.level:nth-child(1) i { height: 8px; } .level:nth-child(2) i { height: 15px; } .level:nth-child(3) i { height: 22px; }',
    '.level[data-filled] i { background: var(--overlay-primary); }',
    '.level span { font-size: 11px; font-weight: 600; line-height: 1.2; }',
    // 밝은 썸네일 위에서도 보이도록 파란 outline 안쪽에 흰 띠를 둔다.
    'button:focus-visible { outline: 2px solid var(--overlay-focus); outline-offset: 2px; box-shadow: 0 0 0 2px var(--overlay-on-scrim); }',
    '.format[aria-pressed="true"]:focus-visible { box-shadow: inset 0 0 0 2px var(--overlay-on-scrim), 0 0 0 2px var(--overlay-on-scrim); }',
    'button:disabled { cursor: not-allowed; opacity: .55; }',
    // 상태 배지는 호버 UI(오른쪽 위)와 겹치지 않는 왼쪽 위에 고정한다. 호버에 따라 움직이면 재시도 배지를 누르려다 빗나간다.
    '.status { position: absolute; top: 8px; left: 8px; }',
    '.status__ring, .status__badge { position: relative; display: grid; width: 44px; height: 44px; place-items: center; border-radius: 9999px; color: var(--overlay-on-scrim); }',
    '.status__ring { background: var(--overlay-scrim); }',
    '.ring { position: absolute; inset: 0; width: 44px; height: 44px; }',
    '.ring__track { stroke: var(--overlay-ring-track); }',
    '.ring__arc { stroke: var(--overlay-ring); transform-origin: 50% 50%; animation: mytube-spin 1.4s linear infinite; }',
    '@keyframes mytube-spin { to { transform: rotate(360deg); } }',
    '.status__ring .icon { width: 18px; height: 18px; }',
    '.status__done { background: var(--overlay-ok); }',
    '.status__done .icon { stroke-width: 2.6; }',
    '.status__retry { background: var(--overlay-bad); pointer-events: auto; }',
    '.status__retry:hover { filter: brightness(.88); }',
    '.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }',
    // 사이드바처럼 짧은 썸네일(168×94)에서는 44px 조작 영역을 유지한 채 여백만 줄여 잘리지 않게 한다.
    '@container (max-height: 130px) { .status { top: 2px; left: 2px; } .overlay { top: 2px; right: 2px; gap: 2px; } .formats { gap: 2px; } .levels { gap: 2px; padding: 0; border-radius: 8px; } .level { height: 44px; gap: 2px; padding-bottom: 3px; } .level:nth-child(1) i { height: 6px; } .level:nth-child(2) i { height: 11px; } .level:nth-child(3) i { height: 16px; } }',
    '@media (prefers-reduced-motion: reduce) { .overlay { transition: none; } .ring__arc { animation: none; } }',
  ].join('');

  return style;
}

/** 전역 Toast Shadow Root에 사용할 CSS를 만든다. */
function createToastStyle(): HTMLStyleElement {
  /** Toast CSS style element. */
  const style = document.createElement('style');

  // YouTube 페이지 위에 떠 있으므로 승인 시안처럼 테마와 상관없이 어두운 표면과 다크 상태 토큰을 쓴다.
  style.textContent = [
    ':host { --toast-surface: #18191b; --toast-thumb: #3a3b3e; --toast-text: #ffffff; --toast-text-secondary: #c8c8c8; --toast-primary: #e60012; --toast-ok: #8fd6a0; --toast-bad: #ff8a80; --toast-on-status: #18191b; --toast-focus: #a9b4f2; --toast-ring-track: rgba(255, 255, 255, .25); display: block; font-family: "Pretendard Variable", ui-sans-serif, system-ui, sans-serif; }',
    createFontFaceRule(),
    '.toast { display: flex; align-items: center; gap: 10px; max-width: calc(100vw - 32px); padding: 8px; border-radius: 12px; background: var(--toast-surface); color: var(--toast-text); box-shadow: 0 8px 24px rgba(0, 0, 0, .24); font: 600 13px/1.2 "Pretendard Variable", ui-sans-serif, system-ui, sans-serif; }',
    '.toast:empty { display: none; }',
    '.icon { width: 16px; height: 16px; flex: none; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }',
    '.toast__thumb { display: block; width: 56px; height: 32px; flex: none; overflow: hidden; border-radius: 4px; background: var(--toast-thumb); }',
    '.toast__thumb img { display: block; width: 100%; height: 100%; object-fit: cover; }',
    '.toast__status { display: grid; width: 28px; height: 28px; flex: none; place-items: center; border-radius: 9999px; color: var(--toast-on-status); }',
    '.toast__status .icon { stroke-width: 3; }',
    '.toast[data-kind="accepted"] .toast__status { background: var(--toast-ok); }',
    '.toast[data-kind="failed"] .toast__status { background: var(--toast-bad); }',
    '.toast[data-kind="pending"] .toast__status { position: relative; background: var(--toast-thumb); }',
    '.ring { position: absolute; inset: 0; width: 28px; height: 28px; }',
    '.ring__track { stroke: var(--toast-ring-track); }',
    '.ring__arc { stroke: var(--toast-text); transform-origin: 50% 50%; animation: mytube-spin 1.4s linear infinite; }',
    '@keyframes mytube-spin { to { transform: rotate(360deg); } }',
    '.toast__quality { display: flex; align-items: center; gap: 4px; color: var(--toast-text-secondary); }',
    '.toast__button { display: grid; width: 44px; height: 44px; flex: none; place-items: center; margin: 0; padding: 0; border: 0; border-radius: 9999px; background: transparent; color: var(--toast-text); cursor: pointer; }',
    '.toast__button .icon { width: 18px; height: 18px; }',
    '.toast__button:hover { background: rgba(255, 255, 255, .12); }',
    '.toast__button[data-action="retry"] { background: var(--toast-primary); }',
    '.toast__button:focus-visible { outline: 2px solid var(--toast-focus); outline-offset: 2px; }',
    '.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }',
    '@media (prefers-reduced-motion: reduce) { .ring__arc { animation: none; } }',
  ].join('');

  return style;
}
