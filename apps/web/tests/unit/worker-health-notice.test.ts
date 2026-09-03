import { describe, expect, it } from 'vitest';
import {
  formatWorkerHealthCheckedAt,
  getWorkerHealthNotice,
  getWorkerHealthStatus,
  getWorkerHealthSubmitReason,
} from '../../src/app/utils/worker-health-notice.util';

describe('worker health notice', () => {
  it('shows a quiet status while the first health check is pending', () => {
    expect(
      getWorkerHealthNotice({
        failed: false,
        pending: true,
        unavailable: false,
        unavailableMessage: '현재 추출 서버가 준비되지 않았습니다.',
      }),
    ).toEqual({
      message: '서비스 상태를 확인 중입니다.',
      role: 'status',
      showRetry: false,
    });
  });

  it('shows retryable alerts for unavailable and failed workers', () => {
    expect(
      getWorkerHealthNotice({
        failed: false,
        pending: false,
        unavailable: true,
        unavailableMessage: '현재 추출 서버가 준비되지 않았습니다.',
      }),
    ).toMatchObject({ role: 'alert', showRetry: true });
    expect(
      getWorkerHealthNotice({
        failed: true,
        pending: false,
        unavailable: false,
        unavailableMessage: '현재 추출 서버가 준비되지 않았습니다.',
      }),
    ).toMatchObject({ role: 'alert', showRetry: true });
  });

  it('hides the notice after a successful health check', () => {
    expect(
      getWorkerHealthNotice({
        failed: false,
        pending: false,
        unavailable: false,
        unavailableMessage: '현재 추출 서버가 준비되지 않았습니다.',
      }),
    ).toBeNull();
  });
});

describe('worker health status', () => {
  it.each([
    {
      expected: {
        kind: 'checking',
        label: '확인 중',
        message: '서비스 상태를 확인하고 있습니다.',
        role: 'status',
      },
      input: {
        apiReady: undefined,
        hasError: false,
        isInitialChecking: true,
        unavailableMessage: '현재 추출 서버가 준비되지 않았습니다.',
        workerAvailable: undefined,
      },
      name: 'checking',
    },
    {
      expected: {
        kind: 'ready',
        label: '준비됨',
        message: '요청을 시작할 수 있습니다.',
        role: 'status',
      },
      input: {
        apiReady: true,
        hasError: false,
        isInitialChecking: false,
        unavailableMessage: '현재 추출 서버가 준비되지 않았습니다.',
        workerAvailable: true,
      },
      name: 'ready',
    },
    {
      expected: {
        kind: 'unavailable',
        label: '작업 준비 안 됨',
        message:
          '서비스가 응답했지만 지금은 요청을 시작할 수 없습니다. 다시 확인해 주세요.',
        role: 'alert',
      },
      input: {
        apiReady: true,
        hasError: false,
        isInitialChecking: false,
        unavailableMessage: '현재 추출 서버가 준비되지 않았습니다.',
        workerAvailable: false,
      },
      name: 'worker unavailable',
    },
    {
      expected: {
        kind: 'failed',
        label: '확인 실패',
        message: 'API 상태를 확인하지 못했습니다. 다시 확인해 주세요.',
        role: 'alert',
      },
      input: {
        apiReady: undefined,
        hasError: true,
        isInitialChecking: false,
        unavailableMessage: '현재 추출 서버가 준비되지 않았습니다.',
        workerAvailable: undefined,
      },
      name: 'check failed',
    },
  ])('exposes the $name state with text and an assistive role', ({ expected, input }) => {
    expect(getWorkerHealthStatus(input)).toEqual(expected);
  });

  it('keeps ready while a background refresh is fetching', () => {
    expect(
      getWorkerHealthStatus({
        apiReady: true,
        hasError: false,
        isInitialChecking: false,
        unavailableMessage: '현재 추출 서버가 준비되지 않았습니다.',
        workerAvailable: true,
      }).kind,
    ).toBe('ready');
  });

  it('treats an unhealthy API response as a failed status', () => {
    expect(
      getWorkerHealthStatus({
        apiReady: false,
        hasError: false,
        isInitialChecking: false,
        unavailableMessage: '현재 추출 서버가 준비되지 않았습니다.',
        workerAvailable: true,
      }).kind,
    ).toBe('failed');
  });
});

describe('worker health submit reason', () => {
  it.each([
    ['checking', '서비스 상태를 확인하는 동안 요청할 수 없습니다.'],
    ['unavailable', '지금은 요청을 시작할 수 없습니다.'],
    ['failed', '서비스 상태를 확인하지 못해 요청할 수 없습니다.'],
  ] as const)('explains why the %s state blocks submit', (kind, expected) => {
    expect(
      getWorkerHealthSubmitReason({
        healthStatus: kind,
        isSubmitting: false,
      }),
    ).toBe(expected);
  });

  it('does not duplicate field guidance when the service is ready', () => {
    expect(
      getWorkerHealthSubmitReason({
        healthStatus: 'ready',
        isSubmitting: false,
      }),
    ).toBe('');
  });
});

describe('formatWorkerHealthCheckedAt', () => {
  it('formats a health response timestamp for the last-check label', () => {
    expect(formatWorkerHealthCheckedAt(Date.parse('2026-08-19T05:32:14.000Z'))).toMatch(
      /^(오전|오후) \d{2}:\d{2}:\d{2}$/,
    );
  });

  it('uses a pre-check label before the first response', () => {
    expect(formatWorkerHealthCheckedAt(0)).toBe('확인 전');
  });
});
