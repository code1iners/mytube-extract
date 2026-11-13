import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

/** Browser smoke 실행 mode. */
const smokeMode =
  process.env.MYTUBE_EXTRACT_POPUP_SMOKE_MODE ??
  process.env.MEDIA_NEST_POPUP_SMOKE_MODE ??
  'production';
/** Dev smoke 여부. */
const isDevSmoke = smokeMode === 'dev';
/** Browser smoke mode별 기본 WXT output root. */
const defaultExtensionOutputRoot = isDevSmoke ? '.output/chrome-mv3-dev' : '.output/chrome-mv3';
/** WXT output root. */
const extensionOutputRoot = path.resolve(
  process.env.MYTUBE_EXTRACT_EXTENSION_OUTPUT_ROOT ??
    process.env.MEDIA_NEST_EXTENSION_OUTPUT_ROOT ??
    defaultExtensionOutputRoot,
);
/** 실제 MyTube Extract API base URL. */
const realApiBaseUrl =
  process.env.WXT_MYTUBE_EXTRACT_API_BASE_URL ??
  process.env.MYTUBE_EXTRACT_API_BASE_URL ??
  process.env.WXT_MEDIA_NEST_API_BASE_URL ??
  process.env.MEDIA_NEST_API_BASE_URL ??
  'https://mytube-extract-api.codeliners.cc';
/** Built popup에 주입되는 MyTube Extract API origin. */
const expectedApiOrigin = new URL(realApiBaseUrl).origin;
/** 가짜 YouTube 썸네일 응답으로 쓸 PNG. 스모크가 실제 YouTube 이미지 서버를 부르지 않게 한다. */
const fakeThumbnailPng = fs.readFileSync(path.resolve('public/icon-128.png'));
/** 지정하면 상태별 Popup 스크린샷을 라이트·다크로 이 폴더에 남긴다. */
const screenshotDirectory =
  process.env.MYTUBE_EXTRACT_POPUP_SCREENSHOT_DIR ?? process.env.MEDIA_NEST_POPUP_SCREENSHOT_DIR ?? '';

if (!['production', 'dev'].includes(smokeMode)) {
  throw new Error(`Unsupported popup smoke mode: ${smokeMode}`);
}

if (!fs.existsSync(path.join(extensionOutputRoot, 'manifest.json'))) {
  throw new Error(createMissingOutputMessage(smokeMode, extensionOutputRoot));
}

await assertRealApiHealth(realApiBaseUrl);
console.error('[popup-smoke] real API health ok');

