import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const API_ORIGINS = [
  'http://127.0.0.1:5011',
  'https://mytube-extract-api.codeliners.cc',
];
const VIDEO_ID = '4f8f82b3-cf37-4e31-9d56-d27eb526a922';
const VIDEO_OTHER_ID = '11111111-1111-4111-8111-111111111111';
const SUBTITLE_ID = '067b084b-c84a-4574-952f-950cb8fa2157';
const SUBTITLE_OTHER_ID = '22222222-2222-4222-8222-222222222222';
const RECEIPT_PREFIX = 'mytube-extract:job-receipt:v2:';
const outputRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../dist',
);

if (!fs.existsSync(path.join(outputRoot, 'index.html'))) {
  throw new Error(`Web build output is missing: ${outputRoot}`);
}

const staticServer = await createStaticServer(outputRoot);
const browser = await chromium.launch();

try {
  await run('request routes do not restore stored jobs', verifyRequestRoutesDoNotRestore);
  await run('video success, failure, navigation lock, and download', verifyVideoRequestFlows);
  await run('subtitle upload navigation lock', verifySubtitleNavigationLock);
  await run('active polling stops at terminal status', verifyTerminalPolling);
  await run('network and 5xx retain receipts while 404 removes one', verifyReceiptErrorHandling);
  await run('cross-tab delete and re-add stay synchronized', verifyCrossTabStorage);
  await run('blocked localStorage keeps the deep-link item', verifyBlockedStorageFallback);
  await run('failed and expired jobs expose matching retry routes', verifyRetryRoutes);

  console.log(JSON.stringify({ origin: staticServer.origin, status: 'ok' }, null, 2));
} finally {
  await browser.close();
  await staticServer.close();
}

async function verifyRequestRoutesDoNotRestore() {
  const context = await createContext();
  const { page, assertNoRuntimeErrors } = await createPage(context);
  const statusRequests = [];

  try {
    await seedReceipts(page, [
      ['video', VIDEO_ID, '2026-08-11T00:00:00.000Z'],
      ['subtitle', SUBTITLE_ID, '2026-08-11T00:01:00.000Z'],
    ]);
    await routeApi(page, async ({ route, url }) => {
      if (url.pathname === '/health') return fulfillJson(route, healthResponse());
      if (url.pathname.includes(VIDEO_ID) || url.pathname.includes(SUBTITLE_ID)) {
        statusRequests.push(url.pathname);
      }
      return fulfillJson(route, {}, 404);
    });

    await page.goto(`${staticServer.origin}/video`);
    await page.getByRole('heading', { name: '추출 요청' }).waitFor();
    await page.goto(`${staticServer.origin}/subtitles`);
    await page.getByRole('heading', { name: '영어 SRT 생성' }).waitFor();

    assert.deepEqual(statusRequests, []);
    assertNoRuntimeErrors();
  } finally {
    await context.close();
  }
}

