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
  await run('global usage guide disclosure stays accessible', verifyUsageGuideDisclosure);
  await run('desktop route headings share one top rhythm', verifyDesktopRouteHeadingAlignment);
  await run('video request keeps the task flow first across viewports', verifyVideoTaskFirstLayout);
  await run('video in-place success, failure, navigation lock, and download', verifyVideoRequestFlows);
  await run('subtitle request error recovery preserves file and focus', verifySubtitleRequestErrorRecovery);
  await run('video request cancellation restores input and navigation', verifyVideoRequestCancellation);
  await run('receipt storage failure keeps the accepted job history destination', verifyAcceptedJobStorageFallback);
  await run('subtitle in-place success and navigation lock', verifySubtitleRequestFlow);
  await run('subtitle lifecycle states stay distinct across themes and widths', verifySubtitleLifecycleStatusSurfaces);
  await run('subtitle accepting and cancellation surfaces restore focus', verifySubtitleAcceptanceAndCancellationSurfaces);
  await run('subtitle receipt storage failure keeps the accepted job history destination', verifySubtitleReceiptStorageFallback);
  await run('subtitle request cancellation cleans upload and restores file input', verifySubtitleRequestCancellation);
  await run('U/F keys do not move request focus', verifyRequestShortcuts);
  await run('subtitle task-first mobile density and processing choices', verifySubtitleProcessingChoice);
  await run('accessible subtitle file picker keeps one control and all input paths', verifySubtitleFilePicker);
  await run('invalid subtitle drops preserve the current request target', verifyInvalidSubtitleDropPreservesSelection);
  await run('invalid subtitle drops keep empty selection and recover on valid files', verifyInvalidSubtitleDropWithoutSelection);
  await run('active request status errors stay actionable', verifyActiveRequestStatusErrors);
  await run('active polling stops at terminal status', verifyTerminalPolling);
  await run('network and 5xx retain receipts while 404 removes one', verifyReceiptErrorHandling);
  await run('history deletion offers one eight-second undo', verifyHistoryDeleteUndo);
  await run('history delete and undo surfaces stay responsive', verifyHistoryDeleteUndoResponsiveLayout);
  await run('blocked storage keeps the history item when delete fails', verifyHistoryDeleteStorageFailure);
  await run('blocked storage reports undo restoration failure', verifyHistoryUndoStorageFailure);
  await run('cross-tab delete and re-add stay synchronized', verifyCrossTabStorage);
  await run('blocked localStorage keeps the deep-link item', verifyBlockedStorageFallback);
  await run('failed and expired jobs expose matching retry routes', verifyRetryRoutes);
  await run('empty history explains both request paths and retention', verifyEmptyHistoryProductModel);
  await run('populated history stays unclipped with long job details', verifyPopulatedHistoryResponsiveLayout);
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
    await page.getByRole('heading', { name: '영상 추출' }).waitFor();
    await page.goto(`${staticServer.origin}/subtitles`);
    await page.getByRole('heading', { name: '자막 추출' }).waitFor();

    assert.deepEqual(statusRequests, []);
    assertNoRuntimeErrors();
  } finally {
    await context.close();
  }
}

