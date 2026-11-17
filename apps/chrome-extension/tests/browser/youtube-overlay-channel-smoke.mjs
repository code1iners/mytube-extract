import { chromium } from 'playwright';
import {
  assertEqual,
  createFixtureServer,
  resolveOverlayScriptPath,
} from './overlay-smoke-support.mjs';

/** Overlay unlisted script path. */
const overlayScriptPath = resolveOverlayScriptPath();

/**
 * 채널 동영상 탭 카드. 2026-11-17 실제 YouTube `/@handle/videos`에서 본 구조를 줄인 것이다.
 * 썸네일 링크에 id·aria-label이 없고 제목은 `h3[title]`에만 있다.
 */
const VIDEOS_TAB_HTML = [
  '<ytd-rich-item-renderer id="videos-card">',
  createLockupHtml('chanVid_001', 'Channel videos tab title'),
  '</ytd-rich-item-renderer>',
].join('');

/**
 * 채널 홈 shelf. 실제 YouTube `/@handle`에서 본 구조로, 카드가 `ytd-rich-item-renderer` 없이 shelf 바로 아래에 놓인다.
 */
const CHANNEL_HOME_HTML = [
  // 실제 shelf는 화살표를 누르면 scroll 없이 transform transition으로 카드를 민다.
  '<ytd-shelf-renderer><yt-horizontal-list-renderer id="home-shelf" style="display:flex;gap:16px;margin-left:160px;transition:transform 0.2s">',
  createLockupHtml('chanHome_01', 'Channel home first title'),
  createLockupHtml('chanHome_02', 'Channel home second title'),
  // 재생목록 카드: 링크는 watch 주소지만 썸네일이 collection 형태다. 영상 카드가 아니라서 Overlay가 붙으면 안 된다.
  '<yt-lockup-view-model id="playlist-lockup"><div class="ytLockupViewModelHost">',
  '<a href="https://www.youtube.com/watch?v=chanList_01&list=PLfixture" class="ytLockupViewModelContentImage">',
  '<yt-collection-thumbnail-view-model class="thumb"></yt-collection-thumbnail-view-model></a>',
  '<h3 title="Channel playlist title"></h3></div></yt-lockup-view-model>',
  '</yt-horizontal-list-renderer></ytd-shelf-renderer>',
].join('');

/**
 * 채널 안 검색 결과. 실제 YouTube `/@handle/search`에서 본 구조로, 일반 영상·Shorts·재생목록이 한 목록에 섞여 나온다.
 */
const CHANNEL_SEARCH_HTML = [
  '<ytd-item-section-renderer>',
  '<ytd-video-renderer id="search-video"><ytd-thumbnail>',
  '<a id="thumbnail" href="https://www.youtube.com/watch?v=chanFind_01"><span class="thumb"></span></a></ytd-thumbnail>',
  '<a id="video-title">Channel search video title</a></ytd-video-renderer>',
  '<ytd-video-renderer id="search-short"><ytd-thumbnail>',
  '<a id="thumbnail" href="https://www.youtube.com/shorts/chanShort01"><span class="thumb"></span></a></ytd-thumbnail>',
  '<a id="video-title">Channel search Shorts title</a></ytd-video-renderer>',
  '<ytd-playlist-renderer id="search-playlist"><ytd-playlist-thumbnail>',
  '<a id="thumbnail" href="https://www.youtube.com/watch?v=chanList_02&list=PLfixture"><span class="thumb"></span></a></ytd-playlist-thumbnail>',
  '</ytd-playlist-renderer>',
  '</ytd-item-section-renderer>',
].join('');

/** 경로별 fixture 본문. */
const FIXTURE_BODIES = {
  '/@fixture/search': CHANNEL_SEARCH_HTML,
  '/@fixture': CHANNEL_HOME_HTML,
  '/@fixture/videos': VIDEOS_TAB_HTML,
};
/** fixture 공통 style. 썸네일 자리 크기만 실제 화면과 비슷하게 준다. */
const FIXTURE_STYLE =
  'body{margin:16px} a{display:block} .thumb{display:block;width:320px;height:180px;background:#6b7280} ytd-video-renderer .thumb,ytd-playlist-renderer .thumb{width:246px;height:138px}';
/** 채널 fixture server. */
const fixtureServer = await createFixtureServer(
  (pathname) =>
    '<!doctype html><html><head><style>' +
    FIXTURE_STYLE +
    '</style></head><body>' +
    (FIXTURE_BODIES[pathname] ?? '') +
    '</body></html>',
);
/** Browser instance. */
const browser = await chromium.launch();

