import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

/** Web API를 가로챌 수 있는 기존 fixture origin. */
const API_ORIGINS = [
  'http://127.0.0.1:5011',
  'https://mytube-extract-api.codeliners.cc',
];
/** 최종 화면 캡처 대상 route와 접근 가능한 제목. */
const ROUTES = [
  { heading: '영상 추출', path: '/video' },
  { heading: '자막 추출', path: '/subtitles' },
  { heading: '요청 내역', path: '/history' },
  { heading: '설정', path: '/settings' },
];
/** 티켓의 최종 화면 비교 viewport. */
const VIEWPORTS = [
  { height: 844, width: 320 },
  { height: 844, width: 390 },
  { height: 900, width: 1280 },
];
/** 최종 화면 비교 테마. */
const THEMES = ['light', 'dark'];
/** 기준 PNG와 동일하게 요청 route를 readiness 실패 상태로 여는 fixture status. */
const BASELINE_HEALTH_STATUS = 503;
/** 캡처 스크립트가 위치한 Web 앱 디렉터리. */
const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** 배포용 Web bundle 경로. */
const DIST_ROOT = path.join(WEB_ROOT, 'dist');
/** 최종 통합 검증 화면 증거 경로. */
const EVIDENCE_ROOT = path.resolve(
  WEB_ROOT,
  '../../.scratch/web-tailwind-migration/evidence/02-final',
);

if (!fs.existsSync(path.join(DIST_ROOT, 'index.html'))) {
  throw new Error(`Web build output is missing: ${DIST_ROOT}`);
}

fs.mkdirSync(EVIDENCE_ROOT, { recursive: true });

/** 배포용 bundle을 제공할 로컬 정적 서버. */
const staticServer = await createStaticServer(DIST_ROOT);
/** 캡처를 실행할 독립 Chromium browser. */
const browser = await chromium.launch();
/** route·theme·viewport별 최종 캡처 요약. */
const captures = [];

try {
  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      for (const route of ROUTES) {
        await captureRoute({ browser, route, theme, viewport });
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        captures,
        count: captures.length,
        status: 'ok',
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  await staticServer.close();
}

/** 한 route의 저장 선호·theme·viewport를 고정하고 화면과 layout을 캡처한다. */
async function captureRoute({ browser, route, theme, viewport }) {
  /** 캡처 조합별 독립 browser context. */
  const context = await browser.newContext({
    serviceWorkers: 'block',
    viewport,
  });
  /** 현재 route를 캡처할 page. */
  const page = await context.newPage();

  try {
    await page.addInitScript((preference) => {
      localStorage.setItem('mytube-extract-theme-preference', preference);
    }, theme);
    await routeApi(page);
    await page.goto(`${staticServer.origin}${route.path}`);
    await page.getByRole('heading', { name: route.heading }).waitFor();
    await page.evaluate(() => document.fonts.ready);

    /** 캡처 전 실제 document·navigation layout 측정값. */
    const layout = await page.evaluate(() => {
      /** 현재 viewport에서 표시 중인 주요 navigation. */
      const visibleNavigation = [...document.querySelectorAll('nav[aria-label="주요 메뉴"]')]
        .find((element) => getComputedStyle(element).display !== 'none');
      /** workspace의 viewport 영역. */
      const workspace = document.querySelector('.workspace')?.getBoundingClientRect();
      /** 주요 navigation의 viewport 영역. */
      const navigation = visibleNavigation?.getBoundingClientRect();

      return {
        document: {
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        },
        navigation: navigation
          ? {
              bottom: navigation.bottom,
              left: navigation.left,
              right: navigation.right,
              top: navigation.top,
              width: navigation.width,
            }
          : null,
        theme: document.documentElement.dataset.theme,
        workspace: workspace
          ? {
              left: workspace.left,
              right: workspace.right,
              width: workspace.width,
            }
          : null,
      };
    });

    assert.equal(layout.theme, theme);
    assert.deepEqual(layout.document, {
      clientWidth: viewport.width,
      scrollWidth: viewport.width,
    });
    assert.ok(layout.navigation);
    assert.ok(layout.workspace);
    assert.equal(layout.navigation.left, layout.workspace.left);
    assert.equal(layout.navigation.right, layout.workspace.right);

    /** 캡처 파일명은 route·theme·viewport만 포함해 비교 가능하게 만든다. */
    const fileName = `${route.path.slice(1)}-${theme}-${viewport.width}x${viewport.height}.png`;
    /** 최종 화면 PNG 경로. */
    const outputPath = path.join(EVIDENCE_ROOT, fileName);
    await page.screenshot({ path: outputPath });

    captures.push({ fileName, layout });
  } finally {
    await context.close();
  }
}

/** 기존 브라우저 smoke와 같은 API origin을 성공·404 fixture로 연결한다. */
async function routeApi(page) {
  for (const origin of API_ORIGINS) {
    await page.route(`${origin}/**`, async (route, request) => {
      const url = new URL(request.url());

      if (url.pathname === '/health') {
        await fulfillJson(route, {}, BASELINE_HEALTH_STATUS);
        return;
      }

      await fulfillJson(route, {}, 404);
    });
  }
}

/** API fixture 응답을 JSON으로 완료한다. */
async function fulfillJson(route, body, status = 200) {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    status,
  });
}

/** 정적 build 결과를 browser에서 읽을 수 있게 제공한다. */
async function createStaticServer(root) {
  /** build 파일을 제공하는 HTTP server. */
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(
      new URL(request.url ?? '/', 'http://localhost').pathname,
    );
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
    close: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
    origin: `http://127.0.0.1:${address.port}`,
  };
}