/** 자막 요청 오류 복구 뒤 파일 보존과 focus 이동을 검증한다. */
async function verifySubtitleRequestErrorRecovery() {
  /** 자막 요청 오류 복구의 파일 보존과 focus를 확인할 context. */
  const failureContext = await createContext({
    viewport: { height: 844, width: 390 },
  });
  /** 자막 요청 오류 복구를 확인할 page. */
  const { page: failurePage, assertNoRuntimeErrors: assertFailureNoErrors } =
    await createPage(failureContext, { ignoreHttpErrors: true });

  try {
    await routeApi(failurePage, async ({ request, route, url }) => {
      if (url.pathname === '/health') return fulfillJson(route, healthResponse());
      if (
        url.pathname === '/subtitles/uploads' &&
        request.method() === 'POST'
      ) {
        return fulfillJson(route, {}, 500);
      }
      return fulfillJson(route, {}, 404);
    });
    await failurePage.goto(`${staticServer.origin}/subtitles`);
    await failurePage.locator('input[type="file"]').setInputFiles({
      buffer: Buffer.from('failed-video'),
      mimeType: 'video/mp4',
      name: 'failed-video.mp4',
    });
    const failureSubmit = failurePage.getByRole('button', {
      name: '영어 SRT 생성',
    });
    await waitForEnabled(failureSubmit);
    await failureSubmit.click();
    await failurePage
      .getByText('영어 SRT 생성 요청에 실패했습니다. 다시 시도해 주세요.')
      .waitFor();
    await failurePage
      .getByRole('button', { name: '요청 설정으로 돌아가기' })
      .click();
    const recoveredPicker = failurePage.getByRole('button', {
      name: '영상 선택 또는 드래그 (로컬 영상 파일)',
    });
    await waitForCondition(async () =>
      recoveredPicker.evaluate((element) => document.activeElement === element),
    );
    await failurePage.getByText('failed-video.mp4', { exact: true }).waitFor();
    assertFailureNoErrors();
  } finally {
    await failureContext.close();
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
        /** 첫 번째 재확인 응답을 해제하는 함수. */
        let releaseRefreshHealth;
        /** 최초 확인을 대기시키는 gate. */
        const initialHealthGate = new Promise((resolve) => {
          releaseInitialHealth = resolve;
        });
        /** 첫 번째 재확인을 대기시키는 gate. */
        const refreshHealthGate = new Promise((resolve) => {
          releaseRefreshHealth = resolve;
        });

        try {
          await page.addInitScript((preference) => {
            localStorage.setItem('mytube-extract-theme-preference', preference);
          }, theme);
          await routeApi(page, async ({ request, route, url }) => {
            if (
              url.pathname ===
                (routePath === '/video' ? '/downloads' : '/subtitles/uploads') &&
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

            if (healthCalls === 4) {
              return fulfillJson(route, {}, 503);
            }

            return fulfillJson(route, healthResponse());
          });

          await page.goto(staticServer.origin + routePath);
          await page.getByRole('heading', { name: '서비스 상태' }).waitFor();
          await page.getByText('확인 중', { exact: true }).waitFor();

          assert.equal(
            await page.evaluate(() => document.documentElement.dataset.theme),
            theme,
          );
          assert.equal(healthCalls, 1);
          assert.equal(await page.locator('.readiness-panel').count(), 1);
          assert.equal(
            await page.locator(routePath === '/video' ? 'input[type="url"]' : 'form').count(),
            0,
          );
          assert.equal(
            await page.getByRole('button', { name: '서비스 상태 다시 확인' }).isDisabled(),
            true,
          );
          assert.equal(await page.locator('.submit-disabled-reason').count(), 0);
          assert.match(
            await page.locator('.worker-health-status__message').textContent(),
            /서비스 상태를 확인하고 있습니다/,
          );
          assert.equal(submitCalls, 0);
          await assertRequestReadinessLayout(page, width);

          releaseInitialHealth();
          await page.getByText('준비됨', { exact: true }).waitFor();
          await page.locator(routePath === '/video' ? 'input[type="url"]' : 'form').waitFor();
          assert.equal(await page.locator('.readiness-panel').count(), 0);
          assert.equal(
            await page.locator('.worker-health-status__last-checked').count(),
            1,
          );
          /** 정상 상태에서 저강조로 표시하는 재확인 control. */
          const readyRefreshButton = page.getByRole('button', {
            name: '서비스 상태 다시 확인',
          });
          /** 재확인 control의 실제 touch target. */
          const readyRefreshBox = await readyRefreshButton.boundingBox();
          assert.ok(readyRefreshBox && readyRefreshBox.width >= 44 && readyRefreshBox.height >= 44);
          assert.match(
            (await readyRefreshButton.getAttribute('class')) ?? '',
            /worker-health-status__retry--quiet/,
          );
          await assertRequestReadinessLayout(page, width);

          if (routePath === '/video') {
            await page.getByLabel('YouTube URL').fill('https://youtu.be/abc123_DEF0');
          } else {
            await page.locator('input[type="file"]').setInputFiles({
              buffer: Buffer.from('fake-video'),
              mimeType: 'video/mp4',
              name: 'sample.mp4',
            });
          }

          /** readiness 상태를 수동으로 다시 확인하는 button. */
          const refreshButton = page.getByRole('button', {
            name: '서비스 상태 다시 확인',
          });
          await refreshButton.focus();
          assert.equal(
            await refreshButton.evaluate((element) => document.activeElement === element),
            true,
          );
          assert.equal(
            await refreshButton.evaluate((element) => element.matches(':focus-visible')),
            true,
          );
          await page.keyboard.press('Enter');
          await waitForCondition(async () => healthCalls === 2);
          await waitForCondition(async () => refreshButton.isDisabled());
          assert.equal(await page.locator('.readiness-panel').count(), 0);
          assert.equal(await page.locator('form').count(), 1);
          assert.equal(await page.locator('.worker-health-status').getAttribute('aria-busy'), 'true');
          assert.equal(await page.locator('.worker-health-status__message').getAttribute('aria-live'), 'off');
          assert.equal(await page.locator('.panel-title__refresh').count(), 1);
          if (routePath === '/video') {
            assert.equal(await page.getByLabel('YouTube URL').inputValue(), 'https://youtu.be/abc123_DEF0');
          } else {
            assert.equal(await page.getByText('sample.mp4', { exact: true }).count(), 1);
          }
          assert.equal(submitCalls, 0);
          await assertRequestReadinessLayout(page, width);
          await refreshButton.dispatchEvent('click');
          await refreshButton.dispatchEvent('click');
          assert.equal(healthCalls, 2);
          releaseRefreshHealth();
          await page.getByText('준비됨', { exact: true }).waitFor();
          if (routePath === '/video') {
            assert.equal(await page.getByLabel('YouTube URL').inputValue(), 'https://youtu.be/abc123_DEF0');
          } else {
            assert.equal(await page.getByText('sample.mp4', { exact: true }).count(), 1);
          }

          await refreshButton.click();
          await page.getByText('작업 준비 안 됨', { exact: true }).waitFor();
          assert.equal(await page.locator('.readiness-panel').count(), 1);
          assert.equal(await page.locator('form, input[type="url"]').count(), 0);
          assert.equal(await page.locator('.error-details').count(), 1);
          assert.equal(await page.getByText('입력한 내용은 그대로 보존됩니다. 다시 확인 후 이어서 요청할 수 있습니다.', { exact: true }).count(), 1);
          /** 미가용 상태에서 먼저 제공하는 primary 재확인 동작. */
          const unavailableRetryButton = page.getByRole('button', { name: '서비스 상태 다시 확인' });
          assert.match((await unavailableRetryButton.getAttribute('class')) ?? '', /primary-button/);
          /** 미가용 상태 action stack의 실제 너비. */
          const unavailableRetryBox = await unavailableRetryButton.boundingBox();
          const unavailableActionBox = await page.locator('.worker-health-status__actions').boundingBox();
          assert.ok(unavailableRetryBox && unavailableActionBox && unavailableRetryBox.width >= unavailableActionBox.width - 1);
          assert.ok(
            await page.locator('.worker-health-status__retry').evaluate((button) =>
              button.compareDocumentPosition(button.parentElement?.querySelector('.error-details') ?? button) & Node.DOCUMENT_POSITION_FOLLOWING,
            ),
          );
          assert.match(
            await page.locator('.worker-health-status__message').textContent(),
            /서비스가 응답했지만 지금은 요청을 시작할 수 없습니다/,
          );
          assert.equal(submitCalls, 0);
          await assertRequestReadinessLayout(page, width);

          await page.getByRole('button', { name: '상세 원인 보기' }).focus();
          await page.keyboard.press('Enter');
          await page.getByText(/오류 코드: WORKER_UNAVAILABLE/, { exact: true }).waitFor();
          assert.equal(
            await page.getByRole('button', { name: '상세 원인 숨기기' }).count(),
            1,
          );
          await page.getByRole('button', { name: '상세 원인 숨기기' }).press('Space');

          await refreshButton.click();
          await page.getByText('확인 실패', { exact: true }).waitFor();
          assert.equal(await page.locator('.readiness-panel').count(), 1);
          assert.equal(await page.locator('form, input[type="url"]').count(), 0);
          assert.equal(await page.locator('.error-details').count(), 1);
          assert.equal(await page.getByText('입력한 내용은 그대로 보존됩니다. 다시 확인 후 이어서 요청할 수 있습니다.', { exact: true }).count(), 1);
          /** API 확인 실패 상태에서 먼저 제공하는 primary 재확인 동작. */
          const failedRetryButton = page.getByRole('button', { name: '서비스 상태 다시 확인' });
          assert.match((await failedRetryButton.getAttribute('class')) ?? '', /primary-button/);
          assert.ok(
            await page.locator('.worker-health-status__retry').evaluate((button) =>
              button.compareDocumentPosition(button.parentElement?.querySelector('.error-details') ?? button) & Node.DOCUMENT_POSITION_FOLLOWING,
            ),
          );
          assert.match(
            await page.locator('.worker-health-status__message').textContent(),
            /API 상태를 확인하지 못했습니다\. 다시 확인해 주세요\./,
          );
          await assertRequestReadinessLayout(page, width);

          await page.getByRole('button', { name: '상세 원인 보기' }).press('Space');
          await page.getByText(/오류 코드: SERVICE_STATUS_CHECK_FAILED/, { exact: true }).waitFor();
          await refreshButton.click();
          await page.getByText('준비됨', { exact: true }).waitFor();
          if (routePath === '/video') {
            assert.equal(await page.getByLabel('YouTube URL').inputValue(), 'https://youtu.be/abc123_DEF0');
          } else {
            assert.equal(await page.getByText('sample.mp4', { exact: true }).count(), 1);
          }
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
    assert.ok(scrolledMetrics.navigationTop - scrolledMetrics.readinessBottom >= 8);
  }
}

/** 헤더의 사용 안내 disclosure가 모든 주요 route에서 열리고 닫히는지 확인한다. */
async function verifyUsageGuideDisclosure() {
  /** 사용 안내를 확인할 responsive viewport. */
  for (const width of [320, 390, 1280]) {
    /** 사용 안내 viewport 높이. */
    const height = width <= 820 ? 844 : 900;
    /** route별 사용 안내를 격리할 browser context. */
    const context = await createContext({ viewport: { height, width } });
    /** 사용 안내 상호작용을 확인할 page. */
    const { page, assertNoRuntimeErrors } = await createPage(context);

    try {
      await routeApi(page, async ({ route, url }) => {
        if (url.pathname === '/health') return fulfillJson(route, healthResponse());
        return fulfillJson(route, {}, 404);
      });

      for (const routePath of RESPONSIVE_NAVIGATION_ROUTES) {
        await page.goto(staticServer.origin + routePath);
        /** 헤더에서 항상 접근할 수 있는 native details. */
        const guide = page.locator('.usage-guide');
        /** 사용 안내를 열고 닫는 native summary. */
        const summary = guide.locator('summary');
        await summary.waitFor();
        assert.equal(await guide.getAttribute('open'), null);
        const summaryBox = await summary.boundingBox();
        assert.ok(summaryBox && summaryBox.width >= 44 && summaryBox.height >= 44);
        assert.equal(await summary.getAttribute('aria-haspopup'), null);
        assert.equal(await summary.getAttribute('aria-expanded'), 'false');
        assert.equal(await guide.locator('.usage-guide__settings').count(), 1);
        assert.equal(await guide.getByText('API 응답을 기준으로 표시합니다.', { exact: true }).count(), 1);
        assert.equal(await guide.getByText('현재 브라우저에만 남습니다.', { exact: true }).count(), 1);
        assert.equal(await guide.getByText('기본 7일 보관됩니다.', { exact: true }).count(), 1);
        assert.equal(await guide.getByText('U', { exact: true }).count(), 0);
        assert.equal(await guide.getByText('F', { exact: true }).count(), 0);

        /** 닫힌 chevron transform. */
        const closedChevron = await summary.evaluate((element) =>
          getComputedStyle(element, '::after').transform,
        );
        await summary.focus();
        assert.equal(await summary.evaluate((element) => document.activeElement === element), true);
        assert.equal(await summary.evaluate((element) => element.matches(':focus-visible')), true);
        await page.keyboard.press('Enter');
        await guide.locator('.usage-guide__content').waitFor();
        assert.equal(await guide.getAttribute('open'), '');
        assert.equal(await summary.getAttribute('aria-expanded'), 'true');
        assert.equal(await guide.locator('.usage-guide__content').isVisible(), true);
        /** 더보기 disclosure에서 보조 설정으로 이동하는 link. */
        const settingsLink = guide.getByRole('link', { name: '설정' });
        assert.equal(await settingsLink.isVisible(), true);
        /** 설정 link의 실제 touch target. */
        const settingsBox = await settingsLink.boundingBox();
        assert.ok(settingsBox && settingsBox.width >= 44 && settingsBox.height >= 44);
        await page.waitForTimeout(200);
        /** 열린 chevron transform. */
        const openChevron = await summary.evaluate((element) =>
          getComputedStyle(element, '::after').transform,
        );
        assert.notEqual(openChevron, closedChevron);
        await page.keyboard.press('Escape');
        await waitForCondition(async () => (await guide.getAttribute('open')) === null);
        assert.equal(await summary.getAttribute('aria-expanded'), 'false');
        assert.equal(await summary.evaluate((element) => document.activeElement === element), true);

        if (width <= 560) {
          /** 높이가 다른 로고와 더보기 영역의 수직 중심을 비교한다. */
          const headerMetrics = await page.evaluate(() => {
            /** 헤더 브랜드의 실제 경계. */
            const brand = document.querySelector('.brand-lockup')?.getBoundingClientRect();
            /** 더보기 조작 영역을 포함한 유틸리티 경계. */
            const utilities = document.querySelector('.hero-utilities')?.getBoundingClientRect();
            return {
              brandCenter: brand ? brand.top + brand.height / 2 : undefined,
              utilitiesRight: utilities?.right,
              utilitiesCenter: utilities ? utilities.top + utilities.height / 2 : undefined,
            };
          });
          assert.ok(headerMetrics.brandCenter !== undefined);
          assert.ok(headerMetrics.utilitiesCenter !== undefined);
          assert.ok(Math.abs(headerMetrics.brandCenter - headerMetrics.utilitiesCenter) <= 1);
          assert.ok(headerMetrics.utilitiesRight !== undefined && headerMetrics.utilitiesRight <= width);
          /** 숨겨진 desktop navigation의 grid row와 gap까지 포함한 기존 mobile header 높이. */
          assert.equal(
            await page.locator('.app-header').evaluate((element) =>
              Math.round(element.getBoundingClientRect().height),
            ),
            63,
          );
        }

        if (routePath === RESPONSIVE_NAVIGATION_ROUTES[0]) {
          await summary.press('Space');
          assert.equal(await guide.getAttribute('open'), '');
          await summary.press('Space');
          assert.equal(await guide.getAttribute('open'), null);
        }

        await summary.click();
        await guide.locator('.usage-guide__content').waitFor();
        await page.mouse.click(1, 1);
        await waitForCondition(async () =>
          (await guide.getAttribute('open')) === null &&
          (await summary.evaluate((element) => document.activeElement === element)),
        );
      }
      assertNoRuntimeErrors();
    } finally {
      await context.close();
    }
  }
}

/** 데스크톱 주요 route의 body heading이 공통 top gap에 맞는지 확인한다. */
async function verifyDesktopRouteHeadingAlignment() {
  /** 데스크톱 route heading을 확인할 독립 context. */
  const context = await createContext({ viewport: { height: 900, width: 1280 } });
  /** route heading의 수직 리듬을 측정할 page. */
  const { page, assertNoRuntimeErrors } = await createPage(context);

  try {
    await routeApi(page, async ({ route, url }) => {
      if (url.pathname === '/health') return fulfillJson(route, healthResponse());
      return fulfillJson(route, {}, 404);
    });

    /** 각 route heading과 header의 실제 top gap. */
    const headingMetrics = [];
    for (const routePath of RESPONSIVE_NAVIGATION_ROUTES) {
      await page.goto(staticServer.origin + routePath);
      await page.locator('.phase-panel h2').waitFor();
      headingMetrics.push(
        await page.evaluate(() => {
          /** 공유 app header. */
          const header = document.querySelector('.app-header');
          /** 현재 route body heading. */
          const heading = document.querySelector('.phase-panel h2');
          /** root layout token. */
          const rootStyle = getComputedStyle(document.documentElement);
          return {
            headingTop: heading?.getBoundingClientRect().top,
            headerBottom: header?.getBoundingClientRect().bottom,
            routeTopGap: rootStyle.getPropertyValue('--layout-route-top-gap').trim(),
          };
        }),
      );
    }

    assert.equal(
      new Set(headingMetrics.map((metrics) => Math.round(metrics.headingTop))).size,
      1,
    );
    assert.ok(
      headingMetrics.every(
        (metrics) =>
          metrics.routeTopGap === '32px' &&
          metrics.headingTop !== undefined &&
          metrics.headerBottom !== undefined &&
          Math.abs(metrics.headingTop - metrics.headerBottom - 32) <= 1,
      ),
    );
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
    await page.getByRole('heading', { name: '추출 요청을 준비하고 있습니다' }).waitFor();
    assert.equal(await page.locator('.request-flow[data-flow-stage="extract"]').count(), 1);

    const historyLink = page.getByRole('link', { name: '요청 내역' });
    const videoLink = page.getByRole('link', { name: '영상 추출' });
    await page.locator('.usage-guide summary').click();
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
    await page.getByRole('heading', { name: '파일이 준비되었습니다' }).waitFor();
    assert.equal(await page.locator('.request-flow[data-flow-stage="receipt"]').count(), 1);
    assert.equal(await page.getByRole('button', { name: '요청 취소' }).count(), 0);
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
    await failurePage
      .getByRole('button', { name: '요청 설정으로 돌아가기' })
      .click();
    const recoveredSourceUrl = failurePage.getByLabel('YouTube URL');
    await waitForCondition(async () =>
      recoveredSourceUrl.evaluate(
        (element) => document.activeElement === element,
      ),
    );
    assert.equal(
      await recoveredSourceUrl.inputValue(),
      'https://youtu.be/abc123_DEF0',
    );

    assert.equal(new URL(failurePage.url()).pathname, '/video');
    assert.equal(await receiptCount(failurePage), 0);
    assertFailureNoErrors();
  } finally {
    await failureContext.close();
  }
}

/** 영상 job 생성 POST를 취소하고 입력·navigation·receipt 경계를 확인한다. */
async function verifyVideoRequestCancellation() {
  const context = await createContext({ viewport: { height: 844, width: 390 } });
  const { page, assertNoRuntimeErrors } = await createPage(context);
  let releaseCreate;
  let createStarted;
  let cancelCalls = 0;
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
        try {
          await fulfillJson(route, videoJob(VIDEO_OTHER_ID, 'queued'));
        } catch {
          // 취소된 browser fetch가 route 응답을 무시하는 것은 정상적인 경계다.
        }
        return;
      }
      if (url.pathname.includes('/cancel')) {
        cancelCalls += 1;
      }
      return fulfillJson(route, {}, 404);
    });

    await page.goto(`${staticServer.origin}/video`);
    const sourceUrl = page.getByLabel('YouTube URL');
    await sourceUrl.fill('https://youtu.be/abc123_DEF0');
    const submit = page.getByRole('button', { name: '추출 요청' });
    await waitForEnabled(submit);
    await submit.click();
    await createStartedPromise;
    await page.getByRole('heading', { name: '추출 요청을 준비하고 있습니다' }).waitFor();

    await page.getByRole('button', { name: '요청 취소' }).click();
    await page.getByRole('heading', { name: '영상 추출' }).waitFor();
    await waitForCondition(async () =>
      sourceUrl.evaluate((element) => document.activeElement === element),
    );
    assert.equal(await sourceUrl.inputValue(), 'https://youtu.be/abc123_DEF0');
    await page
      .getByText('요청을 중단했습니다. 입력한 설정은 그대로입니다. 다시 요청할 수 있습니다.', {
        exact: true,
      })
      .waitFor();
    assert.equal(await receiptCount(page), 0);
    assert.equal(cancelCalls, 0);
    for (const link of await page.locator('nav[aria-label="주요 메뉴"]:visible a').all()) {
      assert.equal(await link.getAttribute('aria-disabled'), null);
    }
    assert.equal(await page.getByRole('button', { name: '요청 취소' }).count(), 0);

    releaseCreate();
    await page.waitForTimeout(100);
    assert.equal(await receiptCount(page), 0);
    assertNoRuntimeErrors();
  } finally {
    releaseCreate?.();
    await context.close();
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
        await page.getByRole('heading', { name: '영상 추출' }).waitFor();
        await page.getByLabel('YouTube URL').waitFor();
        /** 영상 요청 제출 button. */
        const submit = page.getByRole('button', { name: '추출 요청' });
        // 클래스 존재가 아니라 배포 스타일의 실제 우선순위를 검증한다.
        assert.deepEqual(await submit.evaluate((element) => {
          /** 버튼에 최종 적용된 글꼴 스타일. */
          const style = getComputedStyle(element);
          return [style.fontSize, style.fontWeight, style.lineHeight];
        }), ['18px', '600', '18px']);
        assert.equal(await page.locator('.request-flow[data-flow-stage="source"]').count(), 1);
        assert.deepEqual(
          await page.locator('.request-flow__step > span:last-child').allTextContents(),
          ['원본', '추출', '파일 수령'],
        );
        assert.deepEqual(
          await page.locator('.quality-grid .quality-chip').allTextContents(),
          ['128 kbps', '192 kbps', '320 kbps'],
        );
        await page.getByRole('radio', { name: /비디오/ }).check();
        assert.deepEqual(
          await page.locator('.quality-grid .quality-chip').allTextContents(),
          ['360p', '720p', '1080p'],
        );
        await page.getByRole('radio', { name: /오디오/ }).check();

        /** 현재 테마가 입력 control에 적용해야 하는 semantic 색상. */
        const expectedVideoInputTheme = theme === 'dark'
          ? {
              action: 'rgb(230, 0, 18)',
              border: 'rgb(118, 118, 118)',
              danger: 'rgb(255, 138, 128)',
              disabled: 'rgb(92, 89, 85)',
              focus: 'rgb(169, 180, 242)',
              onAction: 'rgb(255, 255, 255)',
              surface: 'rgb(32, 33, 36)',
              surfaceAlt: 'rgb(41, 42, 45)',
              textPrimary: 'rgb(242, 240, 238)',
            }
          : {
              action: 'rgb(230, 0, 18)',
              border: 'rgb(138, 138, 138)',
              danger: 'rgb(198, 40, 40)',
              disabled: 'rgb(200, 200, 200)',
              focus: 'rgb(75, 92, 206)',
              onAction: 'rgb(255, 255, 255)',
              surface: 'rgb(248, 248, 248)',
              surfaceAlt: 'rgb(239, 239, 239)',
              textPrimary: 'rgb(72, 72, 72)',
            };
        /** 영상 입력 control의 computed style을 읽는다. */
        const inputStyles = await page.evaluate(() => {
          /** URL 입력 frame. */
          const urlFrame = document.querySelector('.url-input-frame');
          /** 제출 button. */
          const submit = document.querySelector('button[type="submit"]');
          /** 형식 선택지. */
          const formatOptions = [...document.querySelectorAll('.segmented-control label')];
          /** 품질 선택지. */
          const qualityOptions = [...document.querySelectorAll('.quality-grid label')];
          /** 선택지 style을 직렬화한다. */
          const serializeOption = (element) => {
            const style = getComputedStyle(element);
            return {
              borderColor: style.borderTopColor,
              textColor: style.color,
              textDecoration: style.textDecorationLine,
            };
          };
          /** 제출 button style을 직렬화한다. */
          const submitStyle = getComputedStyle(submit);

          return {
            format: formatOptions.map(serializeOption),
            frame: {
              backgroundColor: getComputedStyle(urlFrame).backgroundColor,
              borderColor: getComputedStyle(urlFrame).borderTopColor,
              borderRadius: getComputedStyle(urlFrame).borderTopLeftRadius,
            },
            quality: qualityOptions.map(serializeOption),
            submit: {
              backgroundColor: submitStyle.backgroundColor,
              boxShadow: submitStyle.boxShadow,
              color: submitStyle.color,
            },
          };
        });
        assert.deepEqual(inputStyles.frame, {
          backgroundColor: expectedVideoInputTheme.surface,
          borderColor: expectedVideoInputTheme.border,
          borderRadius: '8px',
        });
        assert.equal(inputStyles.format[0].borderColor, expectedVideoInputTheme.action);
        assert.equal(inputStyles.format[0].textColor, expectedVideoInputTheme.textPrimary);
        assert.equal(inputStyles.format[0].textDecoration, 'underline');
        assert.equal(inputStyles.format[1].borderColor, expectedVideoInputTheme.border);
        assert.equal(inputStyles.format[1].textDecoration, 'none');
        assert.equal(inputStyles.quality.at(-1).borderColor, expectedVideoInputTheme.action);
        assert.equal(inputStyles.quality.at(-1).textDecoration, 'underline');
        assert.equal(inputStyles.submit.backgroundColor, expectedVideoInputTheme.surfaceAlt);
        assert.doesNotMatch(inputStyles.submit.boxShadow, /2px 8px/);
        assert.equal(inputStyles.submit.color, expectedVideoInputTheme.disabled);

        await page.getByLabel('YouTube URL').focus();
        const focusedFrameStyles = await page.locator('.url-input-frame').evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            borderColor: style.borderTopColor,
            outlineOffset: style.outlineOffset,
            outlineWidth: style.outlineWidth,
          };
        });
        assert.deepEqual(focusedFrameStyles, {
          borderColor: expectedVideoInputTheme.focus,
          outlineOffset: '2px',
          outlineWidth: '2px',
        });

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
            indexes: [readiness, urlField, formatFieldset, qualityFieldset, submit].map(
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
            /** 데스크톱 수직 리듬의 기준이 되는 헤더. */
            const header = document.querySelector('.app-header');
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
            header: toBox(header),
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
        assert.ok(layoutMetrics.readiness.top < layoutMetrics.url.top);
        assert.ok(layoutMetrics.url.left >= 0);
        assert.ok(layoutMetrics.url.right <= width);
        assert.ok(layoutMetrics.submit);
        assert.equal(await page.locator('.submit-disabled-reason').count(), 0);
        assert.equal(
          await page.getByLabel('YouTube URL').getAttribute('aria-describedby'),
          'video-source-url-feedback',
        );

        if (width <= 820) {
          assert.ok(layoutMetrics.navigation);
          assert.ok(layoutMetrics.submit.bottom <= layoutMetrics.navigation.top);
        } else {
          assert.ok(layoutMetrics.header);
          assert.ok(layoutMetrics.panel.box);
          assert.ok(layoutMetrics.panel.box.top - layoutMetrics.header.bottom >= 24);
          assert.ok(layoutMetrics.panel.box.bottom <= 900 - 24);
        }

        assert.equal(await page.getByRole('button', { name: '지우기' }).count(), 0);
        await page.getByLabel('YouTube URL').fill('not-a-url');
        await waitForCondition(async () =>
          (await page.getByLabel('YouTube URL').getAttribute('aria-invalid')) === 'true',
        );
        const invalidFrameColor = await page.locator('.url-input-frame').evaluate(
          (element) => getComputedStyle(element).borderTopColor,
        );
        assert.equal(invalidFrameColor, expectedVideoInputTheme.danger);
        await page.getByLabel('YouTube URL').fill('https://youtu.be/abc123_DEF0');
        /** 입력값이 있을 때 표시되는 URL 지우기 button. */
        const resetButton = page.getByRole('button', { name: '지우기' });
        await waitForEnabled(submit);
        const enabledSubmitStyles = await submit.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            backgroundColor: style.backgroundColor,
            boxShadow: style.boxShadow,
            color: style.color,
          };
        });
        assert.equal(enabledSubmitStyles.backgroundColor, expectedVideoInputTheme.action);
        assert.match(enabledSubmitStyles.boxShadow, /2px 8px/);
        assert.equal(enabledSubmitStyles.color, expectedVideoInputTheme.onAction);
        await page.locator('.usage-guide summary').click();
        /** 더보기 메뉴 안의 설정 navigation link. */
        const settingsLink = page.getByRole('link', { name: '설정' });
        /** URL 지우기 button의 viewport 영역. */
        const resetBox = await resetButton.boundingBox();
        /** 설정 link의 viewport 영역. */
        const settingsBox = await settingsLink.boundingBox();
        assert.ok(resetBox && resetBox.width >= 44 && resetBox.height >= 44);
        assert.ok(settingsBox && settingsBox.width >= 44 && settingsBox.height >= 44);
        await page.locator('.usage-guide summary').press('Escape');
        await waitForCondition(
          async () => (await page.locator('.usage-guide').getAttribute('open')) === null,
        );
        await resetButton.click();
        assert.equal(await page.getByLabel('YouTube URL').inputValue(), '');
        assert.equal(await page.getByRole('button', { name: '지우기' }).count(), 0);
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
    await page.getByRole('heading', { name: '파일이 준비되었습니다' }).waitFor();

    /** 최근 접수 job을 보존해야 하는 요청 내역 링크. */
    const historyLink = page.getByRole('link', { name: '요청 내역' }).first();
    assert.equal(
      await historyLink.getAttribute('href'),
      `/history?kind=video&jobId=${VIDEO_OTHER_ID}`,
    );
    await historyLink.click();
    await page.getByRole('heading', { name: '요청 내역' }).waitFor();
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
    await page.getByRole('heading', { name: '원본 영상을 업로드 중입니다' }).waitFor();
    assert.equal(await page.locator('.request-flow[data-flow-stage="extract"]').count(), 1);

    const historyLink = page.getByRole('link', { name: '요청 내역' });
    const videoTab = page.getByRole('link', { name: '영상 추출' });
    const subtitleTab = page.getByRole('link', { name: '자막 추출' });
    await page.locator('.usage-guide summary').click();
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
    await page.getByRole('heading', { name: '영어 자막 파일이 준비되었습니다' }).waitFor();
    assert.equal(await page.locator('.request-flow[data-flow-stage="receipt"]').count(), 1);
    assert.equal(await page.getByRole('button', { name: '요청 취소' }).count(), 0);
    assert.equal(new URL(page.url()).pathname, '/subtitles');
    assert.equal(await page.locator('.worker-health-status').count(), 0);
    assert.equal(await receiptCount(page), 1);
    assert.equal(await page.getByText('원본 파일', { exact: true }).count(), 1);
    assert.equal(await page.getByText('sample.mp4', { exact: true }).count(), 1);
    assert.equal(await page.getByText('결과 형식', { exact: true }).count(), 1);
    assert.equal(await page.getByText('영어 SRT', { exact: true }).count(), 1);
    assert.equal(await page.getByText('완료 후 3일', { exact: true }).count(), 1);
    assert.equal(
      await page.getByText('완료 파일은 3일 동안 보관되며, 요청 내역은 이 브라우저에만 남습니다.', { exact: true }).count(),
      1,
    );
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

