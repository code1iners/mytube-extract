import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchHistoryJobStatus,
  getHistoryRefetchInterval,
  parseHistoryDeepLink,
  updateDismissedReceiptKeys,
} from '../../src/app/pages/request-history/request-history.logic';

const VIDEO_ID = '4f8f82b3-cf37-4e31-9d56-d27eb526a922';
const SUBTITLE_ID = '067b084b-c84a-4574-952f-950cb8fa2157';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('request history query contract', () => {
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
    expect(getHistoryRefetchInterval('queued')).toBe(2500);
    expect(getHistoryRefetchInterval('processing')).toBe(2500);
    expect(getHistoryRefetchInterval('completed')).toBe(false);
    expect(getHistoryRefetchInterval('failed')).toBe(false);
    expect(getHistoryRefetchInterval('expired')).toBe(false);
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

    await fetchHistoryJobStatus(
      { kind: 'video', jobId: VIDEO_ID, acceptedAt: '2026-08-11T00:00:00.000Z' },
      'https://mytube-extract.example/api',
      signal,
    );
    await fetchHistoryJobStatus(
      { kind: 'subtitle', jobId: SUBTITLE_ID, acceptedAt: '2026-08-11T00:01:00.000Z' },
      'https://mytube-extract.example/api',
      signal,
    );

    expect(fetcher.mock.calls.map(([input]) => String(input))).toEqual([
      `https://mytube-extract.example/api/downloads/${VIDEO_ID}`,
      `https://mytube-extract.example/api/subtitles/jobs/${SUBTITLE_ID}`,
    ]);
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
