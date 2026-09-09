import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ExtractionType } from '@mytube-extract/db';
import {
  processDownloadJob,
  type ClaimedDownloadJob,
  type DownloadJobProcessorDependencies,
} from './download-job-processor';

/** 테스트가 사용하는 대표적인 queued 다운로드 job. */
const REPRESENTATIVE_JOB: ClaimedDownloadJob = {
  id: 'job-1',
  quality: '320',
  title: null,
  type: ExtractionType.audio,
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  videoId: 'dQw4w9WgXcQ',
};

/** 비디오 preflight 순서를 검증할 대표 job. */
const REPRESENTATIVE_VIDEO_JOB: ClaimedDownloadJob = {
  ...REPRESENTATIVE_JOB,
  id: 'video-job-1',
  quality: '720',
  type: ExtractionType.video,
};

/** 처리 경계에서 관찰할 저장·실행 이벤트. */
type ProcessorTestState = {
  /** 처리 순서 기록. */
  events: string[];
  /** 완료 전환 기록. */
  completed: Array<{ assetId: string; jobId: string }>;
  /** 요청 제목 조건부 저장 기록. */
  requestTitles: Array<{ jobId: string; title: string }>;
  /** 실패 전환 기록. */
  failed: Array<{ error: unknown; errorCode: string; jobId: string }>;
  /** asset upsert 입력 기록. */
  upserted: Array<{ objectKey: string; title: string | null }>;
};

/** 재사용 asset 대역이 반환할 수 있는 값. */
type ReusableAsset = Awaited<
  ReturnType<DownloadJobProcessorDependencies['assetStore']['findReusableAsset']>
>;

/** 실제 처리 경계를 제어하는 테스트 의존성을 만든다. */
function createDependencies(
  overrides: Partial<DownloadJobProcessorDependencies> = {},
) {
  /** 처리 순서를 검증하기 위한 상태. */
  const state: ProcessorTestState = {
    completed: [],
    events: [],
    failed: [],
    requestTitles: [],
    upserted: [],
  };
  /** 재사용 결과물 후보. */
  let reusableAsset: ReusableAsset = null;

  /** 기본 저장 대역. */
  const assetStore: DownloadJobProcessorDependencies['assetStore'] = {
    deleteAsset: async (assetId) => {
      state.events.push(`delete:${assetId}`);
    },
    findReusableAsset: async () => {
      state.events.push('find-reusable');
      return reusableAsset;
    },
    markCompleted: async (jobId, assetId) => {
      state.events.push('mark-completed');
      state.completed.push({ assetId, jobId });
    },
    markFailed: async (jobId, errorCode, error) => {
      state.events.push('mark-failed');
      state.failed.push({ error, errorCode, jobId });
    },
    setRequestTitleIfMissing: async (jobId, title) => {
      state.events.push('set-request-title');
      state.requestTitles.push({ jobId, title });
    },
    upsertAsset: async ({ objectKey, title }) => {
      state.events.push('upsert-asset');
      state.upserted.push({ objectKey, title });
      return { id: 'asset-created' };
    },
  };

  /** 다운로드가 반환할 임시 artifact 경로. */
  const dependencies: DownloadJobProcessorDependencies = {
    assetStore,
    cleanupOutputDirectory: async () => {
      state.events.push('cleanup-output');
    },
    download: async () => {
      state.events.push('download');
      return '/tmp/mytube-worker-output/output.mp3';
    },
    hasObject: async () => {
      state.events.push('has-object');
      return true;
    },
    readTitle: async () => {
      state.events.push('read-title');
      return 'A representative title';
    },
    retentionDays: 7,
    runVideoPreflight: async () => {
      state.events.push('preflight');
    },
    upload: async () => {
      state.events.push('upload');
    },
    ...overrides,
  };

  return {
    dependencies,
    setReusableAsset(asset: ReusableAsset) {
      reusableAsset = asset;
    },
    state,
  };
}

