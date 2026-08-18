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
  await page.addInitScript(() => {
    globalThis.__myTubeExtractOverlayRequests = [];
    globalThis.__myTubeExtractOverlayResponse = {
      kind: 'download-started',
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
          callback(globalThis.__myTubeExtractOverlayResponse);
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

  await page.evaluate(() => {
    /** 첫 번째 카드의 MP3 버튼. */
    const host = document.querySelector('[data-mytube-extract-overlay]');
    /** MP3 버튼. */
    const audioButton = host?.shadowRoot?.querySelector(
      'button[aria-label="오디오 추출 (MP3)"]',
    );

    audioButton?.click();
    host?.shadowRoot
      ?.querySelector('button.quality-button:nth-child(2)')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForFunction(
    () => globalThis.__myTubeExtractOverlayRequests.length === 1,
    null,
    { timeout: 10000 },
  );
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-mytube-extract-toast]')
        ?.shadowRoot?.textContent?.includes('다운로드 시작') === true,
    null,
    { timeout: 10000 },
  );

  const audioRequest = await page.evaluate(
    () => globalThis.__myTubeExtractOverlayRequests[0],
  );

  assertEqual(audioRequest.mode, 'audio', 'audio request mode');
  assertEqual(audioRequest.quality, 192, 'audio request quality');
  assertEqual(audioRequest.title, 'Fixture audio title', 'audio request title');
  assertEqual(audioRequest.videoId, 'abc123_DEF0', 'audio request video ID');

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
      '<a id="thumbnail" href="https://www.youtube.com/watch?v=dynam01_XYZ"><div></div></a>' +
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
      message: 'Server is unavailable.',
      ok: false,
    };
    /** 동적 카드 Overlay host. */
    const host = document.querySelector(
      '#dynamic-card [data-mytube-extract-overlay]',
    );
    /** MP4 버튼. */
    const videoButton = host?.shadowRoot?.querySelector(
      'button[aria-label="비디오 추출 (MP4)"]',
    );

    videoButton?.click();
    host?.shadowRoot
      ?.querySelector('button.quality-button:nth-child(2)')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-mytube-extract-toast]')
        ?.shadowRoot?.textContent?.includes('다시 시도') === true,
    null,
    { timeout: 10000 },
  );

  await page.evaluate(() => {
    globalThis.__myTubeExtractOverlayResponse = {
      kind: 'download-started',
      ok: true,
    };
    document
      .querySelector('[data-mytube-extract-toast]')
      ?.shadowRoot?.querySelector('button')
      ?.click();
  });
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
    '<!doctype html><html><body><main id="cards">',
    '<ytd-rich-item-renderer id="audio-card">',
    '<a id="thumbnail" href="https://www.youtube.com/watch?v=abc123_DEF0"><div></div></a>',
    '<a id="video-title-link">Fixture audio title</a></ytd-rich-item-renderer>',
    '<ytd-compact-video-renderer id="video-card">',
    '<a id="thumbnail" href="https://www.youtube.com/watch?v=video12_XYZ"><div></div></a>',
    '<a id="video-title-link">Fixture video title</a></ytd-compact-video-renderer>',
    '<ytd-rich-item-renderer id="shorts-card">',
    '<a id="thumbnail" href="https://www.youtube.com/shorts/short123_XYZ"><div></div></a>',
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
