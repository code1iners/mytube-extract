import { describe, expect, it } from 'vitest';
import config, { createApiHostPermission } from '../../wxt.config';

/** 테스트에서 확인할 WXT manifest shape. */
type TestableManifest = {
  /** Chrome permission 목록. */
  permissions?: string[];
  /** Chrome host permission 목록. */
  host_permissions?: string[];
  /** 사용자 동의로 요청할 optional host permission 목록. */
  optional_host_permissions?: string[];
  /** 외부 페이지에 노출할 정적 리소스 목록. */
  web_accessible_resources?: Array<{
    /** 리소스를 노출할 대상 URL pattern. */
    matches?: string[];
    /** 노출할 정적 파일 목록. */
    resources?: string[];
  }>;
};

/** 테스트에서 확인할 WXT config shape. */
type TestableWxtConfig = {
  /** WXT module 목록. */
  modules?: string[];
  /** WXT가 .env를 process.env에 적재한 뒤 호출하는 manifest 생성 함수. */
  manifest?: (env: { browser: string; command: string; manifestVersion: number; mode: string }) =>
    TestableManifest;
};

/** WXT production build와 같은 env로 manifest를 만든다. */
function resolveManifest(): TestableManifest {
  /** 테스트 가능한 WXT config. */
  const testableConfig = config as TestableWxtConfig;

  if (typeof testableConfig.manifest !== 'function') {
    throw new Error('manifest should be resolved lazily after WXT loads .env files');
  }

  return testableConfig.manifest({
    browser: 'chrome',
    command: 'build',
    manifestVersion: 3,
    mode: 'production',
  });
}

/** API env var를 잠시 바꿔 callback을 실행하고 원래 값으로 되돌린다. */
function withApiBaseUrlEnv<T>(apiBaseUrl: string | undefined, callback: () => T): T {
  /** 테스트 전 API env var. */
  const previousApiBaseUrl = process.env.WXT_MYTUBE_EXTRACT_API_BASE_URL;

  if (apiBaseUrl === undefined) {
    delete process.env.WXT_MYTUBE_EXTRACT_API_BASE_URL;
  } else {
    process.env.WXT_MYTUBE_EXTRACT_API_BASE_URL = apiBaseUrl;
  }

  try {
    return callback();
  } finally {
    if (previousApiBaseUrl === undefined) {
      delete process.env.WXT_MYTUBE_EXTRACT_API_BASE_URL;
    } else {
      process.env.WXT_MYTUBE_EXTRACT_API_BASE_URL = previousApiBaseUrl;
    }
  }
}

describe('WXT config', () => {
  it('prefers the MyTube Extract API env var for host permissions', () => {
    withApiBaseUrlEnv('http://127.0.0.1:3030', () => {
      expect(createApiHostPermission()).toBe('http://127.0.0.1:3030/*');
    });
  });

  // WXT는 config module을 먼저 평가하고 .env를 나중에 process.env로 옮긴다.
  // import 시점에 계산하면 runtime(import.meta.env)은 .env 주소를, manifest는 운영 주소를 갖게 된다.
  it('reads the API env var set after the config module was imported', () => {
    withApiBaseUrlEnv('http://127.0.0.1:5011', () => {
      expect(resolveManifest().host_permissions).toEqual(['http://127.0.0.1:5011/*']);
    });
  });

  it('keeps the React module and extension permissions required by the popup flow', () => {
    /** 테스트 가능한 WXT config. */
    const testableConfig = config as TestableWxtConfig;
    /** 운영 기본값으로 만든 manifest. */
    const manifest = withApiBaseUrlEnv(undefined, resolveManifest);

    expect(testableConfig.modules).toContain('@wxt-dev/module-react');
    expect(manifest.permissions).toEqual(
      expect.arrayContaining([
        'storage',
        'downloads',
        'notifications',
        'activeTab',
        'scripting',
        'alarms',
      ]),
    );
    expect(manifest.host_permissions).toEqual(['https://mytube-extract-api.codeliners.cc/*']);
    expect(manifest.host_permissions).not.toContain('<all_urls>');
  });

  it('requests the YouTube overlay host permission only as optional', () => {
    /** 운영 기본값으로 만든 manifest. */
    const manifest = withApiBaseUrlEnv(undefined, resolveManifest);

    expect(manifest.optional_host_permissions).toEqual([
      'https://www.youtube.com/*',
    ]);
    expect(manifest.host_permissions).not.toContain('https://www.youtube.com/*');
    expect(manifest.web_accessible_resources).toEqual([
      expect.objectContaining({
        matches: ['https://www.youtube.com/*'],
        resources: ['fonts/PretendardVariable.woff2'],
      }),
    ]);
  });

  it('builds host permissions from the configured API origin only', () => {
    expect(createApiHostPermission('http://127.0.0.1:3030')).toBe('http://127.0.0.1:3030/*');
    expect(createApiHostPermission('https://mytube-extract-api.codeliners.cc')).toBe(
      'https://mytube-extract-api.codeliners.cc/*',
    );
  });
});
