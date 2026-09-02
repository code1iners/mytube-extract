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
/** 공통 내비게이션을 실제 route surface마다 확인할 경로. */
const RESPONSIVE_NAVIGATION_ROUTES = [
  '/video',
  '/subtitles',
  '/history',
  '/settings',
];
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
  await run('request routes expose worker readiness and guarded refresh', verifyRequestReadinessStatus);
  await run('video request keeps the task flow first across viewports', verifyVideoTaskFirstLayout);
  await run('video in-place success, failure, navigation lock, and download', verifyVideoRequestFlows);
  await run('receipt storage failure keeps the accepted job history destination', verifyAcceptedJobStorageFallback);
  await run('subtitle in-place success and navigation lock', verifySubtitleRequestFlow);
  await run('subtitle task-first mobile density and processing choices', verifySubtitleProcessingChoice);
  await run('accessible subtitle file picker keeps one control and all input paths', verifySubtitleFilePicker);
  await run('active request status errors stay actionable', verifyActiveRequestStatusErrors);
  await run('active polling stops at terminal status', verifyTerminalPolling);
  await run('network and 5xx retain receipts while 404 removes one', verifyReceiptErrorHandling);
  await run('history deletion offers one eight-second undo', verifyHistoryDeleteUndo);
  await run('blocked storage reports undo restoration failure', verifyHistoryUndoStorageFailure);
  await run('cross-tab delete and re-add stay synchronized', verifyCrossTabStorage);
  await run('blocked localStorage keeps the deep-link item', verifyBlockedStorageFallback);
  await run('failed and expired jobs expose matching retry routes', verifyRetryRoutes);
  await run('empty history explains both request paths and retention', verifyEmptyHistoryProductModel);
  await run('responsive primary navigation stays aligned and unclipped', verifyResponsivePrimaryNavigation);

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

/** 영상·자막 요청 route의 worker health 네 상태와 재확인을 검증한다. */
async function verifyRequestReadinessStatus() {
  /** readiness 상태를 확인할 요청 route. */
  for (const routePath of ['/video', '/subtitles']) {
    /** readiness의 반응형 viewport 폭. */
    for (const width of [320, 390, 1280]) {
      /** readiness의 light·dark 테마. */
      for (const theme of ['light', 'dark']) {
        /** route·viewport·theme 조합별 독립 browser context. */
        const context = await createContext({
          viewport: { height: width <= 820 ? 844 : 900, width },
        });
        /** route readiness를 확인할 browser page. */
        const { page, assertNoRuntimeErrors } = await createPage(context, {
          ignoreHttpErrors: true,
        });
        /** health endpoint가 호출된 횟수. */
        let healthCalls = 0;
        /** readiness가 차단된 동안 발생한 job 제출 요청 횟수. */
        let submitCalls = 0;
        /** 최초 health 응답을 해제하는 함수. */
        let releaseInitialHealth;
        /** 수동 재확인 응답을 해제하는 함수. */
        let releaseRefreshHealth;
        /** 최초 확인을 대기시키는 gate. */
        const initialHealthGate = new Promise((resolve) => {
          releaseInitialHealth = resolve;
        });
        /** 수동 재확인을 대기시키는 gate. */
        const refreshHealthGate = new Promise((resolve) => {
          releaseRefreshHealth = resolve;
        });

        try {
          await page.addInitScript((preference) => {
            localStorage.setItem(
              'mytube-extract-theme-preference',
              preference,
            );
          }, theme);
          await routeApi(page, async ({ request, route, url }) => {
            if (
              url.pathname ===
                (routePath === '/video'
                  ? '/downloads'
                  : '/subtitles/uploads') &&
              request.method() === 'POST'
            ) {
              submitCalls += 1;
            }

            if (url.pathname !== '/health') {
              return fulfillJson(route, {}, 404);
            }

            healthCalls += 1;
            if (healthCalls === 1) {
              await initialHealthGate;
              return fulfillJson(route, healthResponse());
            }

            if (healthCalls === 2) {
              await refreshHealthGate;
              return fulfillJson(route, healthResponse());
            }

            if (healthCalls === 3) {
              return fulfillJson(route, healthResponse(false));
            }

            return fulfillJson(route, {}, 503);
          });

          await page.goto(staticServer.origin + routePath);
          await page
            .getByRole('heading', { name: '서버 연결·worker 준비 상태' })
            .waitFor();
          await page.getByText('확인 중', { exact: true }).waitFor();
          if (routePath === '/video') {
            await page
              .getByLabel('YouTube URL')
              .fill('https://youtu.be/abc123_DEF0');
          } else {
            await page.locator('input[type="file"]').setInputFiles({
              buffer: Buffer.from('fake-video'),
              mimeType: 'video/mp4',
              name: 'sample.mp4',
            });
          }

          /** readiness 확인 중 상태에서 제출할 수 없는 button. */
          const submitButton = page.locator('.primary-button').first();
          /** route별 health 상태 설명 id. */
          const workerHealthMessageId =
            routePath === '/video'
              ? 'video-worker-health-title-message'
              : 'subtitle-worker-health-title-message';
          assert.equal(
            await page.evaluate(
              () => document.documentElement.dataset.theme,
            ),
            theme,
          );
          assert.equal(healthCalls, 1);
          assert.equal(await submitButton.isDisabled(), true);
          assert.equal(
            await page.locator('[data-health-presentation="compact"]').count(),
            1,
          );
          assert.equal(
            await page.locator('.worker-health-status__last-checked').count(),
            0,
          );
          assert.equal(
            await page.getByRole('button', {
              name: '서버와 worker 상태 다시 확인',
            }).isDisabled(),
            true,
          );
          assert.equal(
            await submitButton.getAttribute('aria-describedby'),
            workerHealthMessageId,
          );
          assert.equal(await page.locator('.submit-disabled-reason').count(), 0);
          assert.match(
            await page.locator('.worker-health-status__message').textContent(),
            /서버 연결과 worker 준비 상태를 확인하고 있습니다/,
          );
          assert.equal(submitCalls, 0);
          await assertRequestReadinessLayout(page, width);

          releaseInitialHealth();
          await page.getByText('준비됨', { exact: true }).waitFor();
          assert.equal(
            await page.locator('[data-health-presentation="compact"]').count(),
            1,
          );
          assert.equal(await submitButton.isDisabled(), false);
          assert.equal(
            await page.locator('.worker-health-status__last-checked').count(),
            1,
          );
          await assertRequestReadinessLayout(page, width);

          /** readiness 상태를 수동으로 다시 확인하는 button. */
          const refreshButton = page.getByRole('button', {
            name: '서버와 worker 상태 다시 확인',
          });
          await refreshButton.focus();
          assert.equal(
            await refreshButton.evaluate(
              (element) => document.activeElement === element,
            ),
            true,
          );
          assert.equal(
            await refreshButton.evaluate((element) =>
              element.matches(':focus-visible'),
            ),
            true,
          );
          await page.keyboard.press('Enter');
          await waitForCondition(async () => healthCalls === 2);
          await waitForCondition(async () => refreshButton.isDisabled());
          await refreshButton.dispatchEvent('click');
          await refreshButton.dispatchEvent('click');
          assert.equal(healthCalls, 2);
          releaseRefreshHealth();
          await page.getByText('준비됨', { exact: true }).waitFor();
          assert.equal(healthCalls, 2);

          await refreshButton.click();
          await page.getByText('worker 중단', { exact: true }).waitFor();
          assert.equal(
            await page.locator('[data-health-presentation="expanded"]').count(),
            1,
          );
          assert.equal(
            await page.locator('.worker-health-status__last-checked').count(),
            0,
          );
          assert.equal(await submitButton.isDisabled(), true);
          assert.equal(await page.locator('.submit-disabled-reason').count(), 0);
          assert.equal(
            await submitButton.getAttribute('aria-describedby'),
            workerHealthMessageId,
          );
          assert.match(
            await page.locator('.worker-health-status__message').textContent(),
            /API는 응답했지만 worker가 작업을 받을 수 없습니다/,
          );
          assert.equal(submitCalls, 0);
          await assertRequestReadinessLayout(page, width);

          await refreshButton.click();
          await page.getByText('확인 실패', { exact: true }).waitFor();
          assert.equal(
            await page.locator('[data-health-presentation="expanded"]').count(),
            1,
          );
          assert.equal(
            await page.locator('.worker-health-status__last-checked').count(),
            0,
          );
          assert.equal(await submitButton.isDisabled(), true);
          assert.equal(await page.locator('.submit-disabled-reason').count(), 0);
          assert.equal(
            await submitButton.getAttribute('aria-describedby'),
            workerHealthMessageId,
          );
          assert.match(
            await page.locator('.worker-health-status__message').textContent(),
            /API 상태를 확인하지 못했습니다\. 다시 확인해 주세요\./,
          );
          assert.equal(submitCalls, 0);
          await assertRequestReadinessLayout(page, width);
          assertNoRuntimeErrors();
        } finally {
          await context.close();
        }
      }
    }
  }
}

