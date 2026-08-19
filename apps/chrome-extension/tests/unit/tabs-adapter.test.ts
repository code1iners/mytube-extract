import { describe, expect, it, vi } from 'vitest';
import { createTabsAdapter } from '../../src/adapters/chrome/tabs';

describe('Chrome tabs adapter', () => {
  it('resolves the active tab URL', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({
      lastError: null,
      tabs: [{ url: 'https://www.youtube.com/watch?v=abc123_DEF0' }],
    });
    /** tabs adapter. */
    const adapter = createTabsAdapter(chromeApi);

    await expect(adapter.getCurrentTabUrl()).resolves.toBe(
      'https://www.youtube.com/watch?v=abc123_DEF0',
    );
    expect(chromeApi.tabs.query).toHaveBeenCalledWith(
      { active: true, lastFocusedWindow: true },
      expect.any(Function),
    );
  });

  it('rejects when chrome.runtime.lastError is set', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({
      lastError: { message: 'blocked' },
      tabs: [{ url: 'https://www.youtube.com/watch?v=abc123_DEF0' }],
    });
    /** tabs adapter. */
    const adapter = createTabsAdapter(chromeApi);

    await expect(adapter.getCurrentTabUrl()).rejects.toThrow(
      'Could not read the current tab URL.',
    );
  });

  it('rejects when no active tab has a URL', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({ lastError: null, tabs: [] });
    /** tabs adapter. */
    const adapter = createTabsAdapter(chromeApi);

    await expect(adapter.getCurrentTabUrl()).rejects.toThrow(
      'Current tab URL is unavailable.',
    );
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
  tabs: Array<{ url?: string }>;
}) {
  return {
    runtime: { lastError },
    tabs: {
      query: vi.fn(
        (
          _queryInfo: chrome.tabs.QueryInfo,
          callback: (tabs: Array<{ url?: string }>) => void,
        ) => callback(tabs),
      ),
    },
  } as unknown as typeof chrome;
}