if (isDevSmoke) {
  await verifyLoadUnpackedPopup(extensionOutputRoot);
  console.error('[popup-smoke] dev load unpacked popup ok');
  console.log(
    JSON.stringify(
      {
        mode: smokeMode,
        outputRoot: extensionOutputRoot,
        realApiHealth: `${realApiBaseUrl}/health`,
        status: 'ok',
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

/** Browser smoke용 static output server. */
const staticServer = await createStaticServer(extensionOutputRoot);

  try {
    await verifyLoadUnpackedPopup(extensionOutputRoot);
    console.error('[popup-smoke] load unpacked popup ok');
    await verifyStageFromSupportedTabFlow(staticServer.origin);
    console.error('[popup-smoke] stage from supported tab flow ok');
    await verifyPasteFieldFlow(staticServer.origin);
    console.error('[popup-smoke] paste field and invalid address flow ok');

    if (screenshotDirectory) {
      await captureStageScreenshots(staticServer.origin, screenshotDirectory);
      console.error(`[popup-smoke] screenshots saved to ${screenshotDirectory}`);
    }

    /** 서버 실패 flow에서 수집한 fake API 요청. */
    const unavailableFakeApiRequests = await verifyServerUnavailableFlow(staticServer.origin);
  console.error('[popup-smoke] server unavailable flow ok');
  /** 접수 거부 flow에서 수집한 fake API 요청. */
  const rejectedFakeApiRequests = await verifyRejectedRequestFlow(staticServer.origin);
  console.error('[popup-smoke] rejected request flow ok');
  await verifyRestoredProgressAndReducedMotion(staticServer.origin);
  console.error('[popup-smoke] restored progress and reduced motion ok');
  /** 다운로드 flow에서 수집한 fake API 요청. */
  const fakeApiRequests = await verifyDownloadFlow(staticServer.origin);
  console.error('[popup-smoke] download flow ok');
  /** 최근 요청 flow에서 수집한 fake API 요청. */
  const recentFakeApiRequests = await verifyRecentRequestsFlow(staticServer.origin);
  console.error('[popup-smoke] recent requests flow ok');
  await verifySettingsFlow(staticServer.origin);
  console.error('[popup-smoke] settings theme and overlay permission flow ok');

  console.log(
    JSON.stringify(
      {
        realApiHealth: `${realApiBaseUrl}/health`,
        mode: smokeMode,
        outputRoot: extensionOutputRoot,
        fakeApiRequests,
        recentFakeApiRequests,
        rejectedFakeApiRequests,
        unavailableFakeApiRequests,
        status: 'ok',
      },
      null,
      2,
    ),
  );
} finally {
  await staticServer.close();
}

/** 실제 MyTube Extract API health endpoint를 확인한다. */
async function assertRealApiHealth(apiBaseUrl) {
  /** health check abort controller. */
  const abortController = new AbortController();
  /** health check timeout. */
  const timeout = setTimeout(() => abortController.abort(), 5000);

  try {
    /** 실제 API health 응답. */
    const response = await fetch(`${apiBaseUrl}/health`, {
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`MyTube Extract API health responded with ${response.status}`);
    }

    /** 실제 API health payload. */
    const payload = await response.json();

    if (payload?.ok !== true) {
      throw new Error('MyTube Extract API health payload did not contain ok=true');
    }
  } finally {
    clearTimeout(timeout);
  }
}

/** WXT build output을 load unpacked로 올린 실제 extension popup 렌더링을 확인한다. */
async function verifyLoadUnpackedPopup(outputRoot) {
  /** Chromium user data dir. */
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mytube-extract-extension-'));

  await launchAndCloseExtensionContext(userDataDir, outputRoot);

  /** load unpacked extension ID. */
  const extensionId = await readLoadedExtensionId(userDataDir, outputRoot);
  /** Chromium persistent context. */
  const context = await launchExtensionContext(userDataDir, outputRoot);

  try {
    /** 실제 extension popup page. */
    const popupPage = await context.newPage();

    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`, {
      timeout: 10000,
      waitUntil: 'domcontentloaded',
    });
    await popupPage.getByRole('img', { name: 'MyTube Extract' }).waitFor({ timeout: 10000 });
    // 확장 페이지 자체가 활성 탭이므로 YouTube 영상이 아니고, 무대 자리에 붙여넣기 칸이 나온다.
    await popupPage.getByLabel('YouTube 주소').waitFor({ timeout: 10000 });
  } finally {
    await closeBrowserContext(context);
  }
}

/** Extension context를 열었다가 닫아 Chrome profile에 extension settings를 flush한다. */
async function launchAndCloseExtensionContext(userDataDir, outputRoot) {
  /** Chromium persistent context. */
  const context = await launchExtensionContext(userDataDir, outputRoot);

  await new Promise((resolve) => setTimeout(resolve, 1000));
  await closeBrowserContext(context);
}

/** Extension이 load unpacked된 Chromium context를 연다. */
function launchExtensionContext(userDataDir, outputRoot) {
  return chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${outputRoot}`,
      `--load-extension=${outputRoot}`,
    ],
    ignoreDefaultArgs: ['--disable-extensions'],
  });
}

/** 지원 YouTube 탭에서 열면 그 영상이 무대에 바로 올라오는지 확인한다. */
async function verifyStageFromSupportedTabFlow(origin) {
  /** Browser instance. */
  const browser = await chromium.launch();

  try {
    /** 썸네일을 불러오는 page. */
    const page = await browser.newPage({ viewport: { width: 360, height: 600 } });

    await routeYoutubeThumbnails(page, { available: true });
    await installFakeChromeApi(page, {
      currentTabTitle: '(2) 브라우저 스모크 영상 - YouTube',
      currentTabUrl: 'https://youtu.be/abc123_DEF0',
      storedOptions: {},
    });
    await page.goto(`${origin}/popup.html`, { timeout: 10000, waitUntil: 'domcontentloaded' });

    await page.locator('figure.stage[data-thumbnail="image"]').waitFor({ timeout: 10000 });
    await page.getByText('브라우저 스모크 영상', { exact: true }).waitFor({ timeout: 10000 });
    await expectDownloadButtonDisabled(page, false);
    await expectNoHorizontalOverflow(page);

    /** 무대 썸네일이 실제로 그려졌는지 여부. */
    const thumbnailLoaded = await page
      .locator('.stage__image')
      .evaluate((image) => image.complete && image.naturalWidth > 0);

    if (!thumbnailLoaded) {
      throw new Error('Expected the stage thumbnail image to load.');
    }

    if ((await page.getByLabel('YouTube 주소').count()) !== 0) {
      throw new Error('Expected no paste field while a tab video is on the stage.');
    }

    // 최근 요청이 없으면 무대 아래 줄을 숨긴다.
    if ((await page.locator('.recent-strip').count()) !== 0) {
      throw new Error('Expected no recent request strip without recent requests.');
    }

    // 무대에 영상이 있어도 입력칸 밖에서 붙여넣으면 원본을 바꾼다.
    await dispatchDocumentPaste(page, 'https://vimeo.com/76979871');
    await page.getByLabel('YouTube 주소').waitFor({ timeout: 10000 });
    await expectDownloadButtonDisabled(page, true);

    await page.close();

    /** 썸네일 로드에 실패하는 page. */
    const fallbackPage = await browser.newPage({ viewport: { width: 360, height: 600 } });

    await routeYoutubeThumbnails(fallbackPage, { available: false });
    await installFakeChromeApi(fallbackPage, {
      currentTabTitle: 'YouTube',
      currentTabUrl: 'https://www.youtube.com/shorts/abc123_DEF0',
      storedOptions: {},
    });
    await fallbackPage.goto(`${origin}/popup.html`, { timeout: 10000, waitUntil: 'domcontentloaded' });

    await fallbackPage.locator('figure.stage[data-thumbnail="fallback"]').waitFor({ timeout: 10000 });
    // 탭 제목에서 영상 제목을 얻지 못하면 영상 ID를 보여준다.
    await fallbackPage.getByText('abc123_DEF0', { exact: true }).waitFor({ timeout: 10000 });
    await expectDownloadButtonDisabled(fallbackPage, false);
  } finally {
    await browser.close();
  }
}

/** YouTube가 아닌 탭에서 붙여넣기 칸·잘못된 주소 칸·지우기·유효한 주소 입력을 확인한다. */
async function verifyPasteFieldFlow(origin) {
  /** Browser instance. */
  const browser = await chromium.launch();
  /** Browser page. */
  const page = await browser.newPage({ viewport: { width: 360, height: 600 } });

  try {
    await routeYoutubeThumbnails(page, { available: true });
    await installFakeChromeApi(page, {
      currentTabTitle: '예시 페이지',
      currentTabUrl: 'https://example.com/',
      storedOptions: {},
    });
    await page.goto(`${origin}/popup.html`, { timeout: 10000, waitUntil: 'domcontentloaded' });

    /** 붙여넣기 칸의 주소 입력. */
    const sourceInput = page.getByLabel('YouTube 주소');

    await sourceInput.waitFor({ timeout: 10000 });
    await expectDownloadButtonDisabled(page, true);
    await expectPasteKeycaps(page, true);

    await sourceInput.fill('https://vimeo.com/76979871');
    await expectPasteKeycaps(page, false);
    await expectStatusText(page, '유튜브 영상 주소가 아니에요');
    await expectDownloadButtonDisabled(page, true);
    await expectNoHorizontalOverflow(page);

    if ((await sourceInput.getAttribute('aria-invalid')) !== 'true') {
      throw new Error('Expected the paste field to be marked invalid.');
    }

    await page.getByRole('button', { name: '주소 지우기' }).click();

    if ((await sourceInput.inputValue()) !== '' || (await sourceInput.getAttribute('aria-invalid')) !== null) {
      throw new Error('Expected the clear button to empty the paste field.');
    }

    /** 지우기 뒤 포커스가 붙여넣기 칸에 있는지 여부. */
    const sourceInputFocused = await sourceInput.evaluate((input) => document.activeElement === input);

    if (!sourceInputFocused) {
      throw new Error('Expected focus to return to the paste field after clearing.');
    }

    // 키보드 타이핑으로도 원본을 지정할 수 있어야 한다.
    await page.keyboard.type('https://youtu.be/xyz789_GHI1');
    await page.locator('figure.stage').waitFor({ timeout: 10000 });
    await page.getByText('xyz789_GHI1', { exact: true }).waitFor({ timeout: 10000 });
    await expectDownloadButtonDisabled(page, false);
  } finally {
    await browser.close();
  }
}

/** 상태별 Popup을 라이트·다크 360px 폭으로 캡처한다. */
async function captureStageScreenshots(origin, outputDirectory) {
  fs.mkdirSync(outputDirectory, { recursive: true });

  /** Browser instance. */
  const browser = await chromium.launch();

  try {
    for (const theme of ['light', 'dark']) {
      for (const state of ['stage', 'paste', 'invalid']) {
        /** 캡처할 page. */
        const page = await browser.newPage({ viewport: { width: 360, height: 600 } });

        await routeYoutubeThumbnails(page, { available: true });
        await page.addInitScript((selectedTheme) => {
          window.localStorage.setItem('mytube-extract-popup-theme-preference', selectedTheme);
        }, theme);
        await installFakeChromeApi(page, {
          currentTabTitle: '라이브 세트 풀버전 · 서울 공연에서 아주 길게 붙인 제목 - YouTube',
          currentTabUrl: state === 'stage' ? 'https://www.youtube.com/watch?v=abc123_DEF0' : 'https://example.com/',
          storedOptions: { mode: 'video', resolution: '720' },
        });
        await page.goto(`${origin}/popup.html`, { timeout: 10000, waitUntil: 'domcontentloaded' });

        if (state === 'stage') {
          await page.locator('figure.stage[data-thumbnail="image"]').waitFor({ timeout: 10000 });
        } else {
          await page.getByLabel('YouTube 주소').waitFor({ timeout: 10000 });
        }

        if (state === 'invalid') {
          await page.getByLabel('YouTube 주소').fill('https://vimeo.com/76979871/very/long/path/that/keeps/going');
          await expectStatusText(page, '유튜브 영상 주소가 아니에요');
          await page.locator('body').click({ position: { x: 1, y: 1 } });
        }

        await expectNoHorizontalOverflow(page);
        await page.screenshot({ fullPage: true, path: path.join(outputDirectory, `popup-${state}-${theme}.png`) });
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
}

/** Built popup에서 API health 실패 상태를 확인한다. */
async function verifyServerUnavailableFlow(origin) {
  /** Browser instance. */
  const browser = await chromium.launch();
  /** Browser page. */
  const page = await browser.newPage({ viewport: { width: 360, height: 600 } });
  /** Fake API 요청 목록. */
  const requests = [];

  try {
    await routeMyTubeExtractApi(page, {
      requests,
      healthOk: false,
    });
    await routeYoutubeThumbnails(page, { available: true });
    await installFakeChromeApi(page, {
      storedOptions: {
        mode: 'audio',
      },
    });
    await page.goto(`${origin}/popup.html`, { timeout: 10000, waitUntil: 'domcontentloaded' });

    await page.locator('figure.stage').waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: '추출 시작' }).click();
    // 서버 연결 실패는 구름 아이콘 덮개와 고정 문장으로 일반 실패와 구분된다.
    await page.locator('figure.stage [data-veil="unreachable"]').waitFor({ timeout: 10000 });
    await expectAlertText(page, '서버에 연결할 수 없어요');
    // 같은 자리의 추출 버튼이 같은 조건 재시도로 바뀐다.
    await page.getByRole('button', { name: '다시 시도' }).waitFor({ timeout: 10000 });
    await saveScreenshot(page, 'popup-unreachable-light.png');
    await page.getByRole('button', { name: '다시 시도' }).click();
    await waitForRequestCount(requests, 'GET /health', 2);
    await page.locator('figure.stage [data-veil="unreachable"]').waitFor({ timeout: 10000 });

    /** Fake Chrome downloads API가 요청한 URL. */
    const downloadUrl = await page.evaluate(() => globalThis.__myTubeExtractDownloadUrl);

    if (downloadUrl !== null) {
      throw new Error(`Expected no download URL, got ${downloadUrl}`);
    }

    return requests;
  } finally {
    await browser.close();
  }
}

/** Built popup에서 job 기반 supported page 다운로드 시작 흐름을 확인한다. */
async function verifyDownloadFlow(origin) {
  /** Browser instance. */
  const browser = await chromium.launch();
  /** Browser page. */
  const page = await browser.newPage({ viewport: { width: 360, height: 600 } });
  /** Fake API 요청 목록. */
  const requests = [];
  /** Fake API가 받은 요청 본문 목록. */
  const requestBodies = [];

  try {
    await routeMyTubeExtractApi(page, {
      healthDelayMs: 800,
      requestBodies,
      requests,
      healthOk: true,
    });
    await routeYoutubeThumbnails(page, { available: true });
    await installFakeChromeApi(page, {
      currentTabTitle: '브라우저 스모크 영상 - YouTube',
      storedOptions: {
        mode: 'audio',
      },
    });
    await page.goto(`${origin}/popup.html`, { timeout: 10000, waitUntil: 'domcontentloaded' });

    await page.locator('figure.stage').waitFor({ timeout: 10000 });
    await page.getByRole('radio', { name: '192 kbps' }).waitFor({ timeout: 10000 });
    // 형식 아이콘을 바꾸면 품질 막대가 해상도 값으로 바뀐다.
    await page.getByRole('radio', { name: '비디오 MP4' }).check();
    await page.getByRole('radio', { name: '1080p' }).check();
    await expectRadioChecked(page, '비디오 MP4');
    await expectRadioChecked(page, '1080p');

    /** 형식·품질 선택 뒤 저장된 옵션. */
    const storedOptions = await page.evaluate(() => globalThis.__myTubeExtractStoredOptions);

    if (storedOptions.mode !== 'video' || storedOptions.resolution !== '1080' || 'sourceUrl' in storedOptions || 'filename' in storedOptions) {
      throw new Error(`Unexpected stored options: ${JSON.stringify(storedOptions)}`);
    }

    await editFilenameWithKeyboard(page);

    await expectDownloadButtonDisabled(page, false);
    await expectDownloadButtonVisibleInViewport(page);
    // 파일명 확정 뒤에도 키보드만으로 추출 버튼까지 이어 간다.
    await page.getByRole('button', { name: '추출 시작' }).focus();
    await page.keyboard.press('Enter');
    // 서버 확인 동안은 회전 링 덮개, 회색 회전 버튼, 잠긴 형식·품질을 보여준다.
    await page.locator('figure.stage [data-veil="checking"]').waitFor({ timeout: 10000 });
    // 진행 중에는 파일명을 고칠 수 없다.
    if ((await page.getByRole('button', { name: '파일명 바꾸기' }).count()) !== 0) {
      throw new Error('Expected the filename edit button to be hidden while the request is in progress.');
    }

    await page.getByRole('button', { name: '서버 확인 중' }).waitFor({ timeout: 10000 });
    await expectLiveText(page, '서버 확인 중');
    await expectRadiosDisabled(page, true);
    await saveScreenshot(page, 'popup-checking-light.png');
    // 완료는 초록 체크 덮개를 잠깐 보여 준 뒤 준비 상태로 돌아간다.
    await page.locator('figure.stage [data-veil="done"]').waitFor({ timeout: 10000 });
    await expectLiveText(page, '다운로드를 시작했어요');
    await saveScreenshot(page, 'popup-done-light.png');
    await page.locator('figure.stage [data-veil]').waitFor({ state: 'detached', timeout: 5000 });
    await expectDownloadButtonDisabled(page, false);
    await expectRadiosDisabled(page, false);
    // 완료된 요청이 무대 아래 최근 요청 줄에 완료 배지로 올라온다.
    await page.getByRole('button', { name: 'abc123_DEF0, 완료' }).waitFor({ timeout: 10000 });

    /** 최근 요청 줄의 썸네일 수. */
    const recentJobCount = await page.locator('.recent-strip__item').count();

    if (recentJobCount !== 1) {
      throw new Error(`Expected one recent job, got ${recentJobCount}`);
    }

    /** Fake Chrome downloads API가 요청한 URL. */
    const downloadUrl = await page.evaluate(() => globalThis.__myTubeExtractDownloadUrl);
    /** Fake Chrome downloads API가 요청한 filename. */
    const downloadFilename = await page.evaluate(() => globalThis.__myTubeExtractDownloadFilename);

    if (downloadUrl !== `${expectedApiOrigin}/downloads/job-1/file`) {
      throw new Error(`Unexpected download URL: ${downloadUrl}`);
    }

    // 편집한 파일명이 정리되어 형식 확장자와 함께 로컬 저장 이름이 된다.
    if (downloadFilename !== '내 스모크 클립.mp4') {
      throw new Error(`Unexpected download filename: ${downloadFilename}`);
    }

    /** 파일명 편집 뒤 저장소에 남은 옵션. 파일명은 영상별 값이라 저장하지 않는다. */
    const storedOptionsAfterSubmit = await page.evaluate(() => globalThis.__myTubeExtractStoredOptions);

    if ('filename' in storedOptionsAfterSubmit) {
      throw new Error(`Expected the filename not to be stored: ${JSON.stringify(storedOptionsAfterSubmit)}`);
    }

    /** 가짜 API가 받은 job 생성 요청 본문. */
    const createdJobBody = requestBodies.find((body) => body.path === '/downloads');

    if (
      createdJobBody?.body.type !== 'video' ||
      createdJobBody.body.quality !== '1080' ||
      createdJobBody.body.url !== 'https://www.youtube.com/watch?v=abc123_DEF0'
    ) {
      throw new Error(`Unexpected job create body: ${JSON.stringify(createdJobBody)}`);
    }

    // 더보기로 recent 화면을 열어 완료 요청을 다시 내려받는다.
    await page.evaluate(() => {
      globalThis.__myTubeExtractDownloadUrl = null;
      globalThis.__myTubeExtractDownloadFilename = null;
    });
    await page.getByRole('button', { name: '최근 요청 모두 보기' }).click();
    await page.getByRole('heading', { name: '최근 요청' }).waitFor({ timeout: 10000 });
    await expectFocused(page, page.getByRole('button', { name: '뒤로' }), 'the back button after opening the recent view');
    await page.getByRole('button', { name: '다시 내려받기' }).click();
    await page.waitForFunction(() => globalThis.__myTubeExtractDownloadUrl !== null, null, { timeout: 10000 });
    await expectLiveText(page, '다운로드를 다시 시작했어요');

    /** 다시 내려받기가 요청한 URL과 파일명. 제목을 모르는 job이라 영상 ID 기반 기본 이름이다. */
    const redownload = await page.evaluate(() => ({ filename: globalThis.__myTubeExtractDownloadFilename, url: globalThis.__myTubeExtractDownloadUrl }));

    if (redownload.url !== `${expectedApiOrigin}/downloads/job-1/file` || redownload.filename !== 'abc123_DEF0.mp4') {
      throw new Error(`Unexpected redownload: ${JSON.stringify(redownload)}`);
    }

    if (requestBodies.filter((body) => body.path === '/downloads').length !== 1) {
      throw new Error('Expected the redownload not to create a new job.');
    }

    // 뒤로 버튼으로 무대 화면에 돌아오고, 포커스는 더보기 버튼으로 돌아온다.
    await page.getByRole('button', { name: '뒤로' }).click();
    await page.locator('figure.stage').waitFor({ timeout: 10000 });
    await expectFocused(page, page.getByRole('button', { name: '최근 요청 모두 보기' }), 'the more button after returning to the stage');

    return requests;
  } finally {
    await browser.close();
  }
}

/** 연필 → 입력 → Enter 확정을 키보드로만 진행한다. 빈 값 확정은 제목 기반 기본 이름으로 돌아간다. */
async function editFilenameWithKeyboard(page) {
  /** 제목 줄의 연필 버튼. */
  const editButton = page.getByRole('button', { name: '파일명 바꾸기' });
  /** 편집 중 파일명 입력칸. */
  const filenameInput = page.getByRole('textbox', { name: '파일명' });

  await editButton.focus();
  await page.keyboard.press('Enter');
  await filenameInput.waitFor({ timeout: 10000 });

  if ((await filenameInput.inputValue()) !== '브라우저 스모크 영상') {
    throw new Error(`Expected the edit to start from the default name, got ${await filenameInput.inputValue()}`);
  }

  // 입력칸 옆에 지금 형식의 확장자가 보인다.
  await page.getByText('.mp4', { exact: true }).waitFor({ timeout: 10000 });
  await expectNoHorizontalOverflow(page);
  await saveScreenshot(page, 'popup-filename-editing-light.png');

  // 비우고 확정하면 기본 이름으로 돌아간다.
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Enter');
  await editButton.waitFor({ timeout: 10000 });
  await page.getByText('브라우저 스모크 영상', { exact: true }).waitFor({ timeout: 10000 });

  if (!(await editButton.evaluate((button) => button === document.activeElement))) {
    throw new Error('Expected focus to return to the filename edit button after committing.');
  }

  // 다시 열어 새 이름을 입력하고 Enter로 확정한다. 경로 구분자는 정리된다.
  await page.keyboard.press('Enter');
  await filenameInput.waitFor({ timeout: 10000 });
  await page.keyboard.type('내/스모크 클립');
  await page.keyboard.press('Enter');
  await page.getByText('내 스모크 클립', { exact: true }).waitFor({ timeout: 10000 });

  if ((await page.locator('.recent-strip').count()) !== 0) {
    throw new Error('Expected Enter in the filename input to confirm the name, not submit the request.');
  }
}

/** Built popup에서 서버가 접수를 거부한 실패 덮개와 같은 조건 재시도를 확인한다. */
async function verifyRejectedRequestFlow(origin) {
  /** Browser instance. */
  const browser = await chromium.launch();
  /** Browser page. */
  const page = await browser.newPage({ viewport: { width: 360, height: 600 } });
  /** Fake API 요청 목록. */
  const requests = [];
  /** Fake API가 받은 요청 본문 목록. */
  const requestBodies = [];

  try {
    await routeMyTubeExtractApi(page, {
      createRejectMessage: '지원하지 않는 영상이에요.',
      healthOk: true,
      requestBodies,
      requests,
    });
    await routeYoutubeThumbnails(page, { available: true });
    await installFakeChromeApi(page, {
      currentTabTitle: '거부되는 영상 - YouTube',
      storedOptions: { mode: 'video', resolution: '720' },
    });
    await page.goto(`${origin}/popup.html`, { timeout: 10000, waitUntil: 'domcontentloaded' });

    await page.locator('figure.stage').waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: '추출 시작' }).click();
    // 접수 거부는 어두운 덮개 위 경고 아이콘과 서버가 준 이유 한 줄이다.
    await page.locator('figure.stage [data-veil="failed"]').waitFor({ timeout: 10000 });
    await expectAlertText(page, '지원하지 않는 영상이에요.');
    await page.getByRole('button', { name: '다시 시도' }).waitFor({ timeout: 10000 });
    await expectRadiosDisabled(page, false);
    await saveScreenshot(page, 'popup-failed-light.png');
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await saveScreenshot(page, 'popup-failed-dark.png');

    await page.getByRole('button', { name: '다시 시도' }).click();
    await waitForRequestCount(requests, 'POST /downloads', 2);
    await page.locator('figure.stage [data-veil="failed"]').waitFor({ timeout: 10000 });

    /** 두 번의 job 생성 요청 본문. */
    const createBodies = requestBodies.filter((item) => item.path === '/downloads').map((item) => JSON.stringify(item.body));

    if (createBodies.length !== 2 || createBodies[0] !== createBodies[1] || !createBodies[0].includes('"quality":"720"')) {
      throw new Error(`Expected the retry to resend the same request, got ${JSON.stringify(createBodies)}`);
    }

    return requests;
  } finally {
    await browser.close();
  }
}

/** 다시 연 Popup이 같은 영상의 진행 단계를 복원하고, 줄어든 동작 설정에서 회전을 멈추는지 확인한다. */
async function verifyRestoredProgressAndReducedMotion(origin) {
  /** Browser instance. */
  const browser = await chromium.launch();

  try {
    for (const status of ['queued', 'processing']) {
      for (const reducedMotion of ['no-preference', 'reduce']) {
        /** 상태를 복원할 page. */
        const page = await browser.newPage({ reducedMotion, viewport: { width: 360, height: 600 } });

        await routeYoutubeThumbnails(page, { available: true });
        await installFakeChromeApi(page, {
          currentTabTitle: '진행 중인 영상 - YouTube',
          storedOptions: {
            mode: 'audio',
            recentDownloadJobs: [
              {
                createdAt: new Date().toISOString(),
                displayStatus: status,
                downloadUrl: null,
                errorCode: null,
                jobId: `job-${status}`,
                message: '진행 중입니다.',
                progress: status === 'queued' ? 0 : 50,
                quality: '192',
                retentionDays: 7,
                sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
                status,
                title: null,
                type: 'audio',
              },
            ],
          },
        });
        await page.goto(`${origin}/popup.html`, { timeout: 10000, waitUntil: 'domcontentloaded' });

        await page.locator(`figure.stage [data-veil="${status}"]`).waitFor({ timeout: 10000 });
        await page.getByRole('button', { exact: true, name: status === 'queued' ? '대기 중' : '처리 중' }).waitFor({ timeout: 10000 });
        await expectLiveText(page, status === 'queued' ? '대기 중' : '처리 중');
        await expectDownloadButtonState(page, status === 'queued' ? '대기 중' : '처리 중', true);
        await expectRadiosDisabled(page, true);

        /** 회전 링·버튼 아이콘·덮개의 애니메이션 이름. */
        const animations = await page.evaluate(() =>
          ['.stage-ring', '.extract-button .is-spinning', '.stage-veil'].map(
            (selector) => getComputedStyle(document.querySelector(selector)).animationName,
          ),
        );
        /** 줄어든 동작 설정에서 모든 애니메이션이 꺼졌는지 여부. */
        const allStopped = animations.every((name) => name === 'none');
        /** 기본 설정에서 모든 애니메이션이 살아 있는지 여부. */
        const allRunning = animations.every((name) => name !== 'none');

        if (reducedMotion === 'reduce' ? !allStopped : !allRunning) {
          throw new Error(`Unexpected animations for ${status}/${reducedMotion}: ${JSON.stringify(animations)}`);
        }

        if (reducedMotion === 'no-preference') {
          await saveScreenshot(page, `popup-${status}-light.png`);
          await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
          await saveScreenshot(page, `popup-${status}-dark.png`);
        }

        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
}

/** 저장된 여러 상태의 최근 요청으로 무대 아래 줄의 배지, recent 화면의 항목별 행동, 다시 시도 재제출, 빈 상태를 확인한다. */
async function verifyRecentRequestsFlow(origin) {
  /** Browser instance. */
  const browser = await chromium.launch();
  /** Fake API 요청 목록. */
  const requests = [];
  /** Fake API가 받은 요청 본문 목록. */
  const requestBodies = [];
  /** 생성 시각 기준. 최신순 정렬이 고정되도록 1분씩 앞당긴다. */
  const now = Date.now();

  /** 저장해 둘 최근 job을 만든다. */
  function createStoredJob(index, overrides) {
    return {
      createdAt: new Date(now - index * 60_000).toISOString(),
      displayStatus: overrides.status,
      downloadUrl: null,
      errorCode: null,
      message: '',
      progress: null,
      quality: '192',
      retentionDays: 7,
      sourceUrl: null,
      title: null,
      type: 'audio',
      ...overrides,
    };
  }

  try {
    /** 최근 요청이 있는 page. */
    const page = await browser.newPage({ viewport: { width: 360, height: 640 } });

    await routeMyTubeExtractApi(page, { requestBodies, requests, healthOk: true });
    await routeYoutubeThumbnails(page, { available: true });
    await installFakeChromeApi(page, {
      currentTabTitle: '무대 영상 - YouTube',
      storedOptions: {
        mode: 'audio',
        recentDownloadJobs: [
          createStoredJob(0, { jobId: 'job-processing', sourceUrl: 'https://www.youtube.com/watch?v=procVID0001', status: 'processing', title: '처리 중인 라이브' }),
          createStoredJob(1, { errorCode: 'EXTRACTION_FAILED', jobId: 'job-failed', message: '추출하지 못했어요.', quality: '720', sourceUrl: 'https://www.youtube.com/watch?v=failVID0001', status: 'failed', title: '실패한/뮤직비디오', type: 'video' }),
          createStoredJob(2, { displayStatus: 'expired', downloadUrl: null, jobId: 'job-expired', sourceUrl: 'https://youtu.be/explVID0001', status: 'completed', title: '만료된 강의' }),
          // 원본 주소·제목 필드가 생기기 전에 저장된 예전 완료 job.
          createStoredJob(3, { downloadUrl: `${expectedApiOrigin}/downloads/job-1/file`, jobId: 'job-legacy', quality: '720', sourceUrl: undefined, status: 'completed', title: undefined, type: 'video' }),
          createStoredJob(4, { jobId: 'job-queued', sourceUrl: 'https://www.youtube.com/watch?v=queuVID0001', status: 'queued', title: '대기 중인 팟캐스트' }),
        ],
      },
    });
    await page.goto(`${origin}/popup.html`, { timeout: 10000, waitUntil: 'domcontentloaded' });

    await page.locator('figure.stage').waitFor({ timeout: 10000 });
    // 무대 아래 줄은 최신 세 개와 더보기 버튼만 보여준다.
    await page.getByRole('button', { name: '처리 중인 라이브, 처리 중' }).waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: '실패한/뮤직비디오, 실패' }).waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: '만료된 강의, 만료됨' }).waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: '최근 요청 모두 보기' }).waitFor({ timeout: 10000 });

    /** 무대 아래 줄의 배지 상태. */
    const stripStates = await page.locator('.recent-strip__thumb').evaluateAll((items) => items.map((item) => item.dataset.state));

    if (JSON.stringify(stripStates) !== JSON.stringify(['processing', 'failed', 'expired'])) {
      throw new Error(`Unexpected recent strip states: ${JSON.stringify(stripStates)}`);
    }

    // 다른 영상의 진행은 무대를 바꾸지 않는다.
    await expectDownloadButtonState(page, '추출 시작', false);
    await saveScreenshot(page, 'popup-recent-strip-light.png');
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await saveScreenshot(page, 'popup-recent-strip-dark.png');
    await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));

    // 썸네일을 눌러도 recent 화면이 열린다.
    await page.getByRole('button', { name: '실패한/뮤직비디오, 실패' }).click();
    await page.getByRole('heading', { name: '최근 요청' }).waitFor({ timeout: 10000 });

    /** recent 화면 항목별 상태명과 행동 이름. */
    const rows = await page.locator('.recent-row').evaluateAll((items) =>
      items.map((item) => ({
        action: item.querySelector('button')?.getAttribute('aria-label') ?? null,
        id: item.dataset.jobId,
        state: item.querySelector('.recent-row__state')?.textContent ?? '',
        thumbnail: item.querySelector('.recent-thumb')?.dataset.thumbnail,
        title: item.querySelector('.recent-row__title')?.textContent ?? '',
      })),
    );
    /** 기대하는 항목. 예전 job은 형식 이름을 제목으로, 중립 배경을 썸네일로 쓴다. */
    const expectedRows = [
      { action: null, id: 'job-processing', state: '처리 중', thumbnail: 'image', title: '처리 중인 라이브' },
      { action: '다시 시도', id: 'job-failed', state: '실패', thumbnail: 'image', title: '실패한/뮤직비디오' },
      { action: '다시 요청', id: 'job-expired', state: '만료됨', thumbnail: 'image', title: '만료된 강의' },
      { action: '다시 내려받기', id: 'job-legacy', state: '완료', thumbnail: 'fallback', title: '비디오 MP4' },
      { action: null, id: 'job-queued', state: '대기 중', thumbnail: 'image', title: '대기 중인 팟캐스트' },
    ];

    if (JSON.stringify(rows) !== JSON.stringify(expectedRows)) {
      throw new Error(`Unexpected recent rows: ${JSON.stringify(rows)}`);
    }

    await expectNoHorizontalOverflow(page);
    await saveScreenshot(page, 'popup-recent-light.png');
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await saveScreenshot(page, 'popup-recent-dark.png');
    await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));

    // 실패 항목의 다시 시도는 job의 원본·형식·품질로 새 job을 만들고, 파일명은 기본 이름을 쓴다.
    await page.locator('[data-job-id="job-failed"]').getByRole('button', { name: '다시 시도' }).click();
    await waitForRequestCount(requests, 'POST /downloads', 1);
    await page.waitForFunction(() => globalThis.__myTubeExtractDownloadFilename !== null, null, { timeout: 10000 });
    await expectLiveText(page, '다시 요청했어요');

    /** 다시 시도로 만든 job 생성 요청 본문. */
    const retryBody = requestBodies.find((body) => body.path === '/downloads')?.body;
    /** 다시 시도한 job이 완료되어 저장된 파일명. */
    const retryFilename = await page.evaluate(() => globalThis.__myTubeExtractDownloadFilename);

    if (retryBody?.type !== 'video' || retryBody.quality !== '720' || retryBody.url !== 'https://www.youtube.com/watch?v=failVID0001' || retryFilename !== '실패한 뮤직비디오.mp4') {
      throw new Error(`Unexpected retry: ${JSON.stringify({ retryBody, retryFilename })}`);
    }

    // 새 job이 목록 맨 위에 생긴다.
    await page.locator('.recent-row').first().and(page.locator('[data-job-id="job-1"]')).waitFor({ timeout: 10000 });
    await page.getByRole('button', { name: '뒤로' }).click();
    await page.locator('figure.stage').waitFor({ timeout: 10000 });
    await page.close();

    /** 최근 요청이 없는 page. 무대 아래 줄을 숨긴다. */
    const emptyPage = await browser.newPage({ viewport: { width: 360, height: 600 } });

    await routeYoutubeThumbnails(emptyPage, { available: true });
    await installFakeChromeApi(emptyPage, { currentTabTitle: '무대 영상 - YouTube', storedOptions: {} });
    await emptyPage.goto(`${origin}/popup.html`, { timeout: 10000, waitUntil: 'domcontentloaded' });
    await emptyPage.locator('figure.stage').waitFor({ timeout: 10000 });
    await emptyPage.getByRole('button', { name: '추출 시작' }).waitFor({ timeout: 10000 });

    if ((await emptyPage.locator('.recent-strip').count()) !== 0) {
      throw new Error('Expected no recent request strip without recent requests.');
    }

    return requests;
  } finally {
    await browser.close();
  }
}

