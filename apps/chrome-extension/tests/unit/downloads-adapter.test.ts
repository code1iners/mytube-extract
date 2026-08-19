import { describe, expect, it, vi } from 'vitest';
import { createDownloadsAdapter } from '../../src/adapters/chrome/downloads';

describe('Chrome downloads adapter', () => {
  it('resolves the download ID when chrome.downloads.download succeeds', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({ downloadId: 7, lastError: null });
    /** downloads adapter. */
    const adapter = createDownloadsAdapter(chromeApi);

    await expect(adapter.startDownload('https://api.example/audio')).resolves.toBe(
      7,
    );
    expect(chromeApi.downloads.download).toHaveBeenCalledWith(
      { url: 'https://api.example/audio' },
      expect.any(Function),
    );
  });

  it('rejects when chrome.runtime.lastError is set', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({
      downloadId: 7,
      lastError: { message: 'blocked' },
    });
    /** downloads adapter. */
    const adapter = createDownloadsAdapter(chromeApi);

    await expect(
      adapter.startDownload('https://api.example/audio'),
    ).rejects.toThrow('Could not start the download.');
  });

  it('rejects when chrome does not return a download ID', async () => {
    /** 테스트용 Chrome API. */
    const chromeApi = createChromeApi({ downloadId: undefined, lastError: null });
    /** downloads adapter. */
    const adapter = createDownloadsAdapter(chromeApi);

    await expect(
      adapter.startDownload('https://api.example/audio'),
    ).rejects.toThrow('Could not start the download.');
  });
});

/** 테스트용 Chrome API를 만든다. */
function createChromeApi({
  downloadId,
  lastError,
}: {
  /** chrome.downloads.download 콜백에 전달할 ID. */
  downloadId: number | undefined;
  /** chrome.runtime.lastError 값. */
  lastError: { message: string } | null;
}) {
  return {
    downloads: {
      download: vi.fn(
        (
          _options: { url: string },
          callback: (downloadId: number | undefined) => void,
        ) => callback(downloadId),
      ),
    },
    runtime: { lastError },
  } as unknown as typeof chrome;
}
