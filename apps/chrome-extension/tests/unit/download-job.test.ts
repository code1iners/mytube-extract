import { describe, expect, it } from 'vitest';
import {
  type DownloadJob,
  findLatestVideoJob,
  getDownloadJobVideoId,
  selectLatestJobByVideoId,
  sortDownloadJobsNewestFirst,
} from '../../src/domain/download-job/download-job';

/** 검사용 job을 만든다. */
function createJob(jobId: string, createdAt: string, sourceUrl: string | null): DownloadJob {
  return {
    createdAt,
    displayStatus: 'queued',
    downloadUrl: null,
    errorCode: null,
    jobId,
    message: '',
    progress: null,
    quality: '192',
    retentionDays: 7,
    sourceUrl,
    status: 'queued',
    title: null,
    type: 'audio',
  };
}

describe('download job video ID', () => {
  it.each([
    ['watch', 'https://www.youtube.com/watch?v=abc123_DEF0&t=42', 'abc123_DEF0'],
    ['Shorts', 'https://www.youtube.com/shorts/abc123_DEF0', 'abc123_DEF0'],
    ['youtu.be', 'https://youtu.be/abc123_DEF0?si=share', 'abc123_DEF0'],
  ])('reads the video ID from a %s source URL', (_label, sourceUrl, expectedVideoId) => {
    expect(getDownloadJobVideoId({ sourceUrl })).toBe(expectedVideoId);
  });

  it('returns null for a job stored without a source URL', () => {
    expect(getDownloadJobVideoId({ sourceUrl: null })).toBeNull();
  });

  it.each([
    ['a non-YouTube URL', 'https://example.com/watch?v=abc123_DEF0'],
    ['a malformed URL', 'not a url'],
    ['a watch URL with an invalid ID', 'https://www.youtube.com/watch?v=short'],
  ])('returns null for %s', (_label, sourceUrl) => {
    expect(getDownloadJobVideoId({ sourceUrl })).toBeNull();
  });
});

describe('latest job per video', () => {
  /** 같은 영상 두 건과 다른 영상 한 건, 원본 주소가 없는 예전 job 한 건. 저장 순서는 최신순이 아니다. */
  const jobs = [
    createJob('old-a', '2026-11-12T09:00:00.000Z', 'https://www.youtube.com/watch?v=aaaaaaaaaaa'),
    createJob('legacy', '2026-11-12T09:30:00.000Z', null),
    createJob('new-a', '2026-11-12T10:00:00.000Z', 'https://youtu.be/aaaaaaaaaaa'),
    createJob('only-b', '2026-11-12T09:10:00.000Z', 'https://www.youtube.com/watch?v=bbbbbbbbbbb'),
  ];

  it('sorts jobs newest first without changing the given list', () => {
    expect(sortDownloadJobsNewestFirst(jobs).map((job) => job.jobId)).toEqual(['new-a', 'legacy', 'only-b', 'old-a']);
    expect(jobs[0]?.jobId).toBe('old-a');
  });

  it('keeps only the newest job of each video and skips jobs without a source video', () => {
    expect(
      Object.fromEntries([...selectLatestJobByVideoId(jobs)].map(([videoId, job]) => [videoId, job.jobId])),
    ).toEqual({ aaaaaaaaaaa: 'new-a', bbbbbbbbbbb: 'only-b' });
  });

  it('finds the newest job of one video or null when the video has none', () => {
    expect(findLatestVideoJob(jobs, 'aaaaaaaaaaa')?.jobId).toBe('new-a');
    expect(findLatestVideoJob(jobs, 'ccccccccccc')).toBeNull();
  });
});
