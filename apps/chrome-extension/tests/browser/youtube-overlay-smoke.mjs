import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

/** WXT production output root. */
const extensionOutputRoot = path.resolve(
  process.env.MYTUBE_EXTRACT_EXTENSION_OUTPUT_ROOT ?? '.output/chrome-mv3',
);
/** Overlay unlisted script path. */
const overlayScriptPath = path.join(extensionOutputRoot, 'youtube-overlay.js');

if (!fs.existsSync(overlayScriptPath)) {
  throw new Error(
    'Overlay script is missing at ' +
      overlayScriptPath +
      '. Run build before the browser smoke.',
  );
}

/** 대표 캡처를 저장할 폴더. 비어 있으면 저장하지 않는다. */
const screenshotDirectory = process.env.MYTUBE_EXTRACT_OVERLAY_SCREENSHOT_DIR ?? '';
/** 검사용 썸네일 그림. 실제 이미지 서버 대신 쓴다. */
const FIXTURE_THUMBNAIL_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"><rect width="160" height="90" fill="#3b6ea5"/><circle cx="120" cy="30" r="14" fill="#f2c14e"/></svg>';
/** Overlay DOM fixture server. */
const fixtureServer = await createFixtureServer();
/** Browser instance. */
const browser = await chromium.launch();
/** Overlay fixture page. */
const page = await browser.newPage();

page.on('console', (message) => {
  console.error('[youtube-overlay-smoke] page console', message.type(), message.text());
});
page.on('pageerror', (error) => {
  console.error('[youtube-overlay-smoke] page error', error.message);
});

