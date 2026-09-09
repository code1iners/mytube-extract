import { createElement, StrictMode } from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { createInMemoryRequestLifecycleAdapter } from '../../src/app/adapters/in-memory-request-lifecycle.adapter';
import { createVideoRequestAdapter } from '../../src/app/adapters/video-request.adapter';
import type {
  RequestLifecycleJob,
  RequestLifecycleResult,
  RequestReadinessResponse,
  UseExtractionRequestLifecycleOptions,
} from '../../src/app/hooks/use-extraction-request-lifecycle';
import { useExtractionRequestLifecycle } from '../../src/app/hooks/use-extraction-request-lifecycle';
import { JobStatusRequestError } from '../../src/api/mytube-extract.api';

// React가 비동기 상태 갱신을 act 테스트 환경으로 인식하게 한다.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

/** 테스트에서 사용할 영상 job. */
type TestVideoJob = RequestLifecycleJob & {
  /** API가 완료 파일을 내려줄 URL. */
  downloadUrl: string | null;
  /** API가 계산한 진행률. */
  progress: number | null;
  /** API가 보장하는 결과물 보관 기간. */
  retentionDays: number;
  /** 응답에 보존할 원본 영상 링크. */
  sourceUrl: string;
  /** 응답에 보존할 요청 영상 제목. */
  title: string | null;
  /** 실제 다운로드 job 상태. */
  status: 'queued' | 'processing' | 'completed' | 'failed';
  /** 응답에 담긴 다운로드 형식. */
  type: 'audio' | 'video';
  /** 응답에 보존할 영상 품질. */
  quality: string;
};

/** 테스트에서 사용할 자막 요청 입력. */
type TestSubtitleRequest = {
  /** 업로드할 파일명. */
  fileName: string;
  /** 선택한 Whisper 모델. */
  whisperModel: 'base_en' | 'small_en';
};

/** 테스트에서 사용할 자막 job. */
type TestSubtitleJob = RequestLifecycleJob & {
  /** 응답에 보존할 원본 파일명. */
  fileName: string;
  /** 응답에 보존할 Whisper 모델. */
  whisperModel: 'base_en' | 'small_en';
  /** 응답에 보존할 처리 단계. */
  stage: 'queued' | 'completed';
};

/** 테스트에서 사용할 정상 readiness 응답. */
const readyResponse: RequestReadinessResponse = {
  ok: true,
  worker: { available: true },
};

/** 테스트용 영상 job을 만든다. */
function createJob(overrides: Partial<TestVideoJob> = {}): TestVideoJob {
  return {
    createdAt: '2026-09-04T00:00:00.000Z',
    displayStatus: 'queued',
    downloadUrl: null,
    errorCode: null,
    jobId: '4f8f82b3-cf37-4e31-9d56-d27eb526a922',
    message: '요청이 접수되어 대기 중입니다.',
    progress: 0,
    quality: '720',
    retentionDays: 7,
    sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    status: 'queued',
    title: null,
    type: 'video',
    ...overrides,
  };
}

/** 테스트용 자막 job을 만든다. */
function createSubtitleJob(
  overrides: Partial<TestSubtitleJob> = {},
): TestSubtitleJob {
  return {
    createdAt: '2026-09-04T00:00:00.000Z',
    displayStatus: 'queued',
    fileName: 'sample-video.mp4',
    jobId: '067b084b-c84a-4574-952f-950cb8fa2157',
    message: '영어 SRT 생성 요청이 접수되었습니다.',
    stage: 'queued',
    whisperModel: 'base_en',
    ...overrides,
  };
}

