import { describe, expect, it, vi } from 'vitest';
import {
  createDownloadNotificationsAdapter,
  RETRYABLE_DOWNLOAD_NOTIFICATIONS_STORAGE_KEY,
  type DownloadJobRetryInput,
} from '../../src/adapters/chrome/notifications';
import { type DownloadJob } from '../../src/domain/download-job/download-job';

/** 테스트용 job 상태를 만든다. */
function createJob(overrides: Partial<DownloadJob> = {}): DownloadJob {
  return {
    createdAt: '2026-06-24T05:32:00.000Z',
    displayStatus: 'failed',
    downloadUrl: null,
    errorCode: 'YOUTUBE_AUTH_REQUIRED',
    jobId: 'job-1',
    message: '로그인이 필요한 영상입니다.',
    progress: null,
    quality: '192',
    retentionDays: 7,
    status: 'failed',
    type: 'audio',
    ...overrides,
  };
}

/** 테스트에서 알림 버튼 이벤트를 직접 실행할 수 있는 fake Chrome API를 만든다. */
function createChromeApi({
  lastError = null,
  storageState = { retryInputs: {} },
}: {
  /** Chrome API runtime 오류. */
  lastError?: { message: string } | null;
  /** service worker 재시작 사이에 공유할 fake storage 상태. */
  storageState?: { retryInputs: Record<string, DownloadJobRetryInput> };
} = {}) {
  /** 알림 버튼 클릭 listener. */
  let buttonListener: ((notificationId: string, buttonIndex: number) => void) | undefined;
  /** 알림 닫힘 listener. */
  let closedListener: ((notificationId: string, byUser: boolean) => void) | undefined;
  /** 테스트용 Chrome API. */
  const chromeApi = {
    notifications: {
      create: vi.fn(
        (
          notificationId: string,
          _options: unknown,
          callback: (createdNotificationId: string) => void,
        ) => callback(notificationId),
      ),
      onButtonClicked: {
        addListener: vi.fn(
          (listener: (notificationId: string, buttonIndex: number) => void) => {
            buttonListener = listener;
          },
        ),
      },
      onClosed: {
        addListener: vi.fn(
          (listener: (notificationId: string, byUser: boolean) => void) => {
            closedListener = listener;
          },
        ),
      },
    },
    storage: {
      local: {
        get: vi.fn(
          (
            _keys: readonly string[],
            callback: (items: Record<string, unknown>) => void,
          ) =>
            callback({
              [RETRYABLE_DOWNLOAD_NOTIFICATIONS_STORAGE_KEY]: storageState.retryInputs,
            }),
        ),
        set: vi.fn(
          (
            items: Record<string, unknown>,
            callback: () => void,
          ) => {
            storageState.retryInputs =
              (items[RETRYABLE_DOWNLOAD_NOTIFICATIONS_STORAGE_KEY] as
                | Record<string, DownloadJobRetryInput>
                | undefined) ?? {};
            callback();
          },
        ),
      },
    },
    runtime: {
      getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
      lastError,
    },
  } as unknown as typeof chrome;

  return {
    chromeApi,
    clickButton(notificationId: string, buttonIndex: number) {
      buttonListener?.(notificationId, buttonIndex);
    },
    closeNotification(notificationId: string) {
      closedListener?.(notificationId, true);
    },
  };
}

