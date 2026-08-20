import { describe, expect, it, vi } from 'vitest';
import { type DownloadJob } from '../../src/domain/download-job/download-job';
import { DEFAULT_DOWNLOAD_OPTIONS } from '../../src/domain/download-options/download-options';
import {
  type PopupDownloadModelDependencies,
  createPopupDownloadModel,
} from '../../src/features/popup-download/popup-download-model';

/** 테스트에서 dependency 일부만 골라 override할 수 있게 각 dependency 내부까지 partial로 만든다. */
type PopupDownloadModelDependencyOverrides = {
  [Key in keyof PopupDownloadModelDependencies]?: Partial<PopupDownloadModelDependencies[Key]>;
};

/** 테스트용 완료 job을 만든다. */
function createCompletedJob(overrides: Partial<DownloadJob> = {}): DownloadJob {
  return {
    createdAt: '2026-06-24T05:32:00.000Z',
    displayStatus: 'completed',
    downloadUrl: 'https://mytube-extract-api.codeliners.cc/downloads/job-1/file',
    errorCode: null,
    jobId: 'job-1',
    message: '추출이 완료되었습니다.',
    progress: 100,
    quality: '192',
    retentionDays: 7,
    status: 'completed',
    type: 'audio',
    ...overrides,
  };
}

/** 테스트용 model dependency를 만든다. */
function createDependencies(
  overrides: PopupDownloadModelDependencyOverrides = {},
): PopupDownloadModelDependencies {
  /** 저장된 다운로드 옵션. */
  const savedOptions = {
    ...DEFAULT_DOWNLOAD_OPTIONS,
  };

  // 각 dependency를 개별적으로 병합한다 — override가 myTubeExtractClient 등 하나를
  // 통째로 대체하면, 그 인터페이스에 메서드가 늘어날 때마다 모든 override 자리를
  // 따라다니며 고쳐야 하기 때문이다 (Shotgun Surgery).
  return {
    storage: {
      loadOptions: vi.fn().mockResolvedValue(savedOptions),
      saveOptions: vi.fn().mockResolvedValue(undefined),
      ...overrides.storage,
    },
    jobManager: {
      getJobs: vi.fn().mockReturnValue([]),
      submitJob: vi.fn().mockImplementation((input) => Promise.resolve(createCompletedJob())),
      subscribe: vi.fn().mockReturnValue(() => {}),
      ...overrides.jobManager,
    },
    tabs: {
      getCurrentTabUrl: vi.fn().mockResolvedValue('https://youtu.be/abc123_DEF0'),
      ...overrides.tabs,
    },
    myTubeExtractClient: {
      assertServerAvailable: vi.fn().mockResolvedValue(undefined),
      createDownloadJob: vi.fn(),
      getDownloadJob: vi.fn(),
      ...overrides.myTubeExtractClient,
    },
    youtubeOverlay: {
      isEnabled: vi.fn().mockResolvedValue(false),
      requestAndEnable: vi.fn().mockResolvedValue(true),
      ...overrides.youtubeOverlay,
    },
  };
}