/** 설정 화면의 테마 세 칸과 썸네일 버튼 권한 켜기·끄기·거부 흐름, 헤더 점을 확인한다. */
async function verifySettingsFlow(origin) {
  /** Browser instance. context는 시스템 테마가 다크로 풀리는지 보려고 OS 색 구성을 다크로 둔다. */
  const browser = await chromium.launch();

  try {
    /** 테마 저장소를 다시 연 Popup과 공유하는 context. */
    const context = await browser.newContext({ colorScheme: 'dark', viewport: { width: 360, height: 600 } });
    /** 권한을 아직 켜지 않은 page. */
    const page = await context.newPage();

    await routeYoutubeThumbnails(page, { available: true });
    await installFakeChromeApi(page, {
      currentTabTitle: '무대 영상 - YouTube',
      holdPermissionRequest: true,
      storedOptions: {},
    });
    await page.goto(`${origin}/popup.html`, { timeout: 10000, waitUntil: 'domcontentloaded' });

    // 아직 켜지 않았으면 격자 아이콘에 빨간 점이 붙는다.
    /** 격자 아이콘. */
    const offButton = page.getByRole('button', { name: '썸네일 버튼 켜기' });

    await offButton.waitFor({ timeout: 10000 });
    await expectOverlayDot(page, 'off');
    await offButton.click();
    await page.getByRole('heading', { name: '설정' }).waitFor({ timeout: 10000 });
    await expectFocused(page, page.getByRole('button', { name: '뒤로' }), 'settings back button');
    await page.getByText('저작권과 플랫폼 정책을 지켜 사용하세요.').waitFor({ timeout: 10000 });
    await page.getByText('완료 파일은 7일 뒤 만료돼요.').waitFor({ timeout: 10000 });

    // 테마 세 칸: 고른 칸만 눌림 상태이고, 기존 저장 키에 남으며, 시스템은 OS 색 구성을 따른다.
    // 처음에는 저장값 없이 시스템 테마가 기본 선택이다.
    await expectThemeChoice(page, '시스템 테마', null, 'dark');
    await page.getByRole('button', { name: '라이트 테마' }).click();
    await expectThemeChoice(page, '라이트 테마', 'light', 'light');
    await saveScreenshot(page, 'popup-settings-off-light.png');
    await page.getByRole('button', { name: '다크 테마' }).click();
    await expectThemeChoice(page, '다크 테마', 'dark', 'dark');
    await page.getByRole('button', { name: '시스템 테마' }).click();
    await expectThemeChoice(page, '시스템 테마', 'system', 'dark');
    await page.getByRole('button', { name: '라이트 테마' }).click();
    await expectNoHorizontalOverflow(page);

    // 스위치를 켜면 Chrome 권한 창이 뜨고, 답할 때까지 스위치 자리에 회전 아이콘이 보인다.
    /** 썸네일 버튼 스위치. */
    const overlaySwitch = page.getByRole('switch', { name: '썸네일 버튼' });

    await expectSwitchChecked(overlaySwitch, false);
    await overlaySwitch.click();
    await page.getByRole('img', { name: '권한 요청 중' }).waitFor({ timeout: 10000 });
    await saveScreenshot(page, 'popup-settings-requesting-light.png');
    await page.evaluate(() => globalThis.__myTubeExtractAnswerPermissionRequest(true));
    await expectSwitchChecked(overlaySwitch, true);

    if ((await page.evaluate(() => globalThis.__myTubeExtractOverlayEnableCount ?? 0)) !== 1) {
      throw new Error('Expected the popup to ask Background to enable the overlay once.');
    }

    await saveScreenshot(page, 'popup-settings-on-light.png');
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await saveScreenshot(page, 'popup-settings-on-dark.png');
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

    // 뒤로 가면 무대로 돌아오고, 격자 아이콘이 초록 점과 켜짐 이름을 갖고 포커스를 돌려받는다.
    await page.getByRole('button', { name: '뒤로' }).click();
    await page.locator('figure.stage').waitFor({ timeout: 10000 });
    await expectFocused(page, page.getByRole('button', { name: '썸네일 버튼 켜짐' }), 'thumbnail button header icon');
    await expectOverlayDot(page, 'on');
    await saveScreenshot(page, 'popup-header-on-light.png');

    // 설정 아이콘으로도 같은 화면이 열린다. 스위치를 끄면 YouTube 권한을 해제한다.
    await page.getByRole('button', { name: '설정', exact: true }).click();
    await page.getByRole('heading', { name: '설정' }).waitFor({ timeout: 10000 });
    await overlaySwitch.click();
    await expectSwitchChecked(overlaySwitch, false);

    /** 권한 해제 결과. */
    const removal = await page.evaluate(() => ({
      count: globalThis.__myTubeExtractYoutubePermissionRemoveCount ?? 0,
      granted: globalThis.__myTubeExtractYoutubePermissionGranted,
    }));

    if (removal.count !== 1 || removal.granted !== false) {
      throw new Error(`Expected the switch to remove the YouTube permission: ${JSON.stringify(removal)}`);
    }

    await page.getByRole('button', { name: '뒤로' }).click();
    await expectFocused(page, page.getByRole('button', { name: '설정', exact: true }), 'settings header icon');
    await expectOverlayDot(page, 'off');

    // 권한 창에서 거부하면 crimson 행과 이유 한 줄, 권한 다시 요청 버튼이 보이고 헤더 점이 crimson이 된다.
    await page.getByRole('button', { name: '설정', exact: true }).click();
    await overlaySwitch.click();
    await page.evaluate(() => globalThis.__myTubeExtractAnswerPermissionRequest(false));
    await expectAlertText(page, '권한이 거부되어 표시하지 않아요');
    await page.getByRole('button', { name: '권한 다시 요청' }).waitFor({ timeout: 10000 });
    await expectNoHorizontalOverflow(page);
    await saveScreenshot(page, 'popup-settings-denied-light.png');
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    await saveScreenshot(page, 'popup-settings-denied-dark.png');
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    await page.getByRole('button', { name: '뒤로' }).click();
    await page.getByRole('button', { name: '썸네일 버튼 권한 거부됨' }).waitFor({ timeout: 10000 });
    await expectOverlayDot(page, 'problem');

    // 권한 다시 요청을 허용하면 스위치가 켜진 상태로 돌아온다.
    await page.getByRole('button', { name: '썸네일 버튼 권한 거부됨' }).click();
    await page.getByRole('button', { name: '권한 다시 요청' }).click();
    await page.evaluate(() => globalThis.__myTubeExtractAnswerPermissionRequest(true));
    await expectSwitchChecked(overlaySwitch, true);

    // 이미 켜 둔 사용자는 다시 연 Popup에서 바로 초록 점을 본다. 테마 선택도 유지된다.
    /** 권한이 켜진 채로 다시 연 page. 테마 저장소를 공유하도록 같은 context에서 연다. */
    const reopenedPage = await context.newPage();

    await routeYoutubeThumbnails(reopenedPage, { available: true });
    await installFakeChromeApi(reopenedPage, { storedOptions: {}, youtubePermissionGranted: true });
    await reopenedPage.goto(`${origin}/popup.html`, { timeout: 10000, waitUntil: 'domcontentloaded' });
    await reopenedPage.getByRole('button', { name: '썸네일 버튼 켜짐' }).waitFor({ timeout: 10000 });
    await expectOverlayDot(reopenedPage, 'on');

    if ((await reopenedPage.evaluate(() => document.documentElement.dataset.theme)) !== 'light') {
      throw new Error('Expected the reopened popup to keep the light theme preference.');
    }
  } finally {
    await browser.close();
  }
}

