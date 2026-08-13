import { describe, expect, it } from 'vitest';
import {
  DEFAULT_API_BASE_URL,
  ServiceStatusFormatError,
  WorkerUnavailableError,
  assertWorkerAvailable,
  buildCreateDownloadJobRequest,
  completeSubtitleUpload,
  createSubtitleJob,
  createSubtitleUpload,
  getDownloadJob,
  getJobStatusRetryDelay,
  getSubtitleJob,
  getWorkerHealth,
  shouldRetryJobStatus,
  uploadSubtitleFileParts,
} from '../../src/api/mytube-extract.api';
import type { DownloadDraft } from '../../src/domain/download-request/download-request';

/** 테스트용 기본 다운로드 입력값. */
const baseDraft: DownloadDraft = {
  mode: 'audio',
  quality: '320',
  sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
};

describe('mytube extract api client', () => {
  it('uses port 5011 as the local API default', () => {
    expect(DEFAULT_API_BASE_URL).toBe('http://127.0.0.1:5011');
  });

  it('builds an audio download job request', () => {
    /** 생성된 다운로드 job 요청. */
    const request = buildCreateDownloadJobRequest(
      {
        ...baseDraft,
        quality: '192',
      },
      'http://127.0.0.1:3030',
    );

    expect(request.url).toBe('http://127.0.0.1:3030/downloads');
    expect(request.body).toEqual({
      quality: '192',
      type: 'audio',
      url: baseDraft.sourceUrl,
    });
  });

  it('uses the configured API base URL without dropping its path', () => {
    /** 생성된 다운로드 job 요청. */
    const request = buildCreateDownloadJobRequest(
      baseDraft,
      'https://mytube-extract.example/api/',
    );

    expect(request.url).toBe('https://mytube-extract.example/api/downloads');
  });

  it('reads worker availability from health', async () => {
    /** health 조회 mock fetch. */
    const fetcher = async () =>
      new Response(
        JSON.stringify({
          ok: true,
          worker: { available: false },
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        },
      );

    await expect(
      getWorkerHealth({
        apiBaseUrl: 'https://mytube-extract.example/api',
        fetcher,
      }),
    ).resolves.toEqual({
      ok: true,
      worker: { available: false },
    });
  });

  it('throws a displayable error when worker health omits worker state', async () => {
    /** 이전 배포 health 응답 mock fetch. */
    const fetcher = async () =>
      new Response(JSON.stringify({ ok: true }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });

    await expect(
      getWorkerHealth({
        apiBaseUrl: 'https://mytube-extract.example/api',
        fetcher,
      }),
    ).rejects.toMatchObject({
      detail: {
        code: 'SERVICE_STATUS_FORMAT_ERROR',
        location: '서비스 상태 확인',
        responseBody: '{"ok":true}',
        responseStatus: 200,
      },
    });
    await expect(
      getWorkerHealth({
        apiBaseUrl: 'https://mytube-extract.example/api',
        fetcher,
      }),
    ).rejects.toBeInstanceOf(ServiceStatusFormatError);
  });

  it('throws when worker health is unavailable', () => {
    expect(() =>
      assertWorkerAvailable({
        ok: true,
        worker: { available: false },
      }),
    ).toThrow(WorkerUnavailableError);
  });

  it('throws when worker health is missing', () => {
    expect(() => assertWorkerAvailable(undefined)).toThrow(
      WorkerUnavailableError,
    );
  });

  it('classifies retryable job status failures without retrying 4xx or aborts', async () => {
    /** 503 상태 조회 응답 mock fetch. */
    const fetcher = async () => new Response(null, { status: 503 });

    await expect(
      getDownloadJob('4f8f82b3-cf37-4e31-9d56-d27eb526a922', { fetcher }),
    ).rejects.toMatchObject({ responseStatus: 503 });

    expect(shouldRetryJobStatus(0, new TypeError('Failed to fetch'))).toBe(
      true,
    );
    expect(
      shouldRetryJobStatus(0, { name: 'JobStatusRequestError', responseStatus: 503 }),
    ).toBe(true);
    expect(
      shouldRetryJobStatus(0, { name: 'JobStatusRequestError', responseStatus: 404 }),
    ).toBe(false);
    expect(shouldRetryJobStatus(0, new DOMException('Aborted', 'AbortError'))).toBe(
      false,
    );
    expect(shouldRetryJobStatus(0, new SyntaxError('Invalid JSON'))).toBe(false);
    expect(getJobStatusRetryDelay(0)).toBe(1000);
    expect(getJobStatusRetryDelay(10)).toBe(30_000);
  });

  it('queries the subtitle job endpoint', async () => {
    const jobId = '067b084b-c84a-4574-952f-950cb8fa2157';
    const fetcher = async (input: RequestInfo | URL) => {
      expect(String(input)).toBe(
        `https://mytube-extract.example/api/subtitles/jobs/${jobId}`,
      );
      return new Response(
        JSON.stringify({
          createdAt: '2026-08-11T00:00:00.000Z',
          displayStatus: 'queued',
          downloadUrl: null,
          errorCode: null,
          fileName: 'sample.mp4',
          jobId,
          message: '대기 중',
          progress: 10,
          retentionDays: 7,
          stage: 'queued',
          status: 'queued',
          whisperModel: 'base_en',
        }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 },
      );
    };

    await expect(
      getSubtitleJob(jobId, {
        apiBaseUrl: 'https://mytube-extract.example/api',
        fetcher,
      }),
    ).resolves.toMatchObject({ jobId, displayStatus: 'queued' });
  });

  it('creates a subtitle direct upload session', async () => {
    /** upload session 생성 요청 mock fetch. */
    const fetcher = async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(_url)).toBe(
        'https://mytube-extract.example/api/subtitles/uploads',
      );
      expect(init?.method).toBe('POST');
      expect(init?.headers).toMatchObject({
        'Content-Type': 'application/json',
      });
      expect(JSON.parse(String(init?.body))).toMatchObject({
        contentType: 'video/mp4',
        fileName: 'sample-video.mp4',
        sizeBytes: 5,
        whisperModel: 'small_en',
      });

      return new Response(
        JSON.stringify({
          expiresAt: '2026-07-03T01:30:00.000Z',
          objectKey: 'subtitles/uploads/session-1/source.mp4',
          partSizeBytes: 67108864,
          parts: [{ partNumber: 1, uploadUrl: 'https://r2.example/part-1' }],
          uploadId: 'upload-1',
          uploadToken: 'token',
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        },
      );
    };

    await expect(
      createSubtitleUpload(
        new File(['video'], 'sample-video.mp4', { type: 'video/mp4' }),
        'small_en',
        {
          apiBaseUrl: 'https://mytube-extract.example/api',
          fetcher,
        },
      ),
    ).resolves.toMatchObject({
      objectKey: 'subtitles/uploads/session-1/source.mp4',
      uploadId: 'upload-1',
    });
  });

  it('uploads subtitle file parts to R2 presigned URLs', async () => {
    /** R2 part PUT 요청 mock fetch. */
    const fetcher = async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(_url)).toBe('https://r2.example/part-1');
      expect(init?.method).toBe('PUT');
      expect(init?.body).toBeInstanceOf(Blob);

      return new Response(null, {
        headers: { ETag: '"etag-1"' },
        status: 200,
      });
    };
    /** 진행률 기록. */
    const progress: number[] = [];

    await expect(
      uploadSubtitleFileParts(
        new File(['video'], 'sample-video.mp4', { type: 'video/mp4' }),
        {
          expiresAt: '2026-07-03T01:30:00.000Z',
          objectKey: 'subtitles/uploads/session-1/source.mp4',
          partSizeBytes: 67108864,
          parts: [{ partNumber: 1, uploadUrl: 'https://r2.example/part-1' }],
          uploadId: 'upload-1',
          uploadToken: 'token',
        },
        {
          fetcher,
          onProgress: (snapshot) => progress.push(snapshot.percent),
        },
      ),
    ).resolves.toEqual([{ etag: '"etag-1"', partNumber: 1 }]);
    expect(progress).toEqual([100]);
  });

  it('completes a subtitle direct upload', async () => {
    /** upload complete 요청 mock fetch. */
    const fetcher = async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(_url)).toBe(
        'https://mytube-extract.example/api/subtitles/uploads/complete',
      );
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toMatchObject({
        objectKey: 'subtitles/uploads/session-1/source.mp4',
        parts: [{ etag: '"etag-1"', partNumber: 1 }],
        uploadId: 'upload-1',
        uploadToken: 'token',
      });

      return new Response(
        JSON.stringify({
          createdAt: '2026-07-03T01:00:00.000Z',
          displayStatus: 'queued',
          downloadUrl: null,
          errorCode: null,
          fileName: 'sample-video.mp4',
          jobId: 'subtitle-job-1',
          message: '요청이 접수되어 대기 중입니다.',
          progress: 10,
          retentionDays: 7,
          stage: 'queued',
          status: 'queued',
          whisperModel: 'small_en',
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        },
      );
    };

    await expect(
      completeSubtitleUpload(
        {
          expiresAt: '2026-07-03T01:30:00.000Z',
          objectKey: 'subtitles/uploads/session-1/source.mp4',
          partSizeBytes: 67108864,
          parts: [{ partNumber: 1, uploadUrl: 'https://r2.example/part-1' }],
          uploadId: 'upload-1',
          uploadToken: 'token',
        },
        [{ etag: '"etag-1"', partNumber: 1 }],
        {
          apiBaseUrl: 'https://mytube-extract.example/api',
          fetcher,
        },
      ),
    ).resolves.toMatchObject({
      displayStatus: 'queued',
      jobId: 'subtitle-job-1',
    });
  });

  it('creates a legacy subtitle job with multipart form data', async () => {
    /** 업로드 요청 mock fetch. */
    const fetcher = async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(String(_url)).toBe(
        'https://mytube-extract.example/api/subtitles/jobs',
      );
      expect(init?.method).toBe('POST');
      expect(init?.body).toBeInstanceOf(FormData);
      expect((init?.body as FormData).get('whisperModel')).toBe('small_en');

      return new Response(
        JSON.stringify({
          createdAt: '2026-07-03T01:00:00.000Z',
          displayStatus: 'queued',
          downloadUrl: null,
          errorCode: null,
          fileName: 'sample-video.mp4',
          jobId: 'subtitle-job-1',
          message: '요청이 접수되어 대기 중입니다.',
          progress: 10,
          retentionDays: 7,
          stage: 'queued',
          status: 'queued',
          whisperModel: 'small_en',
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        },
      );
    };

    await expect(
      createSubtitleJob(
        new File(['video'], 'sample-video.mp4', { type: 'video/mp4' }),
        'small_en',
        {
          apiBaseUrl: 'https://mytube-extract.example/api',
          fetcher,
        },
      ),
    ).resolves.toMatchObject({
      displayStatus: 'queued',
      jobId: 'subtitle-job-1',
    });
  });

  it('throws a displayable error when direct subtitle upload is too large', async () => {
    /** 업로드 용량 초과 응답 mock fetch. */
    const fetcher = async () =>
      new Response(
        JSON.stringify({
          error: 'Payload Too Large',
          message: 'File too large',
          statusCode: 413,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 413,
        },
      );

    await expect(
      createSubtitleUpload(
        new File(['video'], 'large-video.mp4', { type: 'video/mp4' }),
        'base_en',
        {
          apiBaseUrl: 'https://mytube-extract.example/api',
          fetcher,
        },
      ),
    ).rejects.toMatchObject({
      detail: {
        requestPath: '/subtitles/uploads',
        responseStatus: 413,
      },
    });
  });

  it('keeps the legacy subtitle upload 413 request path', async () => {
    /** 업로드 용량 초과 응답 mock fetch. */
    const fetcher = async () =>
      new Response(
        JSON.stringify({
          error: 'Payload Too Large',
          message: 'File too large',
          statusCode: 413,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 413,
        },
      );

    await expect(
      createSubtitleJob(
        new File(['video'], 'large-video.mp4', { type: 'video/mp4' }),
        'base_en',
        {
          apiBaseUrl: 'https://mytube-extract.example/api',
          fetcher,
        },
      ),
    ).rejects.toMatchObject({
      detail: {
        requestPath: '/subtitles/jobs',
        responseStatus: 413,
      },
    });
  });

});
