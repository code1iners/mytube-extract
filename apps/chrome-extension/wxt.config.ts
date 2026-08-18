import { defineConfig } from 'wxt';

/** 운영 MyTube Extract API 서버 주소. */
const PRODUCTION_API_BASE_URL = 'https://mytube-extract-api.codeliners.cc';
/** 최초 사용자 동의로 요청할 YouTube host permission. */
const YOUTUBE_HOST_PERMISSION = 'https://www.youtube.com/*';

/** 환경 변수 기반 API host permission을 만든다. */
export function createApiHostPermission(
  apiBaseUrl = process.env.WXT_MYTUBE_EXTRACT_API_BASE_URL ??
    process.env.MYTUBE_EXTRACT_API_BASE_URL ??
    process.env.WXT_MEDIA_NEST_API_BASE_URL ??
    process.env.MEDIA_NEST_API_BASE_URL ??
    PRODUCTION_API_BASE_URL,
) {
  try {
    /** API 서버 origin. */
    const origin = new URL(apiBaseUrl).origin;

    return `${origin}/*`;
  } catch {
    return `${PRODUCTION_API_BASE_URL}/*`;
  }
}

/** WXT extension configuration. */
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'MyTube Extract',
    description: 'YouTube 영상을 오디오 또는 비디오로 추출하는 보조 도구입니다.',
    permissions: ['storage', 'downloads', 'activeTab', 'scripting'],
    host_permissions: [createApiHostPermission()],
    optional_host_permissions: [YOUTUBE_HOST_PERMISSION],
    web_accessible_resources: [
      {
        matches: [YOUTUBE_HOST_PERMISSION],
        resources: ['fonts/PretendardVariable.woff2'],
      },
    ],
  },
});
