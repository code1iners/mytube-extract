import { describe, expect, it, vi } from 'vitest';
import {
  SubtitleUploadCompleteFailedError,
  isAbortError,
} from '../../src/api/mytube-extract.api';
import {
  createSubtitleRequestAdapter,
  type SubtitleRequest,
} from '../../src/app/adapters/subtitle-request.adapter';
import type { RequestReadinessResponse } from '../../src/app/hooks/use-extraction-request-lifecycle';

/** 테스트에서 외부 resolve를 제어할 promise. */
type Deferred<T> = {
  /** 외부에서 값을 완료할 promise. */
  promise: Promise<T>;
  /** promise를 성공으로 완료한다. */
  resolve: (value: T) => void;
  /** promise를 오류로 완료한다. */
  reject: (reason?: unknown) => void;
};

/** 테스트에서 사용할 정상 readiness 응답. */
const readyResponse: RequestReadinessResponse = {
  ok: true,
  worker: { available: true },
};

/** 테스트에서 사용할 자막 job 응답. */
const subtitleJob = {
  createdAt: '2026-09-04T01:02:03.000Z',
  displayStatus: 'queued' as const,
  downloadUrl: null,
  errorCode: null,
  fileName: 'sample-video.mp4',
  jobId: '4f8f82b3-cf37-4e31-9d56-d27eb526a922',
  message: '요청이 접수되어 대기 중입니다.',
  progress: 10,
  retentionDays: 7,
  stage: 'queued' as const,
  status: 'queued' as const,
  whisperModel: 'small_en' as const,
};

/** 테스트에서 외부 resolve·reject를 제어할 promise를 만든다. */
function createDeferred<T>(): Deferred<T> {
  /** promise resolve 함수. */
  let resolve!: (value: T) => void;
  /** promise reject 함수. */
  let reject!: (reason?: unknown) => void;
  /** 외부 제어 promise. */
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, reject, resolve };
}

/** 비동기 fetch chain이 다음 상태까지 진행하도록 microtask를 비운다. */
async function flushMicrotasks() {
  /** microtask를 비우는 반복 index. */
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}

