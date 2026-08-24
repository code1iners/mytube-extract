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
      const diagnostic = (
        error as { diagnostic?: { reason?: string } }
      ).diagnostic;

      assert.equal(diagnostic?.reason, 'client-switch-required');
      return true;
    },
  );

  assert.deepEqual(clients, ['default']);
});
