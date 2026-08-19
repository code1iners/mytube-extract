import { SubtitleJobStatus } from '@mytube-extract/db';
import {
  createAttachmentDisposition,
  createExpiresAt,
  createSubtitleDownloadFileName,
  createSubtitleProgress,
  createSubtitleResultObjectKey,
  createSubtitleSourceObjectKey,
  createSubtitleStatusMessage,
  createSubtitleUploadSourceObjectKey,
  isSupportedSubtitleVideoFile,
  parsePositiveNumber,
  parseSubtitleWhisperModel,
} from './subtitles.util';

describe('createSubtitleProgress', () => {
  it.each([
    [SubtitleJobStatus.queued, 10],
    [SubtitleJobStatus.extracting_audio, 40],
    [SubtitleJobStatus.transcribing, 70],
    [SubtitleJobStatus.completed, 100],
    [SubtitleJobStatus.failed, null],
  ] as const)('maps %s to %s', (status, expected) => {
    expect(createSubtitleProgress(status)).toBe(expected);
  });
});

describe('createSubtitleStatusMessage', () => {
  it.each([
    [SubtitleJobStatus.queued, null, '요청이 접수되어 대기 중입니다.'],
    [
      SubtitleJobStatus.extracting_audio,
      null,
      '영상에서 음성을 추출하고 있습니다.',
    ],
    [SubtitleJobStatus.transcribing, null, '영어 자막을 생성하고 있습니다.'],
    [SubtitleJobStatus.completed, null, '영어 SRT가 준비되었습니다.'],
    ['expired', null, '보관 기간이 지났습니다. 다시 생성해 주세요.'],
  ] as const)('maps %s to the expected copy', (status, errorCode, expected) => {
    expect(createSubtitleStatusMessage(status, errorCode)).toBe(expected);
  });

  it.each([
    ['INVALID_FILE', '지원하는 영상 파일을 선택해 주세요.'],
    [
      'AUDIO_TOO_LARGE',
      '추출된 음성 파일이 커서 현재 설정으로 처리할 수 없습니다.',
    ],
    [
      'TRANSCRIPTION_FAILED',
      '영어 SRT 생성 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    ],
    ['SOURCE_DOWNLOAD_FAILED', '업로드한 영상을 읽는 중 문제가 발생했습니다.'],
    [
      'UPLOAD_FAILED',
      '파일 업로드 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    ],
    ['UNKNOWN', '자막 생성에 실패했습니다. 다시 시도해 주세요.'],
  ])('maps failed/%s to the expected copy', (errorCode, expected) => {
    expect(
      createSubtitleStatusMessage(SubtitleJobStatus.failed, errorCode),
    ).toBe(expected);
  });
});

describe('isSupportedSubtitleVideoFile', () => {
  it('accepts a supported extension and content type pair', () => {
    expect(
      isSupportedSubtitleVideoFile({
        contentType: 'video/mp4',
        fileName: 'clip.mp4',
      }),
    ).toBe(true);
  });

  it('rejects a supported extension with a mismatched content type', () => {
    expect(
      isSupportedSubtitleVideoFile({
        contentType: 'application/zip',
        fileName: 'clip.mp4',
      }),
    ).toBe(false);
  });

  it('rejects an unsupported extension', () => {
    expect(
      isSupportedSubtitleVideoFile({
        contentType: 'video/mp4',
        fileName: 'clip.avi',
      }),
    ).toBe(false);
  });
});

describe('parseSubtitleWhisperModel', () => {
  it('defaults to base_en when omitted', () => {
    expect(parseSubtitleWhisperModel(undefined)).toBe('base_en');
    expect(parseSubtitleWhisperModel(null)).toBe('base_en');
    expect(parseSubtitleWhisperModel('')).toBe('base_en');
  });

  it('passes through a supported model', () => {
    expect(parseSubtitleWhisperModel('small_en')).toBe('small_en');
  });

  it('rejects an unsupported model', () => {
    expect(parseSubtitleWhisperModel('large')).toBeNull();
  });
});

describe('object key builders', () => {
  it('creates a source object key with the upload extension', () => {
    expect(createSubtitleSourceObjectKey('job-1', 'clip.mov')).toBe(
      'subtitles/job-1/source.mov',
    );
  });

  it('falls back to mp4 when the source has an empty extension', () => {
    // 'clip.'처럼 마지막 세그먼트가 빈 문자열일 때만 fallback이 걸린다.
    expect(createSubtitleSourceObjectKey('job-1', 'clip.')).toBe(
      'subtitles/job-1/source.mp4',
    );
  });

  it('creates a direct-upload source object key', () => {
    expect(createSubtitleUploadSourceObjectKey('session-1', 'clip.webm')).toBe(
      'subtitles/uploads/session-1/source.webm',
    );
  });

  it('creates a result object key', () => {
    expect(createSubtitleResultObjectKey('job-1')).toBe(
      'subtitles/job-1/english.srt',
    );
  });
});

describe('createSubtitleDownloadFileName', () => {
  it('appends .en.srt to the original base name', () => {
    expect(createSubtitleDownloadFileName('my clip.mp4')).toBe(
      'my clip.en.srt',
    );
  });

  it('falls back to "subtitle" for an unusable original name', () => {
    expect(createSubtitleDownloadFileName('***.mp4')).toBe('subtitle.en.srt');
  });
});

describe('createAttachmentDisposition', () => {
  it('builds an ASCII fallback and RFC 5987 filename* pair', () => {
    expect(createAttachmentDisposition('clip.mp4')).toBe(
      'attachment; filename="clip.mp4"; filename*=UTF-8\'\'clip.mp4',
    );
  });

  it('percent-encodes non-ASCII filenames for filename* and sanitizes the ASCII fallback', () => {
    /** 자막 다운로드 disposition. */
    const disposition = createAttachmentDisposition('한글 clip.mp4');

    expect(disposition).toContain("filename*=UTF-8''%ED%95%9C%EA%B8%80");
    expect(disposition).toMatch(/filename="[\x20-\x7e]*"/);
  });
});

describe('parsePositiveNumber', () => {
  it('parses a valid positive value', () => {
    expect(parsePositiveNumber('30', 7)).toBe(30);
  });

  it('falls back when the value is missing, zero, negative, or non-numeric', () => {
    expect(parsePositiveNumber(undefined, 7)).toBe(7);
    expect(parsePositiveNumber('0', 7)).toBe(7);
    expect(parsePositiveNumber('-1', 7)).toBe(7);
    expect(parsePositiveNumber('not-a-number', 7)).toBe(7);
  });
});

describe('createExpiresAt', () => {
  it('adds the retention window in days to the given time', () => {
    /** 고정 기준 시각. */
    const now = new Date('2026-08-19T00:00:00.000Z');

    expect(createExpiresAt(7, now).toISOString()).toBe(
      '2026-08-26T00:00:00.000Z',
    );
  });
});