try {
  // 토스트 미니 썸네일이 실제 YouTube 이미지 서버로 나가지 않게 가짜 이미지로 응답한다.
  await page.route('https://i.ytimg.com/**', (route) =>
    route.fulfill({
      body: FIXTURE_THUMBNAIL_SVG,
      contentType: 'image/svg+xml',
    }),
  );
  await page.addInitScript(() => {
    globalThis.__myTubeExtractOverlayRequests = [];
    globalThis.__myTubeExtractOverlayResponseDelayMs = 50;
    globalThis.__myTubeExtractOverlayResponse = {
      kind: 'job-accepted',
      ok: true,
    };
    globalThis.chrome = {
      runtime: {
        lastError: null,
        getURL(path) {
          return 'chrome-extension://fixture/' + path;
        },
        sendMessage(message, callback) {
          globalThis.__myTubeExtractOverlayRequests.push(message);
          setTimeout(
            () => callback(globalThis.__myTubeExtractOverlayResponse),
            globalThis.__myTubeExtractOverlayResponseDelayMs,
          );
        },
      },
    };
  });
  await page.goto(fixtureServer.origin, {
    timeout: 10000,
    waitUntil: 'domcontentloaded',
  });
  await page.addScriptTag({ path: overlayScriptPath });

  await page.waitForFunction(
    () => document.querySelectorAll('[data-mytube-extract-overlay]').length === 2,
    null,
    { timeout: 10000 },
  );

  const initialState = await page.evaluate(() => ({
    overlayCount: document.querySelectorAll('[data-mytube-extract-overlay]').length,
    shortsOverlayCount: document.querySelectorAll(
      '#shorts-card [data-mytube-extract-overlay]',
    ).length,
    toastCount: document.querySelectorAll('[data-mytube-extract-toast]').length,
  }));

  assertEqual(initialState.overlayCount, 2, 'standard card overlay count');
  assertEqual(initialState.shortsOverlayCount, 0, 'Shorts overlay count');
  assertEqual(initialState.toastCount, 1, 'global toast count');
  assertEqual(await readOverlayVisible(page, '#audio-card'), false, 'overlay hidden before hover');

  // 호버하면 형식 아이콘 두 개와 비디오 해상도 막대 세 개가 보인다.
  await page.hover('#audio-card a#thumbnail');
  await waitForOverlayVisible(page, '#audio-card', true);

  const videoHoverState = await readOverlayControls(page, '#audio-card');

  assertEqual(videoHoverState.formats.join(','), '오디오 MP3:false,비디오 MP4:true', 'default format buttons');
  assertEqual(videoHoverState.levelNumbers.join(','), '360,720,1080', 'video level numbers');
  assertEqual(
    videoHoverState.levelNames.join(','),
    '360p 추출,720p 추출,1080p 추출',
    'video level accessible names',
  );
  await saveScreenshot(page, 'overlay-hover-video.png');

  // 오디오를 고르면 막대 숫자가 kbps 값으로 바뀐다.
  await clickInOverlay(page, '#audio-card', 'button[aria-label="오디오 MP3"]');

  const audioHoverState = await readOverlayControls(page, '#audio-card');

  assertEqual(audioHoverState.formats.join(','), '오디오 MP3:true,비디오 MP4:false', 'audio format buttons');
  assertEqual(audioHoverState.levelNumbers.join(','), '128,192,320', 'audio level numbers');
  assertEqual(
    audioHoverState.levelNames.join(','),
    '128kbps 추출,192kbps 추출,320kbps 추출',
    'audio level accessible names',
  );
  await saveScreenshot(page, 'overlay-hover-audio.png');

  // 형식 선택은 같은 페이지의 다른 카드에도 이어진다.
  const sharedFormatState = await readOverlayControls(page, '#video-card');

  assertEqual(sharedFormatState.levelNumbers.join(','), '128,192,320', 'format shared within the page');

  // 막대를 누르면 품질 패널 없이 바로 제출하고 아이콘 토스트를 띄운다.
  await clickInOverlay(page, '#audio-card', '.levels button:nth-child(2)');
  await page.waitForFunction(
    () => globalThis.__myTubeExtractOverlayRequests.length === 1,
    null,
    { timeout: 10000 },
  );

  await waitForLiveText(page, 'status', '요청을 접수했어요');

  const acceptedToast = await readToast(page);

  assertEqual(acceptedToast.kind, 'accepted', 'accepted toast kind');
  assertEqual(acceptedToast.visible, true, 'accepted toast visible');
  assertEqual(acceptedToast.quality, '192', 'accepted toast quality');
  assertEqual(acceptedToast.thumbnailSrc.includes('/vi/abc123_DEF0/'), true, 'accepted toast thumbnail');
  assertEqual(acceptedToast.buttons.join(','), '닫기', 'accepted toast buttons');
  assertEqual(acceptedToast.status, '요청을 접수했어요', 'accepted live region');
  assertEqual(acceptedToast.visibleSentence, false, 'accepted toast hides the sentence');
  await saveScreenshot(page, 'overlay-toast-accepted.png');

  const audioRequest = await page.evaluate(
    () => globalThis.__myTubeExtractOverlayRequests[0],
  );

  assertEqual(audioRequest.mode, 'audio', 'audio request mode');
  assertEqual(audioRequest.quality, 192, 'audio request quality');
  assertEqual(audioRequest.title, 'Fixture audio title', 'audio request title');
  assertEqual(audioRequest.videoId, 'abc123_DEF0', 'audio request video ID');

  // 닫기 버튼으로 토스트를 바로 닫는다.
  await clickInToast(page, 'button[aria-label="닫기"]');
  assertEqual((await readToast(page)).visible, false, 'toast closed by the close button');

  await page.evaluate(() => {
    history.pushState({}, '', '/shorts/fixture-short');
    window.dispatchEvent(new Event('yt-navigate-finish'));
  });
  await page.waitForFunction(
    () => document.querySelectorAll('[data-mytube-extract-overlay]').length === 0,
    null,
    { timeout: 10000 },
  );

  await page.evaluate(() => {
    history.pushState({}, '', '/');
    window.dispatchEvent(new Event('yt-navigate-finish'));
  });
  await page.waitForFunction(
    () => document.querySelectorAll('[data-mytube-extract-overlay]').length === 2,
    null,
    { timeout: 10000 },
  );

  await page.evaluate(() => {
    /** 동적으로 추가할 일반 영상 카드. */
    const card = document.createElement('ytd-rich-item-renderer');

    card.id = 'dynamic-card';
    card.innerHTML =
      '<a id="thumbnail" href="https://www.youtube.com/watch?v=dynam01_XYZ"><div class="thumb"></div></a>' +
      '<a id="video-title-link">Dynamic video title</a>';
    document.querySelector('#cards')?.append(card);
  });
  await page.waitForFunction(
    () =>
      document.querySelectorAll('[data-mytube-extract-overlay]').length === 3,
    null,
    { timeout: 10000 },
  );

  await page.addScriptTag({ path: overlayScriptPath });
  const duplicateOverlayCount = await page.evaluate(
    () => document.querySelectorAll('[data-mytube-extract-overlay]').length,
  );

  assertEqual(duplicateOverlayCount, 3, 'duplicate injection overlay count');

  await page.evaluate(() => {
    globalThis.__myTubeExtractOverlayResponse = {
      message: '서버가 요청을 받지 못했어요.',
      ok: false,
    };
  });
  // 동적 카드는 키보드 포커스로도 호버 UI가 열린다.
  await page.focus('#dynamic-card a#thumbnail');
  await waitForOverlayVisible(page, '#dynamic-card', true);
  await clickInOverlay(page, '#dynamic-card', 'button[aria-label="비디오 MP4"]');
  await clickInOverlay(page, '#dynamic-card', '.levels button:nth-child(2)');
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-mytube-extract-toast]')
        ?.shadowRoot?.querySelector('.toast')
        ?.getAttribute('data-kind') === 'failed',
    null,
    { timeout: 10000 },
  );

  await waitForLiveText(page, 'alert', '추출 요청에 실패했어요. 서버가 요청을 받지 못했어요.');

  const failedToast = await readToast(page);

  assertEqual(failedToast.visible, true, 'failed toast visible');
  assertEqual(failedToast.quality, '720', 'failed toast quality');
  assertEqual(failedToast.buttons.join(','), '다시 시도,닫기', 'failed toast buttons');
  assertEqual(failedToast.alert, '추출 요청에 실패했어요. 서버가 요청을 받지 못했어요.', 'failed live region');
  assertEqual(failedToast.visibleSentence, false, 'failed toast hides the sentence');
  await saveScreenshot(page, 'overlay-toast-failed.png');

  await page.evaluate(() => {
    globalThis.__myTubeExtractOverlayResponse = {
      kind: 'job-accepted',
      ok: true,
    };
  });
  await clickInToast(page, 'button[aria-label="다시 시도"]');
  await page.waitForFunction(
    () => globalThis.__myTubeExtractOverlayRequests.length === 3,
    null,
    { timeout: 10000 },
  );

  const videoRequest = await page.evaluate(
    () => globalThis.__myTubeExtractOverlayRequests[2],
  );

  assertEqual(videoRequest.mode, 'video', 'video request mode');
  assertEqual(videoRequest.quality, 720, 'video request quality');
  assertEqual(videoRequest.title, 'Dynamic video title', 'video request title');
  assertEqual(videoRequest.videoId, 'dynam01_XYZ', 'video request video ID');
} finally {
  await browser.close();
  await fixtureServer.close();
}

