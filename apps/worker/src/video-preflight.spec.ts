import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { YoutubeClientFallbackEvent } from '@mytube-extract/media-downloader';
import { runVideoPreflight } from './video-preflight';

test('uses the shared client fallback for video metadata preflight', async () => {
  /** metadata 요청에 사용한 YouTube client 순서. */
  const clients: string[] = [];
  /** metadata preflight fallback 시작과 성공 이벤트. */
  const fallbackEvents: YoutubeClientFallbackEvent[] = [];

  await runVideoPreflight({
    format: 'bestvideo[height<=720]+bestaudio/best[height<=720]',
    onFallback: (event) => fallbackEvents.push(event),
    run: async (_sourceUrl, options) => {
      /** 현재 metadata 요청의 player client. */
      const client = String(options.extractorArgs ?? 'default');
      clients.push(client);

      if (client === 'default') {
        throw Object.assign(new Error('metadata request failed'), {
          stderr: 'ERROR: Requested format is not available',
        });
      }

      return {
        requested_formats: [
          { filesize: 485_832_684, format_id: '399' },
          { filesize: 205_557_300, format_id: '251' },
        ],
      };
    },
    sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
    wait: async () => undefined,
  });

  assert.deepEqual(clients, [
    'default',
    'youtube:player_client=web_embedded',
  ]);
  assert.deepEqual(
    fallbackEvents.map(({ attempt, fromClient, outcome, toClient }) => ({
      attempt,
      fromClient,
      outcome,
      toClient,
    })),
    [
      {
        attempt: 1,
        fromClient: 'default',
        outcome: 'started',
        toClient: 'web_embedded',
      },
      {
        attempt: 1,
        fromClient: 'default',
        outcome: 'succeeded',
        toClient: 'web_embedded',
      },
    ],
  );
});
