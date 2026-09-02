import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

/** 영상 추출 hook을 대체할 테스트용 spy. */
const videoExtractLogic = vi.hoisted(() => vi.fn());

vi.mock('../../src/app/pages/video-extract/_hooks/use-video-extract-logic', () => ({
  useVideoExtractLogic: videoExtractLogic,
}));

import { VideoExtractPage } from '../../src/app/pages/video-extract/page';

describe('video extract page', () => {
  it('keeps the request fields in task order and places readiness after the form', () => {
    videoExtractLogic.mockReturnValue({
      canSubmit: false,
      draft: { mode: 'audio', quality: '320', sourceUrl: '' },
      handleDownloadFormSubmit: () => undefined,
      handleModeChange: () => undefined,
      handleSourceUrlReset: () => undefined,
      qualityOptions: [],
      register: () => ({ onChange: () => undefined }),
      retryWorkerHealth: () => undefined,
      submitDisabledReason: 'YouTube URL을 입력해 주세요.',
      validation: { kind: 'empty', message: 'YouTube URL을 입력해 주세요.' },
      viewPhase: 'request',
      workerHealthCheckedAt: Date.parse('2026-08-19T05:32:14.000Z'),
      workerHealthIsFetching: false,
      workerHealthStatus: {
        kind: 'ready',
        label: '준비됨',
        message: '서버 연결됨 · worker가 작업을 받을 준비가 되었습니다.',
        role: 'status',
      },
    });

    /** 요청 화면의 readiness 상태와 제출 안내 마크업. */
    const markup = renderToStaticMarkup(<VideoExtractPage />);

    expect(markup).toContain('data-health-status="ready"');
    expect(markup).toContain('data-health-presentation="compact"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain('마지막 확인');
    expect(markup).toContain('다시 확인');
    expect(markup).toContain('aria-describedby="video-submit-disabled-reason"');
    expect(markup).toContain('YouTube URL을 입력해 주세요.');
    expect(markup.indexOf('YouTube URL')).toBeLessThan(
      markup.indexOf('<legend>추출 형식</legend>'),
    );
    expect(markup.indexOf('<legend>추출 형식</legend>')).toBeLessThan(
      markup.indexOf('<legend>품질</legend>'),
    );
    expect(markup.indexOf('<legend>품질</legend>')).toBeLessThan(
      markup.indexOf('추출 요청</button>'),
    );
    expect(markup.indexOf('</form>')).toBeLessThan(
      markup.indexOf('data-health-status="ready"'),
    );
    expect(markup).not.toContain('url-reset-button');
  });

  it('uses the expanded API-failure guidance as the submit description', () => {
    videoExtractLogic.mockReturnValue({
      canSubmit: false,
      draft: { mode: 'audio', quality: '320', sourceUrl: 'https://youtu.be/abc123_DEF0' },
      handleDownloadFormSubmit: () => undefined,
      handleModeChange: () => undefined,
      handleSourceUrlReset: () => undefined,
      qualityOptions: [],
      register: () => ({ onChange: () => undefined }),
      retryWorkerHealth: () => undefined,
      submitDisabledReason: '서버 상태를 확인하지 못해 요청할 수 없습니다.',
      validation: { kind: 'ready', message: '' },
      viewPhase: 'request',
      workerHealthCheckedAt: Date.parse('2026-08-19T05:32:14.000Z'),
      workerHealthIsFetching: false,
      workerHealthStatus: {
        kind: 'failed',
        label: '확인 실패',
        message: 'API 상태를 확인하지 못했습니다. 다시 확인해 주세요.',
        role: 'alert',
      },
    });

    /** API 확인 실패 요청 화면의 정적 HTML. */
    const markup = renderToStaticMarkup(<VideoExtractPage />);

    expect(markup).toContain('data-health-presentation="expanded"');
    expect(markup).toContain(
      'aria-describedby="video-worker-health-title-message"',
    );
    expect(markup).toContain('API 상태를 확인하지 못했습니다. 다시 확인해 주세요.');
    expect(markup).not.toContain('class="submit-disabled-reason"');
    expect(
      markup.match(/API 상태를 확인하지 못했습니다\. 다시 확인해 주세요\./g),
    ).toHaveLength(1);
  });

  it('shows the URL reset control only when a URL has been entered', () => {
    videoExtractLogic.mockReturnValue({
      canSubmit: false,
      draft: {
        mode: 'audio',
        quality: '320',
        sourceUrl: 'https://youtu.be/abc123_DEF0',
      },
      handleDownloadFormSubmit: () => undefined,
      handleModeChange: () => undefined,
      handleSourceUrlReset: () => undefined,
      qualityOptions: [],
      register: () => ({ onChange: () => undefined }),
      retryWorkerHealth: () => undefined,
      submitDisabledReason: '입력값을 확인해 주세요.',
      validation: { kind: 'ready', message: '' },
      viewPhase: 'request',
      workerHealthCheckedAt: 0,
      workerHealthIsFetching: false,
      workerHealthStatus: {
        kind: 'ready',
        label: '준비됨',
        message: '서버 연결됨 · worker가 작업을 받을 준비가 되었습니다.',
        role: 'status',
      },
    });

    /** URL이 입력된 요청 화면의 정적 HTML. */
    const markup = renderToStaticMarkup(<VideoExtractPage />);

    expect(markup).toContain('class="url-reset-button"');
  });

  it('shows a lightweight acceptance status without a progress meter', () => {
    videoExtractLogic.mockReturnValue({
      statusIconName: 'processing',
      statusMessage: '추출 요청을 접수하고 있습니다.',
      statusTitle: '요청을 접수하고 있습니다',
      statusTone: 'processing',
      viewPhase: 'accepting',
    });

    /** 접수 중 화면을 정적 HTML로 렌더링한 결과. */
    const markup = renderToStaticMarkup(<VideoExtractPage />);

    expect(markup).toContain('요청을 접수하고 있습니다');
    expect(markup).not.toContain('progress-meter');
    expect(markup).not.toContain('step-tabs');
  });

  it('marks the selected processing step as the current step', () => {
    videoExtractLogic.mockReturnValue({
      createdTime: '오전 10:00',
      draft: { mode: 'audio', quality: '320', sourceUrl: '' },
      filledProgressCells: 5,
      progressLabel: '50%',
      qualityOptions: [],
      statusIconName: 'processing',
      statusJob: {
        createdAt: '2026-09-01T01:00:00.000Z',
        displayStatus: 'processing',
        downloadUrl: null,
        errorCode: null,
        jobId: '4f8f82b3-cf37-4e31-9d56-d27eb526a922',
        message: '파일을 추출 중입니다.',
        progress: 50,
        quality: '320',
        retentionDays: 7,
        status: 'processing',
        type: 'audio',
      },
      statusMessage: '파일을 추출 중입니다.',
      statusQualityLabel: '320 kbps',
      statusTitle: '파일을 추출 중입니다',
      statusTone: 'processing',
      statusTypeLabel: '오디오',
      validation: { kind: 'ready', message: '' },
      viewPhase: 'processing',
    });

    /** 처리 상태 화면을 정적 HTML로 렌더링한 결과. */
    const markup = renderToStaticMarkup(<VideoExtractPage />);

    expect(markup).toContain('aria-current="step"');
    expect(markup).toContain('처리');
  });

  it('renders the completed job download URL in the in-place result panel', () => {
    videoExtractLogic.mockReturnValue({
      downloadHref: 'https://api.example.test/downloads/job-1/file',
      statusJob: {
        retentionDays: 7,
      },
      statusMessage: '파일이 준비되었습니다.',
      statusQualityLabel: '720p',
      statusTitle: '파일이 준비되었습니다',
      statusTypeLabel: '비디오',
      viewPhase: 'result',
    });

    /** 완료 결과 화면을 정적 HTML로 렌더링한 결과. */
    const markup = renderToStaticMarkup(<VideoExtractPage />);

    expect(markup).toContain('추출 완료');
    expect(markup).toContain(
      'href="https://api.example.test/downloads/job-1/file"',
    );
    expect(markup).toContain('다운로드');
  });

  it('shows a plain error summary before technical details are opened', () => {
    videoExtractLogic.mockReturnValue({
      returnToRequest: () => undefined,
      statusErrorDetail: {
        code: 'VIDEO_REQUEST_FAILED',
        guidance: '영상 추출 요청을 다시 시도해 주세요.',
        location: '영상 추출 요청',
        responseBody: 'upstream failure',
        responseStatus: 502,
      },
      statusMessage: '영상 추출 요청을 다시 시도해 주세요.',
      statusTitle: '추출에 실패했습니다',
      viewPhase: 'error',
      workerHealthFailed: false,
    });

    /** 오류 화면을 정적 HTML로 렌더링한 결과. */
    const markup = renderToStaticMarkup(<VideoExtractPage />);

    expect(markup).toContain('class="error-details__summary"');
    expect(markup).toContain('영상 추출 요청이 정상적으로 처리되지 않았습니다.');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain('오류 코드: VIDEO_REQUEST_FAILED');
    expect(markup).not.toContain('응답 상태: 502');
    expect(markup).not.toContain('응답 내용: upstream failure');
  });

  it.each(['failed', 'expired'])(
    'renders a retry path for a %s terminal job',
    (displayStatus) => {
      videoExtractLogic.mockReturnValue({
        returnToRequest: () => undefined,
        statusErrorDetail: {
          code:
            displayStatus === 'failed'
              ? 'EXTRACTION_FAILED'
              : 'JOB_ASSET_EXPIRED',
          guidance: '다시 요청해 주세요.',
          location: '영상 추출 상태',
        },
        statusIconName: displayStatus,
        statusMessage: '다시 요청해 주세요.',
        statusTitle: '요청을 완료하지 못했습니다',
        statusTone: displayStatus,
        viewPhase: 'error',
        workerHealthFailed: false,
      });

      /** terminal 오류 화면을 정적 HTML로 렌더링한 결과. */
      const markup = renderToStaticMarkup(<VideoExtractPage />);

      expect(markup).toContain('요청 설정으로 돌아가기');
      expect(markup).toContain('영상 추출 요청이 정상적으로 처리되지 않았습니다.');
      expect(markup).toContain('aria-expanded="false"');
    },
  );
});