async function verifyVideoRequestFlows() {
  const context = await createContext();
  const { page, assertNoRuntimeErrors } = await createPage(context);
  let releaseCreate;
  let createStarted;
  const createStartedPromise = new Promise((resolve) => {
    createStarted = resolve;
  });
  const createGate = new Promise((resolve) => {
    releaseCreate = resolve;
  });

  try {
    await routeApi(page, async ({ request, route, url }) => {
      if (url.pathname === '/health') return fulfillJson(route, healthResponse());
      if (url.pathname === '/downloads' && request.method() === 'POST') {
        createStarted();
        await createGate;
        return fulfillJson(route, videoJob(VIDEO_ID, 'queued'));
      }
      if (url.pathname === `/downloads/${VIDEO_ID}`) {
        return fulfillJson(route, videoJob(VIDEO_ID, 'completed'));
      }
      if (url.pathname === `/downloads/${VIDEO_ID}/file`) {
        return route.fulfill({
          body: 'downloaded-video',
          headers: {
            'Content-Disposition': 'attachment; filename="video.mp3"',
            'Content-Type': 'audio/mpeg',
          },
          status: 200,
        });
      }
      return fulfillJson(route, {}, 404);
    });

    await page.goto(`${staticServer.origin}/video`);
    await page.getByLabel('YouTube URL').fill('https://www.youtube.com/watch?v=abc123_DEF0');
    const submit = page.getByRole('button', { name: '추출 요청' });
    await waitForEnabled(submit);
    await submit.click();
    await createStartedPromise;

    const historyLink = page.getByRole('link', { name: '요청 내역' });
    assert.equal(await historyLink.getAttribute('aria-disabled'), 'true');
    await historyLink.focus();
    await page.keyboard.press('Enter');
    assert.equal(new URL(page.url()).pathname, '/video');

    releaseCreate();
    await page.waitForURL(`**/history?kind=video&jobId=${VIDEO_ID}`);
    const storedReceipt = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? 'null'),
      receiptKey('video', VIDEO_ID),
    );
    assert.deepEqual(Object.keys(storedReceipt), ['acceptedAt']);
    assert.equal(typeof storedReceipt.acceptedAt, 'string');
    await page.getByText('완료', { exact: true }).waitFor();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('link', { name: '다운로드' }).click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'video.mp3');
    assertNoRuntimeErrors();
  } finally {
    await context.close();
  }

  const failureContext = await createContext();
  const { page: failurePage, assertNoRuntimeErrors: assertFailureNoErrors } =
    await createPage(failureContext, { ignoreHttpErrors: true });

  try {
    await routeApi(failurePage, async ({ request, route, url }) => {
      if (url.pathname === '/health') return fulfillJson(route, healthResponse());
      if (url.pathname === '/downloads' && request.method() === 'POST') {
        return fulfillJson(route, { message: 'failed' }, 500);
      }
      return fulfillJson(route, {}, 404);
    });
    await failurePage.goto(`${staticServer.origin}/video`);
    await failurePage.getByLabel('YouTube URL').fill('https://youtu.be/abc123_DEF0');
    const submit = failurePage.getByRole('button', { name: '추출 요청' });
    await waitForEnabled(submit);
    await submit.click();
    await failurePage.getByText('추출 요청에 실패했습니다. 다시 시도해 주세요.').waitFor();

    assert.equal(new URL(failurePage.url()).pathname, '/video');
    assert.equal(await receiptCount(failurePage), 0);
    assertFailureNoErrors();
  } finally {
    await failureContext.close();
  }
}

async function verifySubtitleNavigationLock() {
  const context = await createContext({ viewport: { height: 780, width: 390 } });
  const { page, assertNoRuntimeErrors } = await createPage(context);
  let releaseUpload;
  let uploadStarted;
  const uploadStartedPromise = new Promise((resolve) => {
    uploadStarted = resolve;
  });
  const uploadGate = new Promise((resolve) => {
    releaseUpload = resolve;
  });

  try {
    await page.route('https://upload.example/**', async (route) => {
      uploadStarted();
      await uploadGate;
      await route.fulfill({
        body: '',
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'ETag',
          ETag: '"part-1"',
        },
        status: 200,
      });
    });
    await routeApi(page, async ({ request, route, url }) => {
      if (url.pathname === '/health') return fulfillJson(route, healthResponse());
      if (url.pathname === '/subtitles/uploads' && request.method() === 'POST') {
        return fulfillJson(route, {
          expiresAt: '2026-08-13T12:00:00.000Z',
          objectKey: 'source/video.mp4',
          partSizeBytes: 1024,
          parts: [{ partNumber: 1, uploadUrl: 'https://upload.example/part-1' }],
          uploadId: 'upload-1',
          uploadToken: 'token-1',
        });
      }
      if (url.pathname === '/subtitles/uploads/complete') {
        return fulfillJson(route, subtitleJob(SUBTITLE_ID, 'queued'));
      }
      if (url.pathname === `/subtitles/jobs/${SUBTITLE_ID}`) {
        return fulfillJson(route, subtitleJob(SUBTITLE_ID, 'completed'));
      }
      return fulfillJson(route, {}, 404);
    });

    await page.goto(`${staticServer.origin}/subtitles`);
    await page.locator('input[type="file"]').setInputFiles({
      buffer: Buffer.from('fake-video'),
      mimeType: 'video/mp4',
      name: 'sample.mp4',
    });
    const submit = page.getByRole('button', { name: '영어 SRT 생성' });
    await waitForEnabled(submit);
    await submit.click();
    await uploadStartedPromise;

    const historyLink = page.getByRole('link', { name: '요청 내역' });
    const videoTab = page.getByRole('link', { name: '영상 추출' });
    assert.equal(await historyLink.getAttribute('aria-disabled'), 'true');
    assert.equal(await videoTab.getAttribute('aria-disabled'), 'true');
    await assertAccessibilityDisabled(context, page, '요청 내역');
    await historyLink.dispatchEvent('click');
    await videoTab.focus();
    await page.keyboard.press('Enter');
    assert.equal(new URL(page.url()).pathname, '/subtitles');

    releaseUpload();
    await page.waitForURL(`**/history?kind=subtitle&jobId=${SUBTITLE_ID}`);
    assert.equal(await receiptCount(page), 1);
    assertNoRuntimeErrors();
  } finally {
    await context.close();
  }
}

