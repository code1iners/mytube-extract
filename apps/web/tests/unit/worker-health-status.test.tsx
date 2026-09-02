import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WorkerHealthStatusNotice } from '../../src/app/components/worker-health-status';
import type { WorkerHealthStatus } from '../../src/app/utils/worker-health-notice.util';

describe('worker health status notice', () => {
  it('announces a ready status with the last check and retry action', () => {
    /** 화면에 표시할 준비 완료 health 상태. */
    const status: WorkerHealthStatus = {
      kind: 'ready',
      label: '준비됨',
      message: '서버 연결됨 · worker가 작업을 받을 준비가 되었습니다.',
      role: 'status',
    };

    /** 준비 완료 health 안내 마크업. */
    const markup = renderToStaticMarkup(
      <WorkerHealthStatusNotice
        id="video-worker-health"
        isFetching={false}
        lastCheckedAt={Date.parse('2026-08-19T05:32:14.000Z')}
        status={status}
        onRetry={() => undefined}
      />,
    );

    expect(markup).toContain('data-health-status="ready"');
    expect(markup).toContain('data-health-presentation="compact"');
    expect(markup).toContain('준비됨');
    expect(markup).toContain('서버 연결됨 · worker가 작업을 받을 준비가 되었습니다.');
    expect(markup).toContain('id="video-worker-health-message"');
    expect(markup).toContain('마지막 확인');
    expect(markup).toContain('다시 확인');
    expect(markup).toContain('role="status"');
  });

  it('keeps the retry control disabled while health is being checked', () => {
    /** 화면에 표시할 health 확인 중 상태. */
    const status: WorkerHealthStatus = {
      kind: 'checking',
      label: '확인 중',
      message: '서버 연결과 worker 준비 상태를 확인하고 있습니다.',
      role: 'status',
    };

    /** health 확인 중 안내 마크업. */
    const markup = renderToStaticMarkup(
      <WorkerHealthStatusNotice
        id="subtitle-worker-health"
        isFetching
        lastCheckedAt={0}
        status={status}
        onRetry={() => undefined}
      />,
    );

    expect(markup).toContain('data-health-presentation="compact"');
    expect(markup).toContain('확인 중');
    expect(markup).toContain('class="visually-hidden"');
    expect(markup).not.toContain('마지막 확인');
    expect(markup).not.toContain('확인 전');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('aria-busy="true"');
  });

  it.each([
    {
      kind: 'failed',
      label: '확인 실패',
      message: 'API 상태를 확인하지 못했습니다. 다시 확인해 주세요.',
    },
    {
      kind: 'unavailable',
      label: 'worker 중단',
      message:
        'API는 응답했지만 worker가 작업을 받을 수 없습니다. 현재 추출 서버가 준비되지 않았습니다.',
    },
  ])('expands the $kind status guidance with a retry action', ({ kind, label, message }) => {
    /** 장애 상태 health 안내. */
    const status: WorkerHealthStatus = {
      kind: kind as WorkerHealthStatus['kind'],
      label,
      message,
      role: 'alert',
    };

    /** 장애 상태 health 안내 마크업. */
    const markup = renderToStaticMarkup(
      <WorkerHealthStatusNotice
        id={`${kind}-worker-health`}
        isFetching={false}
        lastCheckedAt={Date.parse('2026-08-19T05:32:14.000Z')}
        status={status}
        onRetry={() => undefined}
      />,
    );

    expect(markup).toContain('data-health-presentation="expanded"');
    expect(markup).toContain(label);
    expect(markup).toContain(message);
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('aria-live="assertive"');
    expect(markup).toContain('다시 확인');
    expect(markup).not.toContain('마지막 확인');
  });
});
