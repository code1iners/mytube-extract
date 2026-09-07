import { Fragment } from 'react';
import { type RequestFlowStage } from '../utils/request-flow.util';

/** 요청 흐름 trail 속성. */
type RequestFlowProps = {
  /** 현재 API·화면 상태에 대응하는 흐름 단계. */
  current: RequestFlowStage;
};

/** 요청 흐름 trail의 Tailwind layout className. */
const REQUEST_FLOW_CLASS_NAME =
  'request-flow grid min-w-0 items-center gap-mytube-8 grid-cols-[minmax(0,1fr)_16px_minmax(0,1fr)_16px_minmax(0,1fr)] m-0 p-0 list-none max-[561px]:grid-cols-[auto_minmax(16px,1fr)_auto_minmax(16px,1fr)_auto]';

/** 요청 흐름 한 단계의 표시 상태. */
type RequestFlowStepState = 'current' | 'complete' | 'upcoming';

/** 요청 흐름 단계의 공통 Tailwind className. */
const REQUEST_FLOW_STEP_BASE_CLASS_NAME =
  'inline-flex min-w-0 items-center justify-center gap-mytube-8 text-[14px] font-semibold leading-[1.4] text-center whitespace-nowrap';

/** 요청 흐름 단계 상태별 Tailwind className. */
const REQUEST_FLOW_STEP_CLASS_NAMES: Record<
  RequestFlowStepState,
  string
> = {
  current: `request-flow__step is-current ${REQUEST_FLOW_STEP_BASE_CLASS_NAME} text-mytube-text-primary`,
  complete: `request-flow__step is-complete ${REQUEST_FLOW_STEP_BASE_CLASS_NAME} text-mytube-text-primary`,
  upcoming: `request-flow__step is-upcoming ${REQUEST_FLOW_STEP_BASE_CLASS_NAME} text-mytube-text-secondary`,
};

/** 요청 흐름 번호 marker의 공통 Tailwind className. */
const REQUEST_FLOW_MARKER_BASE_CLASS_NAME =
  'inline-grid size-6 shrink-0 place-items-center border rounded-mytube-full text-[14px] font-semibold';

/** 요청 흐름 번호 marker 상태별 Tailwind className. */
const REQUEST_FLOW_MARKER_CLASS_NAMES: Record<
  RequestFlowStepState,
  string
> = {
  current: `request-flow__marker is-current ${REQUEST_FLOW_MARKER_BASE_CLASS_NAME} border-mytube-action-primary bg-mytube-action-primary text-mytube-on-primary`,
  complete: `request-flow__marker is-complete ${REQUEST_FLOW_MARKER_BASE_CLASS_NAME} border-mytube-status-completed bg-mytube-surface-alt text-mytube-status-completed`,
  upcoming: `request-flow__marker is-upcoming ${REQUEST_FLOW_MARKER_BASE_CLASS_NAME} border-mytube-border bg-mytube-surface-alt text-mytube-text-secondary`,
};

/** 요청 흐름 단계 사이 connector의 기본 Tailwind className. */
const REQUEST_FLOW_CONNECTOR_CLASS_NAME =
  'request-flow__connector h-px bg-mytube-border';

/** 완료된 요청 흐름 단계 connector의 Tailwind className. */
const REQUEST_FLOW_COMPLETE_CONNECTOR_CLASS_NAME =
  `${REQUEST_FLOW_CONNECTOR_CLASS_NAME} is-complete bg-mytube-status-completed`;

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
    <ol
      aria-label="요청 흐름"
      className={REQUEST_FLOW_CLASS_NAME}
      data-flow-stage={current}
    >
      {REQUEST_FLOW_STEPS.map((step, index) => {
        /** 현재 단계와 비교한 trail 위치. */
        const stepState: RequestFlowStepState =
          index === currentIndex
            ? 'current'
            : index < currentIndex
              ? 'complete'
              : 'upcoming';
        /** 현재 단계 상태에 맞춘 단계 className. */
        const stepClassName = REQUEST_FLOW_STEP_CLASS_NAMES[stepState];
        /** 현재 단계 상태에 맞춘 번호 marker className. */
        const markerClassName = REQUEST_FLOW_MARKER_CLASS_NAMES[stepState];

        return (
          <Fragment key={step.stage}>
            <li
              aria-current={step.stage === current ? 'step' : undefined}
              className={stepClassName}
            >
              <span aria-hidden="true" className={markerClassName}>
                {index + 1}
              </span>
              <span>{step.label}</span>
            </li>
            {index < REQUEST_FLOW_STEPS.length - 1 ? (
              <li
                aria-hidden="true"
                className={
                  index < currentIndex
                    ? REQUEST_FLOW_COMPLETE_CONNECTOR_CLASS_NAME
                    : REQUEST_FLOW_CONNECTOR_CLASS_NAME
                }
              />
            ) : null}
          </Fragment>
        );
      })}
    </ol>
  );
}