async function verifyTerminalPolling() {
  const context = await createContext();
  const { page, assertNoRuntimeErrors } = await createPage(context);
  let statusCalls = 0;

  try {
    await seedReceipts(page, [['video', VIDEO_ID, '2026-08-11T00:00:00.000Z']]);
    await routeApi(page, async ({ route, url }) => {
      if (url.pathname === `/downloads/${VIDEO_ID}`) {
        statusCalls += 1;
        const status = statusCalls === 1 ? 'queued' : statusCalls === 2 ? 'processing' : 'completed';
        return fulfillJson(route, videoJob(VIDEO_ID, status));
      }
      if (url.pathname === '/health') return fulfillJson(route, healthResponse());
      return fulfillJson(route, {}, 404);
    });

    await page.goto(`${staticServer.origin}/history`);
    await page.locator('.history-status').getByText('완료', { exact: true }).waitFor({ timeout: 10_000 });
    const terminalCallCount = statusCalls;
    await page.waitForTimeout(3_000);
    assert.equal(statusCalls, terminalCallCount);
    assert.ok(statusCalls >= 3);
    assertNoRuntimeErrors();
  } finally {
    await context.close();
  }
}

async function verifyReceiptErrorHandling() {
  const context = await createContext();
  const { page, assertNoRuntimeErrors } = await createPage(context, {
    ignoreHttpErrors: true,
  });
  let networkCalls = 0;
  let transientCalls = 0;

  try {
    await seedReceipts(page, [
      ['video', VIDEO_ID, '2026-08-11T00:00:00.000Z'],
      ['video', VIDEO_OTHER_ID, '2026-08-11T00:01:00.000Z'],
      ['subtitle', SUBTITLE_ID, '2026-08-11T00:02:00.000Z'],
      ['subtitle', SUBTITLE_OTHER_ID, '2026-08-11T00:03:00.000Z'],
    ]);
    await routeApi(page, async ({ route, url }) => {
      if (url.pathname === `/downloads/${VIDEO_ID}`) {
        transientCalls += 1;
        return fulfillJson(route, {}, 500);
      }
      if (url.pathname === `/downloads/${VIDEO_OTHER_ID}`) {
        return fulfillJson(route, {}, 404);
      }
      if (url.pathname === `/subtitles/jobs/${SUBTITLE_ID}`) {
        return fulfillJson(route, subtitleJob(SUBTITLE_ID, 'completed'));
      }
      if (url.pathname === `/subtitles/jobs/${SUBTITLE_OTHER_ID}`) {
        networkCalls += 1;
        return route.abort('failed');
      }
      return fulfillJson(route, {}, 404);
    });

    await page.goto(`${staticServer.origin}/history`);
    await page.getByText('더 이상 조회할 수 없는 요청을 내역에서 제거했습니다.').waitFor();
    await waitForCondition(async () => transientCalls > 0);
    await waitForCondition(async () => networkCalls > 0);

    assert.notEqual(
      await page.evaluate((key) => localStorage.getItem(key), receiptKey('video', VIDEO_ID)),
      null,
    );
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), receiptKey('video', VIDEO_OTHER_ID)),
      null,
    );
    assert.notEqual(
      await page.evaluate((key) => localStorage.getItem(key), receiptKey('subtitle', SUBTITLE_ID)),
      null,
    );
    assert.notEqual(
      await page.evaluate(
        (key) => localStorage.getItem(key),
        receiptKey('subtitle', SUBTITLE_OTHER_ID),
      ),
      null,
    );
    assertNoRuntimeErrors();
  } finally {
    await context.close();
  }
}

