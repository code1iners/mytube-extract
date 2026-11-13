import { describe, expect, it } from 'vitest';
import { type DownloadJob } from '../../src/domain/download-job/download-job';
import {
  createOverlayCardStatusTracker,
  OVERLAY_COMPLETED_BADGE_MS,
  subscribeOverlayRecentJobs,
} from '../../src/features/youtube-overlay/youtube-overlay-card-status';

/** 검사 기준 시각. */
const NOW = Date.parse('2026-11-12T10:00:00.000Z');

/** 검사용 job을 만든다. 영상 ID만 주면 그 영상의 대기 job이 된다. */
function createJob(overrides: Partial<DownloadJob> & { videoId?: string } = {}): DownloadJob {
  /** job 원본 영상 ID. */
  const { videoId = 'abc123_DEF0', ...jobOverrides } = overrides;

  return {
    createdAt: '2026-11-12T09:59:00.000Z',
    displayStatus: jobOverrides.status ?? 'queued',
    downloadUrl: null,
    errorCode: null,
    jobId: 'job-' + videoId,
    message: '',
    progress: null,
    quality: '720',
    retentionDays: 7,
    sourceUrl: 'https://www.youtube.com/watch?v=' + videoId,
    status: 'queued',
    title: 'Fixture title',
    type: 'video',
    ...jobOverrides,
  };
}

describe('Overlay card status tracker', () => {
  it('shows the stored job state for the card with the same video ID', () => {
    /** Overlay 카드 상태 tracker. */
    const tracker = createOverlayCardStatusTracker();

    tracker.update([createJob({ status: 'processing' })], NOW);

    expect(tracker.getStatus('abc123_DEF0', NOW)).toEqual({ state: 'processing' });
    expect(tracker.getStatus('other12_XYZ', NOW)).toBeNull();
  });

  it('uses the newest job when one video has several jobs', () => {
    /** Overlay 카드 상태 tracker. */
    const tracker = createOverlayCardStatusTracker();

    // 저장 순서와 관계없이 생성 시각이 가장 늦은 job을 기준으로 한다.
    tracker.update(
      [
        createJob({ createdAt: '2026-11-12T09:50:00.000Z', jobId: 'old', status: 'failed' }),
        createJob({ createdAt: '2026-11-12T09:58:00.000Z', jobId: 'new', status: 'queued' }),
      ],
      NOW,
    );

    expect(tracker.getStatus('abc123_DEF0', NOW)).toEqual({ state: 'queued' });
  });

  it('shows nothing once the job leaves the stored recent list', () => {
    /** Overlay 카드 상태 tracker. */
    const tracker = createOverlayCardStatusTracker();

    tracker.update([createJob({ status: 'failed' })], NOW);
    // Background가 보관 정책으로 job을 지우면 카드 상태도 함께 사라진다.
    tracker.update([createJob({ videoId: 'vid0001_AAA' })], NOW + 1000);

    expect(tracker.getStatus('abc123_DEF0', NOW + 1000)).toBeNull();
    expect(tracker.getStatus('vid0001_AAA', NOW + 1000)).toEqual({ state: 'queued' });
  });

  it('keeps in-progress jobs that Background retains beyond five', () => {
    /** Overlay 카드 상태 tracker. */
    const tracker = createOverlayCardStatusTracker();
    /** 진행 중이라 5건을 넘어서도 보관된 job. */
    const inProgressJobs = ['vid0001_AAA', 'vid0002_AAA', 'vid0003_AAA', 'vid0004_AAA', 'vid0005_AAA'].map(
      (videoId, index) =>
        createJob({ createdAt: '2026-11-12T09:5' + index + ':00.000Z', videoId }),
    );

    tracker.update(
      [...inProgressJobs, createJob({ createdAt: '2026-11-12T09:00:00.000Z', status: 'processing' })],
      NOW,
    );

    expect(tracker.getStatus('abc123_DEF0', NOW)).toEqual({ state: 'processing' });
  });

  it('shows nothing for an expired job instead of falling back to an older one', () => {
    /** Overlay 카드 상태 tracker. */
    const tracker = createOverlayCardStatusTracker();

    tracker.update(
      [
        createJob({ createdAt: '2026-11-12T09:00:00.000Z', jobId: 'old', status: 'failed' }),
        createJob({
          createdAt: '2026-11-12T09:30:00.000Z',
          displayStatus: 'expired',
          jobId: 'new',
          status: 'completed',
        }),
      ],
      NOW,
    );

    expect(tracker.getStatus('abc123_DEF0', NOW)).toBeNull();
  });

  it('ignores old jobs without a source URL', () => {
    /** Overlay 카드 상태 tracker. */
    const tracker = createOverlayCardStatusTracker();

    tracker.update([createJob({ sourceUrl: null, status: 'processing' })], NOW);

    expect(tracker.getStatus('abc123_DEF0', NOW)).toBeNull();
  });

  it('offers a retry with the same format and quality for a failed job', () => {
    /** Overlay 카드 상태 tracker. */
    const tracker = createOverlayCardStatusTracker();

    tracker.update([createJob({ quality: '192', status: 'failed', type: 'audio' })], NOW);

    expect(tracker.getStatus('abc123_DEF0', NOW)).toEqual({
      mode: 'audio',
      quality: 192,
      state: 'failed',
    });
  });

  it('shows the completed badge for a few seconds after the job completes', () => {
    /** Overlay 카드 상태 tracker. */
    const tracker = createOverlayCardStatusTracker();

    tracker.update([createJob({ status: 'processing' })], NOW);
    tracker.update([createJob({ status: 'completed' })], NOW + 1000);

    expect(tracker.getStatus('abc123_DEF0', NOW + 1000)).toEqual({ state: 'completed' });
    expect(tracker.getNextChangeDelay(NOW + 2000)).toBe(OVERLAY_COMPLETED_BADGE_MS - 1000);
    expect(tracker.getStatus('abc123_DEF0', NOW + 1000 + OVERLAY_COMPLETED_BADGE_MS)).toBeNull();
    expect(tracker.getNextChangeDelay(NOW + 1000 + OVERLAY_COMPLETED_BADGE_MS)).toBeNull();
  });

  it('does not show the completed badge for a job that was already complete when the page loaded', () => {
    /** Overlay 카드 상태 tracker. */
    const tracker = createOverlayCardStatusTracker();

    tracker.update([createJob({ status: 'completed' })], NOW);
    // 같은 완료 job이 다시 저장돼도 새 완료로 보지 않는다.
    tracker.update([createJob({ status: 'completed' })], NOW + 1000);

    expect(tracker.getStatus('abc123_DEF0', NOW + 1000)).toBeNull();
    expect(tracker.getNextChangeDelay(NOW + 1000)).toBeNull();
  });

  it('shows the completed badge for a job that first appears already complete after the page loaded', () => {
    /** Overlay 카드 상태 tracker. */
    const tracker = createOverlayCardStatusTracker();

    tracker.update([], NOW);
    // 저장 사이에 대기·처리를 건너뛰고 바로 완료로 기록된 job도 새 완료로 본다.
    tracker.update([createJob({ status: 'completed' })], NOW + 1000);

    expect(tracker.getStatus('abc123_DEF0', NOW + 1000)).toEqual({ state: 'completed' });
  });
});