try {
  // 채널 동영상 탭: 카드에 Overlay가 붙고, 품질 막대를 누르면 카드 제목과 영상 ID로 요청한다.
  const videosPage = await openFixturePage('/@fixture/videos');

  await assertOverlayCountAfterScan(videosPage, 1);
  assertEqual(
    await submitFirstLevel(videosPage, '#videos-card a[href*="/watch"]'),
    'chanVid_001|Channel videos tab title',
    'channel videos tab request',
  );

  // 채널 홈: shelf 안 카드마다 Overlay가 하나씩 붙는다.
  const homePage = await openFixturePage('/@fixture');

  await assertOverlayCountAfterScan(homePage, 2);
  assertEqual(
    await submitFirstLevel(homePage, '#home-shelf yt-lockup-view-model:nth-child(2) a[href*="/watch"]'),
    'chanHome_02|Channel home second title',
    'channel home request',
  );

  // 채널 안 검색: 일반 영상에만 붙고 Shorts·재생목록 결과에는 붙지 않는다.
  const searchPage = await openFixturePage('/@fixture/search?query=fixture');

  await assertOverlayCountAfterScan(searchPage, 1);
  assertEqual(
    await submitFirstLevel(searchPage, '#search-video a#thumbnail'),
    'chanFind_01|Channel search video title',
    'channel search request',
  );

  // 지원하지 않는 채널 탭으로 SPA 이동하면 붙어 있던 Overlay를 뗀다.
  await searchPage.evaluate(() => {
    history.pushState({}, '', '/@fixture/shorts');
    document.body.append(document.createElement('div'));
  });
  await assertOverlayCountAfterScan(searchPage, 0);

  // 채널 홈 shelf를 화살표로 넘기면(scroll·pointer 이동 없음) 상태 배지가 썸네일을 따라간다. 민 뒤에도 첫 카드가 화면 안에 남도록 shelf에 왼쪽 여백을 둔다.
  await homePage.evaluate(() =>
    globalThis.__myTubeExtractSetStoredJobs([
      {
        createdAt: new Date().toISOString(),
        displayStatus: 'processing',
        downloadUrl: null,
        errorCode: null,
        jobId: 'job-chanHome_01',
        message: '',
        progress: null,
        quality: '720',
        retentionDays: 7,
        sourceUrl: 'https://www.youtube.com/watch?v=chanHome_01',
        status: 'processing',
        title: 'Stored title',
        type: 'video',
      },
    ]),
  );
  await homePage.mouse.move(700, 600);
  await homePage.waitForFunction(() => globalThis.__readBadgeOffset('chanHome_01') === 0, null, {
    timeout: 10000,
  });
  await homePage.evaluate(() => {
    document.querySelector('#home-shelf').style.transform = 'translateX(-120px)';
  });
  await homePage.waitForTimeout(700);
  assertEqual(
    await homePage.evaluate(() => globalThis.__readBadgeOffset('chanHome_01')),
    0,
    'status badge offset from thumbnail after shelf slide',
  );
} finally {
  await browser.close();
  await fixtureServer.close();
}

console.log(JSON.stringify({ overlayScriptPath, status: 'ok' }, null, 2));

/** 실제 YouTube `yt-lockup-view-model` 영상 카드를 줄인 HTML을 만든다. 실제 링크는 상대 경로지만 fixture origin이 YouTube가 아니라서 절대 주소로 쓴다. */
function createLockupHtml(videoId, title) {
  return [
    '<yt-lockup-view-model class="lockup ytLockupViewModelWrapper">',
    '<div class="ytLockupViewModelHost ytLockupViewModelVertical content-id-' + videoId + '">',
    '<a href="https://www.youtube.com/watch?v=' + videoId + '" class="ytLockupViewModelContentImage" tabindex="-1" aria-hidden="true">',
    '<yt-thumbnail-view-model class="thumb"></yt-thumbnail-view-model></a>',
    '<h3 class="ytLockupMetadataViewModelHeadingReset" title="' + title + '">',
    '<a href="https://www.youtube.com/watch?v=' + videoId + '" class="ytLockupMetadataViewModelTitle"><span>' + title + '</span></a></h3>',
    '</div></yt-lockup-view-model>',
  ].join('');
}

