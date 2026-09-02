import { describe, expect, it } from 'vitest';
import {
  isSubtitleTerminalStatus,
  type SubtitleJobResponse,
  validateSubtitleFile,
} from '../../src/domain/subtitle-request/subtitle-request';
import { createSubtitleStepKey } from '../../src/app/pages/subtitles-extract/_hooks/use-subtitles-extract-logic';

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

  it('rejects unsupported files', () => {
    /** 검증 결과. */
    const validation = validateSubtitleFile(
      new File(['text'], 'sample.txt', { type: 'text/plain' }),
    );

    expect(validation.kind).toBe('invalid');
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