/** readiness 상태가 viewport와 fixed 내비게이션 경계를 지키는지 확인한다. */
async function assertRequestReadinessLayout(page, width) {
  /** readiness와 현재 주요 내비게이션의 viewport 측정값. */
  const metrics = await page.evaluate(() => {
    /** readiness 보조 영역. */
    const readiness = document.querySelector('.worker-health-status');
    /** 현재 viewport에서 보이는 주요 navigation. */
    const navigation = [...document.querySelectorAll('nav[aria-label="주요 메뉴"]')]
      .find((element) => getComputedStyle(element).display !== 'none');
    /** 요소의 viewport 영역을 직렬화한다. */
    const toBox = (element) => {
      /** 요소의 viewport 사각형. */
      const rect = element?.getBoundingClientRect();
      return rect
        ? {
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            top: rect.top,
          }
        : null;
    };

    return {
      document: {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      },
      navigation: toBox(navigation),
      readiness: toBox(readiness),
    };
  });

  assert.deepEqual(metrics.document, {
    clientWidth: width,
    scrollWidth: width,
  });
  assert.ok(metrics.readiness);
  assert.ok(metrics.readiness.left >= 0);
  assert.ok(metrics.readiness.right <= width);
  if (width <= 820) {
    assert.ok(metrics.navigation);
    /** 문서 끝까지 스크롤했을 때 fixed 내비게이션과 readiness 사이의 여유. */
    const scrolledMetrics = await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);

      /** 스크롤된 readiness 보조 영역. */
      const readiness = document
        .querySelector('.worker-health-status')
        ?.getBoundingClientRect();
      /** 스크롤된 주요 navigation. */
      const navigation = [...document.querySelectorAll('nav[aria-label="주요 메뉴"]')]
        .find((element) => getComputedStyle(element).display !== 'none')
        ?.getBoundingClientRect();

      return {
        navigationTop: navigation?.top,
        readinessBottom: readiness?.bottom,
      };
    });
    assert.ok(scrolledMetrics.navigationTop !== undefined);
    assert.ok(scrolledMetrics.readinessBottom !== undefined);
    assert.ok(scrolledMetrics.readinessBottom <= scrolledMetrics.navigationTop);
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
    const videoLink = page.getByRole('link', { name: '영상 추출' });
    const settingsLink = page.getByRole('link', { name: '설정' });
    assert.equal(await historyLink.getAttribute('aria-disabled'), 'true');
    assert.equal(await videoLink.getAttribute('aria-disabled'), null);
    assert.equal(await settingsLink.getAttribute('aria-disabled'), 'true');
    const navigationDescriptionId = await historyLink.getAttribute('aria-describedby');
    assert.ok(navigationDescriptionId);
    assert.match(
      await page.locator('[id="' + navigationDescriptionId + '"]').textContent(),
      /요청 접수 중에는 현재 작업을 마칠 때까지 다른 주요 메뉴로 이동할 수 없습니다/,
    );
    await historyLink.focus();
    await page.keyboard.press('Enter');
    assert.equal(new URL(page.url()).pathname, '/video');

    releaseCreate();
    assert.equal(new URL(page.url()).pathname, '/video');
    await page.getByRole('heading', { name: '추출 완료' }).waitFor();
    assert.equal(await page.locator('.worker-health-status').count(), 0);
    const storedReceipt = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? 'null'),
      receiptKey('video', VIDEO_ID),
    );
    assert.deepEqual(Object.keys(storedReceipt), ['acceptedAt']);
    assert.equal(typeof storedReceipt.acceptedAt, 'string');
    assert.equal(
      await page.getByRole('link', { name: '요청 내역' }).first().getAttribute('href'),
      '/history',
    );

    assert.equal(
      await page.getByRole('link', { name: '다운로드' }).getAttribute('href'),
      `${API_ORIGINS[0]}/downloads/${VIDEO_ID}/file`,
    );
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

