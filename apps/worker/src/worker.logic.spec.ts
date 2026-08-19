import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ExtractionType, SubtitleJobStatus } from '@mytube-extract/db';
import {
  appendProcessOutputTail,
  createAssetObjectKey,
  createContentDisposition,
  createContentType,
  createDownloadYoutubeOptions,
  createExpiresAt,
  createSafeWorkerErrorDetail,
  createSubtitleContentType,
  createSubtitleMessage,
  createSubtitleProgress,
  createSubtitleResultObjectKey,
  createWhisperCliArgs,
  createWhisperModelEnvName,
  createWhisperSrtOutputPath,
  createVideoPreflightDecision,
  createWorkerHeartbeatUpsertArgs,
  createYtDlpFormat,
  DEFAULT_SUBTITLE_AUDIO_MAX_BYTES,
  detectMissingWhisperPaths,
  getSubtitleWorkerFailureCode,
  getWorkerFailureCode,
  isMissingObjectError,
  normalizeSubtitleWorkerFailureCode,
  normalizeWhisperSrt,
  normalizeExtractedAssetTitle,
  parseEnvNumber,
  readRequiredEnv,
  readWhisperFileEnv,
  selectNextQueuedWorkerJob,
  SubtitleWorkerJobFailure,
  WorkerJobFailure,
} from './worker.logic';

/** yt-dlp 오류에 붙일 테스트용 diagnostic. */
function createDownloaderFailure(reason?: string) {
  return Object.assign(new Error('yt-dlp failed'), {
    diagnostic: {
      ...(reason ? { reason } : {}),
      tool: 'yt-dlp',
    },
  });
}