/** 자막 요청 생명주기 상태의 tone과 반응형 overflow를 검증한다. */
async function verifySubtitleLifecycleStatusSurfaces() {
  /** 실제 자막 lifecycle에서 비교할 처리·terminal 상태. */
  const lifecycleStates = [
    {
      apiStatus: 'queued',
      expectedHeading: '작업 대기 중입니다',
      expectedTone: 'queued',
    },
    {
      apiStatus: 'extracting_audio',
      expectedHeading: '음성을 추출 중입니다',
      expectedTone: 'processing',
    },
    {
      apiStatus: 'transcribing',
      expectedHeading: '영어 SRT를 생성 중입니다',
      expectedTone: 'processing',
    },
    {
      apiStatus: 'completed',
      expectedHeading: '영어 자막 파일이 준비되었습니다',
      expectedTone: 'completed',
    },
    {
      apiStatus: 'failed',
      expectedHeading: '영어 SRT 생성에 실패했습니다',
      expectedTone: 'failed',
    },
    {
      apiStatus: 'expired',
      expectedHeading: '영어 SRT 보관 기간이 지났습니다',
      expectedTone: 'expired',
    },
  ];
  /** 상태 tone별 theme semantic color. */
  const expectedToneColors = {
    dark: {
      completed: 'rgb(143, 214, 160)',
      expired: 'rgb(92, 89, 85)',
      failed: 'rgb(255, 138, 128)',
      processing: 'rgb(169, 180, 242)',
      queued: 'rgb(179, 176, 172)',
    },
    light: {
      completed: 'rgb(53, 107, 67)',
      expired: 'rgb(200, 200, 200)',
      failed: 'rgb(198, 40, 40)',
      processing: 'rgb(75, 92, 206)',
      queued: 'rgb(114, 114, 114)',
    },
  };

  for (const width of [320, 390, 560, 561, 820, 821, 1280]) {
    for (const theme of ['light', 'dark']) {
      for (const lifecycleState of lifecycleStates) {
        /** 상태·theme·viewport를 독립적으로 확인할 browser context. */
        const context = await createContext({
          viewport: { height: width <= 821 ? 844 : 900, width },
        });
        /** 상태 surface를 확인할 page. */
        const { page, assertNoRuntimeErrors } = await createPage(context, {
          ignoreHttpErrors: true,
        });

        try {
          await page.addInitScript((preference) => {
            localStorage.setItem('mytube-extract-theme-preference', preference);
          }, theme);
          await page.route('https://upload.example/**', async (route) => {
            await route.fulfill({
              body: '',
              headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Expose-Headers': 'ETag',
                ETag: '"subtitle-lifecycle-part"',
              },
              status: 200,
            });
          });
          await routeApi(page, async ({ request, route, url }) => {
            if (url.pathname === '/health') {
              return fulfillJson(route, healthResponse());
            }
            if (url.pathname === '/subtitles/uploads' && request.method() === 'POST') {
              return fulfillJson(route, {
                expiresAt: '2026-08-13T12:00:00.000Z',
                objectKey: 'source/subtitle-lifecycle.mp4',
                partSizeBytes: 1024,
                parts: [{ partNumber: 1, uploadUrl: 'https://upload.example/part-1' }],
                uploadId: 'subtitle-lifecycle-upload',
                uploadToken: 'subtitle-lifecycle-token',
              });
            }
            if (url.pathname === '/subtitles/uploads/complete') {
              return fulfillJson(
                route,
                subtitleJob(
                  SUBTITLE_ID,
                  lifecycleState.apiStatus === 'transcribing'
                    ? 'queued'
                    : lifecycleState.apiStatus,
                  {
                    fileName: 'a-very-long-original-video-file-name-for-subtitle-result.mp4',
                    message:
                      lifecycleState.apiStatus === 'failed'
                        ? '자막 처리 중 긴 오류 안내가 표시되어도 조작 요소와 겹치지 않아야 합니다.'
                        : undefined,
                  },
                ),
              );
            }
            if (url.pathname === `/subtitles/jobs/${SUBTITLE_ID}`) {
              return fulfillJson(
                route,
                subtitleJob(SUBTITLE_ID, lifecycleState.apiStatus, {
                  fileName: 'a-very-long-original-video-file-name-for-subtitle-result.mp4',
                  message:
                    lifecycleState.apiStatus === 'failed'
                      ? '자막 처리 중 긴 오류 안내가 표시되어도 조작 요소와 겹치지 않아야 합니다.'
                      : undefined,
                }),
              );
            }
            return fulfillJson(route, {}, 404);
          });

          await page.goto(`${staticServer.origin}/subtitles`);
          await page.locator('input[type="file"]').setInputFiles({
            buffer: Buffer.from('subtitle-lifecycle-video'),
            mimeType: 'video/mp4',
            name: 'subtitle-lifecycle.mp4',
          });
          const submit = page.getByRole('button', { name: '영어 SRT 생성' });
          await waitForEnabled(submit);
          await submit.click();
          await page.locator('.subtitle-status-panel').waitFor();
          await page
            .getByRole('heading', { name: lifecycleState.expectedHeading })
            .waitFor();

          /** 상태 panel과 문서가 viewport 안에 남는지 확인할 측정값. */
          const layoutMetrics = await page.evaluate(() => {
            /** 현재 자막 상태 panel. */
            const panel = document.querySelector('.subtitle-status-panel');
            /** 상태 아이콘. */
            const icon = document.querySelector('.subtitle-status-icon');
            /** 상태 설명. */
            const message = document.querySelector('.subtitle-status-head p');
            /** 완료 결과 action 영역. */
            const actions = document.querySelector('.subtitle-result-actions');
            /** 완료 결과 다운로드 control. */
            const download = document.querySelector('.subtitle-download-button');
            /** 요소의 viewport 사각형. */
            const toBox = (element) => {
              const rect = element?.getBoundingClientRect();
              return rect
                ? { bottom: rect.bottom, height: rect.height, left: rect.left, right: rect.right, top: rect.top, width: rect.width }
                : null;
            };

            return {
              actions: toBox(actions),
              document: {
                clientWidth: document.documentElement.clientWidth,
                scrollWidth: document.documentElement.scrollWidth,
              },
              download: toBox(download),
              icon: icon ? getComputedStyle(icon).borderTopColor : null,
              legacyStatusClassCount: document.querySelectorAll(
                '.console-panel, .status-panel, .status-head, .status-icon, .status-details, .result-actions, .download-button',
              ).length,
              message: toBox(message),
              panel: toBox(panel),
            };
          });

          assert.deepEqual(layoutMetrics.document, {
            clientWidth: width,
            scrollWidth: width,
          });
          assert.equal(layoutMetrics.legacyStatusClassCount, 0);
          assert.ok(layoutMetrics.panel);
          assert.ok(layoutMetrics.panel.left >= 0);
          assert.ok(layoutMetrics.panel.right <= width);
          assert.equal(
            layoutMetrics.icon,
            expectedToneColors[theme][lifecycleState.expectedTone],
          );
          assert.ok(layoutMetrics.message);

          if (lifecycleState.apiStatus === 'completed') {
            assert.ok(layoutMetrics.actions);
            assert.ok(layoutMetrics.download);
            assert.ok(layoutMetrics.download.height >= 48);
            assert.equal(
              await page.getByText('영어 SRT 다운로드', { exact: true }).count(),
              1,
            );
          }

          if (['queued', 'extracting_audio', 'transcribing'].includes(lifecycleState.apiStatus)) {
            const stepTabs = page.locator('.subtitle-step-tabs .subtitle-step-tab');
            assert.equal(await stepTabs.count(), 4);
            assert.equal(await page.locator('.subtitle-progress-meter').count(), 1);
          }

          assertNoRuntimeErrors();
        } finally {
          await context.close();
        }
      }
    }
  }
}

