import { describe, expect, it } from 'vitest';
import {
  classifySubtitleVideoMimeType,
  isSubtitleTerminalStatus,
  type SubtitleJobResponse,
  validateSubtitleFile,
} from '../../src/domain/subtitle-request/subtitle-request';
import {
  createSubtitleStepKey,
  getSubtitleDragFeedback,
} from '../../src/app/pages/subtitles-extract/_hooks/use-subtitles-extract-logic';

describe('subtitle request', () => {
  it('requires a local video file', () => {
    /** 검증 결과. */
    const validation = validateSubtitleFile(null);

    expect(validation.kind).toBe('empty');
  });

  it('accepts supported local video files', () => {
    /** 검증 결과. */
    const validation = validateSubtitleFile(
      new File(['video'], 'sample-video.mp4', { type: 'video/mp4' }),
    );

    expect(validation.kind).toBe('ready');
  });

  it.each([
    ['mp4', 'video/mp4'],
    ['mov', 'video/quicktime'],
    ['webm', 'video/webm'],
  ])('accepts the supported %s extension and MIME type pair', (extension, type) => {
    /** 지원 형식에 맞는 파일. */
    const file = new File(['video'], `sample-video.${extension}`, { type });

    expect(validateSubtitleFile(file).kind).toBe('ready');
  });

  it('rejects unsupported files', () => {
    /** 검증 결과. */
    const validation = validateSubtitleFile(
      new File(['text'], 'sample.txt', { type: 'text/plain' }),
    );

    expect(validation.kind).toBe('invalid');
  });

  it.each([
    ['video/mp4', 'supported'],
    ['video/quicktime', 'supported'],
    ['video/webm', 'supported'],
    ['', 'unknown'],
    ['application/octet-stream', 'unknown'],
    ['image/png', 'unsupported'],
    ['text/plain', 'unsupported'],
  ] as const)('classifies the %s MIME type as %s before drop', (mimeType, expected) => {
    expect(classifySubtitleVideoMimeType(mimeType)).toBe(expected);
  });

  it('uses the first file drag item and does not reject uncertain or non-file data', () => {
    /** 지원 형식 뒤의 비지원 형식을 포함한 복수 파일 drag item. */
    const supportedFirstItems = [
      { kind: 'file', type: 'video/mp4' },
      { kind: 'file', type: 'image/png' },
    ] as const;
    /** 정보가 불명확한 첫 파일 drag item. */
    const uncertainItems = [
      { kind: 'file', type: 'application/octet-stream' },
    ] as const;
    /** 파일이 아닌 링크 drag item. */
    const linkItems = [{ kind: 'string', type: 'text/uri-list' }] as const;

    expect(getSubtitleDragFeedback(supportedFirstItems)).toBe('location');
    expect(getSubtitleDragFeedback(uncertainItems)).toBe('location');
    expect(getSubtitleDragFeedback(linkItems)).toBe('none');
  });

  it.each(['image/png', 'text/plain'])(
    'marks a clear unsupported %s file drag as unsupported',
    (mimeType) => {
      /** 명확히 지원하지 않는 첫 파일 drag item. */
      const items = [{ kind: 'file', type: mimeType }] as const;

      expect(getSubtitleDragFeedback(items)).toBe('unsupported');
    },
  );

  it.each([
    ['video/mp4', 'sample-video.txt'],
    ['', 'sample-video.mp4'],
  ])('rejects a file when its extension or MIME type is unsupported', (type, name) => {
    /** 지원 목록에서 벗어난 파일. */
    const file = new File(['video'], name, { type });

    expect(validateSubtitleFile(file).kind).toBe('invalid');
  });

  it('keeps terminal status logic in the domain layer', () => {
    expect(isSubtitleTerminalStatus('queued')).toBe(false);
    expect(isSubtitleTerminalStatus('completed')).toBe(true);
    expect(isSubtitleTerminalStatus('failed')).toBe(true);
    expect(isSubtitleTerminalStatus('expired')).toBe(true);
  });

  it('keeps file selection as a UI-only subtitle step before queueing', () => {
    /** 선택 전 표시용 job. */
    const idleJob = createSubtitleJobSnapshot({
      jobId: '',
      stage: 'queued',
    });
    /** 선택된 영상 파일. */
    const selectedFile = new File(['video'], 'sample-video.mp4', {
      type: 'video/mp4',
    });

    expect(
      createSubtitleStepKey({
        selectedFile: null,
        statusJob: idleJob,
        validationKind: 'empty',
      }),
    ).toBe('file_select');
    expect(
      createSubtitleStepKey({
        selectedFile,
        statusJob: idleJob,
        validationKind: 'ready',
      }),
    ).toBe('queued');
  });
});

/** 테스트용 자막 job snapshot을 만든다. */
function createSubtitleJobSnapshot(
  input: Pick<SubtitleJobResponse, 'jobId' | 'stage'>,
): SubtitleJobResponse {
  return {
    createdAt: '2026-07-06T00:00:00.000Z',
    displayStatus: input.stage,
    downloadUrl: null,
    errorCode: null,
    fileName: 'sample-video.mp4',
    jobId: input.jobId,
    message: '',
    progress: 0,
    retentionDays: 7,
    stage: input.stage,
    status: input.stage,
    whisperModel: 'base_en',
  };
}