assert.equal(
  createAssetObjectKey('dQw4w9WgXcQ', ExtractionType.audio, '192'),
  'extracts/dQw4w9WgXcQ/audio-192.mp3',
);
assert.equal(
  createAssetObjectKey('dQw4w9WgXcQ', ExtractionType.video, '720'),
  'extracts/dQw4w9WgXcQ/video-720.mp4',
);
assert.equal(
  createYtDlpFormat(ExtractionType.audio, '320'),
  'bestaudio[abr<=320]/best',
);
assert.equal(
  createYtDlpFormat(ExtractionType.video, '1080'),
  'bestvideo[height<=1080]+bestaudio/best',
);
assert.equal(
  createYtDlpFormat(ExtractionType.video, '720'),
  'bestvideo[height<=720]+bestaudio/best',
);
// android_vr 기본 client의 403 Forbidden 회귀를 막는 값이므로 명시적으로 고정한다.
assert.equal(
  createDownloadYoutubeOptions({
    format: 'bestaudio[abr<=320]/best',
    outputPath: '/tmp/output.mp3',
    type: ExtractionType.audio,
  }).extractorArgs,
  'youtube:player_client=web_embedded',
);
assert.deepEqual(
  createDownloadYoutubeOptions({
    ffmpegLocation: '/usr/bin/ffmpeg',
    format: 'bestaudio[abr<=320]/best',
    outputPath: '/tmp/output.mp3',
    type: ExtractionType.audio,
  }),
  {
    addMetadata: true,
    audioFormat: 'mp3',
    extractAudio: true,
    extractorArgs: 'youtube:player_client=web_embedded',
    ffmpegLocation: '/usr/bin/ffmpeg',
    format: 'bestaudio[abr<=320]/best',
    jsRuntimes: 'node',
    output: '/tmp/output.mp3',
  },
);
assert.deepEqual(
  createDownloadYoutubeOptions({
    format: 'bestvideo[height<=1080]+bestaudio/best',
    outputPath: '/tmp/output.mp4',
    type: ExtractionType.video,
  }),
  {
    addMetadata: true,
    extractorArgs: 'youtube:player_client=web_embedded',
    format: 'bestvideo[height<=1080]+bestaudio/best',
    jsRuntimes: 'node',
    mergeOutputFormat: 'mp4',
    output: '/tmp/output.mp4',
  },
);
assert.deepEqual(
  createVideoPreflightDecision(
    {
      requested_formats: [
        { filesize: 485_832_684, format_id: '399' },
        { filesize: 205_557_300, format_id: '251' },
      ],
    },
    1024 * 1024 * 1024,
  ),
  {
    estimatedBytes: 691_389_984,
    formatIds: ['399', '251'],
    ok: true,
  },
);
assert.deepEqual(
  createVideoPreflightDecision(
    {
      requested_formats: [
        { filesize: 2_201_425_722, format_id: '401' },
        { filesize: 205_557_300, format_id: '251' },
      ],
    },
    1024 * 1024 * 1024,
  ),
  {
    errorCode: 'VIDEO_TOO_LARGE',
    estimatedBytes: 2_406_983_022,
    formatIds: ['401', '251'],
    message: 'selected video is too large: 2406983022 bytes',
    ok: false,
  },
);
assert.deepEqual(createVideoPreflightDecision({}), {
  errorCode: 'YOUTUBE_FORMAT_UNAVAILABLE',
  estimatedBytes: null,
  formatIds: [],
  message: 'yt-dlp did not return selected video formats',
  ok: false,
});
assert.deepEqual(
  createVideoPreflightDecision(
    {
      requested_formats: [
        { filesize: 485_832_684, format_id: '399' },
        { format_id: '251' },
      ],
    },
    1024 * 1024 * 1024,
  ),
  {
    errorCode: 'YOUTUBE_FORMAT_UNAVAILABLE',
    estimatedBytes: null,
    formatIds: ['399', '251'],
    message: 'yt-dlp selected video formats without complete size metadata',
    ok: false,
  },
);
assert.equal(createContentType(ExtractionType.audio), 'audio/mpeg');
assert.equal(
  createContentDisposition('extracts/dQw4w9WgXcQ/audio-192.mp3'),
  'attachment; filename="audio-192.mp3"; filename*=UTF-8\'\'audio-192.mp3',
);
assert.equal(
  createSubtitleResultObjectKey('job-1'),
  'subtitles/job-1/english.srt',
);
assert.equal(
  createSubtitleContentType(),
  'application/x-subrip; charset=utf-8',
);
assert.equal(DEFAULT_SUBTITLE_AUDIO_MAX_BYTES, 536_870_912);
assert.equal(appendProcessOutputTail('abc', 'def', 10), 'abcdef');
assert.equal(appendProcessOutputTail('abc', 'def', 4), 'cdef');
assert.deepEqual(
  createWhisperCliArgs({
    audioPath: '/tmp/audio.wav',
    language: 'en',
    modelPath: '/models/ggml-medium.en.bin',
    outputBasePath: '/tmp/english',
    threads: 4,
  }),
  [
    '-m',
    '/models/ggml-medium.en.bin',
    '-f',
    '/tmp/audio.wav',
    '-l',
    'en',
    '-np',
    '-osrt',
    '-of',
    '/tmp/english',
    '-t',
    '4',
  ],
);
assert.deepEqual(
  createWhisperCliArgs({
    audioPath: '/tmp/audio.wav',
    language: 'en',
    modelPath: '/models/ggml-medium.en.bin',
    outputBasePath: '/tmp/english',
  }),
  [
    '-m',
    '/models/ggml-medium.en.bin',
    '-f',
    '/tmp/audio.wav',
    '-l',
    'en',
    '-np',
    '-osrt',
    '-of',
    '/tmp/english',
  ],
);
assert.equal(
  createWhisperModelEnvName('base_en'),
  'WHISPER_MODEL_BASE_EN_PATH',
);
assert.equal(
  createWhisperModelEnvName('small_en'),
  'WHISPER_MODEL_SMALL_EN_PATH',
);
assert.equal(createWhisperModelEnvName('large_en'), null);
assert.equal(createWhisperSrtOutputPath('/tmp/english'), '/tmp/english.srt');
assert.equal(
  normalizeWhisperSrt('  1\n00:00:00,000 --> 00:00:01,000\nHello\n\n'),
  '1\n00:00:00,000 --> 00:00:01,000\nHello\n',
);
assert.throws(() => normalizeWhisperSrt('   '), {
  message: 'whisper.cpp generated an empty SRT file',
});
assert.equal(
  normalizeSubtitleWorkerFailureCode('TRANSCRIPTION_FAILED'),
  'TRANSCRIPTION_FAILED',
);
assert.equal(
  normalizeSubtitleWorkerFailureCode('CLI_EXITED'),
  'TRANSCRIPTION_FAILED',
);
assert.equal(createSubtitleProgress(SubtitleJobStatus.queued), 10);
assert.equal(createSubtitleProgress(SubtitleJobStatus.extracting_audio), 40);
assert.equal(createSubtitleProgress(SubtitleJobStatus.transcribing), 70);
assert.equal(createSubtitleProgress(SubtitleJobStatus.completed), 100);
assert.equal(createSubtitleProgress(SubtitleJobStatus.failed), null);
assert.equal(
  createSubtitleMessage(SubtitleJobStatus.transcribing),
  '영어 자막을 생성하고 있습니다.',
);
assert.equal(
  createSubtitleMessage(SubtitleJobStatus.failed, 'AUDIO_TOO_LARGE'),
  '추출된 음성 파일이 커서 현재 설정으로 처리할 수 없습니다.',
);
assert.deepEqual(
  selectNextQueuedWorkerJob({
    downloadJob: {
      createdAt: new Date('2026-07-07T00:00:20.000Z'),
      id: 'download-1',
    },
    subtitleJob: {
      createdAt: new Date('2026-07-07T00:00:10.000Z'),
      id: 'subtitle-1',
    },
  }),
  {
    createdAt: new Date('2026-07-07T00:00:10.000Z'),
    id: 'subtitle-1',
    kind: 'subtitle',
  },
);
assert.deepEqual(
  selectNextQueuedWorkerJob({
    downloadJob: {
      createdAt: new Date('2026-07-07T00:00:10.000Z'),
      id: 'download-1',
    },
    subtitleJob: {
      createdAt: new Date('2026-07-07T00:00:20.000Z'),
      id: 'subtitle-1',
    },
  }),
  {
    createdAt: new Date('2026-07-07T00:00:10.000Z'),
    id: 'download-1',
    kind: 'download',
  },
);
assert.deepEqual(
  selectNextQueuedWorkerJob({
    downloadJob: {
      createdAt: new Date('2026-07-07T00:00:10.000Z'),
      id: 'download-1',
    },
    subtitleJob: {
      createdAt: new Date('2026-07-07T00:00:10.000Z'),
      id: 'subtitle-1',
    },
  }),
  {
    createdAt: new Date('2026-07-07T00:00:10.000Z'),
    id: 'download-1',
    kind: 'download',
  },
);
assert.deepEqual(
  selectNextQueuedWorkerJob({
    downloadJob: null,
    subtitleJob: {
      createdAt: new Date('2026-07-07T00:00:10.000Z'),
      id: 'subtitle-1',
    },
  }),
  {
    createdAt: new Date('2026-07-07T00:00:10.000Z'),
    id: 'subtitle-1',
    kind: 'subtitle',
  },
);
assert.deepEqual(
  selectNextQueuedWorkerJob({
    downloadJob: {
      createdAt: new Date('2026-07-07T00:00:10.000Z'),
      id: 'download-1',
    },
    subtitleJob: null,
  }),
  {
    createdAt: new Date('2026-07-07T00:00:10.000Z'),
    id: 'download-1',
    kind: 'download',
  },
);
assert.equal(parseEnvNumber('abc', 60_000), 60_000);
assert.equal(
  normalizeExtractedAssetTitle('  Never Gonna Give You Up  '),
  'Never Gonna Give You Up',
);
assert.equal(normalizeExtractedAssetTitle('   '), null);
assert.equal(
  createExpiresAt(7, new Date('2026-06-24T00:00:00.000Z')).toISOString(),
  '2026-07-01T00:00:00.000Z',
);
assert.deepEqual(
  createWorkerHeartbeatUpsertArgs(new Date('2026-06-25T00:00:00.000Z')),
  {
    create: {
      id: 'default',
      lastSeenAt: new Date('2026-06-25T00:00:00.000Z'),
    },
    update: {
      lastSeenAt: new Date('2026-06-25T00:00:00.000Z'),
    },
    where: {
      id: 'default',
    },
  },
);
assert.deepEqual(
  detectMissingWhisperPaths({
    cliExists: true,
    baseEnExists: true,
    smallEnExists: true,
  }),
  [],
);
assert.deepEqual(
  detectMissingWhisperPaths({
    cliExists: false,
    baseEnExists: true,
    smallEnExists: true,
  }),
  ['WHISPER_CLI_PATH'],
);
assert.deepEqual(
  detectMissingWhisperPaths({
    cliExists: true,
    baseEnExists: false,
    smallEnExists: true,
  }),
  ['WHISPER_MODEL_BASE_EN_PATH'],
);
assert.deepEqual(
  detectMissingWhisperPaths({
    cliExists: true,
    baseEnExists: true,
    smallEnExists: false,
  }),
  ['WHISPER_MODEL_SMALL_EN_PATH'],
);
assert.deepEqual(
  detectMissingWhisperPaths({
    cliExists: false,
    baseEnExists: false,
    smallEnExists: false,
  }),
  [
    'WHISPER_CLI_PATH',
    'WHISPER_MODEL_BASE_EN_PATH',
    'WHISPER_MODEL_SMALL_EN_PATH',
  ],
);

