import { describe, expect, it, vi } from 'vitest';
import { type DownloadJob } from '../../src/domain/download-job/download-job';
import { DEFAULT_DOWNLOAD_OPTIONS } from '../../src/domain/download-options/download-options';
import { DownloadJobSubmitError } from '../../src/adapters/chrome/download-jobs-bridge';
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
    sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
    status: 'completed',
    title: null,
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
    sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
    status: 'queued',
    title: null,
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
    // 기본 활성 탭은 YouTube가 아닌 페이지다. 현재 탭 자동 지정이 필요한 테스트만 YouTube 탭을 주입한다.
    tabs: {
      getCurrentTab: vi
        .fn()
        .mockResolvedValue({ title: '예시 페이지', url: 'https://example.com/' }),
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

  it.each([
    ['watch', 'https://www.youtube.com/watch?v=abc123_DEF0&t=30s', 'https://www.youtube.com/watch?v=abc123_DEF0&t=30s'],
    ['Shorts', 'https://www.youtube.com/shorts/abc123_DEF0', 'https://www.youtube.com/watch?v=abc123_DEF0'],
    ['youtu.be', 'https://youtu.be/abc123_DEF0', 'https://www.youtube.com/watch?v=abc123_DEF0'],
  ])('puts the active %s tab video on the stage as the source when the popup opens', async (_format, tabUrl, sourceUrl) => {
    /** Popup model dependency. */
    const dependencies = createDependencies({
      tabs: {
        getCurrentTab: vi.fn().mockResolvedValue({ title: '(3) 서울 공연 풀버전 - YouTube', url: tabUrl }),
      },
    });
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();

    expect(model.getSnapshot()).toMatchObject({
      canDownload: true,
      options: { sourceUrl },
      stageSource: {
        kind: 'tab',
        thumbnailUrl: 'https://i.ytimg.com/vi/abc123_DEF0/hqdefault.jpg',
        title: '서울 공연 풀버전',
        videoId: 'abc123_DEF0',
      },
      status: { kind: 'ready' },
    });
  });

  it('leaves the stage title unknown when the YouTube tab title has nothing but the suffix', async () => {
    /** Popup model dependency. */
    const dependencies = createDependencies({
      tabs: {
        getCurrentTab: vi
          .fn()
          .mockResolvedValue({ title: 'YouTube', url: 'https://www.youtube.com/watch?v=abc123_DEF0' }),
      },
    });
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();

    expect(model.getSnapshot().stageSource).toMatchObject({ kind: 'tab', title: null });
  });

  it('shows an empty paste stage and locks submit on a tab that is not a YouTube video', async () => {
    /** Popup model dependency. */
    const dependencies = createDependencies({
      tabs: {
        getCurrentTab: vi
          .fn()
          .mockResolvedValue({ title: 'YouTube', url: 'https://www.youtube.com/feed/subscriptions' }),
      },
    });
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();

    expect(model.getSnapshot()).toMatchObject({
      canDownload: false,
      options: { sourceUrl: '' },
      stageSource: { kind: 'empty' },
      status: { kind: 'missing-source-url' },
    });
  });

  it('falls back to the empty paste stage when the active tab cannot be read', async () => {
    /** Popup model dependency. */
    const dependencies = createDependencies({
      tabs: {
        getCurrentTab: vi.fn().mockRejectedValue(new Error('탭을 읽지 못했습니다.')),
      },
    });
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();

    expect(model.getSnapshot()).toMatchObject({
      canDownload: false,
      stageSource: { kind: 'empty' },
      status: { kind: 'missing-source-url' },
    });
  });

  it('marks a pasted address that is not a supported YouTube video as invalid and locks submit', async () => {
    /** Popup model dependency. */
    const dependencies = createDependencies();
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();
    await model.updateOption('sourceUrl', 'https://vimeo.com/76979871');

    expect(model.getSnapshot()).toMatchObject({
      canDownload: false,
      stageSource: { input: 'https://vimeo.com/76979871', kind: 'invalid' },
      status: { kind: 'invalid-source-url' },
    });
  });

  it('puts a valid pasted address on the stage with the video ID standing in for the unknown title', async () => {
    /** Popup model dependency. */
    const dependencies = createDependencies();
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();
    await model.updateOption('sourceUrl', 'https://youtu.be/xyz789_GHI1');

    expect(model.getSnapshot()).toMatchObject({
      canDownload: true,
      stageSource: {
        kind: 'pasted',
        thumbnailUrl: 'https://i.ytimg.com/vi/xyz789_GHI1/hqdefault.jpg',
        title: null,
        videoId: 'xyz789_GHI1',
      },
    });
  });

  it('replaces the tab video on the stage when a different video address is pasted', async () => {
    /** Popup model dependency. */
    const dependencies = createDependencies({
      tabs: {
        getCurrentTab: vi
          .fn()
          .mockResolvedValue({ title: '탭 영상 - YouTube', url: 'https://www.youtube.com/watch?v=abc123_DEF0' }),
      },
    });
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();
    await model.updateOption('sourceUrl', 'https://www.youtube.com/watch?v=xyz789_GHI1');

    expect(model.getSnapshot().stageSource).toMatchObject({
      kind: 'pasted',
      title: null,
      videoId: 'xyz789_GHI1',
    });
  });

  it('keeps an address the user already entered when the active tab read finishes later', async () => {
    /** 활성 탭 읽기를 늦추는 resolve 함수. */
    let resolveTab: (tab: { title: string; url: string }) => void = () => {};
    /** Popup model dependency. */
    const dependencies = createDependencies({
      tabs: {
        getCurrentTab: vi.fn(
          () =>
            new Promise<{ title: string; url: string }>((resolve) => {
              resolveTab = resolve;
            }),
        ),
      },
    });
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    const initialize = model.initialize();

    await model.updateOption('sourceUrl', 'https://www.youtube.com/watch?v=xyz789_GHI1');
    await vi.waitFor(() => expect(dependencies.tabs.getCurrentTab).toHaveBeenCalled());
    resolveTab({ title: '탭 영상 - YouTube', url: 'https://www.youtube.com/watch?v=abc123_DEF0' });
    await initialize;

    expect(model.getSnapshot()).toMatchObject({
      options: { sourceUrl: 'https://www.youtube.com/watch?v=xyz789_GHI1' },
      stageSource: { kind: 'pasted', videoId: 'xyz789_GHI1' },
    });
  });

  it('does not store the source URL picked from the tab while still storing format and quality', async () => {
    /** Popup model dependency. */
    const dependencies = createDependencies({
      tabs: {
        getCurrentTab: vi
          .fn()
          .mockResolvedValue({ title: '탭 영상 - YouTube', url: 'https://www.youtube.com/watch?v=abc123_DEF0' }),
      },
    });
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();
    await model.updateOption('sourceUrl', 'https://www.youtube.com/watch?v=xyz789_GHI1');

    expect(dependencies.storage.saveOptions).not.toHaveBeenCalled();

    await model.updateOption('mode', 'video');
    await model.updateOption('resolution', '1080');

    expect(dependencies.storage.saveOptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: 'video', resolution: '1080' }),
    );
  });

  it('submits the tab video picked on open without any extra step', async () => {
    /** Popup model dependency. */
    const dependencies = createDependencies({
      tabs: {
        getCurrentTab: vi
          .fn()
          .mockResolvedValue({ title: '탭 영상 - YouTube', url: 'https://youtu.be/abc123_DEF0' }),
      },
    });
    /** Popup download model. */
    const model = createPopupDownloadModel(dependencies);

    await model.initialize();
    await model.submitDownload();

    expect(dependencies.downloadJobs.submitJob).toHaveBeenCalledWith(
      expect.objectContaining({ sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0' }),
    );
    expect(model.getSnapshot().status).toMatchObject({ kind: 'download-started' });
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

  it('keeps a reopened in-progress job of another video out of an empty stage', async () => {
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

    // 무대에 영상이 없으므로 진행 job은 최근 요청에만 남고 무대는 붙여넣기 칸 그대로다.
    expect(model.getSnapshot()).toMatchObject({
      canDownload: false,
      downloading: true,
      stagePhase: 'idle',
      status: { kind: 'missing-source-url' },
    });
  });

  it('does not replay a job that failed before the popup opened and allows a new request', async () => {
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
      stagePhase: 'idle',
    });

    await model.updateOption('sourceUrl', 'https://www.youtube.com/watch?v=abc123_DEF0');

    expect(model.getSnapshot()).toMatchObject({
      canDownload: true,
      stagePhase: 'idle',
      status: { kind: 'ready' },
    });
  });

  it('does not show an expired completed job as a successful download on the stage', async () => {
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
    await model.updateOption('sourceUrl', 'https://www.youtube.com/watch?v=abc123_DEF0');

    expect(model.getSnapshot()).toMatchObject({
      canDownload: true,
      downloading: false,
      stagePhase: 'idle',
      status: { kind: 'ready' },
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
    await model.updateOption('sourceUrl', 'https://www.youtube.com/watch?v=abc123_DEF0');

    latestJobListener?.([
      createJob({ message: '영상을 다운로드하고 있습니다.', status: 'processing' }),
    ]);

    expect(model.getSnapshot()).toMatchObject({
      downloading: true,
      stagePhase: 'processing',
      status: {
        kind: 'job-processing',
        message: '처리 중',
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

    // 제출 응답을 기다리는 동안 무대는 서버 확인 단계로 남는다.
    expect(model.getSnapshot().stagePhase).toBe('checking');

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
      message: '다운로드를 시작했어요',
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
      message: '대기 중',
    });

    latestJobListener?.([
      createJob({ message: '영상을 다운로드하고 있습니다.', status: 'processing' }),
    ]);

    expect(model.getSnapshot().status).toMatchObject({
      kind: 'job-processing',
      message: '처리 중',
    });

    latestJobListener?.([createCompletedJob()]);

    expect(model.getSnapshot().status).toMatchObject({
      kind: 'download-started',
      message: '다운로드를 시작했어요',
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
    /** 다른 영상의 최신 처리 중 job. */
    const secondJob = createJob({
      createdAt: '2026-06-24T05:33:00.000Z',
      jobId: 'job-2',
      message: '두 번째 영상을 처리하고 있습니다.',
      sourceUrl: 'https://www.youtube.com/watch?v=second_VID1',
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
    await model.updateOption('sourceUrl', 'https://www.youtube.com/watch?v=third_VID01');
    jobsListener?.([secondJob, firstJob]);

    // 무대 영상과 다른 영상들이 진행 중이어도 무대 영상은 새로 요청할 수 있다.
    expect(model.getSnapshot()).toMatchObject({
      canDownload: true,
      downloading: true,
      jobs: [secondJob, firstJob],
      stagePhase: 'idle',
    });

    const secondCompletedJob = createCompletedJob({
      createdAt: secondJob.createdAt,
      jobId: secondJob.jobId,
      message: '두 번째 영상 추출이 완료되었습니다.',
      sourceUrl: secondJob.sourceUrl,
    });
    jobsListener?.([secondCompletedJob, firstJob]);

    expect(model.getSnapshot().jobs).toEqual([secondCompletedJob, firstJob]);
    expect(model.getSnapshot().jobs.find((job) => job.jobId === 'job-1')?.status).toBe('queued');
    expect(model.getSnapshot().downloading).toBe(true);
  });
});

/** 무대 테스트에 쓰는 YouTube 영상 탭 주소. */
const STAGE_VIDEO_URL = 'https://www.youtube.com/watch?v=abc123_DEF0';
/** 무대 영상과 다른 영상 주소. */
const OTHER_VIDEO_URL = 'https://www.youtube.com/watch?v=other_VID01';

/** 무대 영상 탭에서 열린 Popup model과 job 구독 listener를 만든다. */
function createStageModel(overrides: PopupDownloadModelDependencyOverrides = {}) {
  /** Background가 저장한 최근 job 목록 listener. */
  let jobsListener: (jobs: DownloadJob[]) => void = () => {};
  /** Popup model dependency. */
  const dependencies = createDependencies({
    ...overrides,
    downloadJobs: {
      subscribeJobs: vi.fn().mockImplementation((listener) => {
        jobsListener = listener;

        return () => {};
      }),
      ...overrides.downloadJobs,
    },
    tabs: {
      getCurrentTab: vi.fn().mockResolvedValue({ title: '무대 영상 - YouTube', url: STAGE_VIDEO_URL }),
      ...overrides.tabs,
    },
  });

  return {
    dependencies,
    model: createPopupDownloadModel(dependencies),
    pushJobs: (jobs: DownloadJob[]) => jobsListener(jobs),
  };
}

/** 응답을 직접 정하는 job 제출 함수를 만든다. */
function createDeferredSubmit() {
  /** 제출 응답 resolve 함수. */
  let resolveSubmit: (job: DownloadJob) => void = () => {};
  /** 가짜 job 제출 함수. */
  const submitJob = vi.fn(
    () =>
      new Promise<DownloadJob>((resolve) => {
        resolveSubmit = resolve;
      }),
  );

  return { resolve: (job: DownloadJob) => resolveSubmit(job), submitJob };
}

describe('popup stage progress and problems', () => {
  it('moves the stage through checking, queued, processing and done, then back to idle', async () => {
    vi.useFakeTimers();

    try {
      /** 늦게 응답하는 job 제출. */
      const deferred = createDeferredSubmit();
      const { model, pushJobs } = createStageModel({ downloadJobs: { submitJob: deferred.submitJob } });

      await model.initialize();

      expect(model.getSnapshot()).toMatchObject({ canDownload: true, stagePhase: 'idle' });

      /** 진행 중인 제출. */
      const submit = model.submitDownload();

      expect(model.getSnapshot()).toMatchObject({
        canDownload: false,
        stagePhase: 'checking',
        status: { message: '서버 확인 중' },
      });

      deferred.resolve(createJob({ status: 'queued' }));
      await submit;

      expect(model.getSnapshot()).toMatchObject({
        canDownload: false,
        stagePhase: 'queued',
        status: { message: '대기 중' },
      });

      pushJobs([createJob({ status: 'processing' })]);

      expect(model.getSnapshot()).toMatchObject({
        canDownload: false,
        stagePhase: 'processing',
        status: { message: '처리 중' },
      });

      pushJobs([createCompletedJob()]);

      expect(model.getSnapshot()).toMatchObject({
        canDownload: true,
        stagePhase: 'done',
        status: { message: '다운로드를 시작했어요' },
      });

      vi.advanceTimersByTime(1799);
      expect(model.getSnapshot().stagePhase).toBe('done');

      vi.advanceTimersByTime(1);
      expect(model.getSnapshot()).toMatchObject({ canDownload: true, stagePhase: 'idle' });
      // 완료 표시가 끝나도 job 자체는 완료 상태로 남는다.
      expect(model.getSnapshot().jobs[0]?.status).toBe('completed');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows a rejected submission as failed with the server reason and retries with the same input', async () => {
    /** 첫 제출은 서버가 거부하고 재시도는 접수된다. */
    const submitJob = vi
      .fn()
      .mockRejectedValueOnce(new DownloadJobSubmitError('rejected', '지원하지 않는 영상이에요.'))
      .mockResolvedValueOnce(createJob({ status: 'queued' }));
    const { model } = createStageModel({ downloadJobs: { submitJob } });

    await model.initialize();
    await model.updateOption('mode', 'video');
    await model.updateOption('resolution', '720');
    await model.submitDownload();

    expect(model.getSnapshot()).toMatchObject({
      canDownload: true,
      stagePhase: 'failed',
      status: { message: '지원하지 않는 영상이에요.' },
    });

    await model.submitDownload();

    expect(submitJob).toHaveBeenCalledTimes(2);
    expect(submitJob.mock.calls[1]).toEqual(submitJob.mock.calls[0]);
    expect(submitJob.mock.calls[1]?.[0]).toMatchObject({
      mode: 'video',
      quality: '720',
      sourceUrl: STAGE_VIDEO_URL,
    });
    expect(model.getSnapshot().stagePhase).toBe('queued');
  });

  it('separates an unreachable server from a failed request', async () => {
    /** 서버 연결 실패로 끝나는 job 제출. */
    const submitJob = vi
      .fn()
      .mockRejectedValue(new DownloadJobSubmitError('unreachable', '서버에 연결할 수 없어요.'));
    const { model } = createStageModel({ downloadJobs: { submitJob } });

    await model.initialize();
    await model.submitDownload();

    expect(model.getSnapshot()).toMatchObject({
      canDownload: true,
      stagePhase: 'unreachable',
      status: { kind: 'server-unreachable', message: '서버에 연결할 수 없어요' },
    });

    await model.submitDownload();

    expect(submitJob).toHaveBeenCalledTimes(2);
    expect(submitJob.mock.calls[1]).toEqual(submitJob.mock.calls[0]);
  });

  it('shows a job that fails after acceptance as failed and retries with that job conditions', async () => {
    /** 첫 제출은 대기 job, 재시도도 대기 job으로 접수된다. */
    const submitJob = vi.fn().mockResolvedValue(createJob({ status: 'queued' }));
    const { model, pushJobs } = createStageModel({ downloadJobs: { submitJob } });

    await model.initialize();
    await model.submitDownload();
    pushJobs([createJob({ message: '로그인이 필요한 영상입니다.', status: 'failed' })]);

    expect(model.getSnapshot()).toMatchObject({
      canDownload: true,
      stagePhase: 'failed',
      status: { kind: 'download-failed', message: '로그인이 필요한 영상입니다.' },
    });

    await model.submitDownload();

    expect(submitJob).toHaveBeenCalledTimes(2);
    expect(submitJob.mock.calls[1]?.[0]).toMatchObject({
      mode: 'audio',
      quality: '192',
      sourceUrl: STAGE_VIDEO_URL,
    });
  });

  it('clears a failure once the user changes the request conditions', async () => {
    const { model } = createStageModel({
      downloadJobs: {
        submitJob: vi.fn().mockRejectedValue(new DownloadJobSubmitError('rejected', '거부됨')),
      },
    });

    await model.initialize();
    await model.submitDownload();
    await model.updateOption('bitrate', '320');

    expect(model.getSnapshot()).toMatchObject({ canDownload: true, stagePhase: 'idle' });
  });

  it('ignores job progress of another video and keeps that video submittable', async () => {
    const { dependencies, model, pushJobs } = createStageModel();

    await model.initialize();
    pushJobs([createJob({ jobId: 'job-other', sourceUrl: OTHER_VIDEO_URL, status: 'processing' })]);

    expect(model.getSnapshot()).toMatchObject({
      canDownload: true,
      downloading: true,
      stagePhase: 'idle',
    });

    await model.submitDownload();

    expect(dependencies.downloadJobs.submitJob).toHaveBeenCalledTimes(1);
  });

  it('locks submitting the stage video while its own job is still in progress', async () => {
    const { dependencies, model, pushJobs } = createStageModel();

    await model.initialize();
    pushJobs([createJob({ status: 'queued' })]);

    expect(model.getSnapshot()).toMatchObject({ canDownload: false, stagePhase: 'queued' });

    await model.submitDownload();

    expect(dependencies.downloadJobs.submitJob).not.toHaveBeenCalled();
  });

  it('restores the in-progress phase of the stage video when the popup reopens', async () => {
    const { model } = createStageModel({
      downloadJobs: {
        getJobs: vi.fn().mockResolvedValue([
          createJob({ createdAt: '2026-06-24T05:33:00.000Z', jobId: 'job-other', sourceUrl: OTHER_VIDEO_URL, status: 'queued' }),
          createJob({ status: 'processing' }),
        ]),
      },
    });

    await model.initialize();

    expect(model.getSnapshot()).toMatchObject({
      canDownload: false,
      stagePhase: 'processing',
      status: { kind: 'job-processing', message: '처리 중' },
    });
  });

  it('starts idle on reopen when the stage video job had already finished before opening', async () => {
    const { model } = createStageModel({
      downloadJobs: {
        getJobs: vi.fn().mockResolvedValue([createJob({ message: '실패', status: 'failed' })]),
      },
    });

    await model.initialize();

    expect(model.getSnapshot()).toMatchObject({ canDownload: true, stagePhase: 'idle' });
  });
});