/** 헤더 격자 아이콘의 권한 점 상태를 확인한다. */
async function expectOverlayDot(page, expectedIndicator) {
  await page.waitForFunction(
    (indicator) => document.querySelector(`.popup-header [data-overlay] .overlay-dot--${indicator}`) !== null,
    expectedIndicator,
    { timeout: 10000 },
  );
}

/** 테마 세 칸 중 고른 칸만 눌림 상태이고, 저장 값과 실제 적용 테마가 맞는지 확인한다. */
async function expectThemeChoice(page, pressedName, storedPreference, appliedTheme) {
  await page.getByRole('button', { name: pressedName, pressed: true }).waitFor({ timeout: 10000 });

  /** 눌림 칸 수, 저장 값, 적용 테마. */
  const state = await page.evaluate(() => ({
    applied: document.documentElement.dataset.theme,
    pressedCount: document.querySelectorAll('.theme-segments__option[aria-pressed="true"]').length,
    stored: window.localStorage.getItem('mytube-extract-popup-theme-preference'),
  }));

  if (state.pressedCount !== 1 || state.stored !== storedPreference || state.applied !== appliedTheme) {
    throw new Error(`Unexpected theme state for ${pressedName}: ${JSON.stringify(state)}`);
  }
}

/** 스위치의 켜짐 상태를 확인한다. 권한 요청 중에는 스위치가 회전 아이콘으로 바뀌었다가 다시 그려지므로 locator로 다시 찾는다. */
async function expectSwitchChecked(locator, expectedChecked) {
  /** 기다릴 마감 시각. */
  const deadline = Date.now() + 10000;

  while (Date.now() < deadline) {
    if ((await locator.count()) === 1 && (await locator.getAttribute('aria-checked')) === String(expectedChecked)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(`Expected the switch to be ${expectedChecked ? 'on' : 'off'}.`);
}

/** 지정한 control에 포커스가 있는지 확인한다. */
async function expectFocused(page, locator, description) {
  await locator.waitFor({ timeout: 10000 });

  if (!(await locator.evaluate((element) => element === document.activeElement))) {
    throw new Error(`Expected focus on ${description}.`);
  }
}

/** 빈 붙여넣기 칸의 단축키 키캡이 보이는지 확인한다. 키캡은 장식이라 접근성 트리에서 숨어 있어야 한다. */
async function expectPasteKeycaps(page, expectedVisible) {
  /** 키캡 묶음. */
  const keycaps = page.locator('.paste-field__keys');

  if (!expectedVisible) {
    if ((await keycaps.count()) !== 0) {
      throw new Error('Expected the paste shortcut keycaps to hide once the field has input.');
    }

    return;
  }

  await keycaps.waitFor({ timeout: 10000 });

  /** 키캡에 적힌 키 이름. */
  const keys = await keycaps.locator('kbd').allTextContents();

  if (keys.length !== 2 || keys[1] !== 'V' || !['⌘', 'Ctrl'].includes(keys[0])) {
    throw new Error(`Unexpected paste shortcut keycaps: ${keys.join(' ')}`);
  }

  if ((await keycaps.getAttribute('aria-hidden')) !== 'true') {
    throw new Error('Expected the paste shortcut keycaps to be hidden from assistive technology.');
  }
}

/** 스크린샷 폴더가 지정됐을 때만 현재 Popup을 캡처한다. */
async function saveScreenshot(page, fileName) {
  if (!screenshotDirectory) {
    return;
  }

  fs.mkdirSync(screenshotDirectory, { recursive: true });
  // 덮개 페이드인이 끝난 모습을 남긴다.
  await page.waitForTimeout(400);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({ fullPage: true, path: path.join(screenshotDirectory, fileName) });
}

/** 같은 fake API 요청이 기대 횟수만큼 들어올 때까지 기다린다. */
async function waitForRequestCount(requests, requestLine, expectedCount) {
  /** 기다릴 마감 시각. */
  const deadline = Date.now() + 10000;

  while (requests.filter((line) => line === requestLine).length < expectedCount) {
    if (Date.now() > deadline) {
      throw new Error(`Expected ${expectedCount} x ${requestLine}, got ${JSON.stringify(requests)}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/** 무대 아래 오류 줄(alert)이 기대 문장이 될 때까지 기다린다. */
async function expectAlertText(page, expectedText) {
  await page.locator('.stage-problem[role="alert"]', { hasText: expectedText }).waitFor({ timeout: 10000 });
}

/** 진행 단계 live region 문장이 기대값이 될 때까지 기다린다. */
async function expectLiveText(page, expectedText) {
  await page.locator('p.visually-hidden[role="status"]', { hasText: expectedText }).waitFor({ state: 'attached', timeout: 10000 });
}

/** 형식·품질 radio가 모두 잠겼는지(또는 풀렸는지) 확인한다. */
async function expectRadiosDisabled(page, expectedDisabled) {
  /** radio별 disabled 여부. */
  const states = await page.locator('input[type="radio"]').evaluateAll((inputs) => inputs.map((input) => input.disabled));

  if (states.length === 0 || states.some((disabled) => disabled !== expectedDisabled)) {
    throw new Error(`Expected radios disabled=${expectedDisabled}, got ${JSON.stringify(states)}`);
  }
}

/** 이름이 주어진 추출 버튼의 disabled 상태를 확인한다. */
async function expectDownloadButtonState(page, name, expectedDisabled) {
  /** 버튼 disabled 여부. */
  // 최근 요청 썸네일 이름(`제목, 대기 중`)과 겹치지 않게 이름 전체로 찾는다.
  const disabled = await page.getByRole('button', { exact: true, name }).evaluate((button) => button.disabled);

  if (disabled !== expectedDisabled) {
    throw new Error(`Expected "${name}" button disabled=${expectedDisabled}, got ${disabled}`);
  }
}

/** Production API 요청을 browser smoke 안에서 fake 응답으로 처리한다. */
async function routeMyTubeExtractApi(
  page,
  { createRejectMessage = null, healthDelayMs = 0, requestBodies = [], requests, healthOk },
) {
  await page.route(`${expectedApiOrigin}/**`, async (route) => {
    /** 가로챈 production API 요청. */
    const request = route.request();
    /** 가로챈 production API 요청 URL. */
    const requestUrl = new URL(request.url());

    requests.push(`${request.method()} ${requestUrl.pathname}${requestUrl.search}`);

    if (requestUrl.pathname === '/health') {
      // 서버 확인 단계를 화면에서 붙잡을 수 있게 health 응답을 늦출 수 있다.
      if (healthDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, healthDelayMs));
      }

      await route.fulfill({
        status: healthOk ? 200 : 503,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ok: healthOk }),
      });
      return;
    }

    // 캐시된 asset이 있어 즉시 완료되는 시나리오를 흉내 내, smoke test가 실제 폴링 간격을 기다리지 않게 한다.
    if (request.method() === 'POST' && requestUrl.pathname === '/downloads') {
      /** job 생성 요청 본문. */
      const body = request.postDataJSON();

      requestBodies.push({ body, path: requestUrl.pathname });

      // 서버가 요청을 거부하는 경우는 안내 메시지와 함께 400을 돌려준다.
      if (createRejectMessage) {
        await route.fulfill({
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message: createRejectMessage }),
        });
        return;
      }

      await route.fulfill({
        status: 201,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          createdAt: new Date().toISOString(),
          displayStatus: 'completed',
          downloadUrl: '/downloads/job-1/file',
          errorCode: null,
          jobId: 'job-1',
          message: '추출이 완료되었습니다.',
          progress: 100,
          quality: body.quality,
          retentionDays: 7,
          sourceUrl: body.url,
          status: 'completed',
          title: null,
          type: body.type,
        }),
      });
      return;
    }

    if (requestUrl.pathname === '/downloads/job-1/file') {
      await route.fulfill({
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Disposition': 'attachment; filename="browser-smoke.mp3"',
          'Content-Type': 'audio/mpeg',
        },
        body: 'browser smoke audio',
      });
      return;
    }

    await route.fulfill({
      status: 404,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: 'not found',
    });
  });
}