// getWorkerFailureCode: 과거 YouTube 인증 오류 오분류 회귀(856e929, 2e5c41d)를 막는 분기 고정.
assert.equal(
  getWorkerFailureCode(new WorkerJobFailure('VIDEO_TOO_LARGE', 'too big')),
  'VIDEO_TOO_LARGE',
);
assert.equal(
  getWorkerFailureCode(createDownloaderFailure('youtube-auth-required')),
  'YOUTUBE_AUTH_REQUIRED',
);
assert.equal(
  getWorkerFailureCode(new Error('Sign in to confirm you’re not a bot')),
  'YOUTUBE_AUTH_REQUIRED',
);
assert.equal(
  getWorkerFailureCode(new Error('LOGIN_REQUIRED')),
  'YOUTUBE_AUTH_REQUIRED',
);
assert.equal(
  getWorkerFailureCode(new Error('network timeout')),
  'EXTRACTION_FAILED',
);
assert.equal(getWorkerFailureCode('not an error'), 'EXTRACTION_FAILED');

// createSafeWorkerErrorDetail: 제어된 실패는 메시지 그대로, 그 외는 redaction된 로그.
assert.equal(
  createSafeWorkerErrorDetail(
    new WorkerJobFailure('EXTRACTION_FAILED', 'server-only detail'),
  ),
  'server-only detail',
);
assert.equal(
  createSafeWorkerErrorDetail(createDownloaderFailure('youtube-auth-required')),
  'tool=yt-dlp reason=youtube-auth-required',
);
assert.equal(createSafeWorkerErrorDetail(new Error('boom')), 'Error');

