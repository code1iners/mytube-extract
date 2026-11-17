import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

/** 빌드된 Overlay unlisted script 경로를 돌려준다. 빌드 산출물이 없으면 바로 실패한다. */
export function resolveOverlayScriptPath() {
  /** WXT production output root. */
  const extensionOutputRoot = path.resolve(
    process.env.MYTUBE_EXTRACT_EXTENSION_OUTPUT_ROOT ?? '.output/chrome-mv3',
  );
  /** Overlay unlisted script path. */
  const overlayScriptPath = path.join(extensionOutputRoot, 'youtube-overlay.js');

  if (!fs.existsSync(overlayScriptPath)) {
    throw new Error(
      'Overlay script is missing at ' +
        overlayScriptPath +
        '. Run build before the browser smoke.',
    );
  }

  return overlayScriptPath;
}

/** 요청 경로별 HTML을 돌려주는 fixture server를 띄운다. */
export function createFixtureServer(readHtml) {
  /** Static fixture server. */
  const server = http.createServer((request, response) => {
    /** 요청 경로. */
    const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;

    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(readHtml(pathname));
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      /** Fixture server address. */
      const address = server.address();

      if (!address || typeof address === 'string') {
        throw new Error('Could not determine the fixture server address.');
      }

      resolve({
        /** fixture 페이지 origin. */
        origin: 'http://127.0.0.1:' + address.port,
        /** server를 닫는다. */
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

/** 실제값과 기대값이 같은지 확인한다. 다르면 바로 실패한다. */
export function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(
      'Unexpected ' +
        label +
        ': expected ' +
        String(expected) +
        ', got ' +
        String(actual),
    );
  }
}