/** 영상 요청의 작업 순서와 반응형 표면 계층을 viewport·theme별로 검증한다. */
async function verifyVideoTaskFirstLayout() {
  /** 작업 흐름을 확인할 responsive viewport 폭. */
  for (const width of [320, 390, 1280]) {
    /** 각 viewport에서 확인할 theme preference. */
    for (const theme of ['light', 'dark']) {
      /** 영상 요청 레이아웃을 확인할 독립 browser context. */
      const context = await createContext({
        viewport: { height: width <= 820 ? 844 : 900, width },
      });
      /** 영상 요청 레이아웃을 확인할 browser page. */
      const { page, assertNoRuntimeErrors } = await createPage(context);

      try {
        await page.addInitScript((preference) => {
          localStorage.setItem('mytube-extract-theme-preference', preference);
        }, theme);
        await routeApi(page, async ({ route, url }) => {
          if (url.pathname === '/health') {
            return fulfillJson(route, healthResponse());
          }

          return fulfillJson(route, {}, 404);
        });

        await page.goto(`${staticServer.origin}/video`);
        await page.getByRole('heading', { name: '추출 요청' }).waitFor();
        await page.getByLabel('YouTube URL').waitFor();

        /** 작업 입력과 보조 readiness의 DOM 위치. */
        const documentOrder = await page.evaluate(() => {
          /** 영상 요청 form. */
          const form = document.querySelector('form');
          /** URL 입력을 포함한 작업 시작 field. */
          const urlField = form?.querySelector('input[type="url"]')?.closest('label');
          /** 요청 form 안의 선택 fieldset 목록. */
          const fieldsets = [...(form?.querySelectorAll('fieldset') ?? [])];
          /** 추출 형식 선택 fieldset. */
          const formatFieldset = fieldsets.find(
            (fieldset) => fieldset.querySelector('legend')?.textContent === '추출 형식',
          );
          /** 품질 선택 fieldset. */
          const qualityFieldset = fieldsets.find(
            (fieldset) => fieldset.querySelector('legend')?.textContent === '품질',
          );
          /** 주요 요청 동작 button. */
          const submit = form?.querySelector('button[type="submit"]');
          /** form 뒤에 표시하는 readiness 안내. */
          const readiness = document.querySelector('.worker-health-status');

          return {
            formContainsReadiness: Boolean(form && readiness && form.contains(readiness)),
            indexes: [urlField, formatFieldset, qualityFieldset, submit, readiness].map(
              (element) => (element ? [...document.querySelectorAll('*')].indexOf(element) : -1),
            ),
          };
        });
        assert.equal(documentOrder.formContainsReadiness, false);
        assert.ok(documentOrder.indexes.every((index) => index >= 0));
        assert.ok(
          documentOrder.indexes.every(
            (index, position, indexes) => position === 0 || indexes[position - 1] < index,
          ),
        );

        /** 현재 영상 요청의 viewport·표면·하단 내비게이션 측정값. */
        const layoutMetrics = await page.evaluate(() => {
          /** 영상 요청 주 작업 영역. */
          const requestPanel = document.querySelector('section[aria-labelledby="request-title"]');
          /** 작업 시작 URL input. */
          const urlInput = document.querySelector('input[type="url"]');
          /** 주요 요청 동작 button. */
          const submit = document.querySelector('button[type="submit"]');
          /** form 뒤의 readiness 안내. */
          const readiness = document.querySelector('.worker-health-status');
          /** 현재 viewport에서 보이는 주요 navigation. */
          const visibleNavigation = [...document.querySelectorAll('nav[aria-label="주요 메뉴"]')]
            .find((element) => getComputedStyle(element).display !== 'none');
          /** 주 작업 영역의 computed surface 값. */
          const panelStyle = requestPanel ? getComputedStyle(requestPanel) : null;
          /** 요소의 viewport 영역을 직렬화한다. */
          const toBox = (element) => {
            /** 요소의 viewport 사각형. */
            const rect = element?.getBoundingClientRect();
            return rect
              ? { bottom: rect.bottom, height: rect.height, left: rect.left, right: rect.right, top: rect.top, width: rect.width }
              : null;
          };

          return {
            document: {
              clientWidth: document.documentElement.clientWidth,
              scrollWidth: document.documentElement.scrollWidth,
            },
            navigation: toBox(visibleNavigation),
            panel: {
              backgroundColor: panelStyle?.backgroundColor,
              borderTopWidth: panelStyle?.borderTopWidth,
              boxShadow: panelStyle?.boxShadow,
              box: toBox(requestPanel),
            },
            readiness: toBox(readiness),
            submit: toBox(submit),
            url: toBox(urlInput),
          };
        });

        assert.deepEqual(layoutMetrics.document, {
          clientWidth: width,
          scrollWidth: width,
        });
        assert.equal(layoutMetrics.panel.borderTopWidth, '0px');
        assert.equal(layoutMetrics.panel.boxShadow, 'none');
        assert.equal(layoutMetrics.panel.backgroundColor, 'rgba(0, 0, 0, 0)');
        assert.ok(layoutMetrics.url);
        assert.ok(layoutMetrics.readiness);
        assert.ok(layoutMetrics.url.top < layoutMetrics.readiness.top);
        assert.ok(layoutMetrics.url.left >= 0);
        assert.ok(layoutMetrics.url.right <= width);
        assert.ok(layoutMetrics.submit);

        if (width <= 820) {
          assert.ok(layoutMetrics.navigation);
          assert.ok(layoutMetrics.submit.bottom <= layoutMetrics.navigation.top);
        }

        assert.equal(await page.getByRole('button', { name: '리셋' }).count(), 0);
        await page.getByLabel('YouTube URL').fill('https://youtu.be/abc123_DEF0');
        /** 입력값이 있을 때 표시되는 URL 리셋 button. */
        const resetButton = page.getByRole('button', { name: '리셋' });
        /** 상단 설정 navigation link. */
        const settingsLink = page.getByRole('link', { name: '설정' });
        /** URL 리셋 button의 viewport 영역. */
        const resetBox = await resetButton.boundingBox();
        /** 설정 link의 viewport 영역. */
        const settingsBox = await settingsLink.boundingBox();
        assert.ok(resetBox && resetBox.width >= 44 && resetBox.height >= 44);
        assert.ok(settingsBox && settingsBox.width >= 44 && settingsBox.height >= 44);
        await resetButton.click();
        assert.equal(await page.getByLabel('YouTube URL').inputValue(), '');
        assert.equal(await page.getByRole('button', { name: '리셋' }).count(), 0);
        assertNoRuntimeErrors();
      } finally {
        await context.close();
      }
    }
  }
}

/** 접수증 저장이 실패해도 현재 session의 요청 내역 deep link를 보존하는지 검증한다. */
async function verifyAcceptedJobStorageFallback() {
  /** 접수증 저장 실패를 재현할 독립 browser context. */
  const context = await createContext();
  /** 저장 실패 복구 흐름을 확인할 page. */
  const { page, assertNoRuntimeErrors } = await createPage(context);

  try {
    await page.addInitScript((receiptPrefix) => {
      /** browser storage의 원래 setItem 구현. */
      const setItem = Storage.prototype.setItem;

      Storage.prototype.setItem = function blockReceiptWrite(key, value) {
        if (key.startsWith(receiptPrefix)) {
          throw new DOMException('Receipt storage is disabled.', 'SecurityError');
        }

        return setItem.call(this, key, value);
      };
    }, RECEIPT_PREFIX);
    await routeApi(page, async ({ request, route, url }) => {
      if (url.pathname === '/health') return fulfillJson(route, healthResponse());
      if (url.pathname === '/downloads' && request.method() === 'POST') {
        return fulfillJson(route, videoJob(VIDEO_OTHER_ID, 'queued'));
      }
      if (url.pathname === `/downloads/${VIDEO_OTHER_ID}`) {
        return fulfillJson(route, videoJob(VIDEO_OTHER_ID, 'completed'));
      }
      return fulfillJson(route, {}, 404);
    });

    await page.goto(`${staticServer.origin}/video`);
    await page.getByLabel('YouTube URL').fill('https://youtu.be/abc123_DEF0');
    /** 저장 실패 흐름에서 사용할 영상 추출 버튼. */
    const submit = page.getByRole('button', { name: '추출 요청' });
    await waitForEnabled(submit);
    await submit.click();
    await page.getByRole('heading', { name: '추출 완료' }).waitFor();

    /** 최근 접수 job을 보존해야 하는 요청 내역 링크. */
    const historyLink = page.getByRole('link', { name: '요청 내역' }).first();
    assert.equal(
      await historyLink.getAttribute('href'),
      `/history?kind=video&jobId=${VIDEO_OTHER_ID}`,
    );
    await historyLink.click();
    await page.getByRole('heading', { name: '이 브라우저의 요청 내역' }).waitFor();
    assert.equal(await page.locator('.history-item').count(), 1);
    assert.equal(new URL(page.url()).searchParams.get('jobId'), VIDEO_OTHER_ID);
    assertNoRuntimeErrors();
  } finally {
    await context.close();
  }
}