// getSubtitleWorkerFailureCode: 제어된 실패의 errorCode를 보존, 그 외는 기본값으로 정규화.
assert.equal(
  getSubtitleWorkerFailureCode(
    new SubtitleWorkerJobFailure('AUDIO_TOO_LARGE', 'audio too big'),
  ),
  'AUDIO_TOO_LARGE',
);
assert.equal(
  getSubtitleWorkerFailureCode(new Error('unexpected')),
  'TRANSCRIPTION_FAILED',
);

// isMissingObjectError: R2 S3 API의 404/NoSuchKey 응답 형태를 인식.
assert.equal(isMissingObjectError({ Code: 'NoSuchKey' }), true);
assert.equal(isMissingObjectError({ Code: 'NotFound' }), true);
assert.equal(
  isMissingObjectError({ $metadata: { httpStatusCode: 404 } }),
  true,
);
assert.equal(
  isMissingObjectError({ $metadata: { httpStatusCode: 500 } }),
  false,
);
assert.equal(isMissingObjectError(new Error('unrelated')), false);
assert.equal(isMissingObjectError(null), false);

// readRequiredEnv: 필수 환경 변수 누락 시 즉시 실패.
process.env.WORKER_LOGIC_SPEC_REQUIRED_ENV = 'value';
assert.equal(
  readRequiredEnv('WORKER_LOGIC_SPEC_REQUIRED_ENV'),
  'value',
);
delete process.env.WORKER_LOGIC_SPEC_REQUIRED_ENV;
assert.throws(
  () => readRequiredEnv('WORKER_LOGIC_SPEC_REQUIRED_ENV'),
  /WORKER_LOGIC_SPEC_REQUIRED_ENV is required/,
);

// readWhisperFileEnv: 자막 worker 기동 중 whisper 파일 경로 검증(부팅 실패로 이어지는 경로).
{
  /** 테스트용 임시 whisper 모델 디렉터리. */
  const tempDir = mkdtempSync(join(tmpdir(), 'worker-logic-spec-'));
  /** 존재하는 것으로 가정할 whisper 파일 경로. */
  const existingFilePath = join(tempDir, 'model.bin');

  writeFileSync(existingFilePath, 'stub');

  try {
    delete process.env.WORKER_LOGIC_SPEC_WHISPER_ENV;
    assert.throws(
      () => readWhisperFileEnv('WORKER_LOGIC_SPEC_WHISPER_ENV'),
      (error: unknown) =>
        error instanceof SubtitleWorkerJobFailure &&
        error.errorCode === 'TRANSCRIPTION_FAILED',
    );

    process.env.WORKER_LOGIC_SPEC_WHISPER_ENV = join(tempDir, 'missing.bin');
    assert.throws(
      () => readWhisperFileEnv('WORKER_LOGIC_SPEC_WHISPER_ENV'),
      (error: unknown) =>
        error instanceof SubtitleWorkerJobFailure &&
        error.errorCode === 'TRANSCRIPTION_FAILED',
    );

    process.env.WORKER_LOGIC_SPEC_WHISPER_ENV = existingFilePath;
    assert.equal(
      readWhisperFileEnv('WORKER_LOGIC_SPEC_WHISPER_ENV'),
      existingFilePath,
    );
  } finally {
    delete process.env.WORKER_LOGIC_SPEC_WHISPER_ENV;
    rmSync(tempDir, { force: true, recursive: true });
  }
}
