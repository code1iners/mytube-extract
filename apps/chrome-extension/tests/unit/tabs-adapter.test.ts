import { describe, expect, it, vi } from 'vitest';
import { createTabsAdapter } from '../../src/adapters/chrome/tabs';

describe('Chrome tabs adapter', () => {
  it('resolves the active tab URL and title', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({
      lastError: null,
      tabs: [{ title: '서울 공연 - YouTube', url: 'https://www.youtube.com/watch?v=abc123_DEF0' }],
    });
    /** tabs adapter. */
    const adapter = createTabsAdapter(chromeApi);

    await expect(adapter.getCurrentTab()).resolves.toEqual({
      title: '서울 공연 - YouTube',
      url: 'https://www.youtube.com/watch?v=abc123_DEF0',
    });
    expect(chromeApi.tabs.query).toHaveBeenCalledWith(
      { active: true, lastFocusedWindow: true },
      expect.any(Function),
    );
  });

  it('resolves a null title when Chrome does not report one', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({
      lastError: null,
      tabs: [{ url: 'https://youtu.be/abc123_DEF0' }],
    });
    /** tabs adapter. */
    const adapter = createTabsAdapter(chromeApi);

    await expect(adapter.getCurrentTab()).resolves.toEqual({
      title: null,
      url: 'https://youtu.be/abc123_DEF0',
    });
  });

  it('rejects when chrome.runtime.lastError is set', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({
      lastError: { message: 'blocked' },
      tabs: [{ url: 'https://www.youtube.com/watch?v=abc123_DEF0' }],
    });
    /** tabs adapter. */
    const adapter = createTabsAdapter(chromeApi);

    await expect(adapter.getCurrentTab()).rejects.toThrow('현재 탭 정보를 읽지 못했습니다.');
  });

  it('rejects when no active tab has a URL', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({ lastError: null, tabs: [] });
    /** tabs adapter. */
    const adapter = createTabsAdapter(chromeApi);

    await expect(adapter.getCurrentTab()).rejects.toThrow('현재 탭 주소를 알 수 없습니다.');
  });
});

/** 테스트용 Chrome API를 만든다. */
function createChromeApi({
  lastError,
  tabs,
}: {
  /** chrome.runtime.lastError 값. */
  lastError: { message: string } | null;
  /** chrome.tabs.query가 반환할 tab 목록. */
  tabs: Array<{ title?: string; url?: string }>;
}) {
  return {
    runtime: { lastError },
    tabs: {
      query: vi.fn(
        (
          _queryInfo: chrome.tabs.QueryInfo,
          callback: (tabs: Array<{ title?: string; url?: string }>) => void,
        ) => callback(tabs),
      ),
    },
  } as unknown as typeof chrome;
}