async function verifySubtitleRequestFlow() {
  const context = await createContext({ viewport: { height: 844, width: 390 } });
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
    const subtitleTab = page.getByRole('link', { name: '자막 추출' });
    const settingsLink = page.getByRole('link', { name: '설정' });
    assert.equal(await historyLink.getAttribute('aria-disabled'), 'true');
    assert.equal(await videoTab.getAttribute('aria-disabled'), 'true');
    assert.equal(await subtitleTab.getAttribute('aria-disabled'), null);
    assert.equal(await settingsLink.getAttribute('aria-disabled'), 'true');
    await assertAccessibilityDisabled(context, page, '요청 내역');
    await historyLink.dispatchEvent('click');
    await videoTab.focus();
    await page.keyboard.press('Enter');
    assert.equal(new URL(page.url()).pathname, '/subtitles');

    releaseUpload();
    await page.getByRole('heading', { name: '영어 SRT 준비 완료' }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/subtitles');
    assert.equal(await page.locator('.worker-health-status').count(), 0);
    assert.equal(await receiptCount(page), 1);
    assert.equal(
      await page
        .getByRole('link', { name: '영어 SRT 다운로드' })
        .getAttribute('href'),
      `${API_ORIGINS[0]}/subtitles/jobs/${SUBTITLE_ID}/file`,
    );
    assertNoRuntimeErrors();
  } finally {
    await context.close();
  }
}

/** 자막 처리 방식 설명과 처리 단계의 반응형 표시를 검증한다. */
async function verifySubtitleProcessingChoice() {
  /** 선택 화면과 처리 화면을 확인할 모바일·데스크톱 viewport 폭. */
  for (const width of [320, 390, 1280]) {
    /** viewport별 자막 처리 방식 검증 context. */
    const context = await createContext({
      viewport: { height: width <= 820 ? 844 : 900, width },
    });
    /** 자막 처리 방식 검증 page. */
    const { page, assertNoRuntimeErrors } = await createPage(context);

    try {
      await page.route('https://upload.example/**', async (route) => {
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
          assert.equal(request.postDataJSON().whisperModel, 'small_en');
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
          return fulfillJson(route, subtitleJob(SUBTITLE_ID, 'transcribing'));
        }
        return fulfillJson(route, {}, 404);
      });

      await page.goto(`${staticServer.origin}/subtitles`);
      await page.getByRole('heading', { name: '영어 SRT 생성' }).waitFor();

      /** 자막 입력 흐름과 readiness 보조 영역의 DOM 위치. */
      const documentOrder = await page.evaluate(() => {
        /** 자막 요청 주 작업 영역. */
        const panel = document.querySelector('.subtitle-request-panel');
        /** 자막 요청 입력 흐름. */
        const form = document.querySelector('.subtitle-form');
        /** 파일 선택 control. */
        const picker = form?.querySelector('.subtitle-dropzone');
        /** 처리 방식 선택 fieldset. */
        const processingMethod = form?.querySelector('.subtitle-processing-method');
        /** 영어 SRT 생성 주요 동작. */
        const submit = form?.querySelector('.primary-button');
        /** 입력 흐름 뒤에 표시하는 readiness 보조 영역. */
        const readiness = panel?.querySelector('.worker-health-status');
        /** 전체 문서에서 요소의 읽기 위치를 반환한다. */
        const getDocumentIndex = (element) =>
          element ? [...document.querySelectorAll('*')].indexOf(element) : -1;

        return {
          formContainsReadiness: Boolean(form && readiness && form.contains(readiness)),
          indexes: [picker, processingMethod, submit, readiness].map(getDocumentIndex),
        };
      });
      assert.equal(documentOrder.formContainsReadiness, false);
      assert.ok(documentOrder.indexes.every((index) => index >= 0));
      assert.ok(
        documentOrder.indexes.every(
          (index, position, indexes) => position === 0 || indexes[position - 1] < index,
        ),
      );

      /** 사용자 언어로 설명하는 처리 방식 fieldset. */
      const processingMethod = page.locator('.subtitle-processing-method');
      /** 두 처리 방식 radio. */
      const processingOptions = processingMethod.locator('.subtitle-processing-option');
      const speedOption = page.getByRole('radio', { name: /속도 우선/ });
      const accuracyOption = page.getByRole('radio', { name: /정확도 우선/ });

      assert.equal(await processingMethod.locator('legend').innerText(), '처리 방식');
      assert.equal(await processingOptions.count(), 2);
      assert.equal(await speedOption.isChecked(), true);
      await accuracyOption.check();
      assert.equal(await accuracyOption.isChecked(), true);
      assert.equal(await page.getByText('파일의 음성을 영어 SRT 자막으로 만들 처리 방향을 선택하세요.', { exact: true }).count(), 1);
      assert.equal(await page.getByText('영어 전용 자막은 로컬 Whisper로 처리합니다.', { exact: true }).count(), 1);
      assert.equal(await page.getByText('파일을 빠르게 영어 자막으로 만들고 싶을 때', { exact: true }).count(), 1);
      assert.equal(await page.getByText('음성을 더 꼼꼼하게 영어 자막으로 옮기고 싶을 때', { exact: true }).count(), 1);
      assert.equal(await page.getByText('base.en · 상대적으로 빠른 처리', { exact: true }).count(), 1);
      assert.equal(await page.getByText('small.en · 인식 정확도를 우선하는 처리', { exact: true }).count(), 1);
      assert.equal(await page.getByText(/예상 처리 시간/, { exact: false }).count(), 0);
      assert.ok(
        await page.evaluate(() => {
          /** 첫 처리 방식의 사용자 중심 설명. */
          const description = document.querySelector(
            '.subtitle-processing-option__description',
          );
          /** 첫 처리 방식의 기술 정보. */
          const technical = document.querySelector(
            '.subtitle-processing-option__technical',
          );

          return Boolean(
            description &&
              technical &&
              description.compareDocumentPosition(technical) &
                Node.DOCUMENT_POSITION_FOLLOWING,
          );
        }),
      );
      /** 처리 방식 선택지의 실제 grid 열 위치. */
      const processingOptionLefts = await processingOptions.evaluateAll((options) =>
        options.map((option) => Math.round(option.getBoundingClientRect().left)),
      );
      assert.deepEqual(new Set(processingOptionLefts).size, 1);
      assert.ok(
        (await processingOptions.evaluateAll((options) => options.map((option) => {
          const rect = option.getBoundingClientRect();
          return { height: rect.height, left: rect.left, right: rect.right };
        }))).every(
          (option) => option.height >= 44 && option.left >= 0 && option.right <= width,
        ),
      );

      /** 자막 요청의 밀도와 fixed 하단 내비게이션 여유를 측정한다. */
      const layoutMetrics = await page.evaluate(() => {
        /** 자막 요청 주 작업 영역. */
        const panel = document.querySelector('.subtitle-request-panel');
        /** 파일 선택 control. */
        const dropzone = document.querySelector('.subtitle-dropzone');
        /** 주요 요청 동작. */
        const submit = document.querySelector('.subtitle-form .primary-button');
        /** readiness 보조 영역. */
        const readiness = document.querySelector('.worker-health-status');
        /** 처리 방식 fieldset. */
        const processingMethod = document.querySelector('.subtitle-processing-method');
        /** 현재 viewport에서 보이는 주요 navigation. */
        const visibleNavigation = [...document.querySelectorAll('nav[aria-label="주요 메뉴"]')]
          .find((element) => getComputedStyle(element).display !== 'none');
        /** 요소의 viewport 영역을 직렬화한다. */
        const toBox = (element) => {
          /** 요소의 viewport 사각형. */
          const rect = element?.getBoundingClientRect();
          return rect
            ? { bottom: rect.bottom, height: rect.height, left: rect.left, right: rect.right, top: rect.top, width: rect.width }
            : null;
        };

        return {
          document: {
            clientWidth: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
          },
          dropzone: toBox(dropzone),
          navigation: toBox(visibleNavigation),
          options: [...document.querySelectorAll('.subtitle-processing-option')].map(toBox),
          panel: {
            backgroundColor: panel ? getComputedStyle(panel).backgroundColor : null,
            borderTopWidth: panel ? getComputedStyle(panel).borderTopWidth : null,
            boxShadow: panel ? getComputedStyle(panel).boxShadow : null,
          },
          processingMethod: toBox(processingMethod),
          readiness: toBox(readiness),
          submit: toBox(submit),
        };
      });
      assert.deepEqual(layoutMetrics.document, {
        clientWidth: width,
        scrollWidth: width,
      });
      assert.equal(layoutMetrics.panel.borderTopWidth, '0px');
      assert.equal(layoutMetrics.panel.boxShadow, 'none');
      assert.equal(layoutMetrics.panel.backgroundColor, 'rgba(0, 0, 0, 0)');
      assert.ok(layoutMetrics.dropzone);
      assert.ok(layoutMetrics.dropzone.height >= 140);
      assert.ok(layoutMetrics.dropzone.height < 220);
      assert.ok(layoutMetrics.processingMethod);
      assert.ok(layoutMetrics.options.every((option) => option.width === layoutMetrics.processingMethod.width));
      assert.ok(layoutMetrics.options.every((option) => option.left >= 0 && option.right <= width));
      assert.ok(layoutMetrics.readiness);
      assert.ok(layoutMetrics.submit);
      assert.ok(layoutMetrics.submit.bottom <= layoutMetrics.readiness.top);
      if (width <= 820) {
        assert.ok(layoutMetrics.navigation);
        assert.ok(layoutMetrics.submit.bottom <= layoutMetrics.navigation.top);
      }

      /** 처리 방식 선택 후 영어 SRT 생성 요청. */
      const submit = page.getByRole('button', { name: '영어 SRT 생성' });
      await page.locator('input[type="file"]').setInputFiles({
        buffer: Buffer.from('fake-video'),
        mimeType: 'video/mp4',
        name: 'sample.mp4',
      });
      await waitForEnabled(submit);
      await submit.click();
      await page.locator('.subtitle-step-tabs').waitFor();

      /** 실제 자막 처리 단계 네 개. */
      const stepTabs = page.locator('.subtitle-step-tabs .step-tab');
      assert.equal(await stepTabs.count(), 4);
      assert.deepEqual(await stepTabs.allTextContents(), ['대기', '음성 추출', '영어 SRT 생성', '완료']);
      assert.equal(await page.locator('.subtitle-step-tabs [aria-current="step"]').count(), 1);
      /** 처리 단계의 실제 grid 열 위치. */
      const stepLefts = await stepTabs.evaluateAll((steps) =>
        steps.map((step) => Math.round(step.getBoundingClientRect().left)),
      );
      assert.deepEqual(new Set(stepLefts).size, width <= 820 ? 1 : 4);
      assert.deepEqual(
        await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        })),
        { clientWidth: width, scrollWidth: width },
      );
      assertNoRuntimeErrors();
    } finally {
      await context.close();
    }
  }
}