describe('subtitle request adapter', () => {
  it('satisfies the lifecycle seam while hiding multipart ordering', async () => {
    /** 테스트에서 adapter로 전달할 자막 요청. */
    const request: SubtitleRequest = {
      file: new File(['video'], 'sample-video.mp4', { type: 'video/mp4' }),
      whisperModel: 'small_en',
    };
    /** adapter의 업로드 progress 관찰값. */
    const progress: Array<number | null> = [];
    /** multipart 요청 순서를 관찰할 fetch transport. */
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      /** 호출된 URL path. */
      const url = new URL(String(input));

      if (url.pathname.endsWith('/health')) {
        return new Response(JSON.stringify(readyResponse), { status: 200 });
      }

      if (url.pathname.endsWith('/subtitles/uploads')) {
        expect(init?.method).toBe('POST');
        expect(JSON.parse(String(init?.body))).toEqual({
          contentType: 'video/mp4',
          fileName: 'sample-video.mp4',
          sizeBytes: 5,
          whisperModel: 'small_en',
        });
        return new Response(
          JSON.stringify({
            expiresAt: '2026-09-04T02:00:00.000Z',
            objectKey: 'subtitles/uploads/session-1/source.mp4',
            partSizeBytes: 64,
            parts: [
              {
                partNumber: 1,
                uploadUrl: 'https://r2.example/session-1/part-1',
              },
            ],
            uploadId: 'upload-1',
            uploadToken: 'token-1',
          }),
          { status: 200 },
        );
      }

      if (url.hostname === 'r2.example') {
        expect(init?.method).toBe('PUT');
        return new Response(null, {
          headers: { ETag: '"etag-1"' },
          status: 200,
        });
      }

      if (url.pathname.endsWith('/subtitles/uploads/complete')) {
        expect(init?.method).toBe('POST');
        expect(JSON.parse(String(init?.body))).toMatchObject({
          objectKey: 'subtitles/uploads/session-1/source.mp4',
          parts: [{ etag: '"etag-1"', partNumber: 1 }],
          uploadId: 'upload-1',
          uploadToken: 'token-1',
        });
        return new Response(JSON.stringify(subtitleJob), { status: 200 });
      }

      if (url.pathname.endsWith(`/subtitles/jobs/${subtitleJob.jobId}`)) {
        expect(init?.method).toBeUndefined();
        return new Response(JSON.stringify(subtitleJob), { status: 200 });
      }

      throw new Error(`Unexpected transport request: ${url}`);
    });
    /** 운영 HTTP transport를 감싼 자막 lifecycle adapter. */
    const adapter = createSubtitleRequestAdapter({
      apiBaseUrl: 'https://mytube-extract.example/api',
      fetcher,
      onProgress: (snapshot) =>
        progress.push(snapshot ? snapshot.uploadedBytes : null),
    });

    await expect(
      adapter.checkReadiness(new AbortController().signal),
    ).resolves.toEqual(readyResponse);
    await expect(
      adapter.createRequest(request, new AbortController().signal),
    ).resolves.toEqual(subtitleJob);
    await expect(
      adapter.getStatus(
        {
          acceptedAt: '2026-09-04T01:02:03.000Z',
          jobId: subtitleJob.jobId,
          kind: 'subtitle',
        },
        new AbortController().signal,
      ),
    ).resolves.toEqual(subtitleJob);

    expect(progress).toEqual([0, request.file.size, null]);
    expect(fetcher).toHaveBeenCalledTimes(5);
  });

  it('uploads parts concurrently, reports real bytes, and completes sorted parts', async () => {
    /** 테스트에서 adapter로 전달할 자막 요청. */
    const request: SubtitleRequest = {
      file: new File(['abcdefghij'], 'sample-video.mp4', {
        type: 'video/mp4',
      }),
      whisperModel: 'base_en',
    };
    /** part별 R2 응답 gate. */
    const partResponses = new Map<number, Deferred<Response>>([
      [1, createDeferred<Response>()],
      [2, createDeferred<Response>()],
      [3, createDeferred<Response>()],
    ]);
    /** adapter의 byte progress 관찰값. */
    const progress: Array<number | null> = [];
    /** 현재 동시에 실행 중인 part 수. */
    let activeUploads = 0;
    /** 관찰된 최대 동시 part 수. */
    let maxConcurrentUploads = 0;
    /** complete 요청에서 받은 part payload. */
    let completedParts: unknown;
    /** session·part·complete를 재현하는 in-memory transport. */
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      /** 호출된 URL. */
      const url = new URL(String(input));

      if (url.pathname.endsWith('/subtitles/uploads')) {
        return new Response(
          JSON.stringify({
            expiresAt: '2026-09-04T02:00:00.000Z',
            objectKey: 'subtitles/uploads/session-2/source.mp4',
            partSizeBytes: 4,
            parts: [1, 2, 3].map((partNumber) => ({
              partNumber,
              uploadUrl: `https://r2.example/session-2/part-${partNumber}`,
            })),
            uploadId: 'upload-2',
            uploadToken: 'token-2',
          }),
          { status: 200 },
        );
      }

      if (url.hostname === 'r2.example') {
        /** URL에서 읽은 multipart part 번호. */
        const partNumber = Number(url.pathname.split('-').pop());
        /** 해당 part의 외부 응답 gate. */
        const partResponse = partResponses.get(partNumber);

        expect(init?.method).toBe('PUT');
        expect(partResponse).toBeDefined();
        activeUploads += 1;
        maxConcurrentUploads = Math.max(maxConcurrentUploads, activeUploads);

        try {
          return await partResponse!.promise;
        } finally {
          activeUploads -= 1;
        }
      }

      if (url.pathname.endsWith('/subtitles/uploads/complete')) {
        /** complete 요청 body. */
        const body = JSON.parse(String(init?.body)) as {
          parts: unknown;
        };

        completedParts = body.parts;
        return new Response(JSON.stringify(subtitleJob), { status: 200 });
      }

      throw new Error(`Unexpected transport request: ${url}`);
    });
    /** 운영 HTTP transport를 감싼 자막 lifecycle adapter. */
    const adapter = createSubtitleRequestAdapter({
      apiBaseUrl: 'https://mytube-extract.example/api',
      fetcher,
      onProgress: (snapshot) =>
        progress.push(snapshot ? snapshot.uploadedBytes : null),
    });
    /** multipart 요청 promise. */
    const requestPromise = adapter.createRequest(
      request,
      new AbortController().signal,
    );

    await flushMicrotasks();
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(maxConcurrentUploads).toBe(3);

    partResponses.get(3)!.resolve(
      new Response(null, {
        headers: { ETag: '"etag-3"' },
        status: 200,
      }),
    );
    partResponses.get(2)!.resolve(
      new Response(null, {
        headers: { ETag: '"etag-2"' },
        status: 200,
      }),
    );
    partResponses.get(1)!.resolve(
      new Response(null, {
        headers: { ETag: '"etag-1"' },
        status: 200,
      }),
    );

    await expect(requestPromise).resolves.toEqual(subtitleJob);
    expect(completedParts).toEqual([
      { etag: '"etag-1"', partNumber: 1 },
      { etag: '"etag-2"', partNumber: 2 },
      { etag: '"etag-3"', partNumber: 3 },
    ]);
    expect(progress).toEqual([0, 2, 6, 10, null]);
  });

  it.each([
    {
      createPartResponse: () => new Response(null, { status: 502 }),
      expectedDetail: {
        code: 'SUBTITLE_DIRECT_UPLOAD_FAILED',
        location: 'R2 part 업로드',
        responseStatus: 502,
      },
      name: 'part HTTP failure',
    },
    {
      createPartResponse: () => new Response(null, { status: 200 }),
      expectedDetail: {
        code: 'SUBTITLE_DIRECT_UPLOAD_FAILED',
        location: 'R2 part 업로드 응답 확인',
        responseStatus: undefined,
      },
      name: 'missing ETag',
    },
  ])(
    'preserves the $name fact and requests best-effort cleanup',
    async ({ createPartResponse, expectedDetail }) => {
      /** 테스트에서 adapter로 전달할 자막 요청. */
      const request: SubtitleRequest = {
        file: new File(['video'], 'sample-video.mp4', {
          type: 'video/mp4',
        }),
        whisperModel: 'base_en',
      };
      /** transport 호출 순서. */
      const paths: string[] = [];
      /** cleanup 요청에 전달된 signal. */
      let cleanupSignal: AbortSignal | null | undefined;
      /** session·part·cleanup을 재현하는 in-memory transport. */
      const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        /** 호출된 URL. */
        const url = new URL(String(input));
        paths.push(url.pathname);

        if (url.pathname.endsWith('/subtitles/uploads')) {
          return new Response(
            JSON.stringify({
              expiresAt: '2026-09-04T02:00:00.000Z',
              objectKey: 'subtitles/uploads/session-failure/source.mp4',
              partSizeBytes: 64,
              parts: [
                {
                  partNumber: 1,
                  uploadUrl: 'https://r2.example/session-failure/part-1',
                },
              ],
              uploadId: 'upload-failure',
              uploadToken: 'token-failure',
            }),
            { status: 200 },
          );
        }

        if (url.hostname === 'r2.example') {
          return createPartResponse();
        }

        if (url.pathname.endsWith('/subtitles/uploads/abort')) {
          cleanupSignal = init?.signal;
          expect(JSON.parse(String(init?.body))).toEqual({
            objectKey: 'subtitles/uploads/session-failure/source.mp4',
            uploadId: 'upload-failure',
            uploadToken: 'token-failure',
          });
          return new Response(null, { status: 204 });
        }

        throw new Error(`Unexpected transport request: ${url}`);
      });
      /** 운영 HTTP transport를 감싼 자막 lifecycle adapter. */
      const adapter = createSubtitleRequestAdapter({
        apiBaseUrl: 'https://mytube-extract.example/api',
        fetcher,
      });

      await expect(
        adapter.createRequest(request, new AbortController().signal),
      ).rejects.toMatchObject({ detail: expectedDetail });
      expect(paths).toEqual([
        '/api/subtitles/uploads',
        '/session-failure/part-1',
        '/api/subtitles/uploads/abort',
      ]);
      expect(cleanupSignal).toBeUndefined();
    },
  );

  it('exposes a user-readable complete failure and does not replace it with cleanup failure', async () => {
    /** 테스트에서 adapter로 전달할 자막 요청. */
    const request: SubtitleRequest = {
      file: new File(['video'], 'sample-video.mp4', { type: 'video/mp4' }),
      whisperModel: 'small_en',
    };
    /** transport 호출 순서. */
    const paths: string[] = [];
    /** complete 실패 뒤 abort cleanup이 끝났는지 확인할 promise. */
    const cleanupFinished = createDeferred<void>();
    /** session·part·complete·cleanup을 재현하는 in-memory transport. */
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      /** 호출된 URL. */
      const url = new URL(String(input));
      paths.push(url.pathname);

      if (url.pathname.endsWith('/subtitles/uploads')) {
        return new Response(
          JSON.stringify({
            expiresAt: '2026-09-04T02:00:00.000Z',
            objectKey: 'subtitles/uploads/session-complete/source.mp4',
            partSizeBytes: 64,
            parts: [
              {
                partNumber: 1,
                uploadUrl: 'https://r2.example/session-complete/part-1',
              },
            ],
            uploadId: 'upload-complete',
            uploadToken: 'token-complete',
          }),
          { status: 200 },
        );
      }

      if (url.hostname === 'r2.example') {
        return new Response(null, {
          headers: { ETag: '"etag-1"' },
          status: 200,
        });
      }

      if (url.pathname.endsWith('/subtitles/uploads/complete')) {
        return new Response(null, { status: 503 });
      }

      if (url.pathname.endsWith('/subtitles/uploads/abort')) {
        cleanupFinished.resolve();
        return new Response(null, { status: 500 });
      }

      throw new Error(`Unexpected transport request: ${url}`);
    });
    /** 운영 HTTP transport를 감싼 자막 lifecycle adapter. */
    const adapter = createSubtitleRequestAdapter({
      apiBaseUrl: 'https://mytube-extract.example/api',
      fetcher,
    });

    /** adapter가 보존한 원래 오류. */
    const error = await adapter
      .createRequest(request, new AbortController().signal)
      .catch((reason: unknown) => reason);

    await cleanupFinished.promise;
    expect(error).toBeInstanceOf(SubtitleUploadCompleteFailedError);
    expect(error).toMatchObject({
      detail: {
        code: 'SUBTITLE_UPLOAD_COMPLETE_FAILED',
        location: 'R2 multipart 업로드 완료',
        requestPath: '/subtitles/uploads/complete',
        responseStatus: 503,
      },
    });
    expect(paths).toEqual([
      '/api/subtitles/uploads',
      '/session-complete/part-1',
      '/api/subtitles/uploads/complete',
      '/api/subtitles/uploads/abort',
    ]);
  });

  it('preserves browser abort and cleans up without reusing the aborted signal', async () => {
    /** 테스트에서 adapter로 전달할 자막 요청. */
    const request: SubtitleRequest = {
      file: new File(['video'], 'sample-video.mp4', { type: 'video/mp4' }),
      whisperModel: 'base_en',
    };
    /** caller가 중단한 signal. */
    const controller = new AbortController();
    /** cleanup 요청에 전달된 signal. */
    let cleanupSignal: AbortSignal | null | undefined;
    /** cleanup endpoint 호출 여부. */
    let cleanupCalled = false;
    /** browser가 보고한 원본 abort 오류. */
    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    /** session·part·cleanup을 재현하는 in-memory transport. */
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      /** 호출된 URL. */
      const url = new URL(String(input));

      if (url.pathname.endsWith('/subtitles/uploads')) {
        return new Response(
          JSON.stringify({
            expiresAt: '2026-09-04T02:00:00.000Z',
            objectKey: 'subtitles/uploads/session-abort/source.mp4',
            partSizeBytes: 64,
            parts: [
              {
                partNumber: 1,
                uploadUrl: 'https://r2.example/session-abort/part-1',
              },
            ],
            uploadId: 'upload-abort',
            uploadToken: 'token-abort',
          }),
          { status: 200 },
        );
      }

      if (url.hostname === 'r2.example') {
        throw abortError;
      }

      if (url.pathname.endsWith('/subtitles/uploads/abort')) {
        cleanupCalled = true;
        cleanupSignal = init?.signal;
        return new Response(null, { status: 500 });
      }

      throw new Error(`Unexpected transport request: ${url}`);
    });
    /** 운영 HTTP transport를 감싼 자막 lifecycle adapter. */
    const adapter = createSubtitleRequestAdapter({
      apiBaseUrl: 'https://mytube-extract.example/api',
      fetcher,
    });

    const requestPromise = adapter.createRequest(request, controller.signal);
    controller.abort();

    await expect(requestPromise).rejects.toBe(abortError);
    expect(isAbortError(abortError)).toBe(true);
    expect(cleanupCalled).toBe(true);
    expect(cleanupSignal).toBeUndefined();
  });

  it('does not request cleanup when session creation fails before an upload exists', async () => {
    /** 테스트에서 adapter로 전달할 자막 요청. */
    const request: SubtitleRequest = {
      file: new File(['video'], 'large-video.mp4', { type: 'video/mp4' }),
      whisperModel: 'base_en',
    };
    /** session 생성 요청 이후 transport 호출 수. */
    let transportCalls = 0;
    /** session 생성 실패를 재현하는 in-memory transport. */
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      /** 호출된 URL. */
      const url = new URL(String(input));
      transportCalls += 1;
      expect(url.pathname).toBe('/api/subtitles/uploads');

      return new Response(null, { status: 413 });
    });
    /** 운영 HTTP transport를 감싼 자막 lifecycle adapter. */
    const adapter = createSubtitleRequestAdapter({
      apiBaseUrl: 'https://mytube-extract.example/api',
      fetcher,
    });

    await expect(
      adapter.createRequest(request, new AbortController().signal),
    ).rejects.toMatchObject({
      detail: {
        code: 'SUBTITLE_UPLOAD_TOO_LARGE',
        requestPath: '/subtitles/uploads',
        responseStatus: 413,
      },
    });
    expect(transportCalls).toBe(1);
  });

  it('keeps a complete success when caller cancellation races the response', async () => {
    /** 테스트에서 adapter로 전달할 자막 요청. */
    const request: SubtitleRequest = {
      file: new File(['video'], 'sample-video.mp4', { type: 'video/mp4' }),
      whisperModel: 'small_en',
    };
    /** complete 응답 gate. */
    const completeResponse = createDeferred<Response>();
    /** complete 이후 cleanup 요청이 발생했는지 여부. */
    let cleanupCalled = false;
    /** complete 응답까지 수행하는 in-memory transport. */
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      /** 호출된 URL. */
      const url = new URL(String(input));

      if (url.pathname.endsWith('/subtitles/uploads')) {
        return new Response(
          JSON.stringify({
            expiresAt: '2026-09-04T02:00:00.000Z',
            objectKey: 'subtitles/uploads/session-race/source.mp4',
            partSizeBytes: 64,
            parts: [
              {
                partNumber: 1,
                uploadUrl: 'https://r2.example/session-race/part-1',
              },
            ],
            uploadId: 'upload-race',
            uploadToken: 'token-race',
          }),
          { status: 200 },
        );
      }

      if (url.hostname === 'r2.example') {
        return new Response(null, {
          headers: { ETag: '"etag-race"' },
          status: 200,
        });
      }

      if (url.pathname.endsWith('/subtitles/uploads/complete')) {
        expect(init?.signal).toBeUndefined();
        return completeResponse.promise;
      }

      if (url.pathname.endsWith('/subtitles/uploads/abort')) {
        cleanupCalled = true;
        return new Response(null, { status: 204 });
      }

      throw new Error(`Unexpected transport request: ${url}`);
    });
    /** caller가 중단할 signal. */
    const controller = new AbortController();
    /** 운영 HTTP transport를 감싼 자막 lifecycle adapter. */
    const adapter = createSubtitleRequestAdapter({
      apiBaseUrl: 'https://mytube-extract.example/api',
      fetcher,
    });
    /** multipart complete 요청 promise. */
    const requestPromise = adapter.createRequest(request, controller.signal);

    await flushMicrotasks();
    controller.abort();
    completeResponse.resolve(new Response(JSON.stringify(subtitleJob), { status: 200 }));

    await expect(requestPromise).resolves.toEqual(subtitleJob);
    expect(cleanupCalled).toBe(false);
  });
});