/** Page에 extension popup용 fake Chrome API를 주입한다. Background 없이 실행되는 bare page이므로
 * download job 제출 메시지도 여기서 Background의 assertServerAvailable → job 생성 → 저장을
 * 직접 흉내 낸다. */
async function installFakeChromeApi(page, options) {
  await page.addInitScript((chromeOptions) => {
    /** 최근 job 목록을 저장하는 storage key. entrypoints/popup/dev-preview-chrome-api.ts, src/adapters/chrome/download-job-storage.ts와 동일한 key를 사용한다. */
    const RECENT_DOWNLOAD_JOBS_STORAGE_KEY = 'recentDownloadJobs';
    /** 이전 버전에서 사용하던 단일 job storage key. */
    const LATEST_DOWNLOAD_JOB_STORAGE_KEY = 'latestDownloadJob';
    /** 등록된 storage.onChanged listener 목록. */
    const storageChangeListeners = [];

    globalThis.__myTubeExtractStoredOptions = chromeOptions.storedOptions;
    globalThis.__myTubeExtractDownloadUrl = null;
    globalThis.__myTubeExtractDownloadFilename = null;
    globalThis.__myTubeExtractYoutubePermissionGranted =
      chromeOptions.youtubePermissionGranted ?? false;
    globalThis.__myTubeExtractCurrentTabUrl =
      chromeOptions.currentTabUrl ?? 'https://www.youtube.com/watch?v=abc123_DEF0';
    globalThis.__myTubeExtractCurrentTabTitle = chromeOptions.currentTabTitle ?? 'YouTube';

    /** storage 값을 쓰고 onChanged listener에게 알린다. */
    function setStorageItems(items) {
      globalThis.__myTubeExtractStoredOptions = {
        ...globalThis.__myTubeExtractStoredOptions,
        ...items,
      };

      /** 이번 변경으로 생긴 storage.onChanged 변경 내역. */
      const changes = {};

      Object.keys(items).forEach((key) => {
        changes[key] = { newValue: items[key] };
      });

      storageChangeListeners.forEach((listener) => listener(changes, 'local'));
    }

    /** Background의 job 제출 handler를 흉내 낸다: 서버 확인 → job 생성 → 저장 → 완료 시 자동 다운로드. */
    async function handleDownloadJobSubmit(request) {
      try {
        /** health check 응답. */
        const healthResponse = await fetch(`${request.apiBaseUrl}/health`);

        if (!healthResponse.ok) {
          return { failure: 'unreachable', message: '서버에 연결할 수 없어요.', ok: false };
        }

        /** health check payload. */
        const healthPayload = await healthResponse.json();

        if (healthPayload?.ok !== true) {
          return { failure: 'unreachable', message: '서버에 연결할 수 없어요.', ok: false };
        }
      } catch {
        return { failure: 'unreachable', message: '서버에 연결할 수 없어요.', ok: false };
      }

      try {
        /** job 생성 응답. */
        const createResponse = await fetch(`${request.apiBaseUrl}/downloads`, {
          body: JSON.stringify({
            quality: request.quality,
            type: request.mode,
            url: request.sourceUrl,
          }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        });

        if (!createResponse.ok) {
          /** 거부 응답의 서버 안내 메시지. */
          const rejectPayload = await createResponse.json().catch(() => null);

          return {
            failure: 'rejected',
            message: rejectPayload?.message ?? '서버가 요청을 처리하지 못했어요.',
            ok: false,
          };
        }

        /** 생성된 job. */
        const rawJob = await createResponse.json();
        /** 절대 다운로드 URL로 resolve한 job. */
        const job = {
          ...rawJob,
          downloadUrl: rawJob.downloadUrl ? `${request.apiBaseUrl}${rawJob.downloadUrl}` : null,
        };

        /** 기존에 저장된 최근 job 목록. */
        const recentJobs =
          globalThis.__myTubeExtractStoredOptions[RECENT_DOWNLOAD_JOBS_STORAGE_KEY] ?? [];

        setStorageItems({
          [LATEST_DOWNLOAD_JOB_STORAGE_KEY]: job,
          [RECENT_DOWNLOAD_JOBS_STORAGE_KEY]: [job, ...recentJobs],
        });

        if (job.status === 'completed' && job.downloadUrl) {
          await new Promise((resolve) => {
            globalThis.chrome.downloads.download(
              request.localFilename
                ? { filename: request.localFilename, url: job.downloadUrl }
                : { url: job.downloadUrl },
              resolve,
            );
          });
        }

        return { job, ok: true };
      } catch {
        return { failure: 'unreachable', message: '서버에 연결할 수 없어요.', ok: false };
      }
    }

    globalThis.chrome = {
      runtime: {
        lastError: null,
        sendMessage(message, callback) {
          if (message?.type === 'download-job-submit') {
            handleDownloadJobSubmit(message).then(callback);
            return;
          }

          if (message?.type === 'youtube-overlay-enable') {
            globalThis.__myTubeExtractOverlayEnableCount =
              (globalThis.__myTubeExtractOverlayEnableCount ?? 0) + 1;
          }

          callback({ ok: true });
        },
      },
      storage: {
        local: {
          get(_keys, callback) {
            callback(globalThis.__myTubeExtractStoredOptions);
          },
          set(items, callback) {
            setStorageItems(items);
            callback();
          },
        },
        onChanged: {
          addListener(listener) {
            storageChangeListeners.push(listener);
          },
          removeListener(listener) {
            /** 제거할 listener의 index. */
            const index = storageChangeListeners.indexOf(listener);

            if (index !== -1) {
              storageChangeListeners.splice(index, 1);
            }
          },
        },
      },
      downloads: {
        async download(downloadOptions, callback) {
          globalThis.__myTubeExtractDownloadUrl = downloadOptions.url;
          globalThis.__myTubeExtractDownloadFilename = downloadOptions.filename ?? null;
          await fetch(downloadOptions.url);
          callback(1);
        },
      },
      tabs: {
        query(_queryInfo, callback) {
          callback([
            {
              active: true,
              id: 1,
              title: globalThis.__myTubeExtractCurrentTabTitle,
              url: globalThis.__myTubeExtractCurrentTabUrl,
            },
          ]);
        },
      },
      permissions: {
        contains(_permissions, callback) {
          callback(globalThis.__myTubeExtractYoutubePermissionGranted);
        },
        request(_permissions, callback) {
          /** 사용자가 Chrome 권한 창에서 고른 답을 반영한다. */
          function answer(granted) {
            globalThis.__myTubeExtractYoutubePermissionGranted = granted;
            callback(granted);
          }

          // 검사가 권한 창이 떠 있는 동안의 화면을 보려면 답을 붙잡아 두고 나중에 답한다.
          if (chromeOptions.holdPermissionRequest) {
            globalThis.__myTubeExtractAnswerPermissionRequest = answer;
            return;
          }

          answer(true);
        },
        remove(_permissions, callback) {
          globalThis.__myTubeExtractYoutubePermissionRemoveCount =
            (globalThis.__myTubeExtractYoutubePermissionRemoveCount ?? 0) + 1;
          globalThis.__myTubeExtractYoutubePermissionGranted = false;
          callback(true);
        },
      },
    };
  }, options);
}

/** YouTube 썸네일 요청을 가짜 이미지 또는 실패로 처리한다. */
async function routeYoutubeThumbnails(page, { available }) {
  await page.route('https://i.ytimg.com/**', async (route) => {
    if (!available) {
      await route.abort('failed');
      return;
    }

    await route.fulfill({
      body: fakeThumbnailPng,
      headers: { 'Content-Type': 'image/png' },
      status: 200,
    });
  });
}

/** 입력칸 밖(document)에서 글자를 붙여넣은 것처럼 paste event를 보낸다. */
async function dispatchDocumentPaste(page, text) {
  await page.evaluate((pastedText) => {
    /** 붙여넣을 clipboard 내용. */
    const clipboardData = new DataTransfer();

    clipboardData.setData('text/plain', pastedText);
    document.body.dispatchEvent(
      new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData }),
    );
  }, text);
}

