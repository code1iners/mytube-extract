/** Chrome downloads adapter. */
export type DownloadsAdapter = {
  /** Chrome downloads API로 다운로드를 시작한다. filename을 지정하면 저장 파일명으로 사용된다. */
  startDownload(downloadUrl: string, filename?: string): Promise<number>;
};

/** Chrome downloads adapter를 만든다. */
export function createDownloadsAdapter(chromeApi: typeof chrome = chrome): DownloadsAdapter {
  return {
    startDownload(downloadUrl, filename) {
      return new Promise((resolve, reject) => {
        /** chrome.downloads.download에 전달할 옵션. */
        const downloadOptions: chrome.downloads.DownloadOptions = filename
          ? { filename, url: downloadUrl }
          : { url: downloadUrl };

        chromeApi.downloads.download(downloadOptions, (downloadId) => {
          if (chromeApi.runtime.lastError || !downloadId) {
            reject(new Error('Could not start the download.'));
            return;
          }

          resolve(downloadId);
        });
      });
    },
  };
}
