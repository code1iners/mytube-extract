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

/** 테스트용 job 상태를 만든다. */
function createJob(overrides: Partial<DownloadJob> = {}): DownloadJob {
  return {
    createdAt: '2026-06-24T05:32:00.000Z',
    displayStatus: 'queued',
    downloadUrl: null,
    errorCode: null,
    jobId: 'job-1',
    message: '요청이 접수되어 대기 중입니다.',
    progress: 0,
    quality: '192',
    retentionDays: 7,
    status: 'queued',
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

  // 각 dependency를 개별적으로 병합한다 — override가 downloadJobs 등 하나를
  // 통째로 대체하면, 그 인터페이스에 메서드가 늘어날 때마다 모든 override 자리를
  // 따라다니며 고쳐야 하기 때문이다 (Shotgun Surgery).
  return {
    storage: {
      loadOptions: vi.fn().mockResolvedValue(savedOptions),
      saveOptions: vi.fn().mockResolvedValue(undefined),
      ...overrides.storage,
    },
    downloadJobs: {
      getJobs: vi.fn().mockResolvedValue([]),
      subscribeJobs: vi.fn().mockReturnValue(() => {}),
      getLatestJob: vi.fn().mockResolvedValue(null),
      submitJob: vi.fn().mockResolvedValue(createCompletedJob()),
      subscribeLatestJob: vi.fn().mockReturnValue(() => {}),
      ...overrides.downloadJobs,
    },
    tabs: {
      getCurrentTabUrl: vi.fn().mockResolvedValue('https://youtu.be/abc123_DEF0'),
      ...overrides.tabs,
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

  it('shows the persisted latest job status immediately when the popup reopens', async () => {
    /** Popup model dependency. */
    const dependencies = createDependencies({
      downloadJobs: {
        getJobs: vi
          .fn()
          .mockResolvedValue([
            createJob({ message: '영상을 다운로드하고 있습니다.', status: 'processing' }),
          ]),
      },
    });
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();

    expect(model.getSnapshot()).toMatchObject({
      canDownload: false,
      downloading: true,
      status: {
        kind: 'job-processing',
        message: '영상을 다운로드하고 있습니다.',
      },
    });
  });

  it('shows a persisted failed job on reopen and allows retrying once a URL is entered', async () => {
    /** Popup model dependency. */
    const dependencies = createDependencies({
      downloadJobs: {
        getJobs: vi
          .fn()
          .mockResolvedValue([
            createJob({ message: '로그인이 필요한 영상입니다.', status: 'failed' }),
          ]),
      },
    });
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();

    expect(model.getSnapshot()).toMatchObject({
      downloading: false,
      status: {
        kind: 'download-failed',
        message: '로그인이 필요한 영상입니다.',
      },
    });

    await model.updateOption('sourceUrl', 'https://www.youtube.com/watch?v=abc123_DEF0');

    expect(model.getSnapshot()).toMatchObject({
      canDownload: true,
      status: { kind: 'ready' },
    });
  });

  it('shows an expired completed job as unavailable instead of a successful download', async () => {
    /** Popup model dependency. */
    const dependencies = createDependencies({
      downloadJobs: {
        getJobs: vi.fn().mockResolvedValue([
          createCompletedJob({
            displayStatus: 'expired',
            downloadUrl: null,
            message: '보관 기간이 지났습니다. 다시 생성해 주세요.',
          }),
        ]),
      },
    });
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();

    expect(model.getSnapshot()).toMatchObject({
      downloading: false,
      status: {
        kind: 'download-failed',
        message: '보관 기간이 지났습니다. 다시 생성해 주세요.',
      },
    });
  });

  it('updates the snapshot when background pushes a job change without a new submit', async () => {
    /** background가 저장한 최근 job 구독 listener. */
    let latestJobListener: ((jobs: DownloadJob[]) => void) | undefined;
    /** Popup model dependency. */
    const dependencies = createDependencies({
      downloadJobs: {
        subscribeJobs: vi.fn().mockImplementation((listener) => {
          latestJobListener = listener;

          return () => {};
        }),
      },
    });
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();

    latestJobListener?.([
      createJob({ message: '영상을 다운로드하고 있습니다.', status: 'processing' }),
    ]);

    expect(model.getSnapshot()).toMatchObject({
      downloading: true,
      status: {
        kind: 'job-processing',
        message: '영상을 다운로드하고 있습니다.',
      },
    });
  });

  it('does not let a late submit response overwrite a status the background subscription already pushed', async () => {
    /** background가 저장한 최근 job 구독 listener. */
    let latestJobListener: ((jobs: DownloadJob[]) => void) | undefined;
    /** job 제출 응답을 늦추는 resolve 함수. */
    let resolveSubmit: (job: DownloadJob) => void = () => {};
    /** Popup model dependency. */
    const dependencies = createDependencies({
      downloadJobs: {
        submitJob: vi.fn(
          () =>
            new Promise<DownloadJob>((resolve) => {
              resolveSubmit = resolve;
            }),
        ),
        subscribeJobs: vi.fn().mockImplementation((listener) => {
          latestJobListener = listener;

          return () => {};
        }),
      },
    });
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();
    await model.updateOption('sourceUrl', 'https://www.youtube.com/watch?v=abc123_DEF0');

    const submit = model.submitDownload();

    // storage 구독이 먼저 completed 상태를 반영한다 — 예를 들어 service worker가 느리게
    // 응답을 돌려주는 동안 폴링이 이미 완료 상태까지 진행된 경우다.
    latestJobListener?.([createCompletedJob()]);

    expect(model.getSnapshot().status).toMatchObject({ kind: 'download-started' });

    // 뒤늦게 도착한 제출 응답은 같은 job의 초기(queued) 상태이므로 무시되어야 한다.
    resolveSubmit(createJob({ message: '요청이 대기 중입니다.', status: 'queued' }));
    await submit;

    expect(model.getSnapshot().status).toMatchObject({ kind: 'download-started' });
  });

  it('creates a download job against the production API base URL when no WXT environment override exists', async () => {
    /** Popup model dependency. */
    const dependencies = createDependencies();
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();
    await model.updateOption('sourceUrl', 'https://www.youtube.com/watch?v=abc123_DEF0');
    await model.submitDownload();

    expect(dependencies.downloadJobs.submitJob).toHaveBeenCalledWith(
      expect.objectContaining({
        apiBaseUrl: 'https://mytube-extract-api.codeliners.cc',
        localFilename: '',
        quality: '192',
        sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
        mode: 'audio',
      }),
    );
  });

  it('submits a job once for duplicate submits while the first is still pending', async () => {
    /** job 제출 완료를 늦추는 resolve 함수. */
    let resolveSubmit: (job: DownloadJob) => void = () => {};
    /** Popup model dependency. */
    const dependencies = createDependencies({
      downloadJobs: {
        submitJob: vi.fn(
          () =>
            new Promise<DownloadJob>((resolve) => {
              resolveSubmit = resolve;
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

    resolveSubmit(createCompletedJob());
    await Promise.all([firstSubmit, secondSubmit]);

    expect(dependencies.downloadJobs.submitJob).toHaveBeenCalledTimes(1);
    expect(model.getSnapshot().status).toMatchObject({
      kind: 'download-started',
      message: '추출 요청을 시작했습니다.',
    });
  });

  it('uses the submitted options while the job submission is pending', async () => {
    /** job 제출 완료를 늦추는 resolve 함수. */
    let resolveSubmit: (job: DownloadJob) => void = () => {};
    /** Popup model dependency. */
    const dependencies = createDependencies({
      downloadJobs: {
        submitJob: vi.fn(
          () =>
            new Promise<DownloadJob>((resolve) => {
              resolveSubmit = resolve;
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
    resolveSubmit(createCompletedJob());
    await submit;

    expect(dependencies.downloadJobs.submitJob).toHaveBeenCalledWith(
      expect.objectContaining({
        quality: '192',
        sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
        mode: 'audio',
      }),
    );
  });

  it('shows the background failure message when job submission fails', async () => {
    /** Popup model dependency. */
    const dependencies = createDependencies({
      downloadJobs: {
        submitJob: vi.fn().mockRejectedValue(new Error('Server is unavailable.')),
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
        message: 'Server is unavailable.',
      },
    });
  });

  it('reflects queued and processing job status live via the background job subscription', async () => {
    /** background가 저장한 최근 job 구독 listener. */
    let latestJobListener: ((jobs: DownloadJob[]) => void) | undefined;
    /** Popup model dependency. */
    const dependencies = createDependencies({
      downloadJobs: {
        submitJob: vi
          .fn()
          .mockResolvedValue(createJob({ message: '요청이 대기 중입니다.', status: 'queued' })),
        subscribeJobs: vi.fn().mockImplementation((listener) => {
          latestJobListener = listener;

          return () => {};
        }),
      },
    });
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();
    await model.updateOption('sourceUrl', 'https://www.youtube.com/watch?v=abc123_DEF0');
    await model.submitDownload();

    expect(model.getSnapshot().status).toMatchObject({
      kind: 'job-queued',
      message: '요청이 대기 중입니다.',
    });

    latestJobListener?.([
      createJob({ message: '영상을 다운로드하고 있습니다.', status: 'processing' }),
    ]);

    expect(model.getSnapshot().status).toMatchObject({
      kind: 'job-processing',
      message: '영상을 다운로드하고 있습니다.',
    });

    latestJobListener?.([createCompletedJob()]);

    expect(model.getSnapshot().status).toMatchObject({
      kind: 'download-started',
      message: '추출 요청을 시작했습니다.',
    });
  });

  it('shows the job failure reason on the existing error screen', async () => {
    /** Popup model dependency. */
    const dependencies = createDependencies({
      downloadJobs: {
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
    expect(dependencies.downloadJobs.submitJob).toHaveBeenCalledWith(
      expect.objectContaining({
        localFilename: 'my clip',
        quality: '720',
        mode: 'video',
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

    expect(dependencies.downloadJobs.submitJob).toHaveBeenCalledWith(
      expect.objectContaining({
        localFilename: '.. etc passwd',
      }),
    );
  });

  it('keeps multiple job states independently while allowing a new request during processing', async () => {
    /** background가 저장한 최근 job 목록 listener. */
    let jobsListener: ((jobs: DownloadJob[]) => void) | undefined;
    /** 오래된 대기 job. */
    const firstJob = createJob({
      createdAt: '2026-06-24T05:32:00.000Z',
      jobId: 'job-1',
      status: 'queued',
    });
    /** 최신 처리 중 job. */
    const secondJob = createJob({
      createdAt: '2026-06-24T05:33:00.000Z',
      jobId: 'job-2',
      message: '두 번째 영상을 처리하고 있습니다.',
      status: 'processing',
    });
    /** Popup model dependency. */
    const dependencies = createDependencies({
      downloadJobs: {
        subscribeJobs: vi.fn().mockImplementation((listener) => {
          jobsListener = listener;

          return () => {};
        }),
      },
    });
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();
    await model.updateOption('sourceUrl', 'https://www.youtube.com/watch?v=abc123_DEF0');
    jobsListener?.([secondJob, firstJob]);

    expect(model.getSnapshot()).toMatchObject({
      canDownload: true,
      downloading: true,
      jobs: [secondJob, firstJob],
      status: { kind: 'job-processing', message: '두 번째 영상을 처리하고 있습니다.' },
    });

    const secondCompletedJob = createCompletedJob({
      createdAt: secondJob.createdAt,
      jobId: secondJob.jobId,
      message: '두 번째 영상 추출이 완료되었습니다.',
    });
    jobsListener?.([secondCompletedJob, firstJob]);

    expect(model.getSnapshot().jobs).toEqual([secondCompletedJob, firstJob]);
    expect(model.getSnapshot().jobs.find((job) => job.jobId === 'job-1')?.status).toBe('queued');
    expect(model.getSnapshot().downloading).toBe(true);
  });
});