/** 테스트에서 외부 resolve를 제어할 promise. */
function createDeferred<T>() {
  /** promise resolve 함수. */
  let resolve!: (value: T) => void;
  /** 지연된 promise. */
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

/** lifecycle hook의 최신 interface를 관찰하는 테스트 probe. */
function LifecycleProbe({
  onValue,
  options,
}: {
  /** 최신 lifecycle 값을 기록할 함수. */
  onValue: (value: RequestLifecycleResult<TestVideoJob, TestVideoJob>) => void;
  /** hook에 주입할 lifecycle dependency. */
  options: UseExtractionRequestLifecycleOptions<
    TestVideoJob,
    TestVideoJob,
    'video'
  >;
}) {
  /** 현재 lifecycle interface. */
  const value = useExtractionRequestLifecycle(options);
  onValue(value);
  return null;
}

/** 자막 lifecycle hook의 최신 interface를 관찰하는 테스트 probe. */
function SubtitleLifecycleProbe({
  onValue,
  options,
}: {
  /** 최신 lifecycle 값을 기록할 함수. */
  onValue: (
    value: RequestLifecycleResult<TestSubtitleRequest, TestSubtitleJob>,
  ) => void;
  /** hook에 주입할 lifecycle dependency. */
  options: UseExtractionRequestLifecycleOptions<
    TestSubtitleRequest,
    TestSubtitleJob,
    'subtitle'
  >;
}) {
  /** 현재 lifecycle interface. */
  const value = useExtractionRequestLifecycle(options);
  onValue(value);
  return null;
}

/** lifecycle이 route에 제공하는 테스트 표시 모델. */
type TestLifecyclePresentation = {
  /** 표시 모델이 반영한 현재 phase. */
  phase: string;
  /** 표시 모델이 반영한 제목. */
  title: string;
};

/** lifecycle이 생성한 최종 표시 모델을 관찰하는 테스트 probe. */
function PresentationLifecycleProbe({
  onValue,
  options,
}: {
  /** 최신 lifecycle 값을 기록할 함수. */
  onValue: (
    value: RequestLifecycleResult<
      TestVideoJob,
      TestVideoJob,
      TestLifecyclePresentation
    >,
  ) => void;
  /** 표시 모델 생성기를 포함한 lifecycle dependency. */
  options: UseExtractionRequestLifecycleOptions<
    TestVideoJob,
    TestVideoJob,
    'video',
    TestLifecyclePresentation
  >;
}) {
  /** 최종 표시 모델을 포함한 lifecycle interface. */
  const value = useExtractionRequestLifecycle(options);
  onValue(value);
  return null;
}

describe('request lifecycle adapter seam', () => {
  it('lets the in-memory adapter satisfy readiness, create, and status operations', async () => {
    /** 테스트용 요청 입력. */
    const request = {
      quality: '720',
      sourceUrl: 'https://youtu.be/abc123_DEF0',
    };
    /** 테스트용 생성 job. */
    const createdJob = createJob();
    /** 테스트용 상태 job. */
    const statusJob = createJob({ displayStatus: 'completed' });
    /** adapter에 전달된 요청 입력 기록. */
    const createRequest = vi.fn(async () => createdJob);
    /** adapter에 전달된 상태 조회 기록. */
    const getStatus = vi.fn(async () => statusJob);
    /** lifecycle production seam을 대체하는 in-memory adapter. */
    const adapter = createInMemoryRequestLifecycleAdapter({
      createRequest,
      getStatus,
      kind: 'video',
      readiness: readyResponse,
    });

    await expect(adapter.checkReadiness(new AbortController().signal)).resolves.toEqual(
      readyResponse,
    );
    await expect(
      adapter.createRequest(request, new AbortController().signal),
    ).resolves.toBe(createdJob);
    await expect(
      adapter.getStatus(
        {
          acceptedAt: '2026-09-04T00:00:00.000Z',
          jobId: createdJob.jobId,
          kind: 'video',
        },
        new AbortController().signal,
      ),
    ).resolves.toBe(statusJob);

    expect(createRequest).toHaveBeenCalledWith(request, expect.any(AbortSignal));
    expect(getStatus).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: createdJob.jobId, kind: 'video' }),
      expect.any(AbortSignal),
    );
  });

  it('returns the route presentation derived from normalized lifecycle state', async () => {
    /** hook에서 관찰한 최신 lifecycle 값. */
    let latest:
      | RequestLifecycleResult<
          TestVideoJob,
          TestVideoJob,
          TestLifecyclePresentation
        >
      | undefined;
    /** lifecycle state를 표시 모델로 바꾸는 selector. */
    const createPresentation = vi.fn(
      (input): TestLifecyclePresentation => ({
        phase: input.phase,
        title:
          input.readiness.status.kind === 'ready'
            ? '요청할 수 있습니다'
            : '서비스 상태를 확인하고 있습니다',
      }),
    );
    /** 테스트 lifecycle hook options. */
    const options: UseExtractionRequestLifecycleOptions<
      TestVideoJob,
      TestVideoJob,
      'video',
      TestLifecyclePresentation
    > = {
      adapter: createInMemoryRequestLifecycleAdapter({
        createRequest: async () => createJob(),
        getStatus: async () => createJob(),
        kind: 'video',
        readiness: readyResponse,
      }),
      createPresentation,
      messages: {
        cancelled: '취소 후 입력을 보존했습니다.',
        unavailable: '서버가 준비되지 않았습니다.',
      },
      navigation: {
        setHistoryDestination: () => undefined,
        setLocked: () => undefined,
      },
    };
    /** lifecycle hook을 mount할 renderer. */
    let renderer: ReturnType<typeof create>;

    await act(async () => {
      renderer = create(
        createElement(PresentationLifecycleProbe, {
          onValue: (value) => {
            latest = value;
          },
          options,
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(createPresentation).toHaveBeenCalled();
    expect(latest?.presentation).toEqual({
      phase: 'request',
      title: '요청할 수 있습니다',
    });

    await act(async () => {
      renderer!.unmount();
    });
  });

  it('keeps the production video adapter on the same interface', async () => {
    /** 운영 adapter의 fetch 대체 함수. */
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      /** 호출된 API URL path. */
      const path = new URL(String(input)).pathname;

      if (path.endsWith('/health')) {
        return new Response(JSON.stringify(readyResponse), { status: 200 });
      }

      if (path.endsWith('/downloads')) {
        return new Response(JSON.stringify(createJob()), { status: 200 });
      }

      return new Response(JSON.stringify(createJob({ displayStatus: 'processing' })), {
        status: 200,
      });
    });
    /** 운영 통신을 감싼 영상 adapter. */
    const adapter = createVideoRequestAdapter({
      apiBaseUrl: 'https://mytube-extract.example/api',
      fetcher,
    });

    await expect(adapter.checkReadiness(new AbortController().signal)).resolves.toEqual(
      readyResponse,
    );
    await expect(
      adapter.createRequest(
        {
          mode: 'video',
          quality: '720',
          sourceUrl: 'https://youtu.be/abc123_DEF0',
        },
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ displayStatus: 'queued' });
    await expect(
      adapter.getStatus(
        {
          acceptedAt: '2026-09-04T00:00:00.000Z',
          jobId: '4f8f82b3-cf37-4e31-9d56-d27eb526a922',
          kind: 'video',
        },
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ displayStatus: 'processing' });

    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('keeps the same lifecycle phases and actions when the adapter is replaced with subtitle', async () => {
    /** 자막 adapter에 전달된 요청 입력 기록. */
    const createRequest = vi.fn(
      async (request: TestSubtitleRequest) =>
        createSubtitleJob({
          fileName: request.fileName,
          whisperModel: request.whisperModel,
        }),
    );
    /** 자막 상태 조회 adapter 호출 기록. */
    const getStatus = vi.fn(async () =>
      createSubtitleJob({
        displayStatus: 'completed',
        stage: 'completed',
      }),
    );
    /** 자막 lifecycle adapter seam을 사용하는 in-memory adapter. */
    const adapter = createInMemoryRequestLifecycleAdapter<
      TestSubtitleRequest,
      TestSubtitleJob,
      'subtitle'
    >({
      createRequest,
      getStatus,
      kind: 'subtitle',
      readiness: readyResponse,
    });
    /** hook에서 관찰한 최신 lifecycle 값. */
    let latest:
      | RequestLifecycleResult<TestSubtitleRequest, TestSubtitleJob>
      | undefined;
    /** lifecycle에서 저장한 자막 receipt 기록. */
    const savedReceipts: string[] = [];
    /** lifecycle hook을 mount할 renderer. */
    let renderer: ReturnType<typeof create>;

    await act(async () => {
      renderer = create(
        createElement(SubtitleLifecycleProbe, {
          onValue: (value) => {
            latest = value;
          },
          options: {
            adapter,
            messages: {
              cancelled: '취소 후 파일을 보존했습니다.',
              unavailable: '자막 서버가 준비되지 않았습니다.',
            },
            navigation: {
              setHistoryDestination: () => undefined,
              setLocked: () => undefined,
            },
            receiptStore: {
              save: (kind, jobId, acceptedAt) => {
                savedReceipts.push(`${kind}:${jobId}:${acceptedAt}`);
                return { storageFailed: false, to: '/history' };
              },
            },
          },
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latest?.phase).toBe('request');
    expect(latest?.actions.submit).toBeDefined();
    expect(latest?.actions.cancel).toBeUndefined();

    await act(async () => {
      latest?.actions.submit?.({
        fileName: 'sample-video.mp4',
        whisperModel: 'small_en',
      });
      /** lifecycle adapter 응답을 반영할 microtask 반복 횟수. */
      let index = 0;
      for (; index < 6; index += 1) {
        await Promise.resolve();
      }
    });

    expect(createRequest).toHaveBeenCalledWith(
      { fileName: 'sample-video.mp4', whisperModel: 'small_en' },
      expect.any(AbortSignal),
    );
    expect(getStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'subtitle',
        jobId: '067b084b-c84a-4574-952f-950cb8fa2157',
      }),
      expect.any(AbortSignal),
    );
    expect(savedReceipts).toHaveLength(1);
    expect(savedReceipts[0]).toMatch(/^subtitle:/);
    expect(latest?.receipt?.kind).toBe('subtitle');
    expect(latest?.phase).toBe('result');
    expect(latest?.actions.submit).toBeUndefined();
    expect(latest?.actions.cancel).toBeUndefined();
    expect(latest?.actions.reset).toBeDefined();

    await act(async () => {
      renderer!.unmount();
    });
  });

  it('continues readiness after React StrictMode effect cleanup and replay', async () => {
    /** readiness 응답을 즉시 반환하는 adapter. */
    const adapter = createInMemoryRequestLifecycleAdapter({
      createRequest: async () => createJob(),
      getStatus: async () => createJob({ displayStatus: 'completed' }),
      kind: 'video',
      readiness: readyResponse,
    });
    /** hook에서 관찰한 최신 lifecycle 값. */
    let latest: RequestLifecycleResult<TestVideoJob, TestVideoJob> | undefined;
    /** lifecycle hook을 mount할 renderer. */
    let renderer: ReturnType<typeof create>;

    await act(async () => {
      renderer = create(
        createElement(
          StrictMode,
          null,
          createElement(LifecycleProbe, {
            onValue: (value) => {
              latest = value;
            },
            options: {
              adapter,
              messages: {
                cancelled: '취소 후 입력을 보존했습니다.',
                unavailable: '서버가 준비되지 않았습니다.',
              },
              navigation: {
                setHistoryDestination: () => undefined,
                setLocked: () => undefined,
              },
            },
          }),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latest?.readiness.status.kind).toBe('ready');

    await act(async () => {
      renderer!.unmount();
    });
  });

  it('exposes readiness retry after submit-time health failure', async () => {
    /** readiness adapter 호출 횟수. */
    let readinessCall = 0;
    /** hook에서 관찰한 최신 lifecycle 값. */
    let latest: RequestLifecycleResult<TestVideoJob, TestVideoJob> | undefined;
    /** 테스트 adapter. */
    const adapter = createInMemoryRequestLifecycleAdapter({
      createRequest: vi.fn(async () => createJob()),
      getStatus: async () => createJob({ displayStatus: 'completed' }),
      kind: 'video',
      readiness: async () => {
        readinessCall += 1;

        if (readinessCall === 2) {
          throw new Error('health temporarily unavailable');
        }

        return readyResponse;
      },
    });
    /** lifecycle hook을 mount할 renderer. */
    let renderer: ReturnType<typeof create>;

    await act(async () => {
      renderer = create(
        createElement(LifecycleProbe, {
          onValue: (value) => {
            latest = value;
          },
          options: {
            adapter,
            messages: {
              cancelled: '취소 후 입력을 보존했습니다.',
              unavailable: '서버가 준비되지 않았습니다.',
            },
            navigation: {
              setHistoryDestination: () => undefined,
              setLocked: () => undefined,
            },
          },
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      latest?.actions.submit?.(createJob());
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latest?.phase).toBe('error');
    expect(latest?.readiness.status.kind).toBe('failed');
    expect(latest?.actions.retryReadiness).toBeDefined();

    await act(async () => {
      latest?.actions.retryReadiness?.();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latest?.phase).toBe('request');
    expect(latest?.readiness.status.kind).toBe('ready');

    await act(async () => {
      renderer!.unmount();
    });
  });

  it('keeps the lifecycle interface through readiness, cancellation race, receipt, and terminal polling', async () => {
    /** 최초 readiness 응답 gate. */
    const initialReadiness = createDeferred<RequestReadinessResponse>();
    /** submit 직전 readiness 응답 gate. */
    const submitReadiness = createDeferred<RequestReadinessResponse>();
    /** 접수 응답 gate. */
    const acceptedJob = createDeferred<TestVideoJob>();
    /** 완료 상태 응답 gate. */
    const completedJob = createDeferred<TestVideoJob>();
    /** readiness adapter 호출 횟수. */
    let readinessCall = 0;
    /** navigation lock 변경 기록. */
    const lockChanges: boolean[] = [];
    /** history 목적지 변경 기록. */
    const historyDestinations: string[] = [];
    /** 저장된 receipt 기록. */
    const savedReceipts: string[] = [];
    /** hook에서 관찰한 최신 lifecycle 값. */
    let latest: RequestLifecycleResult<TestVideoJob, TestVideoJob> | undefined;
    /** 테스트 adapter. */
    const adapter = createInMemoryRequestLifecycleAdapter({
      createRequest: vi.fn(async () => acceptedJob.promise),
      getStatus: vi.fn(async () => completedJob.promise),
      kind: 'video',
      readiness: async () => {
        readinessCall += 1;
        return readinessCall === 1
          ? initialReadiness.promise
          : submitReadiness.promise;
      },
    });
    /** 테스트 lifecycle hook options. */
    const options: UseExtractionRequestLifecycleOptions<
      TestVideoJob,
      TestVideoJob,
      'video'
    > = {
      adapter,
      messages: {
        cancelled: '취소 후 입력을 보존했습니다.',
        unavailable: '서버가 준비되지 않았습니다.',
      },
      navigation: {
        setHistoryDestination: (destination) => historyDestinations.push(destination),
        setLocked: (locked) => lockChanges.push(locked),
      },
      now: () => Date.parse('2026-09-04T01:02:03.000Z'),
      receiptStore: {
        save: (kind, jobId, acceptedAt) => {
          savedReceipts.push(`${kind}:${jobId}:${acceptedAt}`);
          return { storageFailed: false, to: `/history?kind=${kind}&jobId=${jobId}` };
        },
      },
    };
    /** lifecycle hook을 mount할 renderer. */
    let renderer: ReturnType<typeof create>;

    await act(async () => {
      renderer = create(
        createElement(LifecycleProbe, {
          onValue: (value) => {
            latest = value;
          },
          options,
        }),
      );
    });

    expect(latest?.readiness.status.kind).toBe('checking');
    initialReadiness.resolve(readyResponse);
    await act(async () => {
      await Promise.resolve();
    });
    expect(latest?.readiness.status.kind).toBe('ready');

    await act(async () => {
      latest?.actions.submit?.(createJob({ displayStatus: 'queued' }));
    });
    expect(latest?.phase).toBe('accepting');
    expect(lockChanges).toContain(true);
    submitReadiness.resolve(readyResponse);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(latest?.phase).toBe('accepting');

    await act(async () => {
      expect(latest?.actions.cancel?.()).toBe(true);
    });
    expect(latest?.phase).toBe('request');
    expect(latest?.requestNotice).toBe('취소 후 입력을 보존했습니다.');
    expect(lockChanges.at(-1)).toBe(false);

    acceptedJob.resolve(createJob());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(savedReceipts).toHaveLength(1);
    expect(savedReceipts[0]).toContain('2026-09-04T01:02:03.000Z');
    expect(historyDestinations).toEqual(['/history']);
    expect(latest?.phase).toBe('processing');

    completedJob.resolve(createJob({ displayStatus: 'completed' }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(latest?.phase).toBe('result');
    expect(latest?.job?.displayStatus).toBe('completed');

    await act(async () => {
      renderer!.unmount();
    });
  });

  it('keeps an accepted job active when receipt storage fails', async () => {
    /** readiness 응답을 즉시 반환하는 adapter. */
    const adapter = createInMemoryRequestLifecycleAdapter({
      createRequest: async () => createJob(),
      getStatus: async () => createJob({ displayStatus: 'completed' }),
      kind: 'video',
      readiness: readyResponse,
    });
    /** hook에서 관찰한 최신 lifecycle 값. */
    let latest: RequestLifecycleResult<TestVideoJob, TestVideoJob> | undefined;
    /** history 목적지 변경 기록. */
    const historyDestinations: string[] = [];
    /** 테스트 lifecycle hook options. */
    const options: UseExtractionRequestLifecycleOptions<
      TestVideoJob,
      TestVideoJob,
      'video'
    > = {
      adapter,
      messages: {
        cancelled: '취소 후 입력을 보존했습니다.',
        unavailable: '서버가 준비되지 않았습니다.',
      },
      navigation: {
        setHistoryDestination: (destination) => historyDestinations.push(destination),
        setLocked: () => undefined,
      },
      receiptStore: {
        save: () => ({
          storageFailed: true,
          to: '/history?kind=video&jobId=4f8f82b3-cf37-4e31-9d56-d27eb526a922',
        }),
      },
    };
    /** lifecycle hook을 mount할 renderer. */
    let renderer: ReturnType<typeof create>;

    await act(async () => {
      renderer = create(
        createElement(LifecycleProbe, {
          onValue: (value) => {
            latest = value;
          },
          options,
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      latest?.actions.submit?.(createJob());
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latest?.receiptStorageFailed).toBe(true);
    expect(latest?.requestNotice).toBe(
      '요청 내역 저장에 실패했지만 현재 작업은 계속 확인할 수 있습니다.',
    );
    expect(latest?.phase).toBe('result');
    expect(historyDestinations).toEqual([
      '/history?kind=video&jobId=4f8f82b3-cf37-4e31-9d56-d27eb526a922',
    ]);

    await act(async () => {
      renderer!.unmount();
    });
  });

  it('keeps processing during retryable status errors until a later success', async () => {
    vi.useFakeTimers();

    try {
      /** 상태 조회 호출 횟수. */
      let statusCall = 0;
      /** hook에서 관찰한 최신 lifecycle 값. */
      let latest: RequestLifecycleResult<TestVideoJob, TestVideoJob> | undefined;
      /** 첫 network 오류 뒤 완료 상태를 반환하는 adapter. */
      const adapter = createInMemoryRequestLifecycleAdapter({
        createRequest: async () => createJob(),
        getStatus: async () => {
          statusCall += 1;

          if (statusCall === 1) {
            throw new TypeError('temporary network failure');
          }

          return createJob({ displayStatus: 'completed' });
        },
        kind: 'video',
        readiness: readyResponse,
      });
      /** 테스트 lifecycle hook options. */
      const options: UseExtractionRequestLifecycleOptions<
        TestVideoJob,
        TestVideoJob,
        'video'
      > = {
        adapter,
        messages: {
          cancelled: '취소 후 입력을 보존했습니다.',
          unavailable: '서버가 준비되지 않았습니다.',
        },
        navigation: {
          setHistoryDestination: () => undefined,
          setLocked: () => undefined,
        },
      };
      /** lifecycle hook을 mount할 renderer. */
      let renderer: ReturnType<typeof create>;

      await act(async () => {
        renderer = create(
          createElement(LifecycleProbe, {
            onValue: (value) => {
              latest = value;
            },
            options,
          }),
        );
        await Promise.resolve();
        await Promise.resolve();
      });
      await act(async () => {
        latest?.actions.submit?.(createJob());
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(statusCall).toBe(1);
      expect(latest?.phase).toBe('processing');
      expect(latest?.error).toBeNull();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
      });

      expect(latest?.phase).toBe('result');

      await act(async () => {
        renderer!.unmount();
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('exposes a non-retryable status error without scheduling another poll', async () => {
    /** 상태 조회 호출 횟수. */
    let statusCall = 0;
    /** hook에서 관찰한 최신 lifecycle 값. */
    let latest: RequestLifecycleResult<TestVideoJob, TestVideoJob> | undefined;
    /** 재시도 불가 404를 반환하는 adapter. */
    const adapter = createInMemoryRequestLifecycleAdapter({
      createRequest: async () => createJob(),
      getStatus: async () => {
        statusCall += 1;
        throw new JobStatusRequestError(404);
      },
      kind: 'video',
      readiness: readyResponse,
    });
    /** 테스트 lifecycle hook options. */
    const options: UseExtractionRequestLifecycleOptions<
      TestVideoJob,
      TestVideoJob,
      'video'
    > = {
      adapter,
      messages: {
        cancelled: '취소 후 입력을 보존했습니다.',
        unavailable: '서버가 준비되지 않았습니다.',
      },
      navigation: {
        setHistoryDestination: () => undefined,
        setLocked: () => undefined,
      },
    };
    /** lifecycle hook을 mount할 renderer. */
    let renderer: ReturnType<typeof create>;

    await act(async () => {
      renderer = create(
        createElement(LifecycleProbe, {
          onValue: (value) => {
            latest = value;
          },
          options,
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      latest?.actions.submit?.(createJob());
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(statusCall).toBe(1);
    expect(latest?.phase).toBe('error');
    expect(latest?.error?.source).toBe('status');

    await act(async () => {
      renderer!.unmount();
    });
  });

  it('preserves a ready request while background readiness is checking and gates unavailable requests', async () => {
    /** background readiness 응답 gate. */
    const backgroundReadiness = createDeferred<RequestReadinessResponse>();
    /** readiness adapter 호출 횟수. */
    let readinessCall = 0;
    /** hook에서 관찰한 최신 lifecycle 값. */
    let latest: RequestLifecycleResult<TestVideoJob, TestVideoJob> | undefined;
    /** 테스트 adapter. */
    const adapter = createInMemoryRequestLifecycleAdapter({
      createRequest: async () => createJob(),
      getStatus: async () => createJob({ displayStatus: 'completed' }),
      kind: 'video',
      readiness: async () => {
        readinessCall += 1;
        return readinessCall === 1
          ? readyResponse
          : backgroundReadiness.promise;
      },
    });
    /** 테스트 lifecycle hook options. */
    const options: UseExtractionRequestLifecycleOptions<
      TestVideoJob,
      TestVideoJob,
      'video'
    > = {
      adapter,
      messages: {
        cancelled: '취소 후 입력을 보존했습니다.',
        unavailable: '서버가 준비되지 않았습니다.',
      },
      navigation: {
        setHistoryDestination: () => undefined,
        setLocked: () => undefined,
      },
    };
    /** lifecycle hook을 mount할 renderer. */
    let renderer: ReturnType<typeof create>;

    await act(async () => {
      renderer = create(
        createElement(LifecycleProbe, {
          onValue: (value) => {
            latest = value;
          },
          options,
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(latest?.readiness.status.kind).toBe('ready');

    await act(async () => {
      latest?.actions.retryReadiness?.();
    });
    expect(latest?.readiness.status.kind).toBe('ready');
    expect(latest?.readiness.isFetching).toBe(true);
    expect(latest?.actions.submit).toBeDefined();

    backgroundReadiness.resolve({ ok: true, worker: { available: false } });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(latest?.readiness.status.kind).toBe('unavailable');
    expect(latest?.actions.submit).toBeUndefined();
    expect(latest?.actions.retryReadiness).toBeDefined();

    await act(async () => {
      renderer!.unmount();
    });
  });

  it('does not create a job when cancel races a pending submit readiness check', async () => {
    /** submit 직전 readiness 응답 gate. */
    const submitReadiness = createDeferred<RequestReadinessResponse>();
    /** 생성 adapter 호출 기록. */
    const createRequest = vi.fn(async () => createJob());
    /** readiness adapter 호출 횟수. */
    let readinessCall = 0;
    /** hook에서 관찰한 최신 lifecycle 값. */
    let latest: RequestLifecycleResult<TestVideoJob, TestVideoJob> | undefined;
    /** 테스트 adapter. */
    const adapter = createInMemoryRequestLifecycleAdapter({
      createRequest,
      getStatus: async () => createJob({ displayStatus: 'completed' }),
      kind: 'video',
      readiness: async () => {
        readinessCall += 1;
        return readinessCall === 1 ? readyResponse : submitReadiness.promise;
      },
    });
    /** navigation lock 변경 기록. */
    const lockChanges: boolean[] = [];
    /** 테스트 lifecycle hook options. */
    const options: UseExtractionRequestLifecycleOptions<
      TestVideoJob,
      TestVideoJob,
      'video'
    > = {
      adapter,
      messages: {
        cancelled: '취소 후 입력을 보존했습니다.',
        unavailable: '서버가 준비되지 않았습니다.',
      },
      navigation: {
        setHistoryDestination: () => undefined,
        setLocked: (locked) => lockChanges.push(locked),
      },
    };
    /** lifecycle hook을 mount할 renderer. */
    let renderer: ReturnType<typeof create>;

    await act(async () => {
      renderer = create(
        createElement(LifecycleProbe, {
          onValue: (value) => {
            latest = value;
          },
          options,
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      latest?.actions.submit?.(createJob());
    });
    expect(latest?.phase).toBe('accepting');

    await act(async () => {
      expect(latest?.actions.cancel?.()).toBe(true);
    });
    submitReadiness.resolve(readyResponse);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(createRequest).not.toHaveBeenCalled();
    expect(latest?.phase).toBe('request');
    expect(latest?.readiness.isFetching).toBe(false);
    expect(lockChanges.at(-1)).toBe(false);

    await act(async () => {
      renderer!.unmount();
    });
  });
});
