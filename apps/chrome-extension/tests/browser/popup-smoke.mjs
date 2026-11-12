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
  /** 다운로드 flow에서 수집한 fake API 요청. */
  const fakeApiRequests = await verifyDownloadFlow(staticServer.origin);
  console.error('[popup-smoke] download flow ok');

  console.log(
    JSON.stringify(
      {
        realApiHealth: `${realApiBaseUrl}/health`,
        mode: smokeMode,
        outputRoot: extensionOutputRoot,
        fakeApiRequests,
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

    await sourceInput.fill('https://vimeo.com/76979871');
    await expectStatusText(page, '지원하는 YouTube URL을 입력하세요.');
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
          await expectStatusText(page, '지원하는 YouTube URL을 입력하세요.');
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
  const page = await browser.newPage();
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
    await expectStatusText(page, 'Server is unavailable.');
    // 같은 자리의 추출 버튼이 같은 조건 재시도로 바뀐다.
    await page.getByRole('button', { name: '다시 시도' }).waitFor({ timeout: 10000 });
    await page.locator('figure.stage').waitFor({ timeout: 10000 });

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

    if (storedOptions.mode !== 'video' || storedOptions.resolution !== '1080' || 'sourceUrl' in storedOptions) {
      throw new Error(`Unexpected stored options: ${JSON.stringify(storedOptions)}`);
    }

    await expectDownloadButtonDisabled(page, false);
    await expectDownloadButtonVisibleInViewport(page);
    await page.getByRole('button', { name: '추출 시작' }).click();
    await expectStatusText(page, '추출 요청을 시작했습니다.');
    await page.getByRole('heading', { name: '최근 요청' }).waitFor({ timeout: 10000 });

    /** 완료된 job 목록 항목 수. */
    const recentJobCount = await page.getByRole('listitem').count();

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

    // 파일명 편집이 없으면 로컬 파일명을 덮어쓰지 않고 서버 기본 이름을 쓴다.
    if (downloadFilename !== null) {
      throw new Error(`Unexpected download filename: ${downloadFilename}`);
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

    return requests;
  } finally {
    await browser.close();
  }
}

/** Production API 요청을 browser smoke 안에서 fake 응답으로 처리한다. */
async function routeMyTubeExtractApi(page, { requestBodies = [], requests, healthOk }) {
  await page.route(`${expectedApiOrigin}/**`, async (route) => {
    /** 가로챈 production API 요청. */
    const request = route.request();
    /** 가로챈 production API 요청 URL. */
    const requestUrl = new URL(request.url());

    requests.push(`${request.method()} ${requestUrl.pathname}${requestUrl.search}`);

    if (requestUrl.pathname === '/health') {
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
          return { message: 'Server is unavailable.', ok: false };
        }

        /** health check payload. */
        const healthPayload = await healthResponse.json();

        if (healthPayload?.ok !== true) {
          return { message: 'Server health check failed.', ok: false };
        }
      } catch {
        return { message: 'Server is unavailable.', ok: false };
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
          return { message: 'Could not create the download job.', ok: false };
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
        return { message: 'Could not reach the server to create the download job.', ok: false };
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
          globalThis.__myTubeExtractYoutubePermissionGranted = true;
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