async function verifyCrossTabStorage() {
  const context = await createContext();
  const { page: historyPage, assertNoRuntimeErrors } = await createPage(context);
  const { page: writerPage, assertNoRuntimeErrors: assertWriterNoErrors } =
    await createPage(context);

  try {
    for (const page of [historyPage, writerPage]) {
      await routeApi(page, async ({ route, url }) => {
        if (url.pathname === `/downloads/${VIDEO_ID}`) {
          return fulfillJson(route, videoJob(VIDEO_ID, 'completed'));
        }
        if (url.pathname === `/subtitles/jobs/${SUBTITLE_ID}`) {
          return fulfillJson(route, subtitleJob(SUBTITLE_ID, 'completed'));
        }
        if (url.pathname === '/health') return fulfillJson(route, healthResponse());
        return fulfillJson(route, {}, 404);
      });
    }

    await writerPage.goto(`${staticServer.origin}/video`);
    await writerPage.evaluate(
      ({ entries, prefix }) => {
        for (const [kind, jobId, acceptedAt] of entries) {
          localStorage.setItem(`${prefix}${kind}:${jobId}`, JSON.stringify({ acceptedAt }));
        }
      },
      {
        entries: [
          ['video', VIDEO_ID, '2026-08-11T00:00:00.000Z'],
          ['subtitle', SUBTITLE_ID, '2026-08-11T00:01:00.000Z'],
        ],
        prefix: RECEIPT_PREFIX,
      },
    );
    await historyPage.goto(
      `${staticServer.origin}/history?kind=video&jobId=${VIDEO_ID}`,
    );
    await waitForHistoryCount(historyPage, 2);

    await writerPage.evaluate((key) => localStorage.removeItem(key), receiptKey('video', VIDEO_ID));
    await waitForHistoryCount(historyPage, 1);
    assert.equal(await historyPage.getByRole('heading', { name: '자막 요청' }).count(), 1);

    await writerPage.evaluate(
      ({ key, value }) => localStorage.setItem(key, value),
      {
        key: receiptKey('video', VIDEO_ID),
        value: JSON.stringify({ acceptedAt: '2026-08-11T00:02:00.000Z' }),
      },
    );
    await waitForHistoryCount(historyPage, 2);
    assertNoRuntimeErrors();
    assertWriterNoErrors();
  } finally {
    await context.close();
  }
}

async function verifyBlockedStorageFallback() {
  const context = await createContext();
  const { page, assertNoRuntimeErrors } = await createPage(context);

  try {
    await page.addInitScript(() => {
      const fail = () => {
        throw new DOMException('Storage is disabled.', 'SecurityError');
      };
      Object.defineProperty(Storage.prototype, 'length', { configurable: true, get: fail });
      Storage.prototype.getItem = fail;
      Storage.prototype.setItem = fail;
      Storage.prototype.removeItem = fail;
    });
    await routeApi(page, async ({ route, url }) => {
      if (url.pathname === `/downloads/${VIDEO_ID}`) {
        return fulfillJson(route, videoJob(VIDEO_ID, 'completed'));
      }
      return fulfillJson(route, {}, 404);
    });

    await page.goto(`${staticServer.origin}/history?kind=video&jobId=${VIDEO_ID}`);
    await page.getByText('이 브라우저에 내역을 저장하지 못했습니다.', { exact: false }).waitFor();
    await page.getByRole('heading', { name: '영상 요청' }).waitFor();
    assertNoRuntimeErrors();
  } finally {
    await context.close();
  }
}

