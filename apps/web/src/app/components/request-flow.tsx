import { type RequestFlowStage } from '../utils/request-flow.util';

/** 요청 흐름 trail 속성. */
type RequestFlowProps = {
  /** 현재 API·화면 상태에 대응하는 흐름 단계. */
  current: RequestFlowStage;
};

/** 원본에서 추출을 거쳐 파일을 받는 제품 고유 흐름을 표시한다. */
export function RequestFlow({ current }: RequestFlowProps) {
  return (
    <ol aria-label="요청 흐름" className="request-flow" data-flow-stage={current}>
      <li
        aria-current={current === 'source' ? 'step' : undefined}
        className={current === 'source' ? 'request-flow__step is-current' : 'request-flow__step'}
      >
        원본
      </li>
      <li aria-hidden="true" className="request-flow__connector" />
      <li
        aria-current={current === 'extract' ? 'step' : undefined}
        className={current === 'extract' ? 'request-flow__step is-current' : 'request-flow__step'}
      >
        추출
      </li>
      <li aria-hidden="true" className="request-flow__connector" />
      <li
        aria-current={current === 'receipt' ? 'step' : undefined}
        className={current === 'receipt' ? 'request-flow__step is-current' : 'request-flow__step'}
      >
        파일 수령
      </li>
    </ol>
  );
}