/** 자막 파일 선택 control의 접근성·클릭·키보드·drag-and-drop 경로를 검증한다. */
async function verifySubtitleFilePicker() {
  /** 파일 선택 route의 독립 browser context. */
  const context = await createContext({ viewport: { height: 844, width: 390 } });
  /** 합성 파일의 media metadata resource 경고만 제외하고 JS 오류는 계속 검사한다. */
  const { page, assertNoRuntimeErrors } = await createPage(context, {
    ignoreConsoleError: (message) =>
      message === 'Failed to load resource: net::ERR_FILE_NOT_FOUND' ||
      message ===
        'Failed to load resource: the server responded with a status of 413 (Payload Too Large)',
  });
  /** 브라우저에서 선택할 파일의 accessible name. */
  const pickerLabel = '영상 선택 또는 드래그 (로컬 영상 파일)';
  /** 지원하지 않는 파일을 선택했을 때의 안내 문구. */
  const invalidFileMessage = 'mp4, mov, webm 영상 파일만 사용할 수 있습니다.';

  try {
    await routeApi(page, async ({ route, url }) => {
      if (url.pathname === '/health') return fulfillJson(route, healthResponse());
      if (url.pathname === '/subtitles/uploads') {
        return fulfillJson(route, { message: 'too large' }, 413);
      }
      return fulfillJson(route, {}, 404);
    });

    await page.goto(`${staticServer.origin}/subtitles`);
    await page.getByRole('heading', { name: '영어 SRT 생성' }).waitFor();
    await page.getByText('준비됨', { exact: true }).waitFor();

    /** 접근성 트리와 tab 순서에 남아야 하는 유일한 파일 선택 control. */
    const picker = page.getByRole('button', { name: pickerLabel });
    /** 프로그램matic file input. */
    const fileInput = page.locator('input[type="file"]');
    /** 파일 선택 후 화면에 유지되는 파일 메타정보. */
    const selectedFileMeta = page.getByText('1KB', { exact: true });

    assert.equal(await picker.count(), 1);
    assert.equal(await fileInput.count(), 1);
    assert.equal(await fileInput.isVisible(), false);
    assert.equal(await fileInput.getAttribute('aria-hidden'), 'true');
    assert.equal(await fileInput.getAttribute('tabindex'), '-1');
    assert.equal(
      await fileInput.evaluate((element) => element.tabIndex),
      -1,
    );
    await page.evaluate(() => {
      /** 탭 순회 검증용 파일 input focus marker. */
      const input = document.querySelector('input[type="file"]');
      input?.addEventListener('focus', () => {
        input.dataset.focusedByKeyboard = 'true';
      });
      input?.removeAttribute('data-focused-by-keyboard');
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null)?.blur();
    });
    /** 파일 picker 다음에 오는 첫 처리 방식 radio. */
    const firstModelRadio = page.getByRole('radio', { name: '속도 우선' });
    await picker.focus();
    // 유일한 파일 picker 다음에는 첫 처리 방식 radio가 온다.
    await page.keyboard.press('Tab');
    assert.equal(
      await firstModelRadio.evaluate(
        (element) => document.activeElement === element,
      ),
      true,
    );

    await page.evaluate(() => {
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null)?.blur();
    });
    // 전체 tab 순회에서도 프로그램matic input이 focus target으로 노출되지 않는다.
    /** 현재 tab 순회 횟수. */
    for (let index = 0; index < 32; index += 1) {
      await page.keyboard.press('Tab');
    }
    assert.equal(
      await fileInput.getAttribute('data-focused-by-keyboard'),
      null,
    );

    await chooseSubtitleFileThroughPicker(page, picker, 'click', {
      buffer: Buffer.from('mp4-video'),
      mimeType: 'video/mp4',
      name: 'click-video.mp4',
    });
    await page.getByText('click-video.mp4', { exact: true }).waitFor();

    await chooseSubtitleFileThroughPicker(page, picker, 'Enter', {
      buffer: Buffer.from('webm-video'),
      mimeType: 'video/webm',
      name: 'keyboard-video.webm',
    });
    await page.getByText('keyboard-video.webm', { exact: true }).waitFor();

    await chooseSubtitleFileThroughPicker(page, picker, 'Space', {
      buffer: Buffer.from('mov-video'),
      mimeType: 'video/quicktime',
      name: 'space-video.mov',
    });
    await page.getByText('space-video.mov', { exact: true }).waitFor();
    await selectedFileMeta.waitFor();
    assert.equal(
      await picker.evaluate((element) => element.matches(':focus-visible')),
      true,
    );

    /** drop 이벤트를 허용하는 dragover 동작. */
    const dragOverPrevented = await picker.evaluate((element) => {
      /** 테스트용 dragover 이벤트. */
      const event = new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer(),
      });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    });
    assert.equal(dragOverPrevented, true);

    /** drag-and-drop으로 선택할 세 가지 지원 영상 형식. */
    const droppedFiles = [
      { mimeType: 'video/mp4', name: 'dropped-video.mp4' },
      { mimeType: 'video/quicktime', name: 'dropped-video.mov' },
      { mimeType: 'video/webm', name: 'dropped-video.webm' },
    ];
    // 각 지원 형식을 같은 dropzone 경로로 차례로 선택한다.
    /** 현재 drop할 지원 영상 형식. */
    for (const droppedFile of droppedFiles) {
      await dispatchSubtitleFileDrop(page, picker, droppedFile);
      await page.getByText(droppedFile.name, { exact: true }).waitFor();
    }
    assert.equal(
      await page.getByRole('button', { name: '영어 SRT 생성' }).isDisabled(),
      false,
    );

    await dispatchSubtitleFileDrop(page, picker, {
      mimeType: 'text/plain',
      name: 'invalid-video.txt',
    });
    await page
      .locator('#subtitle-file-feedback')
      .getByText(invalidFileMessage, { exact: true })
      .waitFor();
    assert.equal(await page.locator('.field.has-error').count(), 1);
    assert.equal(
      await page.getByRole('button', { name: pickerLabel }).getAttribute('aria-describedby'),
      'subtitle-file-feedback',
    );
    assert.equal(
      await page.getByRole('button', { name: '영어 SRT 생성' }).isDisabled(),
      true,
    );

    await page.getByRole('button', { name: '지우기' }).click();
    assert.equal(await page.getByText('invalid-video.txt', { exact: true }).count(), 0);
    assert.equal(
      await picker.evaluate((element) => document.activeElement === element),
      true,
    );
    assert.equal(await page.locator('.field.has-error').count(), 0);
    assert.equal(
      await picker.getAttribute('aria-describedby'),
      'subtitle-file-feedback',
    );

    await chooseSubtitleFileThroughPicker(page, picker, 'click', {
      buffer: Buffer.from('too-large-video'),
      mimeType: 'video/mp4',
      name: 'size-error.mp4',
    });
    await page.getByText('size-error.mp4', { exact: true }).waitFor();
    await page.getByRole('button', { name: '영어 SRT 생성' }).click();
    await page
      .locator('#subtitle-file-feedback')
      .getByText(/파일이 너무 큽니다\./, { exact: false })
      .waitFor();
    assert.equal(
      await page.getByRole('heading', { name: '영어 SRT 생성' }).count(),
      1,
    );
    assert.equal(await page.locator('.field.has-error').count(), 1);
    assert.equal(
      await page.getByRole('button', { name: '영어 SRT 생성' }).isDisabled(),
      false,
    );
    await page.getByRole('button', { name: '지우기' }).click();
    assert.equal(
      await picker.evaluate((element) => document.activeElement === element),
      true,
    );
    assertNoRuntimeErrors();
  } finally {
    await context.close();
  }
}

