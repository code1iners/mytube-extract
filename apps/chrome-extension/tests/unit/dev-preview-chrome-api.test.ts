import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  hasChromeExtensionRuntime,
  installDevPreviewChromeApi,
} from '../../entrypoints/popup/dev-preview-chrome-api';
import { LATEST_DOWNLOAD_JOB_STORAGE_KEY } from '../../src/adapters/chrome/download-job-storage';
import { DOWNLOAD_JOB_SUBMIT_MESSAGE_TYPE } from '../../src/features/download-jobs/download-job-message';

/** 테스트용 memory localStorage를 만든다. */
function createMemoryStorage() {
  /** 저장된 key-value map. */
  const values = new Map<string, string>();

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

describe('dev preview chrome API', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('simulates the background job submit flow end-to-end, including storage.onChanged', async () => {
    /** 테스트용 global target. */
    const target = {
      location: { search: '' },
      open: vi.fn(),
    } as unknown as typeof globalThis;
    /** 테스트용 localStorage. */
    const storage = createMemoryStorage();
    /** 다운로드 URL opener. */
    const openUrl = vi.fn();
    /** MyTube Extract API fetch 응답을 흉내 내는 fake fetch. */
    const fetchMock = vi.fn(async (url: unknown) => {
      /** 요청 URL 문자열. */
      const requestUrl = String(url);

      if (requestUrl.endsWith('/health')) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      if (requestUrl.endsWith('/downloads')) {
        return new Response(
          JSON.stringify({
            createdAt: '2026-06-24T05:32:00.000Z',
            displayStatus: 'completed',
            downloadUrl: '/downloads/job-1/file',
            errorCode: null,
            jobId: 'job-1',
            message: '추출이 완료되었습니다.',
            progress: 100,
            quality: '192',
            retentionDays: 7,
            status: 'completed',
            type: 'audio',
          }),
          { status: 201 },
        );
      }

      throw new Error(`Unexpected fetch call: ${requestUrl}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    installDevPreviewChromeApi({ target, storage, openUrl });

    /** storage.onChanged listener가 받은 최근 job 변경 내역. */
    const storageChanges: unknown[] = [];

    target.chrome.storage.onChanged.addListener((changes: Record<string, { newValue?: unknown }>) => {
      if (changes[LATEST_DOWNLOAD_JOB_STORAGE_KEY]) {
        storageChanges.push(changes[LATEST_DOWNLOAD_JOB_STORAGE_KEY]?.newValue);
      }
    });

    /** job 제출 응답. */
    const response = await new Promise((resolve) => {
      target.chrome.runtime.sendMessage(
        {
          apiBaseUrl: 'http://127.0.0.1:3030',
          localFilename: 'preview clip',
          mode: 'audio',
          quality: '192',
          sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
          type: DOWNLOAD_JOB_SUBMIT_MESSAGE_TYPE,
        },
        resolve,
      );
    });

    expect(response).toMatchObject({ job: { status: 'completed' }, ok: true });
    expect(openUrl).toHaveBeenCalledWith('http://127.0.0.1:3030/downloads/job-1/file');
    expect(storageChanges).toEqual([expect.objectContaining({ status: 'completed' })]);
  });

  it('installs fake Chrome APIs when the popup runs as a localhost preview', async () => {
    /** 테스트용 global target. */
    const target = {
      location: {
        search: '',
      },
      open: vi.fn(),
    } as unknown as typeof globalThis;
    /** 테스트용 localStorage. */
    const storage = createMemoryStorage();
    /** 다운로드 URL opener. */
    const openUrl = vi.fn();

    expect(
      installDevPreviewChromeApi({
        target,
        storage,
        openUrl,
      }),
    ).toBe(true);
    expect(hasChromeExtensionRuntime(target)).toBe(true);

    /** Preview storage option. */
    const options = await new Promise<Record<string, unknown>>((resolve) => {
      (target.chrome.storage.local.get as (keys: string[], callback: typeof resolve) => void)(
        ['filename', 'mode'],
        resolve,
      );
    });
    /** Preview download id. */
    const downloadId = await new Promise<number | undefined>((resolve) => {
      target.chrome.downloads.download(
        { url: 'http://127.0.0.1:3031/audio/abc123_DEF0' },
        resolve,
      );
    });
    /** Preview current tab query result. */
    const tabs = await new Promise<chrome.tabs.Tab[]>((resolve) => {
      target.chrome.tabs.query({ active: true, lastFocusedWindow: true }, resolve);
    });

    expect(options).toEqual({});
    expect(downloadId).toBe(1);
    expect(tabs[0]?.url).toBe('https://www.youtube.com/watch?v=abc123_DEF0');
    expect(openUrl).toHaveBeenCalledWith('http://127.0.0.1:3031/audio/abc123_DEF0');
  });

  it('does not replace the real Chrome extension runtime', () => {
    /** 실제 runtime처럼 보이는 Chrome API. */
    const chromeApi = {
      runtime: {},
      storage: {
        local: {},
      },
      downloads: {},
      tabs: {},
    };
    /** 테스트용 global target. */
    const target = {
      chrome: chromeApi,
    } as unknown as typeof globalThis;

    expect(installDevPreviewChromeApi({ target })).toBe(false);
    expect(target.chrome).toBe(chromeApi);
  });
});
