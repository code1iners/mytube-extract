import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runVideoPreflight } from './video-preflight';

test('does not fallback from the default client during video metadata preflight', async () => {
  /** metadata 요청에 사용한 YouTube client 순서. */
  const clients: string[] = [];

  await assert.rejects(
    runVideoPreflight({
      format: 'bestvideo[height<=720]+bestaudio/best[height<=720]',
      run: async (_sourceUrl, options) => {
        /** 현재 metadata 요청의 player client. */
        const client = String(options.extractorArgs ?? 'default');
        clients.push(client);

        throw Object.assign(new Error('metadata request failed'), {
          stderr: 'ERROR: Requested format is not available',
        });
      },
      sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
    }),
    (error: unknown) => {
      /** preflight가 남긴 구조화 실패 진단. */
      const diagnostic = (error as { diagnostic?: { reason?: string } })
        .diagnostic;

      assert.equal(diagnostic?.reason, 'client-switch-required');
      return true;
    },
  );

  assert.deepEqual(clients, ['default']);
});

test('accepts the reported 1080p video within the 1.5 GiB limit', async () => {
  await runVideoPreflight({
    sourceUrl: 'https://www.youtube.com/watch?v=nGKd4yTP3M8',
    format: 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
    run: async () => ({
      requested_formats: [
        { format_id: '399', filesize: 895_583_878 },
        { format_id: '251', filesize: 290_705_273 },
      ],
    }),
  });
});

test('accepts exactly 1.5 GiB and rejects one byte above the limit', async () => {
  /** 제한 경계를 실제 preflight 진입점으로 검증한다. */
  const input = {
    sourceUrl: 'https://www.youtube.com/watch?v=nGKd4yTP3M8',
    format: 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
  };

  await runVideoPreflight({
    ...input,
    run: async () => ({ filesize: 1_610_612_736, format_id: 'boundary' }),
  });
  await assert.rejects(
    runVideoPreflight({
      ...input,
      run: async () => ({ filesize: 1_610_612_737, format_id: 'boundary' }),
    }),
    { errorCode: 'VIDEO_TOO_LARGE' },
  );
});
