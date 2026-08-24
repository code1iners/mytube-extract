import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { YoutubeDlExecute } from './youtube-dl-runner';
import { runYoutubeClientPolicy } from './youtube-client-policy';

/** fake runner test에서 호출되지 않아야 하는 process starter. */
const unusedExecute = (() => {
  throw new Error('fake runner must not execute yt-dlp');
}) as unknown as YoutubeDlExecute;

test('uses the default client once when the first attempt succeeds', async () => {
  /** 정책이 만든 client별 option 호출 순서. */
  const optionClients: string[] = [];
  /** 정책이 실행한 yt-dlp client 순서. */
  const runClients: string[] = [];
  /** 테스트용 작업 디렉터리. */
  const workDir = await mkdtemp(join(tmpdir(), 'youtube-client-policy-'));
  /** 최종 artifact 경로. */
  const outputPath = join(workDir, 'output.mp4');

  try {
    await runYoutubeClientPolicy({
      createYoutubeOptions: (client) => {
        optionClients.push(client);

        return { output: outputPath };
      },
      execute: unusedExecute,
      outputPath,
      run: async (input) => {
        runClients.push(
          String(input.youtubeOptions.extractorArgs ?? 'default'),
        );
        await writeFile(input.outputPath, 'video');
      },
      sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
    });

    assert.deepEqual(optionClients, ['default']);
    assert.deepEqual(runClients, ['default']);
  } finally {
    await rm(workDir, { force: true, recursive: true });
  }
});

test('switches to web_embedded once for a client-switch failure', async () => {
  /** 정책이 실행한 yt-dlp client 순서. */
  const runClients: string[] = [];
  /** 테스트용 작업 디렉터리. */
  const workDir = await mkdtemp(join(tmpdir(), 'youtube-client-policy-'));
  /** 최종 artifact 경로. */
  const outputPath = join(workDir, 'output.mp4');

  try {
    await runYoutubeClientPolicy({
      createYoutubeOptions: (client) =>
        client === 'web_embedded'
          ? { extractorArgs: 'youtube:player_client=web_embedded' }
          : {},
      execute: unusedExecute,
      outputPath,
      run: async (input) => {
        /** 실행된 yt-dlp client. */
        const client = String(input.youtubeOptions.extractorArgs ?? 'default');
        runClients.push(client);

        if (client === 'default') {
          throw Object.assign(new Error('client switch required'), {
            diagnostic: {
              reason: 'client-switch-required',
              stderrTail: 'Requested format is not available',
              tool: 'yt-dlp',
            },
          });
        }

        await writeFile(input.outputPath, 'video');
      },
      sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
    });

    assert.deepEqual(runClients, [
      'default',
      'youtube:player_client=web_embedded',
    ]);
  } finally {
    await rm(workDir, { force: true, recursive: true });
  }
});

test('retries one transient failure with the same default client', async () => {
  /** 정책이 실행한 yt-dlp client 순서. */
  const runClients: string[] = [];
  /** retry 대기 호출 횟수. */
  let waitCalls = 0;
  /** 테스트용 작업 디렉터리. */
  const workDir = await mkdtemp(join(tmpdir(), 'youtube-client-policy-'));
  /** 최종 artifact 경로. */
  const outputPath = join(workDir, 'output.mp4');

  try {
    await runYoutubeClientPolicy({
      createYoutubeOptions: () => ({}),
      execute: unusedExecute,
      outputPath,
      run: async (input) => {
        runClients.push(
          String(input.youtubeOptions.extractorArgs ?? 'default'),
        );

        if (runClients.length === 1) {
          throw Object.assign(new Error('temporary network failure'), {
            diagnostic: {
              reason: 'network-unreachable',
              tool: 'yt-dlp',
            },
          });
        }

        await writeFile(input.outputPath, 'video');
      },
      sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
      wait: async () => {
        waitCalls += 1;
      },
    });

    assert.deepEqual(runClients, ['default', 'default']);
    assert.equal(waitCalls, 1);
  } finally {
    await rm(workDir, { force: true, recursive: true });
  }
});

test('does not fallback or retry an embed-disabled failure', async () => {
  /** 정책이 실행한 yt-dlp client 순서. */
  const runClients: string[] = [];
  /** 테스트용 작업 디렉터리. */
  const workDir = await mkdtemp(join(tmpdir(), 'youtube-client-policy-'));
  /** 최종 artifact 경로. */
  const outputPath = join(workDir, 'output.mp4');

  try {
    await assert.rejects(
      runYoutubeClientPolicy({
        createYoutubeOptions: () => ({}),
        execute: unusedExecute,
        outputPath,
        run: async (input) => {
          runClients.push(
            String(input.youtubeOptions.extractorArgs ?? 'default'),
          );
          throw Object.assign(new Error('embedding disabled'), {
            diagnostic: {
              reason: 'embed-disabled',
              tool: 'yt-dlp',
            },
          });
        },
        sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
      }),
      (error: unknown) => {
        assert.equal(
          (error as { diagnostic?: { reason?: string } }).diagnostic?.reason,
          'embed-disabled',
        );
        return true;
      },
    );

    assert.deepEqual(runClients, ['default']);
  } finally {
    await rm(workDir, { force: true, recursive: true });
  }
});