/** 경로에 맞는 채널 fixture를 열고 Overlay script를 넣는다. */
async function openFixturePage(pathname) {
  /** 채널 fixture page. */
  const page = await browser.newPage();

  // 페이지 안에서 난 오류를 검사 출력에 남긴다.
  page.on('pageerror', (error) => {
    console.error('[youtube-overlay-channel-smoke] page error', error.message);
  });
  // 실제 이미지 서버로 요청이 나가지 않게 막는다.
  await page.route('https://i.ytimg.com/**', (route) => route.abort());
  // Overlay script가 쓰는 확장 프로그램 API를 가짜로 둔다. 보낸 요청과 저장된 job을 검사에서 읽고 바꿀 수 있다.
  await page.addInitScript(() => {
    globalThis.__myTubeExtractOverlayRequests = [];
    globalThis.__myTubeExtractStoredJobs = [];
    globalThis.__myTubeExtractStorageListeners = [];
    // 최근 job 목록을 바꾸고 storage 변경 이벤트를 흉내 낸다.
    globalThis.__myTubeExtractSetStoredJobs = (jobs) => {
      /** 이전 저장 값. */
      const oldValue = globalThis.__myTubeExtractStoredJobs;

      globalThis.__myTubeExtractStoredJobs = jobs;
      globalThis.__myTubeExtractStorageListeners.forEach((listener) =>
        listener({ recentDownloadJobs: { newValue: jobs, oldValue } }, 'local'),
      );
    };
    // 영상의 Overlay host와 썸네일의 왼쪽 좌표 차이를 읽는다. host가 보이지 않으면 null.
    globalThis.__readBadgeOffset = (videoId) => {
      /** 영상의 Overlay host. */
      const host = document.querySelector(
        '[data-mytube-extract-overlay][data-video-id="' + videoId + '"]',
      );
      /** 영상의 썸네일 링크. */
      const link = document.querySelector('a.ytLockupViewModelContentImage[href*="' + videoId + '"]');

      return host && link && host.style.display !== 'none'
        ? Math.round(host.getBoundingClientRect().left - link.getBoundingClientRect().left)
        : null;
    };
    globalThis.chrome = {
      storage: {
        local: {
          get(_keys, callback) {
            setTimeout(() => callback({ recentDownloadJobs: globalThis.__myTubeExtractStoredJobs }), 0);
          },
        },
        onChanged: {
          addListener(listener) {
            globalThis.__myTubeExtractStorageListeners.push(listener);
          },
          removeListener() {},
        },
      },
      runtime: {
        lastError: null,
        getURL(resourcePath) {
          return 'chrome-extension://fixture/' + resourcePath;
        },
        sendMessage(message, callback) {
          globalThis.__myTubeExtractOverlayRequests.push(message);
          setTimeout(() => callback({ kind: 'job-accepted', ok: true }), 0);
        },
      },
    };
  });
  await page.goto(fixtureServer.origin + pathname, {
    timeout: 10000,
    waitUntil: 'domcontentloaded',
  });
  await page.addScriptTag({ path: overlayScriptPath });

  return page;
}

/** scan이 끝날 만큼 기다린 뒤 붙은 카드 Overlay 수가 기대값인지 확인한다. */
async function assertOverlayCountAfterScan(page, expected) {
  await page.waitForTimeout(400);

  /** 현재 붙은 카드 Overlay 수. */
  const count = await page.evaluate(
    () => document.querySelectorAll('[data-mytube-extract-overlay]').length,
  );

  assertEqual(count, expected, 'overlay count on ' + new URL(page.url()).pathname);
}

/** 썸네일에 호버해 첫 품질 막대를 누르고, Background로 보낸 요청의 `영상 ID|제목`을 돌려준다. */
async function submitFirstLevel(page, thumbnailSelector) {
  await page.hover(thumbnailSelector);

  /** 보이는 첫 품질 막대의 중심 좌표를 가리키는 handle. */
  const pointHandle = await page.waitForFunction(() => {
    /** 호버 UI가 보이는 Overlay의 첫 품질 막대. */
    const button = [...document.querySelectorAll('[data-mytube-extract-overlay]')]
      .map((host) => host.shadowRoot?.querySelector('.overlay[data-visible] .levels button'))
      .find(Boolean);
    /** 막대 화면 영역. */
    const rect = button?.getBoundingClientRect();

    return rect && rect.width > 0 ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : null;
  }, null, { timeout: 10000 });
  /** 누를 좌표 값. */
  const point = await pointHandle.jsonValue();

  await page.mouse.click(point.x, point.y);
  await page.waitForFunction(
    () => globalThis.__myTubeExtractOverlayRequests.length === 1,
    null,
    { timeout: 10000 },
  );

  return page.evaluate(() => {
    /** Background로 보낸 요청. */
    const request = globalThis.__myTubeExtractOverlayRequests[0];

    return request.videoId + '|' + request.title;
  });
}
