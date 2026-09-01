import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

/** 영상 추출 hook을 대체할 테스트용 spy. */
const videoExtractLogic = vi.hoisted(() => vi.fn());

vi.mock('../../src/app/pages/video-extract/_hooks/use-video-extract-logic', () => ({
  useVideoExtractLogic: videoExtractLogic,
}));

import { VideoExtractPage } from '../../src/app/pages/video-extract/page';

describe('video extract page', () => {
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

  it.each(['failed', 'expired'])(
    'renders a retry path for a %s terminal job',
    (displayStatus) => {
      videoExtractLogic.mockReturnValue({
        returnToRequest: () => undefined,
        statusErrorDetail: undefined,
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
    },
  );
});