/** 이름이 같은 radio가 선택돼 있는지 확인한다. */
async function expectRadioChecked(page, name) {
  if (!(await page.getByRole('radio', { name }).isChecked())) {
    throw new Error(`Expected radio "${name}" to be checked.`);
  }
}

/** 360px 폭에서 가로로 넘치는 내용이 없는지 확인한다. */
async function expectNoHorizontalOverflow(page) {
  /** 문서 폭과 viewport 폭. */
  const widths = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));

  if (widths.scrollWidth > widths.viewportWidth) {
    throw new Error(`Expected no horizontal overflow, got ${JSON.stringify(widths)}`);
  }
}

/** load unpacked extension ID를 Chrome profile에서 읽는다. */
async function readLoadedExtensionId(userDataDir, outputRoot) {
  /** Secure Preferences 경로. */
  const securePreferencesPath = path.join(userDataDir, 'Default', 'Secure Preferences');

  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (fs.existsSync(securePreferencesPath)) {
      /** Chrome secure preferences. */
      const preferences = JSON.parse(fs.readFileSync(securePreferencesPath, 'utf8'));
      /** Extension settings. */
      const settings = preferences.extensions?.settings ?? {};
      /** MyTube Extract extension entry. */
      const extensionEntry = Object.entries(settings).find(
        ([, value]) => value.path === outputRoot,
      );

      if (extensionEntry) {
        return extensionEntry[0];
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error('Could not find loaded extension ID.');
}

/** smoke mode에 맞는 output 누락 메시지를 만든다. */
function createMissingOutputMessage(mode, outputRoot) {
  if (mode === 'dev') {
    return `WXT dev output is missing at ${outputRoot}. Run \`pnpm dev\` first and wait for the readiness message.`;
  }

  return `WXT build output is missing at ${outputRoot}. Run \`pnpm --filter chrome-extension run build\` first.`;
}

/** Browser context를 timeout과 함께 닫는다. */
async function closeBrowserContext(context) {
  await Promise.race([
    context.close(),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timed out while closing browser context.')), 10000);
    }),
  ]);
}