async function verifyRetryRoutes() {
  const context = await createContext();
  const { page, assertNoRuntimeErrors } = await createPage(context);

  try {
    await seedReceipts(page, [
      ['video', VIDEO_ID, '2026-08-11T00:00:00.000Z'],
      ['subtitle', SUBTITLE_OTHER_ID, '2026-08-11T00:01:00.000Z'],
    ]);
    await routeApi(page, async ({ route, url }) => {
      if (url.pathname === `/downloads/${VIDEO_ID}`) {
        return fulfillJson(route, videoJob(VIDEO_ID, 'failed'));
      }
      if (url.pathname === `/subtitles/jobs/${SUBTITLE_OTHER_ID}`) {
        return fulfillJson(route, subtitleJob(SUBTITLE_OTHER_ID, 'expired'));
      }
      return fulfillJson(route, {}, 404);
    });
    await page.goto(`${staticServer.origin}/history`);

    const retryLinks = page.getByRole('link', { name: '다시 요청' });
    await waitForCondition(async () => (await retryLinks.count()) === 2);
    assert.deepEqual(
      (await retryLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href')))).sort(),
      ['/subtitles', '/video'],
    );
    assertNoRuntimeErrors();
  } finally {
    await context.close();
  }
}

async function createContext(options = {}) {
  return browser.newContext({
    acceptDownloads: true,
    serviceWorkers: 'block',
    viewport: { height: 900, width: 1440 },
    ...options,
  });
}

async function createPage(context, options = {}) {
  const page = await context.newPage();
  const runtimeErrors = [];

  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      !(
        options.ignoreHttpErrors &&
        message.text().startsWith('Failed to load resource:')
      )
    ) {
      runtimeErrors.push(`console: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => runtimeErrors.push(`pageerror: ${error.message}`));

  return {
    assertNoRuntimeErrors() {
      assert.deepEqual(runtimeErrors, []);
    },
    page,
  };
}

async function routeApi(page, handler) {
  for (const origin of API_ORIGINS) {
    await page.route(`${origin}/**`, async (route, request) => {
      await handler({ request, route, url: new URL(request.url()) });
    });
  }
}

async function seedReceipts(page, entries) {
  await page.addInitScript(
    ({ entries, prefix }) => {
      for (const [kind, jobId, acceptedAt] of entries) {
        localStorage.setItem(`${prefix}${kind}:${jobId}`, JSON.stringify({ acceptedAt }));
      }
    },
    { entries, prefix: RECEIPT_PREFIX },
  );
}

function healthResponse() {
  return { ok: true, worker: { available: true } };
}

function videoJob(jobId, displayStatus) {
  const status = displayStatus === 'expired' ? 'completed' : displayStatus;
  return {
    createdAt: '2026-08-11T00:00:00.000Z',
    displayStatus,
    downloadUrl:
      displayStatus === 'completed' ? `/downloads/${jobId}/file` : null,
    errorCode: displayStatus === 'failed' ? 'EXTRACTION_FAILED' : null,
    jobId,
    message: `video ${displayStatus}`,
    progress: displayStatus === 'completed' ? 100 : displayStatus === 'processing' ? 50 : 0,
    quality: '320',
    retentionDays: 3,
    status,
    type: 'audio',
  };
}

function subtitleJob(jobId, displayStatus) {
  const status = displayStatus === 'expired' ? 'completed' : displayStatus;
  return {
    createdAt: '2026-08-11T00:00:00.000Z',
    displayStatus,
    downloadUrl:
      displayStatus === 'completed' ? `/subtitles/jobs/${jobId}/file` : null,
    errorCode: displayStatus === 'failed' ? 'TRANSCRIPTION_FAILED' : null,
    fileName: 'sample.mp4',
    jobId,
    message: `subtitle ${displayStatus}`,
    progress: displayStatus === 'completed' ? 100 : 0,
    retentionDays: 3,
    stage: status,
    status,
    whisperModel: 'base_en',
  };
}

function receiptKey(kind, jobId) {
  return `${RECEIPT_PREFIX}${kind}:${jobId}`;
}

async function receiptCount(page) {
  return page.evaluate((prefix) => {
    let count = 0;
    for (let index = 0; index < localStorage.length; index += 1) {
      if (localStorage.key(index)?.startsWith(prefix)) count += 1;
    }
    return count;
  }, RECEIPT_PREFIX);
}

async function waitForEnabled(locator) {
  try {
    await waitForCondition(async () => !(await locator.isDisabled()));
  } catch (error) {
    const markup = await locator.evaluate((element) => element.outerHTML);
    const bodyText = await locator.page().locator('body').innerText();
    throw new Error(`${error.message}\n${markup}\n${bodyText}`);
  }
}

async function assertAccessibilityDisabled(context, page, accessibleName) {
  const session = await context.newCDPSession(page);
  const tree = await session.send('Accessibility.getFullAXTree');
  const node = tree.nodes.find(
    (candidate) => candidate.name?.value === accessibleName,
  );
  const disabled = node?.properties?.find(
    (property) => property.name === 'disabled',
  );

  assert.equal(disabled?.value?.value, true);
}

async function waitForHistoryCount(page, count) {
  await waitForCondition(async () => (await page.locator('.history-item').count()) === count);
}

async function waitForCondition(condition, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Timed out waiting for browser condition.');
}

async function fulfillJson(route, body, status = 200) {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    status,
  });
}

async function run(name, callback) {
  await callback();
  console.error(`[request-history-smoke] ${name} ok`);
}

async function createStaticServer(root) {
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
    const candidate = path.join(root, pathname === '/' ? 'index.html' : pathname);
    const filePath = candidate.startsWith(root) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()
      ? candidate
      : path.join(root, 'index.html');
    const extension = path.extname(filePath);
    const contentType = extension === '.js'
      ? 'text/javascript; charset=utf-8'
      : extension === '.css'
        ? 'text/css; charset=utf-8'
        : extension === '.svg'
          ? 'image/svg+xml'
          : 'text/html; charset=utf-8';

    response.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(response);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Static server did not expose a TCP address.');
  }

  return {
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
    origin: `http://127.0.0.1:${address.port}`,
  };
}
