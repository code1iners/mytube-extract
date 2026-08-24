import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSafeDiagnosticLog } from './media-log-redaction';

test('safe diagnostics redact URLs, query credentials, and local paths', () => {
  /** raw process diagnostic candidate. */
  const error = Object.assign(new Error('raw failure'), {
    diagnostic: {
      stderrTail:
        'https://user:password@example.com/file?token=secret-value failed at /tmp/private/output.mp4',
      tool: 'yt-dlp',
    },
  });
  /** server-safe diagnostic string. */
  const log = createSafeDiagnosticLog(error);

  assert.match(log, /https:\/\/example\.com/);
  assert.doesNotMatch(log, /password|secret-value|\/tmp\/private/);
});

test('keeps client attempt diagnostics server-safe', () => {
  /** client별 시도 진단이 붙은 에러. */
  const error = Object.assign(new Error('fallback failed'), {
    diagnostic: {
      attempts: [
        {
          attempt: 1,
          client: 'default',
          reason: 'client-switch-required',
          stderrTail: 'token=secret-value at /tmp/private/default.mp4',
        },
        {
          attempt: 1,
          client: 'web_embedded',
          reason: 'network-unreachable',
          stderrTail: 'https://user:password@example.com/file',
        },
      ],
      tool: 'yt-dlp',
    },
  });
  /** server-safe diagnostic string. */
  const log = createSafeDiagnosticLog(error);

  assert.match(log, /client=default/);
  assert.match(log, /client=web_embedded/);
  assert.match(log, /client-switch-required/);
  assert.doesNotMatch(log, /secret-value|\/tmp\/private|password/);
});
