import { Fragment } from 'react';
import { type RequestFlowStage } from '../utils/request-flow.util';

/** 요청 흐름 trail 속성. */
type RequestFlowProps = {
  /** 현재 API·화면 상태에 대응하는 흐름 단계. */
  current: RequestFlowStage;
};

/** 요청 흐름에서 변하지 않는 제품 단계와 표시 순서. */
const REQUEST_FLOW_STEPS = [
  { label: '원본', stage: 'source' },
  { label: '추출', stage: 'extract' },
  { label: '파일 수령', stage: 'receipt' },
] as const satisfies ReadonlyArray<{
  /** 화면에 표시할 단계 이름. */
  label: string;
  /** 단계 상태 key. */
  stage: RequestFlowStage;
}>;

/** 원본에서 추출을 거쳐 파일을 받는 제품 고유 흐름을 표시한다. */
export function RequestFlow({ current }: RequestFlowProps) {
  /** 현재 단계 이전까지 완료로 표현할 위치. */
  const currentIndex = REQUEST_FLOW_STEPS.findIndex(
    (step) => step.stage === current,
  );

  return (
    <ol aria-label="요청 흐름" className="request-flow" data-flow-stage={current}>
      {REQUEST_FLOW_STEPS.map((step, index) => {
        /** 현재 단계와 비교한 trail 위치. */
        const stepClassName =
          index === currentIndex
            ? 'request-flow__step is-current'
            : index < currentIndex
              ? 'request-flow__step is-complete'
              : 'request-flow__step is-upcoming';

        return (
          <Fragment key={step.stage}>
            <li
              aria-current={step.stage === current ? 'step' : undefined}
              className={stepClassName}
            >
              <span aria-hidden="true" className="request-flow__marker">
                {index + 1}
              </span>
              <span>{step.label}</span>
            </li>
            {index < REQUEST_FLOW_STEPS.length - 1 ? (
              <li
                aria-hidden="true"
                className={
                  index < currentIndex
                    ? 'request-flow__connector is-complete'
                    : 'request-flow__connector'
                }
              />
            ) : null}
          </Fragment>
        );
      })}
    </ol>
  );
}
