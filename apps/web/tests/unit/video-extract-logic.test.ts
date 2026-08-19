import { describe, expect, it } from 'vitest';
import {
  createIdleJob,
  createProgressLabel,
  createStatusTitle,
  createWorkerHealthErrorDetail,
  createWorkerHealthTitle,
  formatQuality,
  formatTime,
  getStatusIconName,
  hasUserVisibleErrorDetail,
} from '../../src/app/pages/video-extract/_hooks/use-video-extract-logic';
import type { DownloadResponse } from '../../src/domain/download-request/download-request';

/** 테스트용 기본 job. */
function createJob(overrides: Partial<DownloadResponse> = {}): DownloadResponse {
  return {
    createdAt: '2026-08-19T00:00:00.000Z',
    displayStatus: 'queued',
    downloadUrl: null,
    errorCode: null,
    jobId: 'job-1',
    message: '',
    progress: 0,
    quality: '320',
    retentionDays: 7,
    status: 'queued',
    type: 'audio',
    ...overrides,
  };
}

describe('createIdleJob', () => {
  it('creates a placeholder queued job carrying the draft mode and quality', () => {
    /** 빈 화면 임시 job. */
    const job = createIdleJob({
      mode: 'video',
      quality: '720',
      sourceUrl: '',
    });

    expect(job).toMatchObject({
      displayStatus: 'queued',
      jobId: '',
      progress: 0,
      quality: '720',
      status: 'queued',
      type: 'video',
    });
  });
});

describe('createStatusTitle', () => {
  it.each([
    ['queued', '작업 대기 중입니다'],
    ['processing', '파일을 추출 중입니다'],
    ['completed', '파일이 준비되었습니다'],
    ['failed', '추출에 실패했습니다'],
    ['expired', '보관 기간이 지났습니다'],
  ] as const)('maps displayStatus %s to the expected title', (displayStatus, expected) => {
    expect(createStatusTitle(createJob({ displayStatus }))).toBe(expected);
  });
});

describe('getStatusIconName', () => {
  it.each([
    ['completed', 'completed'],
    ['failed', 'failed'],
    ['expired', 'expired'],
    ['processing', 'processing'],
    ['queued', 'queued'],
  ] as const)('maps status %s to icon %s', (status, expected) => {
    expect(getStatusIconName(status)).toBe(expected);
  });
});

describe('createProgressLabel', () => {
  it('shows a placeholder when progress is unknown', () => {
    expect(createProgressLabel(createJob({ progress: null }))).toBe('--');
  });

  it('shows a waiting label while queued even with a numeric progress', () => {
    expect(
      createProgressLabel(createJob({ displayStatus: 'queued', progress: 0 })),
    ).toBe('대기 중');
  });

  it('shows the percentage once processing', () => {
    expect(
      createProgressLabel(
        createJob({ displayStatus: 'processing', progress: 42 }),
      ),
    ).toBe('42%');
  });
});

describe('createWorkerHealthTitle', () => {
  it('prioritizes the unavailable message over a generic failure', () => {
    expect(
      createWorkerHealthTitle({ failed: true, unavailable: true }),
    ).toBe('추출 기능을 사용할 수 없습니다');
  });

  it('shows a generic failure title when the health check itself fails', () => {
    expect(
      createWorkerHealthTitle({ failed: true, unavailable: false }),
    ).toBe('서비스 상태를 확인할 수 없습니다');
  });

  it('returns an empty title when healthy', () => {
    expect(createWorkerHealthTitle({ failed: false, unavailable: false })).toBe(
      '',
    );
  });
});

describe('hasUserVisibleErrorDetail / createWorkerHealthErrorDetail', () => {
  it('returns undefined when there is no error', () => {
    expect(createWorkerHealthErrorDetail(null)).toBeUndefined();
  });

  it('passes through a detail already carried by the error', () => {
    /** 사용자 열람용 상세를 포함한 오류. */
    const error = Object.assign(new Error('boom'), {
      detail: {
        code: 'WORKER_UNAVAILABLE',
        guidance: '서버가 응답하지 않습니다.',
        location: '서비스 상태 확인',
        requestPath: '/health',
      },
    });

    expect(hasUserVisibleErrorDetail(error)).toBe(true);
    expect(createWorkerHealthErrorDetail(error)).toEqual(error.detail);
  });

  it('builds a fallback detail for a plain error without one', () => {
    /** 상세 정보가 없는 일반 오류. */
    const error = new Error('network down');

    expect(hasUserVisibleErrorDetail(error)).toBe(false);
    expect(createWorkerHealthErrorDetail(error)).toEqual({
      code: 'SERVICE_STATUS_CHECK_FAILED',
      guidance: '서비스 상태를 확인할 수 없습니다.',
      location: '서비스 상태 확인',
      requestPath: '/health',
      responseBody: 'network down',
    });
  });
});

describe('formatTime', () => {
  it('formats a valid ISO timestamp as a localized hour:minute string', () => {
    // ko-KR Intl.DateTimeFormat은 12시간제(오전/오후 hh:mm)로 표시한다.
    expect(formatTime('2026-08-19T05:32:00.000Z')).toMatch(
      /^(오전|오후) \d{2}:\d{2}$/,
    );
  });

  it('falls back to a placeholder for an unparsable value', () => {
    expect(formatTime('not-a-date')).toBe('--:--');
  });
});

describe('formatQuality', () => {
  it('formats audio quality in kbps', () => {
    expect(
      formatQuality(createJob({ quality: '192', type: 'audio' })),
    ).toBe('192 kbps');
  });

  it('formats video quality in p', () => {
    expect(formatQuality(createJob({ quality: '720', type: 'video' }))).toBe(
      '720p',
    );
  });
});
