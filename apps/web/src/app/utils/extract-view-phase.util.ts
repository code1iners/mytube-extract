/** 추출 화면에서 한 번에 렌더링할 단일 단계. */
export type ExtractViewPhase =
  | 'request'
  | 'accepting'
  | 'processing'
  | 'result'
  | 'error';

/** API job 상태를 화면 단계로 바꾸는 입력값. */
type ExtractViewPhaseInput = {
  /** API job이 생성된 뒤 요청 오류가 있는지 여부. */
  hasRequestError?: boolean;
  /** 요청을 전송했지만 API job이 아직 생성되지 않았는지 여부. */
  isSubmitting?: boolean;
  /** worker health 확인 오류 또는 미가용 여부. */
  hasWorkerHealthError?: boolean;
  /** 아직 처리되지 않은 API job 상태. */
  status: string | null;
};

/** API 상태를 요청·처리·결과·오류 단일 화면으로 정규화한다. */
export function getExtractViewPhase(
  input: ExtractViewPhaseInput,
): ExtractViewPhase {
  // 요청 오류와 terminal job 오류는 복구 동작을 먼저 보여 준다.
  if (
    input.hasRequestError ||
    input.status === 'failed' ||
    input.status === 'expired'
  ) {
    return 'error';
  }

  if (input.status === 'completed') {
    return 'result';
  }

  // API가 job을 생성하기 전에는 실제 처리 상태나 진행률을 표시하지 않는다.
  if (input.isSubmitting) {
    return 'accepting';
  }

  if (input.status) {
    return 'processing';
  }

  return 'request';
}
