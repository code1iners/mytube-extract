import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RequestFlow } from '../../src/app/components/request-flow';
import { getRequestFlowStage } from '../../src/app/utils/request-flow.util';

describe('request flow', () => {
  it('keeps active work in the extraction stage until the API reports completion', () => {
    expect(getRequestFlowStage('queued')).toBe('extract');
    expect(getRequestFlowStage('processing')).toBe('extract');
    expect(getRequestFlowStage('failed')).toBe('extract');
    expect(getRequestFlowStage('completed')).toBe('receipt');
  });

  it('marks one product step as current without inventing progress', () => {
    const markup = renderToStaticMarkup(<RequestFlow current="receipt" />);

    expect(markup).toContain('data-flow-stage="receipt"');
    expect(markup).toContain('aria-current="step"');
    expect(markup).toContain('원본');
    expect(markup).toContain('추출');
    expect(markup).toContain('파일 수령');
  });
});
