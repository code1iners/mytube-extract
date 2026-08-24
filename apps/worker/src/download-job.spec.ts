import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { test } from 'node:test';
import { ExtractionType } from '@mytube-extract/db';
import type {
  YoutubeDlExecute,
  YoutubeDlRunInput,
} from '@mytube-extract/media-downloader';
import {
  createDownloadYoutubeOptions,
  createSafeWorkerErrorDetail,
  getWorkerFailureCode,
} from './worker.logic';
import { downloadExtractionJob } from './download-job';

/** yt-dlp 오류에 붙일 테스트용 diagnostic. */
function createFailure(reason?: string) {
  return Object.assign(new Error('yt-dlp failed'), {
    diagnostic: {
      ...(reason ? { reason } : {}),
      tool: 'yt-dlp',
    },
  });
}

/** fake runner test에서는 호출되지 않아야 하는 yt-dlp process starter. */
const unusedExecute = (() => {
  throw new Error('fake runner must not execute yt-dlp');
}) as unknown as YoutubeDlExecute;

/** worker queued job이 대표 검증에 사용하는 URL과 품질 조합. */
const REPRESENTATIVE_WORKER_JOBS = [
  {
    expectedExtension: 'mp3',
    format: 'bestaudio[abr<=320]/best',
    sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    type: ExtractionType.audio,
  },
  {
    expectedExtension: 'mp4',
    format: 'bestvideo[height<=1080]+bestaudio/best',
    sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    type: ExtractionType.video,
  },
  {
    expectedExtension: 'mp3',
    format: 'bestaudio[abr<=320]/best',
    sourceUrl: 'https://www.youtube.com/watch?v=a0iBRRoDnDw',
    type: ExtractionType.audio,
  },
  {
    expectedExtension: 'mp4',
    format: 'bestvideo[height<=1080]+bestaudio/best',
    sourceUrl: 'https://www.youtube.com/watch?v=a0iBRRoDnDw',
    type: ExtractionType.video,
  },
] as const;

test('uses the shared policy for representative queued audio and video jobs', async () => {
  for (const job of REPRESENTATIVE_WORKER_JOBS) {
    /** worker extraction runner 입력 기록. */
    const attempts: YoutubeDlRunInput[] = [];
    /** 성공한 worker artifact 경로. */
    let outputPath = '';

    try {
      outputPath = await downloadExtractionJob({
        createYoutubeOptions: (path) =>
          createDownloadYoutubeOptions({
            format: job.format,
            outputPath: path,
            type: job.type,
          }),
        execute: unusedExecute,
        run: async (input) => {
          attempts.push(input);
          await writeFile(input.outputPath, 'non-empty worker artifact');
        },
        sourceUrl: job.sourceUrl,
        type: job.type,
      });

      assert.equal(attempts.length, 1);
      assert.equal(attempts[0]?.sourceUrl, job.sourceUrl);
      assert.equal(attempts[0]?.youtubeOptions.extractorArgs, undefined);
      assert.equal(attempts[0]?.youtubeOptions.format, job.format);
      assert.equal(
        attempts[0]?.youtubeOptions.output,
        attempts[0]?.outputPath,
      );
      assert.equal(
        attempts[0]?.outputPath.endsWith(`.${job.expectedExtension}`),
        true,
      );
      /** 생성된 worker artifact의 실제 byte 크기. */
      const output = await stat(outputPath);

      assert.ok(output.size > 0);
    } finally {
      if (outputPath) {
        await rm(dirname(outputPath), { force: true, recursive: true });
      }
    }
  }
});

test('retries one transient failure with the same output path and preserves partial files', async () => {
  /** runner 입력 기록. */
  const attempts: YoutubeDlRunInput[] = [];
  /** retry 대기 호출 횟수. */
  let waitCalls = 0;

  /** 성공한 extraction artifact. */
  const outputPath = await downloadExtractionJob({
    createYoutubeOptions: (path) => ({ output: path }),
    execute: unusedExecute,
    run: async (input) => {
      attempts.push(input);

      if (attempts.length === 1) {
        await writeFile(input.outputPath, 'invalid final output');
        await writeFile(`${input.outputPath}.part`, 'partial bytes');
        throw createFailure();
      }

      assert.equal(existsSync(input.outputPath), false);
      assert.equal(existsSync(`${input.outputPath}.part`), true);
      await writeFile(input.outputPath, 'valid final output');
    },
    sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
    type: 'video',
    wait: async () => {
      waitCalls += 1;
    },
  });

  assert.equal(attempts.length, 2);
  assert.equal(waitCalls, 1);
  assert.equal(attempts[0]?.outputPath, attempts[1]?.outputPath);
  assert.equal(basename(outputPath), 'output.mp4');
  assert.equal(existsSync(outputPath), true);

  await rm(dirname(outputPath), { force: true, recursive: true });
});