test('stops after one fallback attempt and keeps both diagnostics', async () => {
  /** 정책이 실행한 yt-dlp client 순서. */
  const runClients: string[] = [];
  /** 테스트용 작업 디렉터리. */
  const workDir = await mkdtemp(join(tmpdir(), 'youtube-client-policy-'));
  /** 최종 artifact 경로. */
  const outputPath = join(workDir, 'output.mp4');

  try {
    await assert.rejects(
      runYoutubeClientPolicy({
        createYoutubeOptions: (client) =>
          client === 'web_embedded'
            ? { extractorArgs: 'youtube:player_client=web_embedded' }
            : {},
        execute: unusedExecute,
        outputPath,
        run: async (input) => {
          /** 실행된 yt-dlp client. */
          const client = String(
            input.youtubeOptions.extractorArgs ?? 'default',
          );
          runClients.push(client);

          throw Object.assign(new Error(`${client} failed`), {
            diagnostic: {
              reason:
                client === 'default'
                  ? 'client-switch-required'
                  : 'network-unreachable',
              stderrTail: `${client} stderr`,
              tool: 'yt-dlp',
            },
          });
        },
        sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
      }),
      (error: unknown) => {
        /** 최종 정책 진단. */
        const diagnostic = (
          error as {
            diagnostic?: {
              attempts?: Array<{ client: string; reason?: string }>;
            };
          }
        ).diagnostic;

        assert.deepEqual(
          diagnostic?.attempts?.map(({ client, reason }) => ({
            client,
            reason,
          })),
          [
            { client: 'default', reason: 'client-switch-required' },
            { client: 'web_embedded', reason: 'network-unreachable' },
          ],
        );
        return true;
      },
    );

    assert.deepEqual(runClients, [
      'default',
      'youtube:player_client=web_embedded',
    ]);
  } finally {
    await rm(workDir, { force: true, recursive: true });
  }
});

test('does not fallback for an unclassified 403 failure', async () => {
  /** 정책이 실행한 yt-dlp client 순서. */
  const runClients: string[] = [];
  /** 테스트용 작업 디렉터리. */
  const workDir = await mkdtemp(join(tmpdir(), 'youtube-client-policy-'));
  /** 최종 artifact 경로. */
  const outputPath = join(workDir, 'output.mp4');

  try {
    await assert.rejects(
      runYoutubeClientPolicy({
        createYoutubeOptions: () => ({}),
        execute: unusedExecute,
        outputPath,
        run: async (input) => {
          runClients.push(
            String(input.youtubeOptions.extractorArgs ?? 'default'),
          );
          throw Object.assign(new Error('403 failure'), {
            diagnostic: {
              stderrTail: 'HTTP Error 403: Forbidden',
              tool: 'yt-dlp',
            },
          });
        },
        sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
        wait: async () => undefined,
      }),
    );

    assert.deepEqual(runClients, ['default', 'default']);
  } finally {
    await rm(workDir, { force: true, recursive: true });
  }
});

test('does not fallback for auth, abort, spawn, or network failures', async () => {
  /** 정책별로 확인할 non-client failure reason과 기대 시도 횟수. */
  const cases = [
    { attempts: 1, reason: 'youtube-auth-required' },
    { attempts: 1, reason: 'aborted' },
    { attempts: 1, reason: 'spawn-failed' },
    { attempts: 2, reason: 'network-unreachable' },
  ] as const;

  for (const failureCase of cases) {
    /** 정책이 실행한 yt-dlp client 순서. */
    const runClients: string[] = [];
    /** 테스트용 작업 디렉터리. */
    const workDir = await mkdtemp(join(tmpdir(), 'youtube-client-policy-'));
    /** 최종 artifact 경로. */
    const outputPath = join(workDir, 'output.mp4');

    try {
      await assert.rejects(
        runYoutubeClientPolicy({
          createYoutubeOptions: () => ({}),
          execute: unusedExecute,
          outputPath,
          run: async (input) => {
            runClients.push(
              String(input.youtubeOptions.extractorArgs ?? 'default'),
            );
            throw Object.assign(new Error(failureCase.reason), {
              diagnostic: {
                reason: failureCase.reason,
                tool: 'yt-dlp',
              },
            });
          },
          sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
          wait: async () => undefined,
        }),
      );

      assert.equal(runClients.length, failureCase.attempts);
      assert.ok(runClients.every((client) => client === 'default'));
    } finally {
      await rm(workDir, { force: true, recursive: true });
    }
  }
});
