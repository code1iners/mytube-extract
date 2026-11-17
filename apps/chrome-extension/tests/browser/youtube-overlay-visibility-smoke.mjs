import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { resolveOverlayScriptPath } from './overlay-smoke-support.mjs';

/** Overlay unlisted script path. */
const overlayScriptPath = resolveOverlayScriptPath();

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
          globalThis.__overlayRequestCount = (globalThis.__overlayRequestCount ?? 0) + 1;
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
        // 가로 선반: 부모 overflow:hidden 에 썸네일 오른쪽 절반이 잘린다.
        '<div id="shelf" style="overflow:hidden;width:150px;margin-top:20px"><ytd-rich-item-renderer id="clip-card">' +
        '<a id="thumbnail" style="display:block;width:300px" href="https://www.youtube.com/watch?v=clip001_AAA"><div style="width:300px;height:100px;background:#777"></div></a>' +
        '<a id="video-title-link">Clip title</a></ytd-rich-item-renderer></div>' +
        '<p id="outside" style="margin:40px">outside</p></main>' +
        // 유튜브 호버 미리보기 모사: 카드 밖에 있고 썸네일보다 12px 크며 pointer 를 받는다.
        '<div id="preview" style="display:none;position:absolute;left:4px;top:4px;width:324px;height:194px;background:#222;pointer-events:auto"></div>' +
        '<script>document.getElementById("preview").addEventListener("click",()=>{globalThis.__previewClickCount=(globalThis.__previewClickCount??0)+1})</script>' +
        '</body>',
    });
  });
  await page.goto('https://www.youtube.com/');
  await page.addScriptTag({ path: overlayScriptPath });
  await page.waitForFunction(
    () => document.querySelectorAll('[data-mytube-extract-overlay]').length === 3,
  );

  /** 카드 selector별 영상 ID. Overlay host 가 카드 밖에 있어도 찾을 수 있게 한다. */
  const videoIds = { '#standard-card': 'abc123_DEF0', '#compact-card': 'video12_XYZ', '#clip-card': 'clip001_AAA' };
  /** 카드의 Overlay host selector. */
  const hostSelector = (cardSelector) =>
    '[data-mytube-extract-overlay][data-video-id="' + videoIds[cardSelector] + '"]';

  /** 카드 Overlay 호버 UI의 불투명도. 0이면 보이지 않는다. */
  const overlayOpacity = (cardSelector) =>
    page.evaluate(
      (selector) =>
        Number(
          window.getComputedStyle(
            document.querySelector(selector).shadowRoot.querySelector('.overlay'),
          ).opacity,
        ),
      hostSelector(cardSelector),
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
    const outside = await page.evaluate(([selector, host]) => {
      /** 카드 썸네일 링크 영역. */
      const thumbnailRect = document
        .querySelector(selector + ' a#thumbnail')
        .getBoundingClientRect();
      /** 카드 Overlay Shadow Root. */
      const root = document.querySelector(host).shadowRoot;

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
    }, [cardSelector, hostSelector(cardSelector)]);

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
  await page.evaluate(
    (host) => document.querySelector(host).shadowRoot.querySelector('.levels button').click(),
    hostSelector('#standard-card'),
  );
  await page.waitForTimeout(200);
  expectEqual((await toastHeight()) > 0, true, '막대를 누르면 접수 Toast가 보여야 한다');

  await page.waitForTimeout(4300);
  expectZero(await toastHeight(), '요청 접수 Toast가 자동으로 닫힌 뒤 박스가 남지 않아야 한다');

  // 호버 미리보기 레이어가 썸네일을 덮어도 호버 UI가 유지되고 버튼이 눌려야 한다.
  await page.mouse.move(0, 0);
  await page.waitForTimeout(250);
  await page.hover('#standard-card a#thumbnail');
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    document.getElementById('preview').style.display = 'block';
    globalThis.__overlayRequestCount = 0;
  });
  await page.mouse.move(60, 150);
  await page.waitForTimeout(250);
  expectEqual(await overlayOpacity('#standard-card'), 1, '미리보기 레이어가 덮어도 호버 UI가 유지돼야 한다');

  /** 품질 막대 중심 좌표. 사용자가 실제로 누르는 위치다. */
  const levelCenter = await page.evaluate((host) => {
    const rect = document
      .querySelector(host)
      .shadowRoot.querySelector('.levels button')
      .getBoundingClientRect();

    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  }, hostSelector('#standard-card'));

  await page.mouse.move(levelCenter.x, levelCenter.y);
  await page.waitForTimeout(250);
  expectEqual(await overlayOpacity('#standard-card'), 1, '미리보기 위에서 막대로 옮겨도 호버 UI가 유지돼야 한다');
  // 클릭하면 버튼에 포커스가 남으므로, 썸네일 밖으로 나가면 사라지는지는 클릭 전에 확인한다.
  await page.mouse.move(levelCenter.x, 400);
  await page.waitForTimeout(250);
  expectZero(await overlayOpacity('#standard-card'), '썸네일 밖으로 나가면 미리보기가 있어도 호버 UI가 사라져야 한다');
  await page.mouse.move(levelCenter.x, levelCenter.y);
  await page.waitForTimeout(250);
  await page.mouse.click(levelCenter.x, levelCenter.y);
  await page.waitForTimeout(100);
  expectEqual(
    await page.evaluate(() => globalThis.__previewClickCount ?? 0),
    0,
    '버튼 클릭이 미리보기 레이어로 새면 안 된다',
  );
  expectEqual(
    await page.evaluate(() => globalThis.__overlayRequestCount ?? 0),
    1,
    '미리보기 레이어 위에서도 버튼 클릭이 다운로드 요청으로 전달돼야 한다',
  );

  // 호버 UI가 카드 밖에 있어도 키보드 Tab 순서가 링크 → 품질 막대 → 링크로 이어져야 한다.
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.activeElement?.blur());
  await page.focus('#standard-card a#thumbnail');
  await page.keyboard.press('Tab');
  /** 포커스가 Overlay 안 어느 요소에 있는지 읽는다. */
  const focusedOverlayControl = () =>
    page.evaluate(
      (host) =>
        document.querySelector(host).shadowRoot.activeElement?.getAttribute('aria-label') ?? '',
      hostSelector('#standard-card'),
    );

  expectEqual((await focusedOverlayControl()) !== '', true, 'Tab 으로 링크에서 Overlay 버튼으로 이동해야 한다');
  await page.keyboard.press('Shift+Tab');
  expectEqual(
    await page.evaluate(() => document.activeElement?.id),
    'thumbnail',
    'Shift+Tab 으로 Overlay 첫 버튼에서 링크로 돌아와야 한다',
  );

  /** 호버와 포커스를 모두 푼다. */
  const resetHover = async () => {
    await page.mouse.move(0, 700);
    await page.evaluate(() => document.activeElement?.blur());
    await page.waitForTimeout(250);
  };
  /** 카드 Overlay host 의 viewport 좌표. */
  const hostRect = (cardSelector) =>
    page.evaluate((host) => {
      const rect = document.querySelector(host).getBoundingClientRect();

      return { left: rect.left, top: rect.top, width: rect.width };
    }, hostSelector(cardSelector));

  // 고정 상단 바 아래로 가려진 썸네일 영역에서는 호버 UI를 보이지 않는다.
  await resetHover();
  await page.evaluate(() => {
    /** 고정 상단 바 모사. */
    const masthead = document.createElement('ytd-masthead');

    masthead.style.cssText = 'position:fixed;top:0;left:0;right:0;height:100px;background:#fff';
    document.body.append(masthead);
  });
  await page.mouse.move(100, 60);
  await page.waitForTimeout(250);
  expectZero(await overlayOpacity('#standard-card'), '상단 바에 가려진 썸네일 영역에서는 호버 UI가 보이면 안 된다');
  await page.mouse.move(100, 150);
  await page.waitForTimeout(250);
  expectEqual(await overlayOpacity('#standard-card'), 1, '상단 바 아래로 보이는 썸네일 영역에서는 호버 UI가 보여야 한다');
  expectEqual((await hostRect('#standard-card')).top >= 100, true, '호버 UI는 상단 바 아래 보이는 영역에 놓여야 한다');
  await page.evaluate(() => document.querySelector('ytd-masthead').remove());

  // 부모 overflow:hidden 에 잘린 썸네일 영역에서는 보이지 않고, 보이는 영역 안에 놓인다.
  await resetHover();
  /** 선반 viewport 좌표. */
  const shelf = await page.evaluate(() => {
    const rect = document.querySelector('#shelf').getBoundingClientRect();

    return { left: rect.left, top: rect.top, width: rect.width };
  });

  await page.mouse.move(shelf.left + 200, shelf.top + 50);
  await page.waitForTimeout(250);
  expectZero(await overlayOpacity('#clip-card'), '선반에 잘려 안 보이는 썸네일 영역에서는 호버 UI가 보이면 안 된다');
  await page.mouse.move(shelf.left + 50, shelf.top + 50);
  await page.waitForTimeout(250);
  expectEqual(await overlayOpacity('#clip-card'), 1, '선반 안에 보이는 썸네일 영역에서는 호버 UI가 보여야 한다');
  expectEqual((await hostRect('#clip-card')).width <= shelf.width + 0.5, true, '호버 UI는 선반에 잘리지 않은 영역 안에 놓여야 한다');

  // 포인터가 움직이기 전이라도 pointerenter 좌표로 호버를 인식한다.
  await resetHover();
  await page.evaluate(() => {
    /** 표준 카드 썸네일 링크. */
    const link = document.querySelector('#standard-card a#thumbnail');
    /** 링크 viewport 좌표. */
    const rect = link.getBoundingClientRect();

    link.dispatchEvent(new PointerEvent('pointerenter', { clientX: rect.left + 50, clientY: rect.top + 50 }));
  });
  await page.waitForTimeout(250);
  expectEqual(await overlayOpacity('#standard-card'), 1, 'pointermove 전에도 pointerenter 로 호버 UI가 보여야 한다');

  // 포인터가 멈춘 채 썸네일 크기만 바뀌어도 호버 UI 위치가 따라간다.
  await resetHover();
  await page.mouse.move(100, 100);
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    document.querySelector('#standard-card a#thumbnail').style.width = '200px';
  });
  await page.waitForTimeout(250);
  expectEqual(Math.round((await hostRect('#standard-card')).width), 200, '썸네일 크기가 바뀌면 호버 UI 크기가 따라가야 한다');
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
