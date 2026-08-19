import { ConfigService } from '@nestjs/config';
import { MediaDownloadPolicy } from './media-download-policy';

describe('MediaDownloadPolicy', () => {
  /** 환경 변수 stub. */
  const env: Record<string, string | undefined> = {};
  /** config service mock. */
  const configServiceMock = {
    get: jest.fn((key: string): string | number | undefined => env[key]),
  };
  /** 테스트 대상 policy. */
  let policy: MediaDownloadPolicy;

  beforeEach(() => {
    for (const key of Object.keys(env)) {
      delete env[key];
    }

    configServiceMock.get.mockImplementation((key: string) => env[key]);
    policy = new MediaDownloadPolicy(
      configServiceMock as unknown as ConfigService,
    );
  });

  it('returns all-undefined limits when no env vars are set (기존 무제한 동작 유지)', () => {
    expect(policy.getConfig()).toEqual({
      concurrencyLimit: undefined,
      queueLimit: undefined,
      timeoutMs: undefined,
    });
  });

  it('parses valid positive integer env vars', () => {
    env.MEDIA_DOWNLOAD_CONCURRENCY = '4';
    env.MEDIA_DOWNLOAD_QUEUE_LIMIT = '100';
    env.MEDIA_DOWNLOAD_TIMEOUT_MS = '30000';

    expect(policy.getConfig()).toEqual({
      concurrencyLimit: 4,
      queueLimit: 100,
      timeoutMs: 30000,
    });
  });

  it.each(['0', '-1', '1.5', 'not-a-number', ''])(
    'ignores an invalid value (%s) and leaves the limit unset',
    (invalidValue) => {
      env.MEDIA_DOWNLOAD_CONCURRENCY = invalidValue;

      expect(policy.getConfig().concurrencyLimit).toBeUndefined();
    },
  );

  it('accepts a numeric (non-string) env value', () => {
    env.MEDIA_DOWNLOAD_CONCURRENCY = undefined;
    configServiceMock.get.mockImplementation((key: string) =>
      key === 'MEDIA_DOWNLOAD_CONCURRENCY' ? 8 : env[key],
    );

    expect(policy.getConfig().concurrencyLimit).toBe(8);
  });
});