/** 첫 읽기를 원하는 시점에 끝낼 수 있는 가짜 최근 job storage를 만든다. */
function createDeferredJobStorage() {
  /** 변경 이벤트 listener. */
  let changeListener: (jobs: DownloadJob[]) => void = () => {};
  /** 첫 읽기 결과를 돌려주는 함수. */
  let resolveLoad: (jobs: DownloadJob[]) => void = () => {};

  return {
    storage: {
      loadJobs: () =>
        new Promise<DownloadJob[]>((resolve) => {
          resolveLoad = resolve;
        }),
      subscribeJobs(listener: (jobs: DownloadJob[]) => void) {
        changeListener = listener;

        return () => {};
      },
    },
    emitChange: (jobs: DownloadJob[]) => changeListener(jobs),
    finishLoad: (jobs: DownloadJob[]) => resolveLoad(jobs),
  };
}

describe('Overlay recent job subscription', () => {
  it('shows the completed badge when the job completes before the first read finishes', async () => {
    /** Overlay 카드 상태 tracker. */
    const tracker = createOverlayCardStatusTracker();
    /** 첫 읽기가 늦게 끝나는 storage. */
    const { emitChange, finishLoad, storage } = createDeferredJobStorage();

    subscribeOverlayRecentJobs(storage, (jobs) => tracker.update(jobs, NOW));
    emitChange([createJob({ status: 'completed' })]);
    finishLoad([createJob({ status: 'processing' })]);
    await Promise.resolve();

    expect(tracker.getStatus('abc123_DEF0', NOW)).toEqual({ state: 'completed' });
  });

  it('applies only the first read when no change arrives before it', async () => {
    /** 반영한 목록 기록. */
    const applied: DownloadJob[][] = [];
    /** 첫 읽기가 늦게 끝나는 storage. */
    const { emitChange, finishLoad, storage } = createDeferredJobStorage();

    subscribeOverlayRecentJobs(storage, (jobs) => applied.push(jobs));
    finishLoad([createJob({ status: 'processing' })]);
    await Promise.resolve();
    emitChange([createJob({ status: 'completed' })]);

    expect(applied.map((jobs) => jobs[0]?.status)).toEqual(['processing', 'completed']);
  });
});