/** native file picker를 열고 파일 선택 결과를 전달한다. */
async function chooseSubtitleFileThroughPicker(page, picker, trigger, file) {
  /** native file picker 이벤트 대기. */
  const fileChooserPromise = page.waitForEvent('filechooser');

  // 클릭은 pointer activation으로, Enter와 Space는 keyboard activation으로 picker를 연다.
  if (trigger === 'click') {
    await picker.click();
  } else {
    await picker.focus();
    await page.keyboard.press(trigger);
  }

  /** 열린 native file picker. */
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(file);
}

/** 브라우저 DataTransfer로 자막 파일 drop을 발생시킨다. */
async function dispatchSubtitleFileDrop(page, picker, file) {
  await picker.evaluate(
    (element, droppedFile) => {
      /** 브라우저가 전달할 파일 묶음. */
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(
        new File(['subtitle-picker-test'], droppedFile.name, {
          type: droppedFile.mimeType,
        }),
      );
      element.dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        }),
      );
    },
    file,
  );
}

async function verifyActiveRequestStatusErrors() {
  const context = await createContext();
  const { page, assertNoRuntimeErrors } = await createPage(context, {
    ignoreHttpErrors: true,
  });

  try {
    await routeApi(page, async ({ request, route, url }) => {
      if (url.pathname === '/health') return fulfillJson(route, healthResponse());
      if (url.pathname === '/downloads' && request.method() === 'POST') {
        return fulfillJson(route, videoJob(VIDEO_ID, 'queued'));
      }
      if (url.pathname === `/downloads/${VIDEO_ID}`) {
        return fulfillJson(route, {}, 404);
      }
      return fulfillJson(route, {}, 404);
    });

    await page.goto(`${staticServer.origin}/video`);
    await page
      .getByLabel('YouTube URL')
      .fill('https://www.youtube.com/watch?v=abc123_DEF0');
    const submit = page.getByRole('button', { name: '추출 요청' });
    await waitForEnabled(submit);
    await submit.click();

    await page
      .getByText('접수한 작업을 더 이상 찾을 수 없습니다.')
      .waitFor();
    assert.equal(new URL(page.url()).pathname, '/video');
    assert.equal(await receiptCount(page), 1);
    assert.equal(
      await page.getByText('영상 추출 요청이 정상적으로 처리되지 않았습니다.').count(),
      1,
    );
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

/** 요청 내역 삭제·undo의 삭제, 복원, 연속 삭제, 만료, focus 경로를 검증한다. */
async function verifyHistoryDeleteUndo() {
  /** 삭제·복원 여정을 확인할 독립 browser context. */
  const context = await createContext({ viewport: { height: 844, width: 390 } });
  /** history 삭제·복원 여정을 확인할 page. */
  const { page, assertNoRuntimeErrors } = await createPage(context);

  try {
    await seedReceipts(page, [
      ['subtitle', SUBTITLE_ID, '2026-08-11T00:02:00.000Z'],
      ['video', VIDEO_ID, '2026-08-11T00:01:00.000Z'],
      ['video', VIDEO_OTHER_ID, '2026-08-11T00:00:00.000Z'],
    ]);
    await routeApi(page, async ({ route, url }) => {
      if (url.pathname === '/health') {
        return fulfillJson(route, healthResponse());
      }
      if (url.pathname === `/downloads/${VIDEO_ID}`) {
        return fulfillJson(route, videoJob(VIDEO_ID, 'completed'));
      }
      if (url.pathname === `/downloads/${VIDEO_OTHER_ID}`) {
        return fulfillJson(route, videoJob(VIDEO_OTHER_ID, 'completed'));
      }
      if (url.pathname === `/subtitles/jobs/${SUBTITLE_ID}`) {
        return fulfillJson(route, subtitleJob(SUBTITLE_ID, 'completed'));
      }
      return fulfillJson(route, {}, 404);
    });

    await page.goto(`${staticServer.origin}/history`);
    await waitForHistoryCount(page, 3);

    /** 중간 항목을 삭제해 다음 삭제 버튼 focus를 확인한다. */
    const deleteButtons = page.locator('.history-remove-button');
    await deleteButtons.nth(1).click();
    await waitForHistoryCount(page, 2);
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), receiptKey('video', VIDEO_ID)),
      null,
    );
    assert.notEqual(
      await page.evaluate((key) => localStorage.getItem(key), receiptKey('subtitle', SUBTITLE_ID)),
      null,
    );
    assert.notEqual(
      await page.evaluate((key) => localStorage.getItem(key), receiptKey('video', VIDEO_OTHER_ID)),
      null,
    );
    await page
      .getByRole('button', { name: '삭제한 영상 요청 되돌리기' })
      .waitFor();
    assert.match(await page.locator('.history-undo').textContent(), /8초/);
    await waitForCondition(
      async () =>
        await deleteButtons.nth(1).evaluate(
          (element) => document.activeElement === element,
        ),
    );
    assert.equal(await page.locator('[role="status"]').count(), 1);
    assert.equal(await page.locator('[role="alert"]').count(), 0);

    /** 삭제한 항목을 undo해 원래 위치와 접수 시각을 복원한다. */
    await page.getByRole('button', { name: '삭제한 영상 요청 되돌리기' }).click();
    await waitForHistoryCount(page, 3);
    assert.deepEqual(
      await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), receiptKey('video', VIDEO_ID)),
      { acceptedAt: '2026-08-11T00:01:00.000Z' },
    );
    assert.deepEqual(
      await page.locator('.history-item h3').allTextContents(),
      ['자막 요청', '영상 요청', '영상 요청'],
    );
    await waitForCondition(
      async () =>
        await page.locator('.history-item').nth(1).getByRole('heading').evaluate(
          (element) => document.activeElement === element,
        ),
    );
    assert.equal(await page.locator('[role="status"]').count(), 1);
    assert.equal(await page.locator('[role="alert"]').count(), 0);

    /** 마지막 항목 삭제 후에는 이전 삭제 button으로 focus를 되돌린다. */
    await page.locator('.history-remove-button').last().click();
    await waitForHistoryCount(page, 2);
    await waitForCondition(
      async () =>
        await page.locator('.history-remove-button').last().evaluate(
          (element) => document.activeElement === element,
        ),
    );
    await page.getByRole('button', { name: '삭제한 영상 요청 되돌리기' }).click();
    await waitForHistoryCount(page, 3);

    /** 첫 삭제를 두 번째 삭제로 교체해 가장 최근 undo만 남는지 확인한다. */
    await page.locator('.history-remove-button').first().click();
    await waitForHistoryCount(page, 2);
    assert.equal(
      await page.getByRole('button', { name: '삭제한 자막 요청 되돌리기' }).count(),
      1,
    );
    await page.locator('.history-remove-button').first().click();
    await waitForHistoryCount(page, 1);
    assert.equal(
      await page.getByRole('button', { name: '삭제한 자막 요청 되돌리기' }).count(),
      0,
    );
    assert.equal(
      await page.getByRole('button', { name: '삭제한 영상 요청 되돌리기' }).count(),
      1,
    );
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), receiptKey('subtitle', SUBTITLE_ID)),
      null,
    );
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), receiptKey('video', VIDEO_ID)),
      null,
    );

    /** 가장 최근 삭제만 복원하고 이전 삭제는 확정한다. */
    await page.getByRole('button', { name: '삭제한 영상 요청 되돌리기' }).click();
    await waitForHistoryCount(page, 2);
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), receiptKey('subtitle', SUBTITLE_ID)),
      null,
    );
    assert.deepEqual(
      await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), receiptKey('video', VIDEO_ID)),
      { acceptedAt: '2026-08-11T00:01:00.000Z' },
    );

    /** undo 시간이 지나면 동작이 닫히고 삭제가 유지되는지 확인한다. */
    await page.locator('.history-remove-button').first().click();
    await waitForHistoryCount(page, 1);
    await page.getByRole('button', { name: '삭제한 영상 요청 되돌리기' }).waitFor();
    await page.waitForTimeout(8_200);
    assert.equal(await page.getByRole('button', { name: /되돌리기/ }).count(), 0);
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), receiptKey('video', VIDEO_ID)),
      null,
    );

    /** 마지막 항목 삭제 후에는 목록 제목으로 focus를 옮긴다. */
    await page.locator('.history-remove-button').first().click();
    await waitForHistoryCount(page, 0);
    await waitForCondition(
      async () =>
        await page.locator('#history-title').evaluate(
          (element) => document.activeElement === element,
        ),
    );
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), receiptKey('video', VIDEO_OTHER_ID)),
      null,
    );
    await page.getByRole('link', { name: '영상 추출', exact: true }).click();
    await page.getByRole('heading', { name: '추출 요청' }).waitFor();
    await page.getByRole('link', { name: '요청 내역', exact: true }).click();
    await page
      .getByRole('heading', { name: '이 브라우저의 요청 내역' })
      .waitFor();
    await waitForHistoryCount(page, 0);
    assert.equal(await page.getByRole('button', { name: /되돌리기/ }).count(), 0);
    assertNoRuntimeErrors();
  } finally {
    await context.close();
  }
}