test('switches the worker extraction to web_embedded without retrying the default client', async () => {
  /** runner 입력 기록. */
  const attempts: YoutubeDlRunInput[] = [];

  /** 성공한 extraction artifact. */
  const outputPath = await downloadExtractionJob({
    createYoutubeOptions: (path) => ({ output: path }),
    execute: unusedExecute,
    run: async (input) => {
      attempts.push(input);

      if (attempts.length === 1) {
        throw Object.assign(new Error('client switch required'), {
          diagnostic: {
            reason: 'client-switch-required',
            tool: 'yt-dlp',
          },
        });
      }

      await writeFile(input.outputPath, 'valid final output');
    },
    sourceUrl: 'https://www.youtube.com/watch?v=a0iBRRoDnDw',
    type: 'video',
    wait: async () => undefined,
  });

  assert.equal(attempts.length, 2);
  assert.equal(attempts[0]?.youtubeOptions.extractorArgs, undefined);
  assert.equal(
    attempts[1]?.youtubeOptions.extractorArgs,
    'youtube:player_client=web_embedded',
  );
  assert.equal(existsSync(outputPath), true);

  await rm(dirname(outputPath), { force: true, recursive: true });
});

test('stops after one worker fallback and keeps redacted failure mapping', async () => {
  /** worker extraction runner가 실행한 client 순서. */
  const clients: string[] = [];
  /** worker가 실패한 뒤 정리할 임시 디렉터리. */
  let workDir = '';

  await assert.rejects(
    downloadExtractionJob({
      createYoutubeOptions: (path) => ({ output: path }),
      execute: unusedExecute,
      run: async (input) => {
        /** 현재 실행된 player client. */
        const client = String(
          input.youtubeOptions.extractorArgs ?? 'default',
        );
        clients.push(client);
        workDir = dirname(input.outputPath);

        throw Object.assign(new Error(`${client} failed`), {
          diagnostic: {
            reason:
              client === 'default'
                ? 'client-switch-required'
                : 'network-unreachable',
            stderrTail:
              'token=secret-value at /tmp/private/output.mp4',
            tool: 'yt-dlp',
          },
        });
      },
      sourceUrl: 'https://www.youtube.com/watch?v=a0iBRRoDnDw',
      type: ExtractionType.audio,
    }),
    (error: unknown) => {
      assert.equal(getWorkerFailureCode(error), 'EXTRACTION_FAILED');

      /** DB에 저장할 server-safe worker 오류 상세. */
      const detail = createSafeWorkerErrorDetail(error);

      assert.match(detail, /client=default/);
      assert.match(detail, /client=web_embedded/);
      assert.doesNotMatch(detail, /secret-value|\/tmp\/private/);
      return true;
    },
  );

  assert.deepEqual(clients, ['default', 'youtube:player_client=web_embedded']);
  assert.equal(existsSync(workDir), false);
});

test('does not retry a YouTube auth failure and removes its work directory', async () => {
  /** runner invocation count. */
  let runCalls = 0;
  /** discovered work directory. */
  let workDir = '';

  await assert.rejects(
    downloadExtractionJob({
      createYoutubeOptions: (path) => ({ output: path }),
      execute: unusedExecute,
      run: async (input) => {
        runCalls += 1;
        workDir = dirname(input.outputPath);
        throw createFailure('youtube-auth-required');
      },
      sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
      type: 'audio',
    }),
  );

  assert.equal(runCalls, 1);
  assert.equal(existsSync(workDir), false);
});

test('removes the work directory after two retryable failures', async () => {
  /** runner invocation count. */
  let runCalls = 0;
  /** discovered work directory. */
  let workDir = '';

  await assert.rejects(
    downloadExtractionJob({
      createYoutubeOptions: (path) => ({ output: path }),
      execute: unusedExecute,
      run: async (input) => {
        runCalls += 1;
        workDir = dirname(input.outputPath);
        await writeFile(join(workDir, 'output.mp4.part'), 'partial bytes');
        throw createFailure();
      },
      sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
      type: 'video',
      wait: async () => undefined,
    }),
  );

  assert.equal(runCalls, 2);
  assert.equal(existsSync(workDir), false);
});
