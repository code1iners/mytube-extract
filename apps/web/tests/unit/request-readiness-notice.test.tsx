import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RequestReadinessNotice } from '../../src/app/components/request-readiness-notice';
import { RequestSubmitLabel } from '../../src/app/components/request-submit-label';
import type { WorkerHealthStatus } from '../../src/app/utils/worker-health-notice.util';

/** 최초 health 응답을 기다리는 상태. */
const CHECKING_STATUS: WorkerHealthStatus = {
  kind: 'checking',
  label: '확인 중',
  message: '서비스 상태를 확인하고 있습니다.',
  role: 'status',
};

/** health 요청이 실패한 상태. */
const FAILED_STATUS: WorkerHealthStatus = {
  kind: 'failed',
  label: '확인 실패',
  message: 'API 상태를 확인하지 못했습니다. 다시 확인해 주세요.',
  role: 'alert',
};

describe('request readiness notice', () => {
  it('announces checking without taking layout space', () => {
    /** 확인 중 안내 마크업. */
    const markup = renderToStaticMarkup(
      <RequestReadinessNotice
        id="readiness"
        isFetching
        status={CHECKING_STATUS}
        onRetry={() => undefined}
      />,
    );

    // 흐름 안에 남는 wrapper가 없어야 제출 버튼이 밀리지 않는다.
    expect(markup).not.toContain('request-readiness-notice');
    expect(markup).toMatch(/^<p aria-atomic="true" class="visually-hidden" id="readiness" role="status"/);
    expect(markup).toContain('서비스 상태를 확인하고 있습니다.');
    expect(markup).not.toContain('<button');
  });

  it('keeps the visible notice and retry for a failed check', () => {
    /** 확인 실패 안내 마크업. */
    const markup = renderToStaticMarkup(
      <RequestReadinessNotice
        id="readiness"
        isFetching={false}
        status={FAILED_STATUS}
        onRetry={() => undefined}
      />,
    );

    expect(markup).toContain('class="request-readiness-notice"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('aria-label="서비스 상태 다시 확인"');
  });

  it('keeps the failed notice in place while a recheck is running', () => {
    /** 실패 뒤 재확인 중 안내 마크업. */
    const markup = renderToStaticMarkup(
      <RequestReadinessNotice
        id="readiness"
        isFetching
        status={FAILED_STATUS}
        onRetry={() => undefined}
      />,
    );

    // 안내 문장은 그대로 남고 재확인 버튼만 진행 표시로 바뀐다.
    expect(markup).toContain('API 상태를 확인하지 못했습니다. 다시 확인해 주세요.');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('loading-spinner');
    expect(markup).toContain('확인 중</button>');
  });

  it('replaces the submit label with a decorative spinner only while checking', () => {
    /** 확인 중 요청 버튼 내용 마크업. */
    const checkingMarkup = renderToStaticMarkup(
      <RequestSubmitLabel status={CHECKING_STATUS}>추출 요청</RequestSubmitLabel>,
    );
    /** 확인 실패 요청 버튼 내용 마크업. */
    const failedMarkup = renderToStaticMarkup(
      <RequestSubmitLabel status={FAILED_STATUS}>추출 요청</RequestSubmitLabel>,
    );

    expect(checkingMarkup).toContain('aria-hidden="true"');
    expect(checkingMarkup).toContain('motion-reduce:animate-none');
    expect(checkingMarkup).toContain('서비스 확인 중');
    expect(checkingMarkup).not.toContain('추출 요청');
    expect(failedMarkup).toBe('추출 요청');
  });
});