test('processes one request through the real boundary while download is paused', async () => {
  /** 다운로드 시작 시점을 기다릴 promise. */
  let resolveDownloadStarted!: () => void;
  /** 다운로드가 실제로 시작했음을 알리는 promise. */
  const downloadStarted = new Promise<void>((resolve) => {
    resolveDownloadStarted = resolve;
  });
  /** 일시 정지한 다운로드를 완료시키는 함수. */
  let resolveDownload!: () => void;
  /** 일시 정지한 다운로드를 해제하는 promise. */
  const downloadRelease = new Promise<void>((resolve) => {
    resolveDownload = resolve;
  });
  /** 실제 처리 진입점에 전달할 테스트 대역. */
  const { dependencies, state } = createDependencies({
    download: async () => {
      state.events.push('download:start');
      resolveDownloadStarted();
      await downloadRelease;
      state.events.push('download:done');
      return '/tmp/mytube-worker-output/output.mp3';
    },
  });

  /** 큐 반복과 무관하게 요청 한 건을 처리하는 promise. */
  const processing = processDownloadJob(REPRESENTATIVE_JOB, dependencies);

  await downloadStarted;
  assert.deepEqual(state.events, [
    'find-reusable',
    'read-title',
    'download:start',
  ]);
  assert.deepEqual(state.upserted, []);
  assert.deepEqual(state.completed, []);
  assert.deepEqual(state.failed, []);

  resolveDownload();
  await processing;

  assert.deepEqual(state.events, [
    'find-reusable',
    'read-title',
    'download:start',
    'download:done',
    'upload',
    'cleanup-output',
    'upsert-asset',
    'mark-completed',
  ]);
  assert.deepEqual(state.upserted, [
    {
      objectKey: 'extracts/dQw4w9WgXcQ/audio-320.mp3',
      title: 'A representative title',
    },
  ]);
  assert.deepEqual(state.completed, [
    { assetId: 'asset-created', jobId: 'job-1' },
  ]);
});

test('marks an extraction failure without uploading or creating an asset', async () => {
  /** 처리 경계에서 발생시킬 추출 오류. */
  const extractionError = new Error('controlled extraction failure');
  /** 추출 실패 경로에 사용할 테스트 의존성. */
  const { dependencies, state } = createDependencies({
    download: async () => {
      state.events.push('download');
      throw extractionError;
    },
  });

  await processDownloadJob(REPRESENTATIVE_JOB, dependencies);

  assert.deepEqual(state.events, [
    'find-reusable',
    'read-title',
    'download',
    'mark-failed',
  ]);
  assert.deepEqual(state.failed, [
    {
      error: extractionError,
      errorCode: 'EXTRACTION_FAILED',
      jobId: 'job-1',
    },
  ]);
  assert.deepEqual(state.upserted, []);
  assert.deepEqual(state.completed, []);
});

test('runs video preflight before title lookup and extraction', async () => {
  /** preflight에 전달된 검증 입력. */
  let preflightInput: { format: string; sourceUrl: string } | undefined;
  const { dependencies, state } = createDependencies({
    runVideoPreflight: async (input) => {
      state.events.push('preflight');
      preflightInput = input;
    },
  });

  await processDownloadJob(REPRESENTATIVE_VIDEO_JOB, dependencies);

  assert.deepEqual(state.events, [
    'find-reusable',
    'preflight',
    'read-title',
    'download',
    'upload',
    'cleanup-output',
    'upsert-asset',
    'mark-completed',
  ]);
  assert.deepEqual(preflightInput, {
    format: 'bestvideo[height<=720]+bestaudio/best[height<=720]',
    sourceUrl: REPRESENTATIVE_VIDEO_JOB.url,
  });
});

