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
  it('keeps the subtitle task order and places readiness after the form', () => {
    subtitlesExtractLogic.mockReturnValue({
      canChangeWhisperModel: true,
      canSubmit: false,
      clearSelectedFile: () => undefined,
      fileInputRef: { current: null },
      fileFeedbackIsError: false,
      fileFeedbackMessage: '영상 파일을 선택해 주세요.',
      filePickerButtonRef: { current: null },
      handleDropzoneDragOver: () => undefined,
      handleDropzoneDrop: () => undefined,
      handleFileInputChange: () => undefined,
      handleFilePickerOpen: () => undefined,
      handleSubtitleSubmit: () => undefined,
      handleWhisperModelChange: () => undefined,
      retryWorkerHealth: () => undefined,
      selectedFile: null,
      selectedFileMeta: '',
      selectedWhisperModel: 'base_en',
      submitDisabledReason: 'worker가 준비되지 않아 요청할 수 없습니다.',
      validation: { kind: 'empty', message: '영상 파일을 선택해 주세요.' },
      viewPhase: 'request',
      workerHealthCheckedAt: Date.parse('2026-08-19T05:32:14.000Z'),
      workerHealthIsFetching: false,
      workerHealthStatus: {
        kind: 'unavailable',
        label: 'worker 중단',
        message:
          'API는 응답했지만 worker가 작업을 받을 수 없습니다. 현재 자막 추출 서버가 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.',
        role: 'alert',
      },
    });

    /** 요청 화면의 readiness 상태와 제출 안내 마크업. */
    const markup = renderToStaticMarkup(<SubtitlesExtractPage />);

    expect(markup).toContain('data-health-status="unavailable"');
    expect(markup).toContain('data-health-presentation="expanded"');
    expect(markup).toContain('class="phase-panel subtitle-request-panel"');
    expect(markup).toContain('class="subtitle-form"');
    expect(markup).toContain('type="submit"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('다시 확인');
    expect(markup).toContain(
      'aria-describedby="subtitle-worker-health-title-message"',
    );
    expect(markup).not.toContain('class="submit-disabled-reason"');
    expect(markup).toContain(
      'API는 응답했지만 worker가 작업을 받을 수 없습니다. 현재 자막 추출 서버가 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.',
    );
    expect(markup.indexOf('로컬 영상 파일')).toBeLessThan(
      markup.indexOf('<legend>처리 방식</legend>'),
    );
    expect(markup.indexOf('<legend>처리 방식</legend>')).toBeLessThan(
      markup.indexOf('영어 SRT 생성</button>'),
    );
    expect(markup).toMatch(
      /class="subtitle-form">[\s\S]*<\/form><section[^>]*class="worker-health-status/,
    );
  });

  it('uses the expanded API-failure guidance as the submit description', () => {
    subtitlesExtractLogic.mockReturnValue({
      canChangeWhisperModel: true,
      canSubmit: false,
      clearSelectedFile: () => undefined,
      fileInputRef: { current: null },
      fileFeedbackIsError: false,
      fileFeedbackMessage: '',
      filePickerButtonRef: { current: null },
      handleDropzoneDragOver: () => undefined,
      handleDropzoneDrop: () => undefined,
      handleFileInputChange: () => undefined,
      handleFilePickerOpen: () => undefined,
      handleSubtitleSubmit: () => undefined,
      handleWhisperModelChange: () => undefined,
      retryWorkerHealth: () => undefined,
      selectedFile: new File(['video'], 'sample-video.mp4', { type: 'video/mp4' }),
      selectedFileMeta: '5B',
      selectedWhisperModel: 'base_en',
      submitDisabledReason: '서버 상태를 확인하지 못해 요청할 수 없습니다.',
      validation: { kind: 'ready', message: '영어 SRT 생성을 시작할 수 있습니다.' },
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

    /** API 확인 실패 자막 요청 화면의 정적 HTML. */
    const markup = renderToStaticMarkup(<SubtitlesExtractPage />);

    expect(markup).toContain('data-health-presentation="expanded"');
    expect(markup).toContain(
      'aria-describedby="subtitle-worker-health-title-message"',
    );
    expect(markup).not.toContain('class="submit-disabled-reason"');
    expect(
      markup.match(/API 상태를 확인하지 못했습니다\. 다시 확인해 주세요\./g),
    ).toHaveLength(1);
  });

  it('exposes one named file picker and keeps file validation beside it', () => {
    subtitlesExtractLogic.mockReturnValue({
      canChangeWhisperModel: true,
      canSubmit: false,
      clearSelectedFile: () => undefined,
      fileInputRef: { current: null },
      fileFeedbackIsError: true,
      fileFeedbackMessage: 'mp4, mov, webm 영상 파일만 사용할 수 있습니다.',
      filePickerButtonRef: { current: null },
      handleDropzoneDragOver: () => undefined,
      handleDropzoneDrop: () => undefined,
      handleFileInputChange: () => undefined,
      handleFilePickerOpen: () => undefined,
      handleSubtitleSubmit: () => undefined,
      handleWhisperModelChange: () => undefined,
      retryWorkerHealth: () => undefined,
      selectedFile: new File(['video'], 'sample.txt', { type: 'text/plain' }),
      selectedFileMeta: '1KB',
      selectedWhisperModel: 'base_en',
      submitDisabledReason: '지원하지 않는 영상 형식입니다.',
      validation: {
        kind: 'invalid',
        message: 'mp4, mov, webm 영상 파일만 사용할 수 있습니다.',
      },
      viewPhase: 'request',
      workerHealthCheckedAt: 0,
      workerHealthIsFetching: false,
      workerHealthStatus: {
        kind: 'ready',
        label: '준비됨',
        message: '서버와 worker가 요청을 받을 준비가 되었습니다.',
        role: 'status',
      },
    });

    /** 파일 선택 오류 상태의 접근성 마크업. */
    const markup = renderToStaticMarkup(<SubtitlesExtractPage />);

    expect(markup).toContain(
      'aria-label="영상 선택 또는 드래그 (로컬 영상 파일)"',
    );
    expect(markup).toContain('aria-describedby="subtitle-file-feedback"');
    expect(markup).toContain('class="field has-error"');
    expect(markup).not.toContain('aria-invalid="true"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('hidden=""');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toContain('id="subtitle-file-feedback"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('mp4, mov, webm 영상 파일만 사용할 수 있습니다.');
    expect(markup).toContain('sample.txt');
    expect(markup).toContain('1KB');
    expect(markup).toContain('지우기');
    expect(markup.match(/class="subtitle-dropzone"/g)).toHaveLength(1);
  });

  it('explains subtitle processing choices without requiring Whisper knowledge', () => {
    subtitlesExtractLogic.mockReturnValue({
      canChangeWhisperModel: true,
      canSubmit: true,
      clearSelectedFile: () => undefined,
      fileInputRef: { current: null },
      fileFeedbackIsError: false,
      fileFeedbackMessage: '',
      filePickerButtonRef: { current: null },
      handleDropzoneDragOver: () => undefined,
      handleDropzoneDrop: () => undefined,
      handleFileInputChange: () => undefined,
      handleFilePickerOpen: () => undefined,
      handleSubtitleSubmit: () => undefined,
      handleWhisperModelChange: () => undefined,
      retryWorkerHealth: () => undefined,
      selectedFile: new File(['video'], 'sample-video.mp4', { type: 'video/mp4' }),
      selectedFileMeta: '5B',
      selectedWhisperModel: 'small_en',
      submitDisabledReason: '',
      validation: { kind: 'ready', message: '영어 SRT 생성을 시작할 수 있습니다.' },
      viewPhase: 'request',
      workerHealthCheckedAt: 0,
      workerHealthIsFetching: false,
      workerHealthStatus: {
        kind: 'ready',
        label: '준비됨',
        message: '서버와 worker가 요청을 받을 준비가 되었습니다.',
        role: 'status',
      },
    });

    /** 처리 방식 선택 화면의 정적 HTML. */
    const markup = renderToStaticMarkup(<SubtitlesExtractPage />);

    expect(markup).toContain('<legend>처리 방식</legend>');
    expect(markup).toContain('속도 우선');
    expect(markup).toContain('파일을 빠르게 영어 자막으로 만들고 싶을 때');
    expect(markup).toContain('base.en');
    expect(markup).toContain('정확도 우선');
    expect(markup).toContain('음성을 더 꼼꼼하게 영어 자막으로 옮기고 싶을 때');
    expect(markup).toContain('small.en');
    expect(markup).toContain('파일의 음성을 영어 SRT 자막으로 만들 처리 방향을 선택하세요.');
    expect(markup).toContain('영어 전용 자막은 로컬 Whisper로 처리합니다.');
    expect(markup).toContain('로컬 Whisper');
    expect(markup).toContain('value="small_en"');
    expect(markup).toContain('checked=""');
    expect(markup).not.toContain('Whisper 모델');
    expect(markup).not.toContain('예상 처리 시간');
    expect(markup.indexOf('파일을 빠르게 영어 자막으로 만들고 싶을 때')).toBeLessThan(
      markup.indexOf('base.en'),
    );
    expect(markup.indexOf('음성을 더 꼼꼼하게 영어 자막으로 옮기고 싶을 때')).toBeLessThan(
      markup.indexOf('small.en'),
    );
  });

  it('shows a lightweight acceptance status without processing stages or a progress meter', () => {
    subtitlesExtractLogic.mockReturnValue({
      statusIconName: 'processing',
      statusMessage: '자막 요청을 접수하고 있습니다.',
      statusTitle: '자막 요청을 접수하고 있습니다',
      statusTone: 'processing',
      viewPhase: 'accepting',
    });

    /** 접수 중 화면을 정적 HTML로 렌더링한 결과. */
    const markup = renderToStaticMarkup(<SubtitlesExtractPage />);

    expect(markup).toContain('요청 접수 중');
    expect(markup).toContain('자막 요청을 접수하고 있습니다');
    expect(markup).not.toContain('progress-meter');
    expect(markup).not.toContain('subtitle-step-tabs');
  });

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
    expect(markup).toContain('aria-valuetext="진행률 60%"');
    expect(markup).toContain('class="progress-label">진행률 60%');
    expect(markup).toContain('영어 SRT 생성');
    expect(markup.match(/class="step-tab/g)).toHaveLength(4);
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

    expect(markup).toContain('영어 SRT 준비 완료');
    expect(markup).toContain(
      'href="https://api.example.test/subtitles/job-1/file.srt"',
    );
    expect(markup).toContain('영어 SRT 다운로드');
  });

  it('shows a plain error summary before technical details are opened', () => {
    subtitlesExtractLogic.mockReturnValue({
      returnToRequest: () => undefined,
      statusErrorDetail: {
        code: 'SUBTITLE_REQUEST_FAILED',
        guidance: '영어 SRT 생성 요청을 다시 시도해 주세요.',
        location: '영어 SRT 생성 요청',
        responseBody: 'upstream failure',
        responseStatus: 502,
      },
      statusMessage: '영어 SRT 생성 요청을 다시 시도해 주세요.',
      statusTitle: '영어 SRT 생성에 실패했습니다',
      viewPhase: 'error',
      workerHealthFailed: false,
    });

    /** 오류 화면을 정적 HTML로 렌더링한 결과. */
    const markup = renderToStaticMarkup(<SubtitlesExtractPage />);

    expect(markup).toContain('class="error-details__summary"');
    expect(markup).toContain('영어 SRT 생성 요청이 정상적으로 처리되지 않았습니다.');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain('오류 코드: SUBTITLE_REQUEST_FAILED');
    expect(markup).not.toContain('응답 상태: 502');
    expect(markup).not.toContain('응답 내용: upstream failure');
  });

  it.each(['failed', 'expired'])(
    'renders a retry path for a %s terminal job',
    (displayStatus) => {
      subtitlesExtractLogic.mockReturnValue({
        returnToRequest: () => undefined,
        statusErrorDetail: {
          code:
            displayStatus === 'failed'
              ? 'TRANSCRIPTION_FAILED'
              : 'JOB_ASSET_EXPIRED',
          guidance: '다시 요청해 주세요.',
          location: '영어 SRT 생성 상태',
        },
        statusMessage: '다시 요청해 주세요.',
        statusTitle: '요청을 완료하지 못했습니다',
        viewPhase: 'error',
        workerHealthFailed: false,
      });

      /** terminal 오류 화면을 정적 HTML로 렌더링한 결과. */
      const markup = renderToStaticMarkup(<SubtitlesExtractPage />);

      expect(markup).toContain('요청 설정으로 돌아가기');
      expect(markup).toContain('영어 SRT 생성 요청이 정상적으로 처리되지 않았습니다.');
      expect(markup).toContain('aria-expanded="false"');
      expect(displayStatus).toMatch(/failed|expired/);
    },
  );
});
