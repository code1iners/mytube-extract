/** 원본·추출·파일 수령으로 이어지는 공통 요청 흐름 단계. */
export type RequestFlowStage = 'source' | 'extract' | 'receipt';

/** API 표시 상태를 공통 요청 흐름 단계로 바꾼다. */
export function getRequestFlowStage(status?: string): RequestFlowStage {
  return status === 'completed' ? 'receipt' : 'extract';
}
