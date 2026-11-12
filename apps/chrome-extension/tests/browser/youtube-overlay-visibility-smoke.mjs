import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

/** WXT production output root. */
const extensionOutputRoot = path.resolve(
  process.env.MYTUBE_EXTRACT_EXTENSION_OUTPUT_ROOT ?? '.output/chrome-mv3',
);
/** Overlay unlisted script path. */
const overlayScriptPath = path.join(extensionOutputRoot, 'youtube-overlay.js');

if (!fs.existsSync(overlayScriptPath)) {
  throw new Error('Overlay script is missing at ' + overlayScriptPath + '. Run build first.');
}

/** 렌더링 결과로 실패를 모으는 목록. */
const failures = [];
/** Browser instance. */
const browser = await chromium.launch();
/** Overlay fixture page. */
const page = await browser.newPage();

try {
  await page.addInitScript(() => {
    globalThis.chrome = {
      runtime: {
        lastError: null,
        getURL: (resource) => 'chrome-extension://fixture/' + resource,
        sendMessage(_message, callback) {
          setTimeout(() => callback({ kind: 'job-accepted', ok: true }), 50);
        },
      },
    };
  });
  await page.route('**/*', (route) =>
    route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body:
        '<body><main><ytd-rich-item-renderer>' +
        '<a id="thumbnail" href="https://www.youtube.com/watch?v=abc123_DEF0"><div style="width:300px;height:170px"></div></a>' +
        '<a id="video-title-link">Fixture title</a></ytd-rich-item-renderer>' +
        '<p id="outside" style="margin:40px">outside</p></main></body>',
    }),
  );
  await page.goto('https://www.youtube.com/');
  await page.addScriptTag({ path: overlayScriptPath });
  await page.waitForSelector('[data-mytube-extract-overlay]', { state: 'attached' });

  /** 품질 panel이 화면에서 차지하는 렌더링 높이. */
  const panelHeight = () =>
    page.evaluate(() =>
      document
        .querySelector('[data-mytube-extract-overlay]')
        .shadowRoot.querySelector('.quality-panel')
        .getBoundingClientRect().height,
    );
  /** Toast 박스가 화면에서 차지하는 렌더링 높이. */
  const toastHeight = () =>
    page.evaluate(() =>
      document
        .querySelector('[data-mytube-extract-toast]')
        .shadowRoot.querySelector('.toast')
        .getBoundingClientRect().height,
    );
  /** 첫 카드 Shadow Root에서 selector 요소를 클릭한다. */
  const clickInOverlay = (selector) =>
    page.evaluate(
      (target) =>
        document
          .querySelector('[data-mytube-extract-overlay]')
          .shadowRoot.querySelector(target)
          .click(),
      selector,
    );

  expectZero(await panelHeight(), '초기 상태에서 품질 영역이 보이지 않아야 한다');

  await clickInOverlay('.mode-button');
  await page.click('#outside');
  expectZero(await panelHeight(), '다른 영역 클릭 시 품질 영역이 닫혀야 한다');

  await clickInOverlay('.mode-button');
  await clickInOverlay('.quality-button');
  expectZero(await panelHeight(), '품질 선택 후 품질 영역이 닫혀야 한다');

  await page.waitForTimeout(4300);
  expectZero(await toastHeight(), '요청 접수 Toast가 자동으로 닫힌 뒤 박스가 남지 않아야 한다');
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({ status: 'ok' }));

/** 렌더링 높이가 0이 아니면 실패로 기록한다. */
function expectZero(height, label) {
  if (height !== 0) {
    failures.push('FAIL: ' + label + ' (height=' + String(height) + ')');
  }
}