console.log(
  JSON.stringify(
    {
      overlayScriptPath,
      standardCards: 3,
      shortsExcluded: true,
      status: 'ok',
    },
    null,
    2,
  ),
);

/** Overlay 동작을 확인하는 fixture HTML server를 만든다. */
function createFixtureServer() {
  /** Fixture HTML. */
  const fixtureHtml = [
    '<!doctype html><html><head><style>body{margin:16px;font-family:sans-serif} #cards{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start} a#thumbnail{display:block} .thumb{width:320px;height:180px;background:#6b7280} ytd-compact-video-renderer .thumb{width:168px;height:94px}</style></head><body><main id="cards">',
    '<ytd-rich-item-renderer id="audio-card">',
    '<a id="thumbnail" href="https://www.youtube.com/watch?v=abc123_DEF0"><div class="thumb"></div></a>',
    '<a id="video-title-link">Fixture audio title</a></ytd-rich-item-renderer>',
    '<ytd-compact-video-renderer id="video-card">',
    '<a id="thumbnail" href="https://www.youtube.com/watch?v=video12_XYZ"><div class="thumb"></div></a>',
    '<a id="video-title-link">Fixture video title</a></ytd-compact-video-renderer>',
    '<ytd-rich-item-renderer id="shorts-card">',
    '<a id="thumbnail" href="https://www.youtube.com/shorts/short123_XYZ"><div class="thumb"></div></a>',
    '<a id="video-title-link">Fixture Shorts title</a></ytd-rich-item-renderer>',
    '</main></body></html>',
  ].join('');
  /** Static fixture server. */
  const server = http.createServer((_request, response) => {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(fixtureHtml);
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      /** Fixture server address. */
      const address = server.address();

      if (!address || typeof address === 'string') {
        throw new Error('Could not determine the fixture server address.');
      }

      resolve({
        origin: 'http://127.0.0.1:' + address.port,
        close() {
          return new Promise((closeResolve, closeReject) => {
            server.close((error) => {
              if (error) {
                closeReject(error);
                return;
              }

              closeResolve();
            });
          });
        },
      });
    });
  });
}

/** 캡처 폴더가 지정되면 현재 화면을 저장한다. */
async function saveScreenshot(page, fileName) {
  if (!screenshotDirectory) {
    return;
  }

  fs.mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({ path: path.join(screenshotDirectory, fileName) });
}

/** 카드 Overlay 호버 UI가 보이는지 읽는다. */
function readOverlayVisible(page, cardSelector) {
  return page.evaluate(
    (selector) =>
      document
        .querySelector(selector + ' [data-mytube-extract-overlay]')
        ?.shadowRoot?.querySelector('.overlay')
        ?.hasAttribute('data-visible') === true,
    cardSelector,
  );
}