/** 자막 요청 접수 중·중단의 고유 surface와 포커스 복귀를 검증한다. */
async function verifySubtitleAcceptanceAndCancellationSurfaces() {
  /** 접수 중 상태를 비교할 대표 폭과 테마. */
  for (const width of [320, 390, 1280]) {
    for (const theme of ['light', 'dark']) {
      const context = await createContext({
        viewport: { height: width <= 821 ? 844 : 900, width },
      });
      const { page, assertNoRuntimeErrors } = await createPage(context, {
        ignoreHttpErrors: true,
      });
      let releaseUploadInit;
      let uploadInitStarted;
      let completeCalls = 0;
      let abortCalls = 0;
      const uploadInitGate = new Promise((resolve) => {
        releaseUploadInit = resolve;
      });
      const uploadInitStartedPromise = new Promise((resolve) => {
        uploadInitStarted = resolve;
      });

      try {
        await page.addInitScript((preference) => {
          localStorage.setItem('mytube-extract-theme-preference', preference);
        }, theme);
        await routeApi(page, async ({ request, route, url }) => {
          if (url.pathname === '/health') {
            return fulfillJson(route, healthResponse());
          }
          if (url.pathname === '/subtitles/uploads' && request.method() === 'POST') {
            uploadInitStarted();
            await uploadInitGate;
            try {
              return await fulfillJson(route, {
                expiresAt: '2026-08-13T12:00:00.000Z',
                objectKey: 'source/subtitle-accepting.mp4',
                partSizeBytes: 1024,
                parts: [{ partNumber: 1, uploadUrl: 'https://upload.example/part-1' }],
                uploadId: 'subtitle-accepting-upload',
                uploadToken: 'subtitle-accepting-token',
              });
            } catch {
              return undefined;
            }
          }
          if (url.pathname === '/subtitles/uploads/abort') {
            abortCalls += 1;
            return fulfillJson(route, {});
          }
          if (url.pathname === '/subtitles/uploads/complete') {
            completeCalls += 1;
          }
          return fulfillJson(route, {}, 404);
        });

        await page.goto(`${staticServer.origin}/subtitles`);
        await page.locator('input[type="file"]').setInputFiles({
          buffer: Buffer.from('subtitle-accepting-video'),
          mimeType: 'video/mp4',
          name: 'subtitle-accepting-video.mp4',
        });
        const submit = page.getByRole('button', { name: '영어 SRT 생성' });
        await waitForEnabled(submit);
        await submit.click();
        await uploadInitStartedPromise;
        await page
          .getByRole('heading', { name: '영어 SRT 생성 요청을 준비하고 있습니다' })
          .waitFor();

        /** 접수 중 panel과 navigation이 동일한 surface를 사용하는지 확인한다. */
        const acceptingMetrics = await page.evaluate(() => {
          /** 접수 중 상태 panel. */
          const panel = document.querySelector('.subtitle-status-panel');
          /** 접수 중 상태 아이콘. */
          const icon = document.querySelector('.subtitle-status-icon');

          return {
            document: {
              clientWidth: document.documentElement.clientWidth,
              scrollWidth: document.documentElement.scrollWidth,
            },
            icon: icon ? getComputedStyle(icon).borderTopColor : null,
            panel: panel ? panel.getBoundingClientRect().toJSON() : null,
            progress: document.querySelector('.subtitle-progress-meter'),
            steps: document.querySelector('.subtitle-step-tabs'),
          };
        });
        assert.deepEqual(acceptingMetrics.document, {
          clientWidth: width,
          scrollWidth: width,
        });
        assert.equal(acceptingMetrics.icon, theme === 'dark' ? 'rgb(169, 180, 242)' : 'rgb(75, 92, 206)');
        assert.ok(acceptingMetrics.panel);
        assert.equal(acceptingMetrics.steps, null);
        assert.equal(acceptingMetrics.progress, null);
        assert.equal(
          await page.getByRole('link', { name: '요청 내역' }).getAttribute('aria-disabled'),
          'true',
        );

        await page.getByRole('button', { name: '요청 취소' }).click();
        const picker = page.getByRole('button', {
          name: '영상 선택 또는 드래그 (로컬 영상 파일)',
        });
        await picker.waitFor();
        await waitForCondition(async () =>
          picker.evaluate((element) => document.activeElement === element),
        );
        assert.equal(await page.getByText('subtitle-accepting-video.mp4', { exact: true }).count(), 1);
        assert.equal(await page.getByRole('button', { name: '요청 취소' }).count(), 0);
        assert.equal(completeCalls, 0);
        assert.equal(abortCalls, 0);
        releaseUploadInit();
        await page.waitForTimeout(100);
        assertNoRuntimeErrors();
      } finally {
        releaseUploadInit?.();
        await context.close();
      }
    }
  }
}

/** 자막 접수증 저장 실패 뒤에도 현재 job의 요청 내역 deep link를 보존하는지 검증한다. */
async function verifySubtitleReceiptStorageFallback() {
  /** 접수증 저장 실패를 재현할 독립 browser context. */
  const context = await createContext({ viewport: { height: 844, width: 390 } });
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
    await page.route('https://upload.example/**', async (route) => {
      await route.fulfill({
        body: '',
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'ETag',
          ETag: '"subtitle-fallback-part"',
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
          uploadId: 'upload-fallback-1',
          uploadToken: 'token-fallback-1',
        });
      }
      if (url.pathname === '/subtitles/uploads/complete') {
        return fulfillJson(route, subtitleJob(SUBTITLE_OTHER_ID, 'queued'));
      }
      if (url.pathname === `/subtitles/jobs/${SUBTITLE_OTHER_ID}`) {
        return fulfillJson(route, subtitleJob(SUBTITLE_OTHER_ID, 'completed'));
      }
      return fulfillJson(route, {}, 404);
    });

    await page.goto(`${staticServer.origin}/subtitles`);
    await page.locator('input[type="file"]').setInputFiles({
      buffer: Buffer.from('fake-video'),
      mimeType: 'video/mp4',
      name: 'storage-fallback-video.mp4',
    });
    /** 저장 실패 흐름에서 사용할 영어 SRT 생성 button. */
    const submit = page.getByRole('button', { name: '영어 SRT 생성' });
    await waitForEnabled(submit);
    await submit.click();
    await page.getByRole('heading', { name: '영어 자막 파일이 준비되었습니다' }).waitFor();
    await page
      .getByText('요청 내역 저장에 실패했지만 현재 작업은 계속 확인할 수 있습니다.', { exact: true })
      .waitFor();

    /** 저장 실패 job을 가리키는 요청 내역 deep link. */
    const historyLink = page.getByRole('link', { name: '요청 내역' }).first();
    assert.equal(
      await historyLink.getAttribute('href'),
      `/history?kind=subtitle&jobId=${SUBTITLE_OTHER_ID}`,
    );
    await historyLink.click();
    await page.getByRole('heading', { name: '요청 내역' }).waitFor();
    assert.equal(await page.locator('.history-item').count(), 1);
    assert.equal(new URL(page.url()).searchParams.get('jobId'), SUBTITLE_OTHER_ID);
    assertNoRuntimeErrors();
  } finally {
    await context.close();
  }
}

/** 자막 multipart 업로드를 취소하고 cleanup·파일 유지·navigation 경계를 확인한다. */
async function verifySubtitleRequestCancellation() {
  const context = await createContext({ viewport: { height: 844, width: 390 } });
  const { page, assertNoRuntimeErrors } = await createPage(context, {
    ignoreHttpErrors: true,
  });
  let releaseUpload;
  let uploadStarted;
  let completeCalls = 0;
  let abortCalls = 0;
  let cancelCalls = 0;
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
      try {
        await route.fulfill({
          body: '',
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Expose-Headers': 'ETag',
            ETag: '"part-1"',
          },
          status: 200,
        });
      } catch {
        // 취소된 browser fetch가 route 응답을 무시하는 것은 정상적인 경계다.
      }
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
        completeCalls += 1;
        return fulfillJson(route, subtitleJob(SUBTITLE_OTHER_ID, 'queued'));
      }
      if (url.pathname === '/subtitles/uploads/abort') {
        abortCalls += 1;
        return fulfillJson(route, {});
      }
      if (url.pathname.includes('/cancel')) {
        cancelCalls += 1;
      }
      return fulfillJson(route, {}, 404);
    });

    await page.goto(`${staticServer.origin}/subtitles`);
    await page.locator('input[type="file"]').setInputFiles({
      buffer: Buffer.from('fake-video'),
      mimeType: 'video/mp4',
      name: 'cancel-video.mp4',
    });
    const submit = page.getByRole('button', { name: '영어 SRT 생성' });
    await waitForEnabled(submit);
    await submit.click();
    await uploadStartedPromise;
    await page.getByRole('heading', { name: '원본 영상을 업로드 중입니다' }).waitFor();

    await page.getByRole('button', { name: '요청 취소' }).click();
    await page.getByRole('heading', { name: '자막 추출' }).waitFor();
    const picker = page.getByRole('button', {
      name: '영상 선택 또는 드래그 (로컬 영상 파일)',
    });
    await waitForCondition(async () =>
      picker.evaluate((element) => document.activeElement === element),
    );
    assert.equal(await page.getByText('cancel-video.mp4', { exact: true }).count(), 1);
    await page
      .getByText('요청을 중단했습니다. 선택한 파일과 처리 방식은 그대로입니다. 다시 요청할 수 있습니다.', {
        exact: true,
      })
      .waitFor();
    await waitForCondition(async () => abortCalls === 1);
    assert.equal(completeCalls, 0);
    assert.equal(cancelCalls, 0);
    assert.equal(await receiptCount(page), 0);
    for (const link of await page.locator('nav[aria-label="주요 메뉴"]:visible a').all()) {
      assert.equal(await link.getAttribute('aria-disabled'), null);
    }
    assert.equal(await page.getByRole('button', { name: '요청 취소' }).count(), 0);

    releaseUpload();
    await page.waitForTimeout(100);
    assertNoRuntimeErrors();
  } finally {
    releaseUpload?.();
    await context.close();
  }
}

/** U/F 키가 요청 control로 포커스를 이동시키지 않고 URL에는 일반 문자로 입력되는지 확인한다. */
async function verifyRequestShortcuts() {
  const context = await createContext({ viewport: { height: 844, width: 390 } });
  const { page, assertNoRuntimeErrors } = await createPage(context);

  try {
    await routeApi(page, async ({ route, url }) => {
      if (url.pathname === '/health') return fulfillJson(route, healthResponse());
      return fulfillJson(route, {}, 404);
    });

    await page.goto(`${staticServer.origin}/video`);
    const sourceUrl = page.getByLabel('YouTube URL');
    await sourceUrl.waitFor();
    await page.evaluate(() => {
      document.body.tabIndex = -1;
      document.body.focus();
    });
    await page.keyboard.press('u');
    assert.equal(
      await sourceUrl.evaluate((element) => document.activeElement === element),
      false,
    );
    await sourceUrl.fill('https://youtu.be/abc123_DEF0');
    await page.keyboard.press('u');
    assert.equal(await sourceUrl.inputValue(), 'https://youtu.be/abc123_DEF0u');
    await page.evaluate(() => document.body.focus());
    await page.keyboard.press('Control+u');
    assert.equal(
      await sourceUrl.evaluate((element) => document.activeElement === element),
      false,
    );
    assert.equal(new URL(page.url()).pathname, '/video');

    await page.goto(`${staticServer.origin}/subtitles`);
    const picker = page.getByRole('button', {
      name: '영상 선택 또는 드래그 (로컬 영상 파일)',
    });
    await picker.waitFor();
    await page.evaluate(() => {
      document.body.tabIndex = -1;
      document.body.focus();
    });
    await page.keyboard.press('f');
    assert.equal(
      await picker.evaluate((element) => document.activeElement === element),
      false,
    );
    await page.evaluate(() => document.body.focus());
    await page.keyboard.press('Control+f');
    assert.equal(
      await picker.evaluate((element) => document.activeElement === element),
      false,
    );
    assert.equal(new URL(page.url()).pathname, '/subtitles');
    assertNoRuntimeErrors();
  } finally {
    await context.close();
  }
}