/** Status text가 기대값이 될 때까지 기다린다. */
async function expectStatusText(page, expectedText) {
  await page.getByText(expectedText, { exact: true }).waitFor({ timeout: 10000 });
}

/** Download button disabled 상태를 확인한다. */
async function expectDownloadButtonDisabled(page, expectedDisabled) {
  /** Download button disabled 여부. */
  const disabled = await page
    .getByRole('button', { name: '추출 시작' })
    .evaluate((button) => button.disabled);

  if (disabled !== expectedDisabled) {
    throw new Error(`Expected download button disabled=${expectedDisabled}, got ${disabled}`);
  }
}

/** 360x600 popup viewport에서 주요 다운로드 버튼이 바로 보이는지 확인한다. */
async function expectDownloadButtonVisibleInViewport(page) {
  /** Download button 위치와 viewport 크기. */
  const metrics = await page.getByRole('button', { name: '추출 시작' }).evaluate((button) => {
    /** Download button viewport 기준 rect. */
    const rect = button.getBoundingClientRect();

    return {
      bottom: rect.bottom,
      innerHeight: window.innerHeight,
      top: rect.top,
    };
  });

  if (metrics.top < 0 || metrics.bottom > metrics.innerHeight - 12) {
    throw new Error(
      `Expected download button within 360x600 popup viewport, got top=${metrics.top}, bottom=${metrics.bottom}, innerHeight=${metrics.innerHeight}`,
    );
  }
}

