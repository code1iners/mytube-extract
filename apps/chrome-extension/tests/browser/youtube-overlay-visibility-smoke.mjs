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

/** 대표 캡처를 저장할 폴더. 비어 있으면 저장하지 않는다. */
const screenshotDirectory = process.env.MYTUBE_EXTRACT_OVERLAY_SCREENSHOT_DIR ?? '';
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
  await page.route('**/*', (route) => {
    // 토스트 미니 썸네일은 실제 이미지 서버 대신 가짜 그림으로 응답한다.
    if (route.request().url().startsWith('https://i.ytimg.com/')) {
      return route.fulfill({
        body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"><rect width="160" height="90" fill="#3b6ea5"/></svg>',
        contentType: 'image/svg+xml',
      });
    }

    return route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body:
        '<body style="margin:16px"><main>' +
        '<ytd-rich-item-renderer id="standard-card">' +
        '<a id="thumbnail" style="display:block;width:300px" href="https://www.youtube.com/watch?v=abc123_DEF0"><div style="width:300px;height:170px;background:#777"></div></a>' +
        '<a id="video-title-link">Fixture title</a></ytd-rich-item-renderer>' +
        '<ytd-compact-video-renderer id="compact-card">' +
        '<a id="thumbnail" style="display:block;width:168px;overflow:hidden" href="https://www.youtube.com/watch?v=video12_XYZ"><div style="width:168px;height:94px;background:#777"></div></a>' +
        '<a id="video-title-link">Compact title</a></ytd-compact-video-renderer>' +
        '<p id="outside" style="margin:40px">outside</p></main></body>',
    });
  });
  await page.goto('https://www.youtube.com/');
  await page.addScriptTag({ path: overlayScriptPath });
  await page.waitForFunction(
    () => document.querySelectorAll('[data-mytube-extract-overlay]').length === 2,
  );

  /** 카드 Overlay 호버 UI의 불투명도. 0이면 보이지 않는다. */
  const overlayOpacity = (cardSelector) =>
    page.evaluate(
      (selector) =>
        Number(
          window.getComputedStyle(
            document
              .querySelector(selector + ' [data-mytube-extract-overlay]')
              .shadowRoot.querySelector('.overlay'),
          ).opacity,
        ),
      cardSelector,
    );
  /** Toast 박스가 화면에서 차지하는 렌더링 높이. */
  const toastHeight = () =>
    page.evaluate(() =>
      document
        .querySelector('[data-mytube-extract-toast]')
        .shadowRoot.querySelector('.toast')
        .getBoundingClientRect().height,
    );
  /** 호버 UI의 모든 control이 썸네일 영역 안에 들어오는지 확인한다. */
  const expectControlsInsideThumbnail = async (cardSelector) => {
    /** 썸네일 밖으로 나간 control 목록. */
    const outside = await page.evaluate((selector) => {
      /** 카드 썸네일 링크 영역. */
      const thumbnailRect = document
        .querySelector(selector + ' a#thumbnail')
        .getBoundingClientRect();
      /** 카드 Overlay Shadow Root. */
      const root = document.querySelector(selector + ' [data-mytube-extract-overlay]').shadowRoot;

      return [...root.querySelectorAll('button')]
        .map((button) => ({ label: button.getAttribute('aria-label'), rect: button.getBoundingClientRect() }))
        .filter(
          ({ rect }) =>
            rect.width === 0 ||
            rect.left < thumbnailRect.left ||
            rect.top < thumbnailRect.top ||
            rect.right > thumbnailRect.right ||
            rect.bottom > thumbnailRect.bottom,
        )
        .map(({ label }) => label);
    }, cardSelector);

    if (outside.length > 0) {
      failures.push('FAIL: ' + cardSelector + ' 썸네일 밖으로 나간 control: ' + outside.join(', '));
    }
  };

  expectZero(await overlayOpacity('#standard-card'), '초기 상태에서 호버 UI가 보이지 않아야 한다');

  await page.hover('#standard-card a#thumbnail');
  await page.waitForTimeout(250);
  expectEqual(await overlayOpacity('#standard-card'), 1, '썸네일 호버 시 호버 UI가 보여야 한다');
  await expectControlsInsideThumbnail('#standard-card');

  await page.hover('#outside');
  await page.waitForTimeout(250);
  expectZero(await overlayOpacity('#standard-card'), '썸네일 밖으로 나가면 호버 UI가 사라져야 한다');

  await page.hover('#compact-card a#thumbnail');
  await page.waitForTimeout(250);
  expectEqual(await overlayOpacity('#compact-card'), 1, '작은 썸네일 호버 시 호버 UI가 보여야 한다');
  await expectControlsInsideThumbnail('#compact-card');

  if (screenshotDirectory) {
    fs.mkdirSync(screenshotDirectory, { recursive: true });
    await page.screenshot({
      clip: { height: 340, width: 360, x: 0, y: 0 },
      path: path.join(screenshotDirectory, 'overlay-hover-compact.png'),
    });
  }

  await page.hover('#standard-card a#thumbnail');
  await page.waitForTimeout(250);
  await page.evaluate(() =>
    document
      .querySelector('#standard-card [data-mytube-extract-overlay]')
      .shadowRoot.querySelector('.levels button')
      .click(),
  );
  await page.waitForTimeout(200);
  expectEqual((await toastHeight()) > 0, true, '막대를 누르면 접수 Toast가 보여야 한다');

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

/** 렌더링 값이 0이 아니면 실패로 기록한다. */
function expectZero(value, label) {
  expectEqual(value, 0, label);
}

/** 렌더링 값이 기대값과 다르면 실패로 기록한다. */
function expectEqual(actual, expected, label) {
  if (actual !== expected) {
    failures.push('FAIL: ' + label + ' (value=' + String(actual) + ')');
  }
}