describe('Chrome download notifications adapter', () => {
  it('shows a completion notification with the extension icon', async () => {
    /** 테스트용 Chrome API. */
    const { chromeApi } = createChromeApi();
    /** 알림 adapter. */
    const adapter = createDownloadNotificationsAdapter(chromeApi);

    await adapter.showCompleted(createJob({ displayStatus: 'completed', status: 'completed' }));

    expect(chromeApi.notifications.create).toHaveBeenCalledWith(
      'download-job-completed-job-1',
      {
        iconUrl: 'chrome-extension://test/icon-128.png',
        message: '추출한 파일을 다운로드했습니다.',
        title: '다운로드 완료',
        type: 'basic',
      },
      expect.any(Function),
    );
  });

  it('shows the failure reason and runs the retry action once when its button is clicked', async () => {
    /** 테스트용 Chrome API. */
    const chrome = createChromeApi();
    /** 재시도 입력 listener. */
    const retry = vi.fn().mockResolvedValue(undefined);
    /** 알림 adapter. */
    const adapter = createDownloadNotificationsAdapter(chrome.chromeApi);
    /** 실패 알림에서 전달할 재시도 입력. */
    const retryInput: DownloadJobRetryInput = {
      apiBaseUrl: 'http://127.0.0.1:3030',
      quality: '192',
      sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
      type: 'audio',
    };

    adapter.subscribeRetry(retry);

    await adapter.showFailed(createJob(), retryInput);

    expect(chrome.chromeApi.notifications.create).toHaveBeenCalledWith(
      'download-job-failed-job-1',
      {
        buttons: [{ title: '다시 시도' }],
        iconUrl: 'chrome-extension://test/icon-128.png',
        message: '로그인이 필요한 영상입니다.',
        title: '다운로드 실패',
        type: 'basic',
      },
      expect.any(Function),
    );

    chrome.clickButton('download-job-failed-job-1', 0);
    await Promise.resolve();
    chrome.clickButton('download-job-failed-job-1', 0);

    expect(retry).toHaveBeenCalledTimes(1);
    expect(retry).toHaveBeenCalledWith(retryInput);
  });

  it('does not leave a retry action after the notification is closed', async () => {
    /** 테스트용 Chrome API. */
    const chrome = createChromeApi();
    /** 재시도 입력 listener. */
    const retry = vi.fn();
    /** 알림 adapter. */
    const adapter = createDownloadNotificationsAdapter(chrome.chromeApi);

    adapter.subscribeRetry(retry);
    await adapter.showFailed(createJob(), {
      apiBaseUrl: 'http://127.0.0.1:3030',
      quality: '192',
      sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
      type: 'audio',
    });
    chrome.closeNotification('download-job-failed-job-1');
    chrome.clickButton('download-job-failed-job-1', 0);

    expect(retry).not.toHaveBeenCalled();
  });

  it('restores a retry action from storage after the notification adapter is recreated', async () => {
    /** service worker 재시작 사이에 유지되는 fake storage. */
    const storageState = { retryInputs: {} as Record<string, DownloadJobRetryInput> };
    /** 재시작 전 Chrome API와 adapter. */
    const firstChrome = createChromeApi({ storageState });
    const firstAdapter = createDownloadNotificationsAdapter(firstChrome.chromeApi);
    /** 실패 알림에서 저장할 재시도 입력. */
    const retryInput: DownloadJobRetryInput = {
      apiBaseUrl: 'http://127.0.0.1:3030',
      quality: '192',
      sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
      type: 'audio',
    };

    await firstAdapter.showFailed(createJob(), retryInput);

    /** service worker 재시작 후 새로 만들어진 Chrome API와 adapter. */
    const restartedChrome = createChromeApi({ storageState });
    const restartedAdapter = createDownloadNotificationsAdapter(restartedChrome.chromeApi);
    /** 재시작 후 manager가 등록할 retry listener. */
    const retry = vi.fn();

    restartedAdapter.subscribeRetry(retry);
    restartedChrome.clickButton('download-job-failed-job-1', 0);
    for (let index = 0; index < 8; index += 1) {
      await Promise.resolve();
    }

    expect(retry).toHaveBeenCalledWith(retryInput);
  });

  it('rejects when Chrome refuses to create the notification', async () => {
    /** 오류를 반환하는 테스트용 Chrome API. */
    const chrome = createChromeApi({ lastError: { message: 'blocked' } });
    /** 알림 adapter. */
    const adapter = createDownloadNotificationsAdapter(chrome.chromeApi);

    await expect(adapter.showCompleted(createJob({ status: 'completed' }))).rejects.toThrow(
      'Could not show the download notification.',
    );
  });
});