/** 자막 처리 방식 설명과 처리 단계의 반응형 표시를 검증한다. */
async function verifySubtitleProcessingChoice() {
  /** 선택 화면과 처리 화면을 확인할 모바일·데스크톱 viewport 폭. */
  for (const width of [320, 390, 560, 1280]) {
    /** 각 viewport에서 확인할 theme preference. */
    for (const theme of ['light', 'dark']) {
      /** viewport·theme별 자막 처리 방식 검증 context. */
      const context = await createContext({
        viewport: { height: width <= 820 ? 844 : 900, width },
      });
      /** 자막 처리 방식 검증 page. */
      const { page, assertNoRuntimeErrors } = await createPage(context);
      await page.emulateMedia({ reducedMotion: 'reduce' });

      try {
        await page.addInitScript((preference) => {
          localStorage.setItem('mytube-extract-theme-preference', preference);
        }, theme);
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
        await page.getByRole('heading', { name: '자막 추출' }).waitFor();
        await page.locator('.subtitle-form').waitFor();
        assert.equal(
          await page.evaluate(() => document.documentElement.dataset.theme),
          theme,
        );

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
        const submit = form?.querySelector('.subtitle-submit-button');
        /** 입력 흐름 뒤에 표시하는 readiness 보조 영역. */
        const readiness = panel?.querySelector('.worker-health-status');
        /** 전체 문서에서 요소의 읽기 위치를 반환한다. */
        const getDocumentIndex = (element) =>
          element ? [...document.querySelectorAll('*')].indexOf(element) : -1;

        return {
          formContainsReadiness: Boolean(form && readiness && form.contains(readiness)),
          indexes: [readiness, picker, processingMethod, submit].map(getDocumentIndex),
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
      /** 현재 테마가 자막 입력 control에 적용해야 하는 semantic 색상. */
      const expectedSubtitleInputTheme = theme === 'dark'
        ? {
            action: 'rgb(230, 0, 18)',
            border: 'rgb(118, 118, 118)',
            danger: 'rgb(255, 138, 128)',
            disabled: 'rgb(92, 89, 85)',
            onAction: 'rgb(255, 255, 255)',
            surface: 'rgb(32, 33, 36)',
            surfaceAlt: 'rgb(41, 42, 45)',
            textPrimary: 'rgb(242, 240, 238)',
            textSecondary: 'rgb(179, 176, 172)',
          }
        : {
            action: 'rgb(230, 0, 18)',
            border: 'rgb(138, 138, 138)',
            danger: 'rgb(198, 40, 40)',
            disabled: 'rgb(200, 200, 200)',
            onAction: 'rgb(255, 255, 255)',
            surface: 'rgb(248, 248, 248)',
            surfaceAlt: 'rgb(239, 239, 239)',
            textPrimary: 'rgb(72, 72, 72)',
            textSecondary: 'rgb(114, 114, 114)',
          };
      /** 자막 입력 control의 초기 computed style을 읽는다. */
      const initialInputStyles = await page.evaluate(() => {
        /** 파일 선택 control. */
        const dropzone = document.querySelector('.subtitle-dropzone');
        /** 처리 방식 선택지. */
        const processingOptions = [...document.querySelectorAll('.subtitle-processing-option')];
        /** 제출 button. */
        const submit = document.querySelector('.subtitle-submit-button');
        /** 선택지 style을 직렬화한다. */
        const serializeOption = (element) => {
          const style = getComputedStyle(element);
          return {
            borderColor: style.borderTopColor,
            textColor: style.color,
            textDecoration: style.textDecorationLine,
          };
        };
        /** 제출 button style을 직렬화한다. */
        const submitStyle = getComputedStyle(submit);
        /** 파일 선택 control style을 직렬화한다. */
        const dropzoneStyle = getComputedStyle(dropzone);

        return {
          dropzone: {
            backgroundColor: dropzoneStyle.backgroundColor,
            borderColor: dropzoneStyle.borderTopColor,
            borderRadius: dropzoneStyle.borderTopLeftRadius,
            borderStyle: dropzoneStyle.borderTopStyle,
            color: dropzoneStyle.color,
            hintColor: getComputedStyle(dropzone?.querySelector('span')).color,
            hintFontSize: getComputedStyle(dropzone?.querySelector('span')).fontSize,
            primaryCopyColor: getComputedStyle(dropzone?.querySelector('strong')).color,
            primaryCopyFontSize: getComputedStyle(dropzone?.querySelector('strong')).fontSize,
          },
          options: processingOptions.map(serializeOption),
          submit: {
            backgroundColor: submitStyle.backgroundColor,
            borderColor: submitStyle.borderTopColor,
            boxShadow: submitStyle.boxShadow,
            color: submitStyle.color,
          },
        };
      });
      assert.deepEqual(initialInputStyles.dropzone, {
        backgroundColor: expectedSubtitleInputTheme.surfaceAlt,
        borderColor: expectedSubtitleInputTheme.border,
        borderRadius: '12px',
        borderStyle: 'dashed',
        color: expectedSubtitleInputTheme.textSecondary,
        hintColor: expectedSubtitleInputTheme.textSecondary,
        hintFontSize: '14px',
        primaryCopyColor: expectedSubtitleInputTheme.textPrimary,
        primaryCopyFontSize: '16px',
      });
      assert.equal(initialInputStyles.options[0].borderColor, expectedSubtitleInputTheme.action);
      assert.equal(initialInputStyles.options[0].textColor, expectedSubtitleInputTheme.textPrimary);
      assert.equal(initialInputStyles.options[0].textDecoration, 'underline');
      assert.equal(initialInputStyles.options[1].borderColor, expectedSubtitleInputTheme.border);
      assert.equal(initialInputStyles.options[1].textColor, expectedSubtitleInputTheme.textSecondary);
      assert.equal(initialInputStyles.options[1].textDecoration, 'none');
      assert.equal(initialInputStyles.submit.backgroundColor, expectedSubtitleInputTheme.surfaceAlt);
      assert.equal(initialInputStyles.submit.borderColor, expectedSubtitleInputTheme.border);
      assert.doesNotMatch(initialInputStyles.submit.boxShadow, /2px 8px/);
      assert.equal(initialInputStyles.submit.color, expectedSubtitleInputTheme.disabled);
      await dispatchSubtitleFileDrop(page, page.locator('.subtitle-dropzone'), {
        mimeType: 'text/plain',
        name: 'invalid-video.txt',
      });
      await page
        .getByText('mp4, mov, webm 영상 파일만 사용할 수 있습니다.', { exact: true })
        .waitFor();
      /** 잘못된 파일 입력에 적용된 danger 색상. */
      const invalidInputStyles = await page.evaluate(() => ({
        dropzoneBorder: getComputedStyle(document.querySelector('.subtitle-dropzone')).borderTopColor,
        feedbackColor: getComputedStyle(document.querySelector('#subtitle-file-feedback')).color,
      }));
      assert.deepEqual(invalidInputStyles, {
        dropzoneBorder: expectedSubtitleInputTheme.danger,
        feedbackColor: expectedSubtitleInputTheme.danger,
      });
      assert.equal(await page.locator('.selected-file-row').count(), 0);
      assert.equal(
        await page.getByRole('button', { name: '영어 SRT 생성' }).isDisabled(),
        true,
      );
      await accuracyOption.check();
      assert.equal(await accuracyOption.isChecked(), true);
      /** 두 번째 처리 방식 선택 후의 selected state style. */
      const selectedProcessingStyles = await processingOptions.evaluateAll((options) =>
        options.map((option) => {
          const style = getComputedStyle(option);
          return {
            borderColor: style.borderTopColor,
            textColor: style.color,
            textDecoration: style.textDecorationLine,
          };
        }),
      );
      assert.equal(selectedProcessingStyles[0].borderColor, expectedSubtitleInputTheme.border);
      assert.equal(selectedProcessingStyles[0].textDecoration, 'none');
      assert.equal(selectedProcessingStyles[1].borderColor, expectedSubtitleInputTheme.action);
      assert.equal(selectedProcessingStyles[1].textColor, expectedSubtitleInputTheme.textPrimary);
      assert.equal(selectedProcessingStyles[1].textDecoration, 'underline');
      assert.equal(await page.getByText('파일의 음성을 영어 자막 파일(SRT)로 만들 처리 방향을 선택하세요.', { exact: true }).count(), 1);
      assert.equal(await page.getByText('파일을 빠르게 영어 자막으로 만들고 싶을 때', { exact: true }).count(), 1);
      assert.equal(await page.getByText('음성을 더 꼼꼼하게 영어 자막으로 옮기고 싶을 때', { exact: true }).count(), 1);
      assert.equal(await page.getByText(/예상 처리 시간/, { exact: false }).count(), 0);
      assert.equal(await page.getByText(/R2/, { exact: false }).count(), 0);
      /** 접힌 기술 처리 정보 disclosure. */
      const processingDetails = page.locator('.subtitle-processing-method__details');
      const processingSummary = processingDetails.locator('summary');
      assert.equal(await processingDetails.getAttribute('open'), null);
      assert.equal(await processingSummary.innerText(), '기술적인 처리 정보');
      assert.ok((await processingSummary.boundingBox())?.height >= 44);
      assert.equal(
        await processingSummary.evaluate((element) =>
          getComputedStyle(element, '::after').transitionDuration,
        ),
        '0s',
      );
      assert.equal(await processingDetails.getByText('속도 우선: base.en · 상대적으로 빠른 처리', { exact: true }).isVisible(), false);
      assert.equal(await processingDetails.getByText('정확도 우선: small.en · 인식 정확도를 우선하는 처리', { exact: true }).isVisible(), false);
      await processingSummary.focus();
      await page.keyboard.press('Enter');
      await processingDetails.getByText('영어 전용 자막은 로컬 Whisper로 처리합니다.', { exact: true }).waitFor();
      assert.equal(await processingDetails.getAttribute('open'), '');
      assert.equal(await processingDetails.getByText('속도 우선: base.en · 상대적으로 빠른 처리', { exact: true }).isVisible(), true);
      await processingSummary.press('Space');
      assert.equal(await processingDetails.getAttribute('open'), null);
      await processingSummary.click();
      assert.equal(await processingDetails.getAttribute('open'), '');
      assert.ok(
        await page.evaluate(() => {
          /** 첫 처리 방식의 사용자 중심 설명. */
          const description = document.querySelector(
            '.subtitle-processing-option__description',
          );
          /** 처리 방식 disclosure. */
          const technical = document.querySelector(
            '.subtitle-processing-method__details',
          );

          return Boolean(
            description &&
              technical &&
              description.compareDocumentPosition(technical) &
                Node.DOCUMENT_POSITION_FOLLOWING,
          );
        }),
      );
      await processingSummary.click();
      assert.equal(await processingDetails.getAttribute('open'), null);
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
        const submit = document.querySelector('.subtitle-form .subtitle-submit-button');
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
      assert.ok(layoutMetrics.submit.height >= 48);
      assert.ok(layoutMetrics.readiness.bottom <= layoutMetrics.dropzone.top);
      assert.equal(await page.locator('.submit-disabled-reason').count(), 0);
      assert.equal(
        await page.locator('.subtitle-dropzone').getAttribute('aria-describedby'),
        'subtitle-file-feedback',
      );
      if (width <= 820) {
        assert.ok(layoutMetrics.navigation);
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        /** 문서 끝에서 fixed navigation 위로 올라온 제출·readiness 영역. */
        const scrolledMetrics = await page.evaluate(() => {
          /** 현재 주요 navigation. */
          const navigation = [...document.querySelectorAll('nav[aria-label="주요 메뉴"]')]
            .find((element) => getComputedStyle(element).display !== 'none');
          /** 제출 button. */
          const submit = document.querySelector('.subtitle-form .subtitle-submit-button');
          /** 마지막 서비스 상태 영역. */
          const readiness = document.querySelector('.worker-health-status');
          return {
            navigationTop: navigation?.getBoundingClientRect().top,
            readinessBottom: readiness?.getBoundingClientRect().bottom,
            submitBottom: submit?.getBoundingClientRect().bottom,
          };
        });
        assert.ok(scrolledMetrics.navigationTop !== undefined);
        assert.ok(scrolledMetrics.readinessBottom !== undefined);
        assert.ok(scrolledMetrics.submitBottom !== undefined);
        assert.ok(scrolledMetrics.submitBottom <= scrolledMetrics.navigationTop);
        assert.ok(scrolledMetrics.navigationTop - scrolledMetrics.readinessBottom >= 8);
      }

      /** 처리 방식 선택 후 영어 SRT 생성 요청. */
      const submit = page.getByRole('button', { name: '영어 SRT 생성' });
      await page.locator('input[type="file"]').setInputFiles({
        buffer: Buffer.from('fake-video'),
        mimeType: 'video/mp4',
        name: 'sample.mp4',
      });
      await waitForEnabled(submit);
      const enabledSubmitStyles = await submit.evaluate((element) => {
        /** 활성 제출 button style. */
        const style = getComputedStyle(element);
        return {
          backgroundColor: style.backgroundColor,
          boxShadow: style.boxShadow,
          color: style.color,
        };
      });
      assert.equal(enabledSubmitStyles.backgroundColor, expectedSubtitleInputTheme.action);
      assert.match(enabledSubmitStyles.boxShadow, /2px 8px/);
      assert.equal(enabledSubmitStyles.color, expectedSubtitleInputTheme.onAction);
      /** 선택한 파일을 지우는 실제 조작 영역. */
      const clearSelectedFileButton = page.locator('.selected-file-row button');
      const clearSelectedFileBox = await clearSelectedFileButton.boundingBox();
      assert.ok(clearSelectedFileBox && clearSelectedFileBox.width >= 44 && clearSelectedFileBox.height >= 44);
      await waitForEnabled(submit);
      await submit.click();
      await page.locator('.subtitle-step-tabs').waitFor();
      assert.equal(await page.locator('.request-flow[data-flow-stage="extract"]').count(), 1);

      /** 실제 자막 처리 단계 네 개. */
      const stepTabs = page.locator('.subtitle-step-tabs .subtitle-step-tab');
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
    await page.getByRole('heading', { name: '자막 추출' }).waitFor();
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
      false,
    );
    assert.equal(await page.getByText('dropped-video.webm', { exact: true }).count(), 1);

    await page.getByRole('button', { name: '지우기' }).click();
    assert.equal(await page.getByText('dropped-video.webm', { exact: true }).count(), 0);
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
      await page.getByRole('heading', { name: '자막 추출' }).count(),
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

/** 정상 영상이 있는 상태에서 잘못된 drop이 선택·처리 방식·실제 요청 대상을 보존하는지 검증한다. */
async function verifyInvalidSubtitleDropPreservesSelection() {
  /** 잘못된 drop 보존 흐름을 확인할 독립 browser context. */
  const context = await createContext({ viewport: { height: 844, width: 390 } });
  /** 잘못된 drop 뒤 제출 가능 상태와 요청 body를 확인할 page. */
  const { page, assertNoRuntimeErrors } = await createPage(context);
  /** 자막 업로드 session 생성 요청에서 확인할 원본 정보. */
  const uploadRequests = [];

  try {
    await page.route('https://upload.example/**', async (route) => {
      await route.fulfill({
        body: '',
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'ETag',
          ETag: '"preserved-file-part"',
        },
        status: 200,
      });
    });
    await routeApi(page, async ({ request, route, url }) => {
      if (url.pathname === '/health') return fulfillJson(route, healthResponse());
      if (url.pathname === '/subtitles/uploads' && request.method() === 'POST') {
        uploadRequests.push(request.postDataJSON());
        return fulfillJson(route, {
          expiresAt: '2026-08-13T12:00:00.000Z',
          objectKey: 'source/preserved-video.mp4',
          partSizeBytes: 1024,
          parts: [{ partNumber: 1, uploadUrl: 'https://upload.example/preserved-file-part' }],
          uploadId: 'preserved-upload-1',
          uploadToken: 'preserved-upload-token',
        });
      }
      if (url.pathname === '/subtitles/uploads/complete') {
        return fulfillJson(
          route,
          subtitleJob(SUBTITLE_ID, 'completed', {
            fileName: 'preserved-video.mp4',
          }),
        );
      }
      if (url.pathname === `/subtitles/jobs/${SUBTITLE_ID}`) {
        return fulfillJson(
          route,
          subtitleJob(SUBTITLE_ID, 'completed', {
            fileName: 'preserved-video.mp4',
          }),
        );
      }
      return fulfillJson(route, {}, 404);
    });

    await page.goto(`${staticServer.origin}/subtitles`);
    /** 현재 선택을 조작할 자막 file picker. */
    const picker = page.getByRole('button', {
      name: '영상 선택 또는 드래그 (로컬 영상 파일)',
    });
    await picker.waitFor();
    await dispatchSubtitleFileDrop(page, picker, {
      mimeType: 'video/mp4',
      name: 'preserved-video.mp4',
    });
    await page.getByText('preserved-video.mp4', { exact: true }).waitFor();

    /** 기존 선택에서 유지해야 하는 처리 방식. */
    const accuracyOption = page.getByRole('radio', { name: /정확도 우선/ });
    await accuracyOption.check();
    await dispatchSubtitleFileDrop(page, picker, {
      mimeType: 'text/plain',
      name: 'rejected-video.txt',
    });
    await page
      .getByText('mp4, mov, webm 영상 파일만 사용할 수 있습니다.', { exact: true })
      .waitFor();

    assert.equal(await page.getByText('preserved-video.mp4', { exact: true }).count(), 1);
    assert.equal(await page.getByText('rejected-video.txt', { exact: true }).count(), 0);
    assert.equal(
      await page.getByRole('button', { name: '영어 SRT 생성' }).isDisabled(),
      false,
    );
    assert.equal(await accuracyOption.isChecked(), true);

    await page.getByRole('button', { name: '영어 SRT 생성' }).click();
    await page
      .getByRole('heading', { name: '영어 자막 파일이 준비되었습니다' })
      .waitFor();
    await waitForCondition(async () => uploadRequests.length === 1);
    assert.equal(uploadRequests[0].fileName, 'preserved-video.mp4');
    assert.equal(uploadRequests[0].contentType, 'video/mp4');
    assert.equal(uploadRequests[0].whisperModel, 'small_en');
    assertNoRuntimeErrors();
  } finally {
    await context.close();
  }
}

/** 선택이 없거나 파일이 아닌 drop에서도 오류·첫 파일 정책·정상 복구를 검증한다. */
async function verifyInvalidSubtitleDropWithoutSelection() {
  /** 선택 보존 경계를 확인할 독립 browser context. */
  const context = await createContext({ viewport: { height: 844, width: 390 } });
  /** 빈 선택과 재선택 경로를 확인할 page. */
  const { page, assertNoRuntimeErrors } = await createPage(context);

  try {
    await routeApi(page, async ({ route, url }) => {
      if (url.pathname === '/health') return fulfillJson(route, healthResponse());
      return fulfillJson(route, {}, 404);
    });

    await page.goto(`${staticServer.origin}/subtitles`);
    /** 선택·오류 상태를 확인할 자막 file picker. */
    const picker = page.getByRole('button', {
      name: '영상 선택 또는 드래그 (로컬 영상 파일)',
    });
    /** 현재 선택이 없을 때 비활성화되어야 하는 제출 button. */
    const submit = page.getByRole('button', { name: '영어 SRT 생성' });
    await picker.waitFor();
    await dispatchSubtitleFileDrop(page, picker, {
      mimeType: 'video/mp4',
      name: 'kept-video.mp4',
    });
    await page.getByText('kept-video.mp4', { exact: true }).waitFor();

    await dispatchSubtitleDataTransferDrop(page, picker, {
      text: 'https://example.test/video',
    });
    assert.equal(await page.getByText('kept-video.mp4', { exact: true }).count(), 1);

    await dispatchSubtitleDataTransferDrop(page, picker, {
      files: [
        { mimeType: 'video/mp4', name: 'first-rejected.txt' },
        { mimeType: 'video/mp4', name: 'second-valid.mp4' },
      ],
    });
    await page
      .getByText('mp4, mov, webm 영상 파일만 사용할 수 있습니다.', { exact: true })
      .waitFor();
    assert.equal(await page.getByText('kept-video.mp4', { exact: true }).count(), 1);
    assert.equal(await page.getByText('second-valid.mp4', { exact: true }).count(), 0);
    assert.equal(await submit.isDisabled(), false);

    await dispatchSubtitleFileDrop(page, picker, {
      mimeType: '',
      name: 'empty-mime.mp4',
    });
    await page
      .getByText('mp4, mov, webm 영상 파일만 사용할 수 있습니다.', { exact: true })
      .waitFor();
    assert.equal(await page.getByText('kept-video.mp4', { exact: true }).count(), 1);

    await page.getByRole('button', { name: '지우기' }).click();
    assert.equal(await page.locator('.selected-file-row').count(), 0);
    assert.equal(await submit.isDisabled(), true);

    await dispatchSubtitleFileDrop(page, picker, {
      mimeType: 'text/plain',
      name: 'rejected-without-selection.txt',
    });
    await page
      .getByText('mp4, mov, webm 영상 파일만 사용할 수 있습니다.', { exact: true })
      .waitFor();
    assert.equal(await page.locator('.selected-file-row').count(), 0);
    assert.equal(await page.getByText('rejected-without-selection.txt', { exact: true }).count(), 0);
    assert.equal(await submit.isDisabled(), true);

    await dispatchSubtitleFileDrop(page, picker, {
      mimeType: 'video/webm',
      name: 'replacement-video.webm',
    });
    await page.getByText('replacement-video.webm', { exact: true }).waitFor();
    assert.equal(
      await page.getByText('mp4, mov, webm 영상 파일만 사용할 수 있습니다.', { exact: true }).count(),
      0,
    );
    assert.equal(await submit.isDisabled(), false);
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
  await dispatchSubtitleDataTransferDrop(page, picker, { files: [file] });
}

/** 브라우저 DataTransfer로 파일·링크·텍스트 drop을 발생시킨다. */
async function dispatchSubtitleDataTransferDrop(page, picker, input = {}) {
  await picker.evaluate(
    (element, dropInput) => {
      /** 브라우저가 전달할 파일 묶음. */
      const dataTransfer = new DataTransfer();
      for (const droppedFile of dropInput.files ?? []) {
        dataTransfer.items.add(
          new File(['subtitle-picker-test'], droppedFile.name, {
            type: droppedFile.mimeType,
          }),
        );
      }
      if (dropInput.text) {
        dataTransfer.setData('text/plain', dropInput.text);
      }
      element.dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
        }),
      );
    },
    input,
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
  /** 영상 상태 API 호출 수. */
  let videoStatusCalls = 0;
  /** 자막 상태 API 호출 수. */
  let subtitleStatusCalls = 0;

  try {
    await seedReceipts(page, [
      ['video', VIDEO_ID, '2026-08-11T00:00:00.000Z'],
      ['subtitle', SUBTITLE_ID, '2026-08-11T00:01:00.000Z'],
    ]);
    await routeApi(page, async ({ route, url }) => {
      if (url.pathname === `/downloads/${VIDEO_ID}`) {
        videoStatusCalls += 1;
        const status = videoStatusCalls === 1 ? 'queued' : videoStatusCalls === 2 ? 'processing' : 'completed';
        return fulfillJson(route, videoJob(VIDEO_ID, status));
      }
      if (url.pathname === `/subtitles/jobs/${SUBTITLE_ID}`) {
        subtitleStatusCalls += 1;
        const status = subtitleStatusCalls === 1 ? 'queued' : subtitleStatusCalls === 2 ? 'transcribing' : 'completed';
        return fulfillJson(route, subtitleJob(SUBTITLE_ID, status));
      }
      if (url.pathname === '/health') return fulfillJson(route, healthResponse());
      return fulfillJson(route, {}, 404);
    });

    await page.goto(`${staticServer.origin}/history`);
    await page.evaluate(() => {
      /** polling 동안 live region에 표시된 상태 전환 공지. */
      window.__historyStatusAnnouncements = [];
      /** 짧게 교체되는 공지도 놓치지 않고 기록할 observer. */
      const announcementObserver = new MutationObserver(() => {
        /** 현재 live region에 표시된 공지. */
        const message = document
          .querySelector('.history-panel > .history-announcement')
          ?.textContent?.trim();

        if (message) {
          window.__historyStatusAnnouncements.push(message);
        }
      });
      announcementObserver.observe(document.body, {
        characterData: true,
        childList: true,
        subtree: true,
      });
    });
    await waitForCondition(
      async () =>
        (await page.locator('.history-status').getByText('완료', { exact: true }).count()) === 2,
    );
    await waitForCondition(async () => {
      /** 관찰 기간에 기록한 모든 상태 전환 공지. */
      const messages = await page.evaluate(
        () => window.__historyStatusAnnouncements.join(' '),
      );
      return messages.includes('영상 요청') && messages.includes('자막 요청');
    });
    /** terminal 상태에 도달했을 때 종류별 API 호출 수. */
    const terminalCallCounts = {
      subtitle: subtitleStatusCalls,
      video: videoStatusCalls,
    };
    await page.waitForTimeout(3_000);
    assert.deepEqual(
      { subtitle: subtitleStatusCalls, video: videoStatusCalls },
      terminalCallCounts,
    );
    assert.ok(videoStatusCalls >= 3);
    assert.ok(subtitleStatusCalls >= 3);
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
    await page.getByRole('heading', { name: '영상 추출' }).waitFor();
    await page.getByRole('link', { name: '요청 내역', exact: true }).click();
    await page
      .getByRole('heading', { name: '요청 내역' })
      .waitFor();
    await waitForHistoryCount(page, 0);
    assert.equal(await page.getByRole('button', { name: /되돌리기/ }).count(), 0);
    assertNoRuntimeErrors();
  } finally {
    await context.close();
  }
}

/** 삭제 후 undo 안내와 빈 상태가 viewport·하단 navigation을 침범하지 않는지 검증한다. */
async function verifyHistoryDeleteUndoResponsiveLayout() {
  /** 삭제·복원 표면을 확인할 viewport 폭. */
  for (const width of [320, 390, 1280]) {
    /** 삭제·복원 표면을 확인할 테마. */
    for (const theme of ['light', 'dark']) {
      /** 현재 viewport에 맞춘 독립 browser context. */
      const context = await createContext({
        viewport: { height: width <= 820 ? 844 : 900, width },
      });
      /** 현재 theme와 viewport의 history page. */
      const { page, assertNoRuntimeErrors } = await createPage(context);

      try {
        await page.addInitScript((preference) => {
          localStorage.setItem(
            'mytube-extract-theme-preference',
            preference,
          );
        }, theme);
        await seedReceipts(page, [
          ['video', VIDEO_ID, '2026-08-11T00:00:00.000Z'],
        ]);
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
        await page.getByText('시작할 작업을 선택하세요.', { exact: true }).waitFor();
        await page
          .getByRole('button', { name: '삭제한 영상 요청 되돌리기' })
          .waitFor();

        /** 삭제 후 undo·빈 상태의 실제 viewport 영역. */
        const layoutMetrics = await page.evaluate(() => {
          /** 요소의 viewport 사각형을 직렬화한다. */
          const toBox = (element) => {
            const rect = element?.getBoundingClientRect();
            return rect
              ? {
                  bottom: rect.bottom,
                  height: rect.height,
                  left: rect.left,
                  right: rect.right,
                  top: rect.top,
                  width: rect.width,
                }
              : null;
          };
          /** 삭제 직후 표시되는 undo 안내. */
          const undo = document.querySelector('.history-undo');
          /** undo 안내의 실제 조작 button. */
          const undoButton = document.querySelector('.history-undo__button');
          /** 삭제 직후 함께 표시되는 빈 history surface. */
          const emptyState = document.querySelector('.history-empty');

          return {
            document: {
              clientWidth: document.documentElement.clientWidth,
              scrollWidth: document.documentElement.scrollWidth,
            },
            emptyState: toBox(emptyState),
            undo: undo
              ? {
                  box: toBox(undo),
                  clientWidth: undo.clientWidth,
                  scrollWidth: undo.scrollWidth,
                }
              : null,
            undoButton: toBox(undoButton),
          };
        });

        assert.deepEqual(layoutMetrics.document, {
          clientWidth: width,
          scrollWidth: width,
        });
        assert.ok(
          layoutMetrics.undo?.box &&
            layoutMetrics.undo.box.left >= 0 &&
            layoutMetrics.undo.box.right <= width &&
            layoutMetrics.undo.scrollWidth <= layoutMetrics.undo.clientWidth,
        );
        assert.ok(
          layoutMetrics.undoButton &&
            layoutMetrics.undoButton.width >= 44 &&
            layoutMetrics.undoButton.height >= 44 &&
            layoutMetrics.undoButton.left >= 0 &&
            layoutMetrics.undoButton.right <= width,
        );
        assert.ok(layoutMetrics.emptyState);
        await verifyResponsiveNavigationLayout(page, width, '/history');
        assertNoRuntimeErrors();
      } finally {
        await context.close();
      }
    }
  }
}

/** 삭제 storage 접근 실패 시 기존 항목과 실패 공지를 유지하는지 검증한다. */
async function verifyHistoryDeleteStorageFailure() {
  /** 삭제 storage 실패를 확인할 독립 browser context. */
  const context = await createContext();
  /** 삭제 storage 실패를 확인할 history page. */
  const { page, assertNoRuntimeErrors } = await createPage(context);

  try {
    await page.addInitScript(({ key, prefix }) => {
      localStorage.setItem(key, JSON.stringify({ acceptedAt: '2026-08-11T00:00:00.000Z' }));

      /** 원래 removeItem 함수. */
      const removeItem = Storage.prototype.removeItem;

      Storage.prototype.removeItem = function blockReceiptRemoval(storageKey) {
        if (storageKey.startsWith(prefix)) {
          throw new DOMException('Receipt storage is disabled.', 'SecurityError');
        }

        return removeItem.call(this, storageKey);
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

    /** 삭제 실패를 전달한 alert 문장. */
    const alertMessage = page.getByRole('alert');
    await alertMessage.waitFor();
    const alertText = await alertMessage.textContent();

    assert.match(alertText ?? '', /삭제하지 못했습니다/);
    assert.doesNotMatch(alertText ?? '', /내역에서 삭제했습니다/);
    assert.equal(await page.locator('.history-item').count(), 1);
    assert.equal(await page.getByRole('heading', { name: '영상 요청' }).count(), 1);
    assert.equal(await page.getByRole('button', { name: /되돌리기/ }).count(), 0);
    assert.notEqual(
      await page.evaluate((key) => localStorage.getItem(key), receiptKey('video', VIDEO_ID)),
      null,
    );
    assert.equal(await page.getByRole('alert').count(), 1);
    assert.equal(await page.getByRole('status').count(), 0);
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

/** 빈 요청 내역의 시작점·보관 모델·표면 계층을 viewport와 theme별로 검증한다. */
async function verifyEmptyHistoryProductModel() {
  /** 빈 상태를 확인할 모바일·데스크톱 viewport 폭. */
  for (const width of [320, 390, 1280]) {
    /** 빈 내역의 light·dark 표면을 각각 독립적으로 확인한다. */
    for (const theme of ['light', 'dark']) {
      /** 빈 내역의 모바일·데스크톱 viewport. */
      const context = await createContext({
        viewport: { height: width <= 820 ? 844 : 900, width },
      });
      /** 빈 상태 browser page와 runtime error assertion. */
      const { page, assertNoRuntimeErrors } = await createPage(context);

      try {
        await page.addInitScript((preference) => {
          localStorage.setItem(
            'mytube-extract-theme-preference',
            preference,
          );
        }, theme);
        await page.goto(`${staticServer.origin}/history`);
        await page.getByText('시작할 작업을 선택하세요.', { exact: true }).waitFor();

        assert.equal(await page.getByRole('heading', { name: '요청 내역' }).count(), 1);
        assert.equal(
          await page
            .getByText('이 브라우저가 접수한 최근 요청 20건을 API 응답의 최신 상태로 확인합니다.', {
              exact: true,
            })
            .count(),
          1,
        );

        /** 빈 상태에서 제공하는 두 개의 요청 시작 링크. */
        const emptyLinks = page.locator('.history-empty__link');
        assert.equal(await emptyLinks.count(), 2);
        // 공통 아이콘 기본 크기가 화면의 28px 크기를 덮지 않아야 한다.
        assert.deepEqual(await emptyLinks.locator('svg').evaluateAll((icons) =>
          icons.map((icon) => {
            /** 화면에 실제 표시된 아이콘 크기. */
            const bounds = icon.getBoundingClientRect();
            return [bounds.width, bounds.height];
          }),
        ), [[28, 28], [28, 28]]);
        assert.deepEqual(
          await emptyLinks.evaluateAll((links) =>
            links.map((link) => link.getAttribute('href')),
          ),
          ['/video', '/subtitles'],
        );
        /** 키보드 focus와 손가락 조작을 위한 링크 크기. */
        for (const link of await emptyLinks.all()) {
          await link.focus();
          assert.equal(
            await link.evaluate((element) => document.activeElement === element),
            true,
          );
        }
        assert.equal(
          await page
            .getByText(
              'YouTube URL로 영상(MP4) 또는 오디오(MP3)를 받습니다.',
              { exact: true },
            )
            .count(),
          1,
        );
        assert.equal(
          await page
            .getByText('로컬 영상으로 영어 자막 파일(SRT)을 만듭니다.', {
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
        assert.equal(await page.locator('.request-flow[data-flow-stage="source"]').count(), 1);
        assert.deepEqual(
          await page.locator('.request-flow__step > span:last-child').allTextContents(),
          ['원본', '추출', '파일 수령'],
        );

        /** 빈 내역 표면과 링크의 실제 viewport 영역. */
        const layoutMetrics = await page.evaluate(() => {
          /** 빈 내역의 flat work surface. */
          const panel = document.querySelector('.history-panel');
          /** 빈 상태 시작 링크 영역. */
          const links = [...document.querySelectorAll('.history-empty__link')];
          /** 요소의 viewport 영역을 직렬화한다. */
          const toBox = (element) => {
            /** 요소의 viewport 사각형. */
            const rect = element?.getBoundingClientRect();
            return rect
              ? {
                  bottom: rect.bottom,
                  height: rect.height,
                  left: rect.left,
                  right: rect.right,
                  top: rect.top,
                  width: rect.width,
                }
              : null;
          };

          return {
            document: {
              clientWidth: document.documentElement.clientWidth,
              scrollWidth: document.documentElement.scrollWidth,
            },
            links: links.map(toBox),
            panel: {
              backgroundColor: panel
                ? getComputedStyle(panel).backgroundColor
                : null,
              borderTopWidth: panel
                ? getComputedStyle(panel).borderTopWidth
                : null,
              boxShadow: panel ? getComputedStyle(panel).boxShadow : null,
            },
          };
        });
        assert.deepEqual(layoutMetrics.document, {
          clientWidth: width,
          scrollWidth: width,
        });
        assert.equal(layoutMetrics.panel.borderTopWidth, '0px');
        assert.equal(layoutMetrics.panel.boxShadow, 'none');
        assert.equal(layoutMetrics.panel.backgroundColor, 'rgba(0, 0, 0, 0)');
        assert.ok(
          layoutMetrics.links.every(
            (link) =>
              link &&
              link.width > 0 &&
              link.height >= 44 &&
              link.left >= 0 &&
              link.right <= width,
          ),
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
}

/** 실제 receipt 목록도 긴 파일명·상태 안내에서 좁은 viewport를 밀어내지 않는지 확인한다. */
async function verifyPopulatedHistoryResponsiveLayout() {
  /** 기존 목록의 실제 데이터 경계를 확인할 viewport 폭. */
  for (const width of [320, 390, 1280]) {
    /** populated history의 light·dark surface를 각각 확인한다. */
    for (const theme of ['light', 'dark']) {
      const context = await createContext({
        viewport: { height: width <= 820 ? 844 : 900, width },
      });
      const { page, assertNoRuntimeErrors } = await createPage(context);
      const longFileName = `${'long-file-name-'.repeat(12)}.mp4`;
      const longStatusMessage = `${'긴 상태 안내 문구 '.repeat(12)}확인해 주세요.`;

      try {
        await page.addInitScript((preference) => {
          localStorage.setItem(
            'mytube-extract-theme-preference',
            preference,
          );
        }, theme);
        await seedReceipts(page, [
          ['video', VIDEO_ID, '2026-08-11T00:03:00.000Z'],
          ['subtitle', SUBTITLE_ID, '2026-08-11T00:02:00.000Z'],
          ['video', VIDEO_OTHER_ID, '2026-08-11T00:01:00.000Z'],
          ['subtitle', SUBTITLE_OTHER_ID, '2026-08-11T00:00:00.000Z'],
        ]);
        await routeApi(page, async ({ route, url }) => {
          if (url.pathname === `/downloads/${VIDEO_ID}`) {
            return fulfillJson(route, videoJob(VIDEO_ID, 'processing'));
          }
          if (url.pathname === `/subtitles/jobs/${SUBTITLE_ID}`) {
            return fulfillJson(route, {
              ...subtitleJob(SUBTITLE_ID, 'completed'),
              fileName: longFileName,
            });
          }
          if (url.pathname === `/downloads/${VIDEO_OTHER_ID}`) {
            return fulfillJson(route, videoJob(VIDEO_OTHER_ID, 'failed'));
          }
          if (url.pathname === `/subtitles/jobs/${SUBTITLE_OTHER_ID}`) {
            return fulfillJson(
              route,
              subtitleJob(SUBTITLE_OTHER_ID, 'expired', {
                message: longStatusMessage,
              }),
            );
          }

          return fulfillJson(route, {}, 404);
        });
        await page.goto(`${staticServer.origin}/history`);
        const detail = page.locator('.history-item__header p');
        await detail.first().waitFor();
        await waitForCondition(
          async () =>
            (await detail.allTextContents()).some((text) =>
              text.includes(longFileName),
            ),
        );
        await page.getByText(longStatusMessage, { exact: true }).waitFor();
        assert.equal(await page.locator('.history-item').count(), 4);
        assert.deepEqual(
          await page.locator('.history-item h3').allTextContents(),
          ['영상 요청', '자막 요청', '영상 요청', '자막 요청'],
        );
        assert.deepEqual(
          await page.locator('.history-status').allTextContents(),
          ['처리 중', '완료', '실패', '만료'],
        );
        assert.deepEqual(
          await page.locator('.history-progress span').allTextContents(),
          ['50%', '100%', '0%', '0%'],
        );
        assert.equal(await page.locator('.history-status--processing').count(), 1);
        assert.equal(await page.locator('.history-status--completed').count(), 1);
        assert.equal(await page.locator('.history-status--failed').count(), 1);
        assert.equal(await page.locator('.history-status--expired').count(), 1);
        assert.equal(await page.getByRole('link', { name: '다운로드' }).count(), 1);
        assert.equal(await page.getByRole('link', { name: '다시 요청' }).count(), 2);
        assert.equal(await page.locator('.request-flow[data-flow-stage="receipt"]').count(), 1);

        const layoutMetrics = await page.evaluate(() => {
          /** 목록과 항목의 실제 viewport 및 scroll 영역. */
          const panel = document.querySelector('.history-panel');
          const item = document.querySelector('.history-item');
          const article = document.querySelector('.history-item article');
          const toBox = (element) => {
            const rect = element?.getBoundingClientRect();
            return rect
              ? { right: rect.right, width: rect.width }
              : null;
          };

          return {
            document: {
              clientWidth: document.documentElement.clientWidth,
              scrollWidth: document.documentElement.scrollWidth,
            },
            item: item
              ? {
                  box: toBox(item),
                  clientWidth: item.clientWidth,
                  scrollWidth: item.scrollWidth,
                }
              : null,
            panel: panel
              ? {
                  box: toBox(panel),
                  clientWidth: panel.clientWidth,
                  scrollWidth: panel.scrollWidth,
                }
              : null,
            article: article
              ? {
                  clientWidth: article.clientWidth,
                  scrollWidth: article.scrollWidth,
                }
              : null,
            actions: [...document.querySelectorAll('.history-actions a, .history-actions button')].map((action) => {
              const rect = action.getBoundingClientRect();
              return {
                bottom: rect.bottom,
                height: rect.height,
                left: rect.left,
                right: rect.right,
                width: rect.width,
              };
            }),
          };
        });

        assert.deepEqual(layoutMetrics.document, {
          clientWidth: width,
          scrollWidth: width,
        });
        assert.ok(
          layoutMetrics.panel &&
            layoutMetrics.panel.box &&
            layoutMetrics.panel.box.right <= width &&
            layoutMetrics.panel.scrollWidth <= layoutMetrics.panel.clientWidth,
        );
        assert.ok(
          layoutMetrics.item &&
            layoutMetrics.item.box &&
            layoutMetrics.item.box.right <= width &&
            layoutMetrics.item.scrollWidth <= layoutMetrics.item.clientWidth,
        );
        assert.ok(
          layoutMetrics.article &&
            layoutMetrics.article.scrollWidth <= layoutMetrics.article.clientWidth,
        );
        assert.ok(
          layoutMetrics.actions.length > 0 &&
            layoutMetrics.actions.every(
              (action) =>
                action.width >= 44 &&
                action.height >= 44 &&
                action.left >= 0 &&
                action.right <= width,
            ),
        );
        assertNoRuntimeErrors();
      } finally {
        await context.close();
      }
    }
  }
}

async function verifyResponsivePrimaryNavigation() {
  // 설정·내비게이션의 모바일 계약은 320x844·390x844, 데스크톱은 1280x900으로 확인한다.
  for (const width of [320, 390, 560, 561, 640, 800, 820, 821, 1280]) {
    for (const theme of ['light', 'dark']) {
      /** 화면 표시·하단 내비게이션의 요구 viewport 높이. */
      const height = width <= 820 ? 844 : 900;
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
            await verifySettingsSurface(page, width);
          }
          await verifyResponsiveNavigationLayout(page, width, routePath);
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
  const alternateThemeLabel = alternateTheme === 'dark' ? '다크' : '라이트';
  await page.getByText(alternateThemeLabel, { exact: true }).click();
  assert.equal(
    await page.evaluate(() => document.documentElement.dataset.theme),
    alternateTheme,
  );
  await page.goto(`${staticServer.origin}/video`);
  await page.getByRole('heading', { name: '영상 추출' }).waitFor();
  assert.deepEqual(
    await page.evaluate(() => ({
      backgroundColor: getComputedStyle(document.body).backgroundColor,
      theme: document.documentElement.dataset.theme,
    })),
    {
      backgroundColor: alternateTheme === 'dark' ? 'rgb(24, 25, 27)' : 'rgb(255, 255, 255)',
      theme: alternateTheme,
    },
  );
  await page.goto(`${staticServer.origin}/settings`);
  await page.getByRole('heading', { name: '설정' }).waitFor();
  await page.reload();
  assert.equal(
    await page.evaluate(() => document.documentElement.dataset.theme),
    alternateTheme,
  );

  /** native radio의 실제 focus와 ArrowRight 선택을 검증한다. */
  const systemRadio = page.getByRole('radio', { name: '시스템' });
  const lightRadio = page.getByRole('radio', { name: '라이트' });
  await systemRadio.focus();
  assert.equal(
    await systemRadio.evaluate((element) => document.activeElement === element),
    true,
  );
  await page.keyboard.press('ArrowRight');
  assert.equal(await lightRadio.isChecked(), true);
  assert.deepEqual(
    await lightRadio.evaluate((element) => {
      const surface = element.nextElementSibling;
      const style = surface ? getComputedStyle(surface) : null;
      return {
        active: document.activeElement === element,
        focusVisible: element.matches(':focus-visible'),
        outlineStyle: style?.outlineStyle,
        outlineWidth: style?.outlineWidth,
      };
    }),
    {
      active: true,
      focusVisible: true,
      outlineStyle: 'solid',
      outlineWidth: '2px',
    },
  );
  await page.getByText(alternateThemeLabel, { exact: true }).click();
  assert.equal(
    await page.evaluate(() => document.documentElement.dataset.theme),
    alternateTheme,
  );

  await page.getByText('시스템', { exact: true }).click();
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem('mytube-extract-theme-preference'),
    ),
    'system',
  );
  assert.ok(
    ['light', 'dark'].includes(
      await page.evaluate(() => document.documentElement.dataset.theme),
    ),
  );
  /** 현재 system 해석과 반대인 운영체제 theme. */
  const changedSystemTheme =
    (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark'
      ? 'light'
      : 'dark';
  await page.emulateMedia({ colorScheme: changedSystemTheme });
  await waitForCondition(
    async () =>
      (await page.evaluate(() => document.documentElement.dataset.theme)) ===
      changedSystemTheme,
  );
  assert.ok(
    await page
      .locator('meta[name="theme-color"]')
      .evaluateAll((metas, expectedColor) =>
        metas.every(
          (meta) =>
            meta.getAttribute('content') ===
            (expectedColor === 'dark' ? '#18191b' : '#ffffff'),
        ),
      changedSystemTheme),
  );
  await page.reload();
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem('mytube-extract-theme-preference'),
    ),
    'system',
  );
  assert.ok(
    ['light', 'dark'].includes(
      await page.evaluate(() => document.documentElement.dataset.theme),
    ),
  );
}

/** 설정 route가 flat 표면·테마 조작·focus 계약을 지키는지 확인한다. */
async function verifySettingsSurface(page, width) {
  await page.locator('.settings-panel').waitFor();
  /** 설정 route로 이동하기 전에 여는 더보기 summary. */
  const moreSummary = page.locator('.usage-guide summary');
  await moreSummary.focus();
  await page.keyboard.press('Enter');
  /** 설정 route의 실제 조작 대상. */
  const settingsLink = page.getByRole('link', { name: '설정' });
  /** 설정 화면의 테마 선택 label 영역. */
  const themeOptions = page.locator('.theme-toggle__option');
  /** 설정 surface와 radio geometry를 한 번에 읽는다. */
  const layoutMetrics = await page.evaluate(() => {
    /** 설정의 flat work surface. */
    const panel = document.querySelector('.settings-panel');
    /** 설정 surface와 workspace의 viewport 영역. */
    const panelRect = panel?.getBoundingClientRect();
    const workspaceRect = document.querySelector('.workspace')?.getBoundingClientRect();

    return {
      panel: {
        backgroundColor: panel ? getComputedStyle(panel).backgroundColor : null,
        borderTopWidth: panel ? getComputedStyle(panel).borderTopWidth : null,
        boxShadow: panel ? getComputedStyle(panel).boxShadow : null,
        right: panelRect?.right,
        width: panelRect?.width,
      },
      workspace: {
        right: workspaceRect?.right,
        width: workspaceRect?.width,
      },
    };
  });

  assert.deepEqual(
    {
      clientWidth: await page.evaluate(() => document.documentElement.clientWidth),
      scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth),
    },
    { clientWidth: width, scrollWidth: width },
  );
  assert.equal(layoutMetrics.panel.borderTopWidth, '0px');
  assert.equal(layoutMetrics.panel.boxShadow, 'none');
  assert.equal(layoutMetrics.panel.backgroundColor, 'rgba(0, 0, 0, 0)');
  assert.equal(layoutMetrics.panel.width, layoutMetrics.workspace.width);
  assert.equal(layoutMetrics.panel.right, layoutMetrics.workspace.right);
  assert.equal(await page.getByText('화면 표시', { exact: true }).count(), 1);
  assert.equal(
    await page
      .getByText(
        '이 설정의 화면 표시 선택만 이 브라우저에 저장하며, 요청 URL과 파일 정보는 저장하지 않습니다.',
        { exact: true },
      )
      .count(),
    1,
  );
  assert.equal(await themeOptions.count(), 3);
  assert.ok(
    (await themeOptions.evaluateAll((options) =>
      options.map((option) => {
        const rect = option.getBoundingClientRect();
        return {
          bottom: rect.bottom,
          height: rect.height,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          width: rect.width,
        };
      }),
    )).every(
      (option) =>
        option.width >= 44 &&
        option.height >= 44 &&
        option.left >= 0 &&
        option.right <= width,
    ),
  );
  const settingsBox = await settingsLink.boundingBox();
  assert.ok(settingsBox && settingsBox.width >= 44 && settingsBox.height >= 44);
  await page.keyboard.press('Tab');
  assert.equal(
    await settingsLink.evaluate((element) => document.activeElement === element),
    true,
  );
  assert.equal(
    await settingsLink.evaluate((element) => element.matches(':focus-visible')),
    true,
  );
}

/** 주요 navigation surface의 overflow·touch target·position을 검증한다. */
async function verifyResponsiveNavigationLayout(page, width, routePath) {
  const visibleNavigation = page.locator(
    'nav[aria-label="주요 메뉴"]:visible',
  );
  assert.equal(await visibleNavigation.count(), 1);
  assert.equal(await visibleNavigation.locator('a').count(), 3);
  if (routePath === '/settings') {
    assert.equal(await visibleNavigation.locator('a[aria-current="page"]').count(), 0);
    assert.equal(
      await page.getByRole('link', { name: '설정' }).getAttribute('aria-current'),
      'page',
    );
  } else {
    assert.equal(await visibleNavigation.locator('a[aria-current="page"]').count(), 1);
  }
  /** 현재 목적지 label의 본문 대비와 설정 secondary marker를 측정한다. */
  const activeLabelContrast = await page.evaluate((isSettingsRoute) => {
    /** CSS 색상을 RGB 배열로 바꾼다. */
    const parseColor = (value) => {
      const channels = value.match(/[\d.]+/g)?.map(Number) ?? [];
      return channels.length >= 3 ? channels.slice(0, 3) : null;
    };
    /** 투명 배경이면 상위 surface를 사용한다. */
    const isTransparent = (value) => {
      const channels = value.match(/[\d.]+/g)?.map(Number) ?? [];
      return channels.length >= 4 && channels[3] === 0;
    };
    /** sRGB channel의 상대 휘도 입력값을 만든다. */
    const linearize = (channel) => {
      const normalized = channel / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    /** 두 RGB 색상의 WCAG 대비를 계산한다. */
    const contrastRatio = (foreground, background) => {
      if (!foreground || !background) return 0;
      const foregroundLuminance =
        0.2126 * linearize(foreground[0]) +
        0.7152 * linearize(foreground[1]) +
        0.0722 * linearize(foreground[2]);
      const backgroundLuminance =
        0.2126 * linearize(background[0]) +
        0.7152 * linearize(background[1]) +
        0.0722 * linearize(background[2]);
      const lighter = Math.max(foregroundLuminance, backgroundLuminance);
      const darker = Math.min(foregroundLuminance, backgroundLuminance);
      return (lighter + 0.05) / (darker + 0.05);
    };
    /** route의 현재 목적지 link. */
    const link = isSettingsRoute
      ? document.querySelector('.settings-link[aria-current="page"]')
      : document.querySelector('nav[aria-label="주요 메뉴"]:not([style*="display: none"]) a[aria-current="page"]');
    if (!link) return null;
    const linkStyle = getComputedStyle(link);
    const rootStyle = getComputedStyle(document.documentElement);
    const bodyStyle = getComputedStyle(document.body);
    const background = isTransparent(linkStyle.backgroundColor)
      ? parseColor(bodyStyle.backgroundColor)
      : parseColor(linkStyle.backgroundColor);
    const foreground = parseColor(linkStyle.color);
    return {
      background,
      foreground,
      ratio: contrastRatio(foreground, background),
      textColor: rootStyle.color,
      linkColor: linkStyle.color,
      textDecorationLine: linkStyle.textDecorationLine,
    };
  }, routePath === '/settings');
  assert.ok(activeLabelContrast);
  assert.equal(activeLabelContrast.linkColor, activeLabelContrast.textColor);
  assert.ok(activeLabelContrast.ratio >= 4.5);
  if (routePath === '/settings') {
    assert.match(activeLabelContrast.textDecorationLine, /underline/);
  }
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
    /** 하단 탭과 본문이 공유해야 하는 콘텐츠 폭과 좌측 위치. */
    const workspaceMetrics = await page.locator('.workspace').evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, width: rect.width };
    });
    assert.equal(navigationMetrics.navigation.left, workspaceMetrics.left);
    assert.equal(navigationMetrics.navigation.width, workspaceMetrics.width);
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

function subtitleJob(jobId, displayStatus, overrides = {}) {
  const status = displayStatus === 'expired' ? 'completed' : displayStatus;
  return {
    createdAt: '2026-08-11T00:00:00.000Z',
    displayStatus,
    downloadUrl:
      displayStatus === 'completed' ? `/subtitles/jobs/${jobId}/file` : null,
    errorCode: displayStatus === 'failed' ? 'TRANSCRIPTION_FAILED' : null,
    fileName: overrides.fileName ?? 'sample.mp4',
    jobId,
    message: overrides.message ?? `subtitle ${displayStatus}`,
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