describe('popup download model', () => {
  it('shows the YouTube overlay activation state without changing the URL form flow', async () => {
    /** Popup model dependency. */
    const dependencies = createDependencies();
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();

    expect(model.getSnapshot()).toMatchObject({
      youtubeOverlay: {
        enabled: false,
        status: 'disabled',
      },
    });

    await model.activateYoutubeOverlay();

    expect(dependencies.youtubeOverlay.requestAndEnable).toHaveBeenCalledTimes(1);
    expect(model.getSnapshot()).toMatchObject({
      youtubeOverlay: {
        enabled: true,
        status: 'enabled',
      },
    });
  });

  it('keeps the popup usable when the user denies the YouTube overlay permission', async () => {
    /** Popup model dependency. */
    const dependencies = createDependencies({
      youtubeOverlay: {
        isEnabled: vi.fn().mockResolvedValue(false),
        requestAndEnable: vi.fn().mockResolvedValue(false),
      },
    });
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();
    await model.activateYoutubeOverlay();
    await model.updateOption('sourceUrl', 'https://www.youtube.com/watch?v=abc123_DEF0');

    expect(model.getSnapshot()).toMatchObject({
      canDownload: true,
      youtubeOverlay: {
        enabled: false,
        status: 'denied',
      },
    });
  });

  it('starts with source URL input required instead of active tab detection', async () => {
    /** Popup model dependency. */
    const dependencies = createDependencies();
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();

    expect(model.getSnapshot()).toMatchObject({
      canDownload: false,
      status: {
        kind: 'missing-source-url',
        message: '추출할 URL을 입력하세요.',
      },
    });
  });

  it('enables download when a valid source URL is entered on any page', async () => {
    /** Popup model dependency. */
    const dependencies = createDependencies();
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();
    await model.updateOption('sourceUrl', 'https://www.youtube.com/watch?v=abc123_DEF0');

    expect(model.getSnapshot()).toMatchObject({
      canDownload: true,
      status: {
        kind: 'ready',
        message: '추출할 URL이 준비되었습니다.',
      },
    });
  });

  it('does not persist source URLs while keeping the entered URL ready', async () => {
    /** Popup model dependency. */
    const dependencies = createDependencies({
      storage: {
        loadOptions: vi.fn().mockResolvedValue(DEFAULT_DOWNLOAD_OPTIONS),
        saveOptions: vi.fn().mockRejectedValue(new Error('storage unavailable')),
      },
    });
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();
    await model.updateOption('sourceUrl', 'https://www.youtube.com/watch?v=abc123_DEF0');

    expect(dependencies.storage.saveOptions).not.toHaveBeenCalled();
    expect(model.getSnapshot()).toMatchObject({
      canDownload: true,
      status: {
        kind: 'ready',
        message: '추출할 URL이 준비되었습니다.',
      },
    });
  });

  it('disables download when source URL is invalid', async () => {
    /** Popup model dependency. */
    const dependencies = createDependencies();
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();
    await model.updateOption('sourceUrl', 'not-a-url');

    expect(model.getSnapshot()).toMatchObject({
      canDownload: false,
      status: {
        kind: 'invalid-source-url',
        message: '지원하는 YouTube URL을 입력하세요.',
      },
    });
  });

  it('imports a supported current tab URL without persisting it', async () => {
    /** Popup model dependency. */
    const dependencies = createDependencies({
      tabs: {
        getCurrentTabUrl: vi.fn().mockResolvedValue('https://www.youtube.com/shorts/abc123_DEF0'),
      },
    });
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();
    await model.importCurrentTabUrl();

    expect(dependencies.storage.saveOptions).not.toHaveBeenCalled();
    expect(model.getSnapshot()).toMatchObject({
      canDownload: true,
      options: {
        sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
      },
      status: {
        kind: 'ready',
        message: '추출할 URL이 준비되었습니다.',
      },
    });
  });

  it('keeps the entered URL when the current tab URL is unsupported', async () => {
    /** Popup model dependency. */
    const dependencies = createDependencies({
      tabs: {
        getCurrentTabUrl: vi.fn().mockResolvedValue('https://example.com/watch?v=abc123_DEF0'),
      },
    });
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();
    await model.updateOption('sourceUrl', 'https://www.youtube.com/watch?v=abc123_DEF0');
    await model.importCurrentTabUrl();

    expect(model.getSnapshot()).toMatchObject({
      canDownload: true,
      options: {
        sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
      },
      status: {
        kind: 'invalid-source-url',
        message: '현재 탭에서 지원하는 YouTube URL을 찾을 수 없습니다.',
      },
    });
  });

  it('creates a download job against the production API base URL when no WXT environment override exists', async () => {
    /** Popup model dependency. */
    const dependencies = createDependencies();
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();
    await model.updateOption('sourceUrl', 'https://www.youtube.com/watch?v=abc123_DEF0');
    await model.submitDownload();

    expect(dependencies.myTubeExtractClient.assertServerAvailable).toHaveBeenCalledWith(
      'https://mytube-extract-api.codeliners.cc',
    );
    expect(dependencies.jobManager.submitJob).toHaveBeenCalledWith(
      expect.objectContaining({
        apiBaseUrl: 'https://mytube-extract-api.codeliners.cc',
        localFilename: '',
        quality: '192',
        sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
        type: 'audio',
      }),
    );
  });

  it('checks server and submits a job once for duplicate submits', async () => {
    /** 서버 확인 해제 함수. */
    let releaseServerCheck: () => void = () => {};
    /** Popup model dependency. */
    const dependencies = createDependencies({
      myTubeExtractClient: {
        assertServerAvailable: vi.fn(
          () =>
            new Promise<void>((resolve) => {
              releaseServerCheck = resolve;
            }),
        ),
      },
    });
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();
    await model.updateOption('sourceUrl', 'https://www.youtube.com/watch?v=abc123_DEF0');

    /** 첫 번째 다운로드 submit. */
    const firstSubmit = model.submitDownload();
    /** 중복 다운로드 submit. */
    const secondSubmit = model.submitDownload();

    releaseServerCheck();
    await Promise.all([firstSubmit, secondSubmit]);

    expect(dependencies.myTubeExtractClient.assertServerAvailable).toHaveBeenCalledTimes(1);
    expect(dependencies.jobManager.submitJob).toHaveBeenCalledTimes(1);
    expect(model.getSnapshot().status).toMatchObject({
      kind: 'download-started',
      message: '추출 요청을 시작했습니다.',
    });
  });

  it('uses the submitted options while the server check is pending', async () => {
    /** 서버 확인 해제 함수. */
    let releaseServerCheck: () => void = () => {};
    /** Popup model dependency. */
    const dependencies = createDependencies({
      myTubeExtractClient: {
        assertServerAvailable: vi.fn(
          () =>
            new Promise<void>((resolve) => {
              releaseServerCheck = resolve;
            }),
        ),
      },
    });
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();
    await model.updateOption('sourceUrl', 'https://www.youtube.com/watch?v=abc123_DEF0');

    /** 제출 시점의 다운로드 요청. */
    const submit = model.submitDownload();

    await model.updateOption('sourceUrl', 'https://www.youtube.com/watch?v=changed_ID1');
    await model.updateOption('mode', 'video');
    await model.updateOption('resolution', '720');
    releaseServerCheck();
    await submit;

    expect(dependencies.jobManager.submitJob).toHaveBeenCalledWith(
      expect.objectContaining({
        quality: '192',
        sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
        type: 'audio',
      }),
    );
  });

  it('shows server unavailable state when health check fails', async () => {
    /** Popup model dependency. */
    const dependencies = createDependencies({
      myTubeExtractClient: {
        assertServerAvailable: vi.fn().mockRejectedValue(new Error('Server is unavailable.')),
      },
    });
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();
    await model.updateOption('sourceUrl', 'https://www.youtube.com/watch?v=abc123_DEF0');
    await model.submitDownload();

    expect(dependencies.jobManager.submitJob).not.toHaveBeenCalled();
    expect(model.getSnapshot()).toMatchObject({
      canDownload: true,
      status: {
        kind: 'download-failed',
        message: 'Server is unavailable.',
      },
    });
  });

  it('reflects queued and processing job status on the existing status screen', async () => {
    /** job manager가 순서대로 호출할 onStatusChange callback. */
    let capturedOnStatusChange: ((job: DownloadJob) => void) | undefined;
    /** job 완료를 늦추는 resolve 함수. */
    let resolveSubmitJob: (job: DownloadJob) => void = () => {};
    /** Popup model dependency. */
    const dependencies = createDependencies({
      jobManager: {
        submitJob: vi.fn().mockImplementation((input) => {
          capturedOnStatusChange = input.onStatusChange;

          return new Promise((resolve) => {
            resolveSubmitJob = resolve;
          });
        }),
      },
    });
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();
    await model.updateOption('sourceUrl', 'https://www.youtube.com/watch?v=abc123_DEF0');

    /** 제출 시점의 다운로드 요청. */
    const submit = model.submitDownload();
    await Promise.resolve();
    await Promise.resolve();

    capturedOnStatusChange?.({
      createdAt: '2026-06-24T05:32:00.000Z',
      displayStatus: 'queued',
      downloadUrl: null,
      errorCode: null,
      jobId: 'job-1',
      message: '요청이 대기 중입니다.',
      progress: 0,
      quality: '192',
      retentionDays: 7,
      status: 'queued',
      type: 'audio',
    });

    expect(model.getSnapshot().status).toMatchObject({
      kind: 'job-queued',
      message: '요청이 대기 중입니다.',
    });

    capturedOnStatusChange?.({
      createdAt: '2026-06-24T05:32:00.000Z',
      displayStatus: 'processing',
      downloadUrl: null,
      errorCode: null,
      jobId: 'job-1',
      message: '영상을 다운로드하고 있습니다.',
      progress: 40,
      quality: '192',
      retentionDays: 7,
      status: 'processing',
      type: 'audio',
    });

    expect(model.getSnapshot().status).toMatchObject({
      kind: 'job-processing',
      message: '영상을 다운로드하고 있습니다.',
    });

    resolveSubmitJob(createCompletedJob());
    await submit;

    expect(model.getSnapshot().status).toMatchObject({
      kind: 'download-started',
      message: '추출 요청을 시작했습니다.',
    });
  });

  it('shows the job failure reason on the existing error screen', async () => {
    /** Popup model dependency. */
    const dependencies = createDependencies({
      jobManager: {
        submitJob: vi.fn().mockRejectedValue(new Error('로그인이 필요한 영상입니다.')),
      },
    });
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();
    await model.updateOption('sourceUrl', 'https://www.youtube.com/watch?v=abc123_DEF0');
    await model.submitDownload();

    expect(model.getSnapshot()).toMatchObject({
      canDownload: true,
      status: {
        kind: 'download-failed',
        message: '로그인이 필요한 영상입니다.',
      },
    });
  });

  it('returns a completed popup to its request settings without clearing the URL', async () => {
    /** Popup model dependency. */
    const dependencies = createDependencies();
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();
    await model.updateOption('sourceUrl', 'https://www.youtube.com/watch?v=abc123_DEF0');
    await model.submitDownload();
    await model.returnToForm();

    expect(model.getSnapshot()).toMatchObject({
      canDownload: true,
      downloading: false,
      options: {
        sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
      },
      status: {
        kind: 'ready',
      },
    });
  });

  it('updates options, submits the user-entered filename, and preserves video mode quality', async () => {
    /** Popup model dependency. */
    const dependencies = createDependencies();
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();
    await model.updateOption('sourceUrl', 'https://www.youtube.com/watch?v=abc123_DEF0');
    await model.updateOption('filename', 'my clip');
    await model.updateOption('mode', 'video');
    await model.updateOption('resolution', '720');
    await model.submitDownload();

    expect(dependencies.storage.saveOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'video',
        resolution: '720',
      }),
    );
    expect(dependencies.jobManager.submitJob).toHaveBeenCalledWith(
      expect.objectContaining({
        localFilename: 'my clip',
        quality: '720',
        type: 'video',
      }),
    );
  });

  it('sanitizes the user-entered filename before submitting the job', async () => {
    /** Popup model dependency. */
    const dependencies = createDependencies();
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();
    await model.updateOption('sourceUrl', 'https://www.youtube.com/watch?v=abc123_DEF0');
    await model.updateOption('filename', '../etc/passwd\r\n');
    await model.submitDownload();

    expect(dependencies.jobManager.submitJob).toHaveBeenCalledWith(
      expect.objectContaining({
        localFilename: '.. etc passwd',
      }),
    );
  });
});
