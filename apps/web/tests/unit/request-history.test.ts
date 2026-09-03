import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JobStatusRequestError } from '../../src/api/mytube-extract.api';
import { RequestHistoryPage } from '../../src/app/pages/request-history/page';
import {
  createJobStatusRequestErrorDetail,
  createTerminalJobErrorDetail,
  fetchJobStatus,
  getJobStatusRefetchInterval,
} from '../../src/app/utils/job-status-polling.util';
import {
  parseHistoryDeepLink,
  updateDismissedReceiptKeys,
} from '../../src/app/pages/request-history/request-history.logic';

const VIDEO_ID = '4f8f82b3-cf37-4e31-9d56-d27eb526a922';
const SUBTITLE_ID = '067b084b-c84a-4574-952f-950cb8fa2157';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('request history query contract', () => {
  it('shows both request paths and the browser retention model when history is empty', () => {
    /** 빈 요청 내역 페이지의 query client. */
    const queryClient = new QueryClient();
    /** 빈 요청 내역에서 렌더링한 실제 페이지 마크업. */
    const markup = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(
          MemoryRouter,
          { initialEntries: ['/history'] },
          createElement(RequestHistoryPage),
        ),
      ),
    );

    expect(markup).toContain('class="phase-panel history-panel"');
    expect(markup).not.toContain('class="console-panel history-panel"');
    expect(markup).toContain('class="history-empty__links"');
    expect(markup).toContain('시작할 작업을 선택하세요.');
    expect(markup).toContain('href="/video"');
    expect(markup).toContain('href="/subtitles"');
    expect(markup).toContain(
      'YouTube URL로 영상(MP4) 또는 오디오(MP3)를 받습니다.',
    );
    expect(markup).toContain('로컬 영상으로 영어 자막 파일(SRT)을 만듭니다.');
    expect(markup).toContain(
      '이력은 이 브라우저에만 저장되며, 완료 파일은 7일 동안 보관됩니다.',
    );
    expect(markup).not.toContain(
      '아직 이 브라우저에서 접수한 요청이 없습니다.',
    );
  });

  it('validates deep links and stops polling only for terminal states', () => {
    expect(
      parseHistoryDeepLink(
        `?kind=video&jobId=${VIDEO_ID}`,
        '2026-08-11T00:00:00.000Z',
      ),
    ).toEqual({
      kind: 'video',
      jobId: VIDEO_ID,
      acceptedAt: '2026-08-11T00:00:00.000Z',
    });
    expect(parseHistoryDeepLink('?kind=video&jobId=bad')).toBeNull();
    expect(getJobStatusRefetchInterval('queued')).toBe(2500);
    expect(getJobStatusRefetchInterval('processing')).toBe(2500);
    expect(getJobStatusRefetchInterval('completed')).toBe(false);
    expect(getJobStatusRefetchInterval('failed')).toBe(false);
    expect(getJobStatusRefetchInterval('expired')).toBe(false);
    expect(
      getJobStatusRefetchInterval(
        'queued',
        new JobStatusRequestError(404),
      ),
    ).toBe(false);
    expect(
      getJobStatusRefetchInterval(
        'queued',
        new JobStatusRequestError(500),
      ),
    ).toBe(2500);
  });

  it('uses the existing endpoint for each receipt kind', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL) =>
      new Response(JSON.stringify({ displayStatus: 'completed' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetcher);
    const signal = new AbortController().signal;

    await fetchJobStatus(
      { kind: 'video', jobId: VIDEO_ID, acceptedAt: '2026-08-11T00:00:00.000Z' },
      'https://mytube-extract.example/api',
      signal,
    );
    await fetchJobStatus(
      { kind: 'subtitle', jobId: SUBTITLE_ID, acceptedAt: '2026-08-11T00:01:00.000Z' },
      'https://mytube-extract.example/api',
      signal,
    );

    expect(fetcher.mock.calls.map(([input]) => String(input))).toEqual([
      `https://mytube-extract.example/api/downloads/${VIDEO_ID}`,
      `https://mytube-extract.example/api/subtitles/jobs/${SUBTITLE_ID}`,
    ]);
  });

  it('turns a non-retryable status lookup failure into actionable detail', () => {
    /** 상태 조회에 실패한 영상 접수증. */
    const receipt = {
      kind: 'video' as const,
      jobId: VIDEO_ID,
      acceptedAt: '2026-08-11T00:00:00.000Z',
    };

    expect(
      createJobStatusRequestErrorDetail(
        new JobStatusRequestError(404),
        receipt,
      ),
    ).toEqual({
      code: 'JOB_STATUS_NOT_FOUND',
      guidance:
        '접수한 작업을 더 이상 찾을 수 없습니다. 같은 종류의 요청을 다시 접수해 주세요.',
      location: '작업 상태 확인',
      requestPath: `/downloads/${VIDEO_ID}`,
      responseStatus: 404,
    });
  });

  it('preserves a terminal job error code in disclosure detail', () => {
    /** 실패한 자막 job 접수증. */
    const receipt = {
      kind: 'subtitle' as const,
      jobId: SUBTITLE_ID,
      acceptedAt: '2026-08-11T00:01:00.000Z',
    };

    expect(
      createTerminalJobErrorDetail(
        {
          displayStatus: 'failed',
          errorCode: 'TRANSCRIPTION_FAILED',
          message: '영어 SRT 생성에 실패했습니다.',
        },
        receipt,
      ),
    ).toEqual({
      code: 'TRANSCRIPTION_FAILED',
      guidance: '영어 SRT 생성에 실패했습니다.',
      location: '영어 SRT 생성 상태',
      requestPath: `/subtitles/jobs/${SUBTITLE_ID}`,
    });
  });

  it('hides an exact cross-tab deletion and restores the same receipt when re-added', () => {
    const videoKey = `mytube-extract:job-receipt:v2:video:${VIDEO_ID}`;
    const subtitleIdentity = `subtitle:${SUBTITLE_ID}`;
    const deleted = updateDismissedReceiptKeys(
      new Set([subtitleIdentity]),
      videoKey,
      null,
    );

    expect([...deleted]).toEqual([subtitleIdentity, `video:${VIDEO_ID}`]);
    expect([
      ...updateDismissedReceiptKeys(
        deleted,
        videoKey,
        JSON.stringify({ acceptedAt: '2026-08-11T00:00:00.000Z' }),
      ),
    ]).toEqual([subtitleIdentity]);
    expect(updateDismissedReceiptKeys(deleted, 'unrelated', null)).toBe(deleted);
  });
});