/** 복원 시 localStorage 접근이 막히면 삭제 상태와 alert를 유지하는지 검증한다. */
async function verifyHistoryUndoStorageFailure() {
  /** 복원 storage 실패를 확인할 독립 browser context. */
  const context = await createContext();
  /** 복원 storage 실패를 확인할 page. */
  const { page, assertNoRuntimeErrors } = await createPage(context);

  try {
    await page.addInitScript(({ key, prefix }) => {
      localStorage.setItem(key, JSON.stringify({ acceptedAt: '2026-08-11T00:00:00.000Z' }));

      /** 원래 receipt 저장 함수. */
      const setItem = Storage.prototype.setItem;

      Storage.prototype.setItem = function blockReceiptRestore(storageKey, value) {
        if (storageKey.startsWith(prefix)) {
          throw new DOMException('Receipt storage is disabled.', 'SecurityError');
        }

        return setItem.call(this, storageKey, value);
      };
    }, { key: receiptKey('video', VIDEO_ID), prefix: RECEIPT_PREFIX });
    await routeApi(page, async ({ route, url }) => {
      if (url.pathname === `/downloads/${VIDEO_ID}`) {
        return fulfillJson(route, videoJob(VIDEO_ID, 'completed'));
      }
      return fulfillJson(route, {}, 404);
    });

    await page.goto(`${staticServer.origin}/history`);
    await waitForHistoryCount(page, 1);
    await page.locator('.history-remove-button').click();
    await waitForHistoryCount(page, 0);
    await page.getByRole('button', { name: '삭제한 영상 요청 되돌리기' }).click();

    await page.getByRole('alert').waitFor();
    assert.match(
      await page.getByRole('alert').textContent(),
      /복원하지 못했습니다/,
    );
    assert.doesNotMatch(
      await page.getByRole('alert').textContent(),
      /복원했습니다/,
    );
    assert.equal(await page.getByRole('button', { name: /되돌리기/ }).count(), 0);
    assert.equal(await page.locator('.history-item').count(), 0);
    assert.equal(
      await page.evaluate((key) => localStorage.getItem(key), receiptKey('video', VIDEO_ID)),
      null,
    );
    assert.equal(await page.locator('[role="alert"]').count(), 1);
    assert.equal(await page.locator('[role="status"]').count(), 0);
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

/** 빈 요청 내역의 두 시작점과 보관 모델을 viewport별로 검증한다. */
async function verifyEmptyHistoryProductModel() {
  /** 빈 상태를 확인할 모바일·데스크톱 viewport 폭. */
  for (const width of [390, 1280]) {
    /** 빈 내역의 모바일·데스크톱 viewport. */
    const context = await createContext({
      viewport: { height: width <= 560 ? 780 : 900, width },
    });
    /** 빈 상태 browser page와 runtime error assertion. */
    const { page, assertNoRuntimeErrors } = await createPage(context);

    try {
      await page.goto(`${staticServer.origin}/history`);
      await page
        .getByText('아직 이 브라우저에서 접수한 요청이 없습니다.')
        .waitFor();

      /** 빈 상태에서 제공하는 두 개의 요청 시작 링크. */
      const emptyLinks = page.locator('.history-empty__link');
      assert.equal(await emptyLinks.count(), 2);
      assert.deepEqual(
        await emptyLinks.evaluateAll((links) =>
          links.map((link) => link.getAttribute('href')),
        ),
        ['/video', '/subtitles'],
      );
      /** 키보드 focus와 손가락 조작을 위한 링크 크기. */
      for (const link of await emptyLinks.all()) {
        /** 빈 상태 링크의 실제 viewport 영역. */
        const linkBox = await link.boundingBox();
        assert.ok(linkBox && linkBox.width > 0 && linkBox.height >= 44);
        await link.focus();
        assert.equal(
          await link.evaluate((element) => document.activeElement === element),
          true,
        );
      }
      assert.equal(
        await page
          .getByText(
            'YouTube URL을 입력해 영상(MP4) 또는 오디오(MP3)를 받습니다.',
            { exact: true },
          )
          .count(),
        1,
      );
      assert.equal(
        await page
          .getByText('로컬 영상을 올려 영어 SRT 자막을 만듭니다.', {
            exact: true,
          })
          .count(),
        1,
      );
      assert.equal(
        await page
          .getByText(
            '이력은 이 브라우저에만 저장되며, 완료 파일은 7일 동안 보관됩니다.',
            { exact: true },
          )
          .count(),
        1,
      );

      /** viewport별 빈 상태 링크 열 배치. */
      const linkColumns = await page
        .locator('.history-empty__links')
        .evaluate((element) => getComputedStyle(element).gridTemplateColumns);
      assert.equal(linkColumns.trim().split(/\s+/).length, width <= 560 ? 1 : 2);
      assertNoRuntimeErrors();
    } finally {
      await context.close();
    }
  }
}

async function verifyResponsivePrimaryNavigation() {
  for (const width of [320, 390, 1280]) {
    for (const theme of ['light', 'dark']) {
      /** 모바일 하단 내비게이션의 짧은 viewport 계약도 함께 확인한다. */
      const height = width <= 820 ? 640 : 900;
      const context = await createContext({ viewport: { height, width } });
      const { page, assertNoRuntimeErrors } = await createPage(context);

      try {
        await page.addInitScript(
          (preference) => {
            if (!localStorage.getItem('mytube-extract-theme-preference')) {
              localStorage.setItem(
                'mytube-extract-theme-preference',
                preference,
              );
            }
          },
          theme,
        );
        await routeApi(page, async ({ route, url }) => {
          if (url.pathname === '/health') {
            return fulfillJson(route, healthResponse());
          }

          return fulfillJson(route, {}, 404);
        });
        for (const routePath of RESPONSIVE_NAVIGATION_ROUTES) {
          await page.goto(staticServer.origin + routePath);
          await page.locator('nav[aria-label="주요 메뉴"]:visible').waitFor();
          if (routePath === '/settings') {
            await page.getByRole('heading', { name: '설정' }).waitFor();
            await verifyThemePreference(page, theme);
          }
          await verifyResponsiveNavigationLayout(page, width);
        }
        assertNoRuntimeErrors();
      } finally {
        await context.close();
      }
    }
  }
}

/** 설정 화면에서 테마 변경과 reload 복원을 검증한다. */
async function verifyThemePreference(page, theme) {
  assert.equal(
    await page.evaluate(() => document.documentElement.dataset.theme),
    theme,
  );
  const alternateTheme = theme === 'dark' ? 'light' : 'dark';
  await page
    .getByText(alternateTheme === 'dark' ? '다크' : '라이트', { exact: true })
    .click();
  assert.equal(
    await page.evaluate(() => document.documentElement.dataset.theme),
    alternateTheme,
  );
  await page.reload();
  assert.equal(
    await page.evaluate(() => document.documentElement.dataset.theme),
    alternateTheme,
  );
}

/** 주요 navigation surface의 overflow·touch target·position을 검증한다. */
async function verifyResponsiveNavigationLayout(page, width) {
  const visibleNavigation = page.locator(
    'nav[aria-label="주요 메뉴"]:visible',
  );
  assert.equal(await visibleNavigation.count(), 1);
  assert.equal(await visibleNavigation.locator('a').count(), 3);
  assert.deepEqual(
    await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    })),
    {
      clientWidth: width,
      scrollWidth: width,
    },
  );

  const navigationMetrics = await visibleNavigation.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const links = [...element.querySelectorAll('a')].map((link) => {
      const linkRect = link.getBoundingClientRect();
      return {
        bottom: linkRect.bottom,
        height: linkRect.height,
        left: linkRect.left,
        right: linkRect.right,
        top: linkRect.top,
        width: linkRect.width,
      };
    });

    return {
      links,
      navigation: {
        bottom: rect.bottom,
        left: rect.left,
        position: getComputedStyle(element).position,
        right: rect.right,
        top: rect.top,
        width: rect.width,
      },
    };
  });
  assert.ok(
    navigationMetrics.links.every(
      (link) =>
        link.height >= 44 &&
        link.width > 0 &&
        link.left >= navigationMetrics.navigation.left &&
        link.right <= navigationMetrics.navigation.right &&
        link.top >= navigationMetrics.navigation.top &&
        link.bottom <= navigationMetrics.navigation.bottom,
    ),
  );

  if (width <= 820) {
    assert.equal(
      await visibleNavigation.evaluate((element) =>
        element.classList.contains('bottom-tab-bar'),
      ),
      true,
    );
    assert.equal(navigationMetrics.navigation.position, 'fixed');
    assert.equal(
      await visibleNavigation.evaluate(() =>
        [...document.styleSheets].some((styleSheet) => {
          try {
            return [...styleSheet.cssRules].some(
              (rule) =>
                rule.selectorText
                  ?.split(',')
                  .some((selector) => selector.trim() === '.bottom-tab-bar') &&
                rule.style.paddingBottom.includes('safe-area-inset-bottom'),
            );
          } catch {
            return false;
          }
        }),
      ),
      true,
    );
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const scrolledMetrics = await page.evaluate(() => {
      const navigation = [...document.querySelectorAll('nav[aria-label="주요 메뉴"]')]
        .find((element) => getComputedStyle(element).display !== 'none');
      const workspace = document.querySelector('.workspace');
      const navigationRect = navigation.getBoundingClientRect();
      const workspaceRect = workspace.getBoundingClientRect();

      return {
        navigationTop: navigationRect.top,
        workspaceBottom: workspaceRect.bottom,
      };
    });
    assert.ok(
      scrolledMetrics.workspaceBottom <= scrolledMetrics.navigationTop,
    );
  } else {
    assert.equal(
      await visibleNavigation.evaluate((element) =>
        element.classList.contains('primary-navigation--desktop'),
      ),
      true,
    );
    assert.equal(navigationMetrics.navigation.position, 'static');
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
      ) &&
      !options.ignoreConsoleError?.(message.text())
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

function healthResponse(workerAvailable = true) {
  return { ok: true, worker: { available: workerAvailable } };
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