/** 카드 Overlay 호버 UI의 표시 상태가 기대값이 될 때까지 기다린다. */
async function waitForOverlayVisible(page, cardSelector, expected) {
  await page.waitForFunction(
    ([selector, visible]) => {
      /** 카드 Overlay layout root. */
      const overlay = document
        .querySelector(selector + ' [data-mytube-extract-overlay]')
        ?.shadowRoot?.querySelector('.overlay');

      return (
        overlay !== null &&
        overlay !== undefined &&
        overlay.hasAttribute('data-visible') === visible &&
        (window.getComputedStyle(overlay).opacity === '1') === visible
      );
    },
    [cardSelector, expected],
    { timeout: 10000 },
  );
}

/** 카드 Overlay의 형식 버튼과 품질 막대 상태를 읽는다. */
function readOverlayControls(page, cardSelector) {
  return page.evaluate((selector) => {
    /** 카드 Overlay Shadow Root. */
    const root = document.querySelector(selector + ' [data-mytube-extract-overlay]')?.shadowRoot;

    return {
      formats: [...(root?.querySelectorAll('.formats button') ?? [])].map(
        (button) => button.getAttribute('aria-label') + ':' + button.getAttribute('aria-pressed'),
      ),
      levelNames: [...(root?.querySelectorAll('.levels button') ?? [])].map((button) =>
        button.getAttribute('aria-label'),
      ),
      levelNumbers: [...(root?.querySelectorAll('.levels button') ?? [])].map((button) =>
        button.textContent?.trim(),
      ),
    };
  }, cardSelector);
}

/** 카드 Overlay Shadow Root 안의 control을 실제 pointer로 누른다. */
async function clickInOverlay(page, cardSelector, controlSelector) {
  /** 누를 control의 화면 좌표. */
  const box = await page.evaluate(
    ([selector, control]) => {
      /** 누를 Shadow Root 안 control. */
      const element = document
        .querySelector(selector + ' [data-mytube-extract-overlay]')
        ?.shadowRoot?.querySelector(control);
      /** control 화면 영역. */
      const rect = element?.getBoundingClientRect();

      return rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : null;
    },
    [cardSelector, controlSelector],
  );

  if (!box) {
    throw new Error('Overlay control is missing: ' + controlSelector);
  }

  await page.mouse.click(box.x, box.y);
}

/** 전역 Toast Shadow Root 안의 control을 누른다. */
async function clickInToast(page, controlSelector) {
  await page.evaluate((control) => {
    /** 누를 Toast control. */
    const element = document
      .querySelector('[data-mytube-extract-toast]')
      ?.shadowRoot?.querySelector(control);

    if (!element) {
      throw new Error('Toast control is missing: ' + control);
    }

    element.click();
  }, controlSelector);
}

/** Toast live region 문장이 채워질 때까지 기다린다. */
async function waitForLiveText(page, role, expected) {
  await page.waitForFunction(
    ([liveRole, text]) =>
      document
        .querySelector('[data-mytube-extract-toast]')
        ?.shadowRoot?.querySelector('[role="' + liveRole + '"]')
        ?.textContent === text,
    [role, expected],
    { timeout: 10000 },
  );
}

/** 전역 Toast의 화면 표시와 live region 문장을 읽는다. */
function readToast(page) {
  return page.evaluate(() => {
    /** Toast Shadow Root. */
    const root = document.querySelector('[data-mytube-extract-toast]')?.shadowRoot;
    /** 화면에 보이는 Toast 박스. */
    const toast = root?.querySelector('.toast');
    /** Toast 박스 화면 영역. */
    const rect = toast?.getBoundingClientRect();

    return {
      alert: root?.querySelector('[role="alert"]')?.textContent ?? '',
      buttons: [...(toast?.querySelectorAll('button') ?? [])].map((button) =>
        button.getAttribute('aria-label'),
      ),
      kind: toast?.getAttribute('data-kind') ?? '',
      quality: toast?.querySelector('.toast__quality')?.textContent?.trim() ?? '',
      status: root?.querySelector('[role="status"]')?.textContent ?? '',
      thumbnailSrc: toast?.querySelector('img')?.getAttribute('src') ?? '',
      visible: Boolean(rect && rect.width > 0 && rect.height > 0),
      // 화면에 보이는 Toast 박스 안에는 문장이 없어야 한다.
      visibleSentence: /[가-힣]{2,}/.test(toast?.textContent ?? ''),
    };
  });
}

/** 기대값이 다르면 browser smoke를 실패시킨다. */
function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(
      'Unexpected ' +
        label +
        ': expected ' +
        String(expected) +
        ', got ' +
        String(actual),
    );
  }
}
