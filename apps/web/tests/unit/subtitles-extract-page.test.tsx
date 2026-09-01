import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

/** 자막 추출 hook을 대체할 테스트용 spy. */
const subtitlesExtractLogic = vi.hoisted(() => vi.fn());

vi.mock(
  '../../src/app/pages/subtitles-extract/_hooks/use-subtitles-extract-logic',
  () => ({
    useSubtitlesExtractLogic: subtitlesExtractLogic,
  }),
);

import { SubtitlesExtractPage } from '../../src/app/pages/subtitles-extract/page';

describe('subtitles extract page', () => {
  it('marks the selected processing step as the current step', () => {
    subtitlesExtractLogic.mockReturnValue({
      currentStepKey: 'transcribing',
      filledProgressCells: 6,
      statusIconName: 'processing',
      statusJob: { progress: 60 },
      statusMessage: '영어 SRT를 생성 중입니다.',
      statusTitle: '영어 SRT를 생성 중입니다',
      statusTone: 'processing',
      viewPhase: 'processing',
    });

    /** 처리 상태 화면을 정적 HTML로 렌더링한 결과. */
    const markup = renderToStaticMarkup(<SubtitlesExtractPage />);

    expect(markup).toContain('aria-current="step"');
    expect(markup).toContain('SRT 생성');
  });

  it('renders the completed job download URL in the in-place result panel', () => {
    subtitlesExtractLogic.mockReturnValue({
      downloadHref: 'https://api.example.test/subtitles/job-1/file.srt',
      statusMessage: '영어 SRT가 준비되었습니다.',
      statusTitle: '영어 SRT가 준비되었습니다',
      viewPhase: 'result',
    });

    /** 완료 결과 화면을 정적 HTML로 렌더링한 결과. */
    const markup = renderToStaticMarkup(<SubtitlesExtractPage />);

    expect(markup).toContain('SRT 준비 완료');
    expect(markup).toContain(
      'href="https://api.example.test/subtitles/job-1/file.srt"',
    );
    expect(markup).toContain('영어 SRT 다운로드');
  });

  it.each(['failed', 'expired'])(
    'renders a retry path for a %s terminal job',
    (displayStatus) => {
      subtitlesExtractLogic.mockReturnValue({
        returnToRequest: () => undefined,
        statusErrorDetail: undefined,
        statusMessage: '다시 요청해 주세요.',
        statusTitle: '요청을 완료하지 못했습니다',
        viewPhase: 'error',
        workerHealthFailed: false,
      });

      /** terminal 오류 화면을 정적 HTML로 렌더링한 결과. */
      const markup = renderToStaticMarkup(<SubtitlesExtractPage />);

      expect(markup).toContain('요청 설정으로 돌아가기');
      expect(displayStatus).toMatch(/failed|expired/);
    },
  );
});