test('marks an upload failure after cleaning the downloaded artifact', async () => {
  /** 처리 경계에서 발생시킬 업로드 오류. */
  const uploadError = new Error('controlled upload failure');
  /** 업로드 실패 경로에 사용할 테스트 의존성. */
  const { dependencies, state } = createDependencies({
    upload: async () => {
      state.events.push('upload');
      throw uploadError;
    },
  });

  await processDownloadJob(REPRESENTATIVE_JOB, dependencies);

  assert.deepEqual(state.events, [
    'find-reusable',
    'read-title',
    'download',
    'upload',
    'mark-failed',
    'cleanup-output',
  ]);
  assert.deepEqual(state.failed, [
    {
      error: uploadError,
      errorCode: 'UPLOAD_FAILED',
      jobId: 'job-1',
    },
  ]);
  assert.deepEqual(state.upserted, []);
  assert.deepEqual(state.completed, []);
});

test('deletes a reusable row with a missing object before starting a fresh extraction', async () => {
  const { dependencies, setReusableAsset, state } = createDependencies({
    hasObject: async () => {
      state.events.push('has-object');
      return false;
    },
  });
  setReusableAsset({
    id: 'asset-missing-object',
    objectKey: 'extracts/dQw4w9WgXcQ/audio-320.mp3',
    title: null,
  });

  await processDownloadJob(REPRESENTATIVE_JOB, dependencies);

  assert.deepEqual(state.events, [
    'find-reusable',
    'has-object',
    'delete:asset-missing-object',
    'read-title',
    'download',
    'upload',
    'cleanup-output',
    'upsert-asset',
    'mark-completed',
  ]);
});

test('reuses an existing object without reading the title or starting extraction', async () => {
  const { dependencies, setReusableAsset, state } = createDependencies();
  setReusableAsset({
    id: 'asset-reused',
    objectKey: 'extracts/dQw4w9WgXcQ/audio-320.mp3',
    title: 'Reusable title',
  });

  await processDownloadJob(REPRESENTATIVE_JOB, dependencies);

  assert.deepEqual(state.events, [
    'find-reusable',
    'has-object',
    'set-request-title',
    'mark-completed',
  ]);
  assert.deepEqual(state.completed, [
    { assetId: 'asset-reused', jobId: 'job-1' },
  ]);
  assert.deepEqual(state.requestTitles, [
    { jobId: 'job-1', title: 'Reusable title' },
  ]);
  assert.deepEqual(state.failed, []);
  assert.deepEqual(state.upserted, []);
});

test('does not replace an existing request title when reusing a changed asset', async () => {
  /** 재사용 경로에 주입할 처리 의존성·상태. */
  const { dependencies, setReusableAsset, state } = createDependencies();
  /** 이미 보존된 요청 제목을 가진 job. */
  const titledJob: ClaimedDownloadJob = {
    ...REPRESENTATIVE_JOB,
    title: 'First request title',
  };
  /** 이후 변경된 결과물 제목을 가진 재사용 asset. */
  setReusableAsset({
    id: 'asset-reused',
    objectKey: 'extracts/dQw4w9WgXcQ/audio-320.mp3',
    title: 'Later asset title',
  });

  await processDownloadJob(titledJob, dependencies);

  assert.deepEqual(state.events, [
    'find-reusable',
    'has-object',
    'mark-completed',
  ]);
  assert.deepEqual(state.requestTitles, []);
});

test('fills a whitespace request title when reusing a titled asset', async () => {
  /** 공백만 있는 요청 제목을 가진 job. */
  const whitespaceJob: ClaimedDownloadJob = {
    ...REPRESENTATIVE_JOB,
    title: '   ',
  };
  /** 재사용 경로에 주입할 처리 의존성·상태. */
  const { dependencies, setReusableAsset, state } = createDependencies();
  setReusableAsset({
    id: 'asset-reused',
    objectKey: 'extracts/dQw4w9WgXcQ/audio-320.mp3',
    title: 'Reusable title',
  });

  await processDownloadJob(whitespaceJob, dependencies);

  assert.deepEqual(state.events, [
    'find-reusable',
    'has-object',
    'set-request-title',
    'mark-completed',
  ]);
  assert.deepEqual(state.requestTitles, [
    { jobId: 'job-1', title: 'Reusable title' },
  ]);
});