/** WXT output static server를 만든다. */
function createStaticServer(rootDirectory) {
  /** Static server. */
  const server = http.createServer((request, response) => {
    /** 요청 path. */
    const requestPath = request.url === '/' ? '/popup.html' : request.url ?? '/popup.html';
    /** 정적 파일 경로. */
    const filePath = path.join(rootDirectory, decodeURIComponent(requestPath.split('?')[0]));

    if (!filePath.startsWith(rootDirectory) || !fs.existsSync(filePath)) {
      response.statusCode = 404;
      response.end('not found');
      return;
    }

    response.setHeader('Content-Type', getContentType(filePath));
    response.end(fs.readFileSync(filePath));
  });

  return listen(server);
}

/** Static file content type을 반환한다. */
function getContentType(filePath) {
  /** 정적 파일 확장자. */
  const extension = path.extname(filePath);

  if (extension === '.html') {
    return 'text/html; charset=utf-8';
  }

  if (extension === '.js') {
    return 'text/javascript; charset=utf-8';
  }

  if (extension === '.css') {
    return 'text/css; charset=utf-8';
  }

  if (extension === '.png') {
    return 'image/png';
  }

  return 'application/octet-stream';
}

/** HTTP server를 임의 port로 연다. */
function listen(server, extra = {}) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      /** Server address. */
      const address = server.address();

      if (!address || typeof address === 'string') {
        throw new Error('Could not determine server address.');
      }

      resolve({
        ...extra,
        origin: `http://127.0.0.1:${address.port}`,
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
