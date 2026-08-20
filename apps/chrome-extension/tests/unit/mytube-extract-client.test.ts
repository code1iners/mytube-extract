import { describe, expect, it, vi } from 'vitest';
import {
  DownloadJobRequestError,
  createMyTubeExtractClient,
} from '../../src/services/mytube-extract/mytube-extract-client';

/** job 생성 성공 응답을 만든다. */
function createJobResponseBody(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    createdAt: '2026-06-24T05:32:00.000Z',
    displayStatus: 'queued',
    downloadUrl: null,
    errorCode: null,
    jobId: 'job-1',
    message: '요청이 접수되어 대기 중입니다.',
    progress: 0,
    quality: '320',
    retentionDays: 7,
    status: 'queued',
    type: 'audio',
    ...overrides,
  };
}

describe('mytube extract client download jobs', () => {
  it('creates a download job without sending a filename', async () => {
    /** 가짜 fetch 함수. */
    const fetchMock = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(createJobResponseBody()),
      ok: true,
      status: 201,
    });
    /** 테스트용 client. */
    const client = createMyTubeExtractClient({ fetch: fetchMock });

    /** job 생성 결과. */
    const job = await client.createDownloadJob({
      apiBaseUrl: 'http://127.0.0.1:3030',
      quality: '320',
      sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
      type: 'audio',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:3030/downloads',
      expect.objectContaining({
        body: JSON.stringify({
          quality: '320',
          type: 'audio',
          url: 'https://www.youtube.com/watch?v=abc123_DEF0',
        }),
        method: 'POST',
      }),
    );
    expect(job).toMatchObject({ jobId: 'job-1', status: 'queued' });
  });

  it('resolves a relative downloadUrl into an absolute URL when fetching job status', async () => {
    /** 가짜 fetch 함수. */
    const fetchMock = vi.fn().mockResolvedValue({
      json: () =>
        Promise.resolve(
          createJobResponseBody({
            displayStatus: 'completed',
            downloadUrl: '/downloads/job-1/file',
            progress: 100,
            status: 'completed',
          }),
        ),
      ok: true,
      status: 200,
    });
    /** 테스트용 client. */
    const client = createMyTubeExtractClient({ fetch: fetchMock });

    /** job 상태 조회 결과. */
    const job = await client.getDownloadJob('http://127.0.0.1:3030', 'job-1');

    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:3030/downloads/job-1');
    expect(job.downloadUrl).toBe('http://127.0.0.1:3030/downloads/job-1/file');
  });

  it('throws a distinguishable error with the response status on job request failures', async () => {
    /** 가짜 fetch 함수. */
    const fetchMock = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({}),
      ok: false,
      status: 404,
    });
    /** 테스트용 client. */
    const client = createMyTubeExtractClient({ fetch: fetchMock });

    await expect(client.getDownloadJob('http://127.0.0.1:3030', 'missing')).rejects.toThrow(
      DownloadJobRequestError,
    );

    try {
      await client.getDownloadJob('http://127.0.0.1:3030', 'missing');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DownloadJobRequestError);
      expect((error as DownloadJobRequestError).responseStatus).toBe(404);
    }
  });

  it('throws a network error distinguishable from an HTTP error when fetch itself fails', async () => {
    /** 네트워크 오류를 던지는 가짜 fetch 함수. */
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('network down'));
    /** 테스트용 client. */
    const client = createMyTubeExtractClient({ fetch: fetchMock });

    await expect(
      client.createDownloadJob({
        apiBaseUrl: 'http://127.0.0.1:3030',
        quality: '320',
        sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
        type: 'audio',
      }),
    ).rejects.not.toBeInstanceOf(DownloadJobRequestError);
  });
});
