import { useQuery } from '@tanstack/react-query';
import type { JobReceipt, JobReceiptKind } from '../utils/job-receipt.util';
import { createJobStatusQueryOptions } from '../utils/job-status-polling.util';

/** 화면 안에서 추적할 수 있는 API job의 공통 식별 정보. */
type ActiveJob = {
  /** API가 발급한 job ID. */
  jobId: string;
  /** API가 기록한 job 생성 시각. */
  createdAt: string;
};

/** route별 active job 상태 query 입력. */
type ActiveJobStatusInput<TJob extends ActiveJob, TKind extends JobReceiptKind> = {
  /** 현재 화면에서 추적할 job. */
  activeJob: TJob | null;
  /** API base URL. */
  apiBaseUrl: string | undefined;
  /** 접수증 종류에 맞는 job 상태 조회 함수. */
  fetchStatus: (
    receipt: JobReceipt & { kind: TKind },
    signal: AbortSignal,
  ) => Promise<TJob>;
  /** 접수증에 기록할 job 종류. */
  kind: TKind;
};

/** 영상·자막 route가 공유하는 active job 접수증과 polling query를 만든다. */
export function useActiveJobStatus<
  TJob extends ActiveJob,
  TKind extends JobReceiptKind,
>(input: ActiveJobStatusInput<TJob, TKind>) {
  /** 현재 화면에서 조회할 job 접수증. */
  const activeJobReceipt = {
    jobId: input.activeJob?.jobId ?? '',
    kind: input.kind,
    acceptedAt: input.activeJob?.createdAt ?? '',
  } as JobReceipt & { kind: TKind };
  /** 현재 화면의 job 상태 query. */
  const activeJobQuery = useQuery({
    enabled: input.activeJob !== null,
    ...createJobStatusQueryOptions({
      receipt: activeJobReceipt,
      fetchStatus: (signal) => input.fetchStatus(activeJobReceipt, signal),
    }),
  });

  return { activeJobQuery, activeJobReceipt };
}
