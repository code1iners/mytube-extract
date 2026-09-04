import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  WorkerUnavailableError,
  assertWorkerAvailable,
  getJobStatusRetryDelay,
  isAbortError,
  shouldRetryJobStatus,
} from '../../api/mytube-extract.api';
import { getJobStatusRefetchInterval } from '../utils/job-status-polling.util';
import {
  acceptJobReceipt,
  type JobReceipt,
  type JobReceiptKind,
} from '../utils/job-receipt.util';
import {
  getWorkerHealthStatus,
  type WorkerHealthStatus,
} from '../utils/worker-health-notice.util';

/** lifecycle adapter가 제공해야 하는 최소 job 상태. */
export type RequestLifecycleJob = {
  /** API가 발급한 job ID. */
  jobId: string;
  /** API가 기록한 job 생성 시각. */
  createdAt: string;
  /** API가 제공하는 표시 상태. */
  displayStatus: string;
  /** API가 제공하는 사용자 안내 문구. */
  message: string;
  /** API가 제공하는 실패 코드. */
  errorCode?: string | null;
};

/** readiness adapter가 반환하는 최소 health 응답. */
export type RequestReadinessResponse = {
  /** API 프로세스 응답 가능 여부. */
  ok: boolean;
  /** worker 처리 가능 상태. */
  worker: {
    /** worker가 새 작업을 받을 수 있는지 여부. */
    available: boolean;
  };
};

/** 추출 요청 생명주기에서 화면에 노출하는 phase. */
export type RequestLifecyclePhase =
  | 'request'
  | 'accepting'
  | 'processing'
  | 'result'
  | 'error';

/** 오류가 발생한 lifecycle 위치. */
export type RequestLifecycleErrorSource =
  | 'readiness'
  | 'request'
  | 'status'
  | 'terminal';

/** lifecycle이 우선순위를 정한 사용자 오류 후보. */
export type RequestLifecycleError<TJob extends RequestLifecycleJob> = {
  /** 오류가 발생한 lifecycle 위치. */
  source: RequestLifecycleErrorSource;
  /** 원래 adapter 또는 상태 응답 오류. */
  cause: unknown;
  /** terminal 오류에서 사용할 현재 job. */
  job?: TJob;
  /** 일시적인 오류라 polling 재시도가 가능한지 여부. */
  retryable: boolean;
};

/** 영상·자막 adapter가 만족해야 하는 요청 lifecycle 내부 seam. */
export type RequestLifecycleAdapter<
  TRequest,
  TJob extends RequestLifecycleJob,
  TKind extends JobReceiptKind,
> = {
  /** adapter가 보존할 접수증 종류. */
  readonly kind: TKind;
  /** API와 worker readiness를 확인한다. */
  checkReadiness: (signal: AbortSignal) => Promise<RequestReadinessResponse>;
  /** 검증된 route 입력으로 서버 job 접수를 시작한다. */
  createRequest: (request: TRequest, signal: AbortSignal) => Promise<TJob>;
  /** 접수증에 해당하는 현재 job 상태를 조회한다. */
  getStatus: (
    receipt: JobReceipt & { kind: TKind },
    signal: AbortSignal,
  ) => Promise<TJob>;
};

/** 접수증 저장 뒤 lifecycle이 알아야 하는 결과. */
export type RequestReceiptStorageResult = {
  /** browser storage 저장에 실패했는지 여부. */
  storageFailed: boolean;
  /** 저장 성공 여부와 무관하게 접근 가능한 history deep link. */
  to: string;
};

/** 접수증 저장 구현이 만족해야 하는 내부 seam. */
export type RequestReceiptStore = {
  /** 접수증을 저장하고 history fallback 정보를 반환한다. */
  save: (
    kind: JobReceiptKind,
    jobId: string,
    acceptedAt: string,
  ) => RequestReceiptStorageResult;
};

/** route navigation과 lifecycle이 공유하는 내부 seam. */
export type RequestLifecycleNavigation = {
  /** route 이동 차단 상태를 갱신한다. */
  setLocked: (locked: boolean) => void;
  /** 최근 접수 job을 가리키는 history 목적지를 갱신한다. */
  setHistoryDestination: (destination: string) => void;
};

/** route가 제공하는 lifecycle별 사용자 문구. */
export type RequestLifecycleMessages = {
  /** worker 미가용 시 요청 화면에서 사용할 안내. */
  unavailable: string;
  /** cancel 뒤 입력 보존을 알릴 안내. */
  cancelled: string;
};

/** lifecycle hook에 주입할 dependency와 정책. */
export type UseExtractionRequestLifecycleOptions<
  TRequest,
  TJob extends RequestLifecycleJob,
  TKind extends JobReceiptKind,
> = {
  /** 영상 또는 자막 통신을 감싼 adapter. */
  adapter: RequestLifecycleAdapter<TRequest, TJob, TKind>;
  /** browser receipt와 route navigation adapter. */
  navigation: RequestLifecycleNavigation;
  /** 운영 browser receipt 대신 사용할 저장 adapter. */
  receiptStore?: RequestReceiptStore;
  /** 정상 저장 시 사용할 history route. */
  historyPath?: string;
  /** route별 readiness·cancel 안내. */
  messages: RequestLifecycleMessages;
  /** readiness background 확인 간격. */
  readinessIntervalMs?: number;
  /** 접수 시각과 readiness 확인 시각을 주입할 clock. */
  now?: () => number;
};

/** lifecycle 현재 상태에서 사용할 action. 잘못된 phase에서는 노출하지 않는다. */
export type RequestLifecycleActions<TRequest> = {
  /** readiness가 준비된 요청 phase에서만 제공하는 접수 action. */
  submit?: (request: TRequest) => void;
  /** accepting phase에서만 제공하는 pre-job cancel action. */
  cancel?: () => boolean;
  /** 요청 phase에서 제공하는 readiness 재확인 action. */
  retryReadiness?: () => void;
  /** result·error phase에서 제공하는 route-local reset action. */
  reset?: () => void;
  /** 현재 요청 오류와 보조 안내를 지운다. */
  clearRequestError: () => void;
};

/** 화면과 테스트가 관찰하는 추출 요청 생명주기 interface. */
export type RequestLifecycleResult<
  TRequest,
  TJob extends RequestLifecycleJob,
> = {
  /** 현재 lifecycle phase. */
  phase: RequestLifecyclePhase;
  /** 현재 요청 phase에서 새 접수를 시작할 수 있는지 여부. */
  canSubmit: boolean;
  /** 현재 route에서 추적 중인 job. */
  job: TJob | null;
  /** 현재 job에 대응하는 browser receipt. */
  receipt: JobReceipt | null;
  /** lifecycle이 우선순위를 정한 오류. */
  error: RequestLifecycleError<TJob> | null;
  /** readiness 표시와 갱신 상태. */
  readiness: {
    /** 사용자에게 표시할 readiness 상태. */
    status: WorkerHealthStatus;
    /** readiness 요청 진행 여부. */
    isFetching: boolean;
    /** 마지막 성공 확인 시각(epoch milliseconds). */
    lastCheckedAt: number;
    /** readiness 요청에서 발생한 원래 오류. */
    error: unknown | null;
  };
  /** cancel 또는 race 결과를 알리는 보조 안내. */
  requestNotice: string;
  /** receipt 저장 실패 여부. 서버 job 추적은 계속한다. */
  receiptStorageFailed: boolean;
  /** 현재 phase에 맞춘 lifecycle action. */
  actions: RequestLifecycleActions<TRequest>;
};

/** 기본 browser receipt 저장 adapter. */
const browserReceiptStore: RequestReceiptStore = {
  save(kind, jobId, acceptedAt) {
    return acceptJobReceipt(kind, jobId, acceptedAt);
  },
};

/** 정상 저장 시 사용하는 기본 history route. */
const DEFAULT_HISTORY_PATH = '/history';
/** worker health background 확인 기본 간격. */
const DEFAULT_READINESS_INTERVAL_MS = 15_000;

/** lifecycle 내부 상태. */
type InternalLifecycleState<TJob extends RequestLifecycleJob> = {
  /** readiness 사용자 표시값. */
  readiness: {
    /** readiness status. */
    status: WorkerHealthStatus;
    /** readiness 요청 진행 여부. */
    isFetching: boolean;
    /** 마지막 성공 확인 시각. */
    lastCheckedAt: number;
    /** readiness 요청 오류. */
    error: unknown | null;
  };
  /** 현재 route에서 추적할 job. */
  job: TJob | null;
  /** 현재 job의 browser receipt. */
  receipt: JobReceipt | null;
  /** 접수 중인지 여부. */
  isSubmitting: boolean;
  /** 접수 오류. */
  requestError: unknown | null;
  /** job 상태 조회 오류. */
  statusError: unknown | null;
  /** cancel 또는 race 보조 안내. */
  requestNotice: string;
  /** receipt 저장 실패 여부. */
  receiptStorageFailed: boolean;
};

/** 접수 시도 식별자. */
type RequestAttempt = {
  /** adapter 요청을 중단할 controller. */
  controller: AbortController;
  /** 사용자가 job 생성 전에 cancel했는지 여부. */
  cancelled: boolean;
};

/** readiness 요청 식별자와 취소 정보를 함께 보관한다. */
type ReadinessRequest = {
  /** readiness 요청의 고유 번호. */
  id: number;
  /** 현재 요청을 중단할 controller. */
  controller: AbortController;
  /** 현재 readiness 요청 promise. */
  promise: Promise<RequestReadinessResponse>;
};

/** 추출 요청 생명주기를 하나의 deep React hook interface로 제공한다. */
export function useExtractionRequestLifecycle<
  TRequest,
  TJob extends RequestLifecycleJob,
  TKind extends JobReceiptKind,
>(
  options: UseExtractionRequestLifecycleOptions<TRequest, TJob, TKind>,
): RequestLifecycleResult<TRequest, TJob> {
  /** 통신을 담당하는 route adapter. */
  const adapter = options.adapter;
  /** navigation lock 갱신 함수. */
  const setNavigationLocked = options.navigation.setLocked;
  /** history 목적지 갱신 함수. */
  const setHistoryDestination = options.navigation.setHistoryDestination;
  /** receipt 저장 adapter. */
  const receiptStore = options.receiptStore ?? browserReceiptStore;
  /** 정상 저장 시 사용할 history route. */
  const historyPath = options.historyPath ?? DEFAULT_HISTORY_PATH;
  /** worker 미가용 안내 문구. */
  const unavailableMessage = options.messages.unavailable;
  /** cancel 뒤 안내 문구. */
  const cancelledMessage = options.messages.cancelled;
  /** readiness background 확인 간격. */
  const readinessIntervalMs =
    options.readinessIntervalMs ?? DEFAULT_READINESS_INTERVAL_MS;
  /** 테스트와 운영에서 공유할 현재 시각 공급자. */
  const now = options.now ?? Date.now;

  // State.

  /** lifecycle observable state. */
  const [state, setState] = useState<InternalLifecycleState<TJob>>(() =>
    createInitialLifecycleState(unavailableMessage),
  );

  // Refs.

  /** 최신 state를 비동기 adapter callback에서 읽기 위한 참조. */
  const stateRef = useRef(state);
  /** 현재 접수 시도. */
  const requestAttemptRef = useRef<RequestAttempt | null>(null);
  /** 최신 접수 callback을 submit callback에서 참조한다. */
  const acceptRequestRef = useRef<
    ((request: TRequest, attempt: RequestAttempt) => Promise<void>) | null
  >(null);
  /** 현재 readiness 요청. */
  const readinessRequestRef = useRef<ReadinessRequest | null>(null);
  /** 다음 readiness 요청 번호. */
  const readinessRequestIdRef = useRef(0);
  /** hook이 아직 mount 상태인지 여부. */
  const mountedRef = useRef(true);

  // Helpers.

  /** state와 ref를 함께 최신 값으로 바꾼다. */
  const updateState = useCallback(
    function updateState(
      updater: (
        current: InternalLifecycleState<TJob>,
      ) => InternalLifecycleState<TJob>,
    ) {
      setState((current) => {
        /** updater가 계산한 다음 lifecycle 상태. */
        const next = updater(current);
        stateRef.current = next;
        return next;
      });
    },
    [],
  );

  /** readiness 응답을 WorkerHealthStatus와 오류 상태로 반영한다. */
  const updateReadinessSuccess = useCallback(
    function updateReadinessSuccess(
      response: RequestReadinessResponse,
      requestId: number,
    ) {
      if (
        !mountedRef.current ||
        readinessRequestRef.current?.id !== requestId
      ) {
        return;
      }

      /** 성공한 readiness 응답의 사용자 표시값. */
      const status = getWorkerHealthStatus({
        apiReady: response.ok,
        hasError: false,
        isInitialChecking: false,
        unavailableMessage,
        workerAvailable: response.worker.available,
      });

      updateState((current) => ({
        ...current,
        readiness: {
          error: null,
          isFetching: false,
          lastCheckedAt: now(),
          status,
        },
      }));
    },
    [now, unavailableMessage, updateState],
  );

  /** readiness 오류를 사용자 표시 상태로 반영한다. */
  const updateReadinessFailure = useCallback(
    function updateReadinessFailure(error: unknown, requestId: number) {
      if (
        !mountedRef.current ||
        readinessRequestRef.current?.id !== requestId ||
        isAbortError(error)
      ) {
        return;
      }

      /** readiness 확인 실패 상태. */
      const status = getWorkerHealthStatus({
        apiReady: undefined,
        hasError: true,
        isInitialChecking: false,
        unavailableMessage,
        workerAvailable: undefined,
      });

      updateState((current) => ({
        ...current,
        readiness: {
          ...current.readiness,
          error,
          isFetching: false,
          status,
        },
      }));
    },
    [unavailableMessage, updateState],
  );

  /** readiness 요청을 시작하거나 현재 요청 promise를 재사용한다. */
  const runReadinessCheck = useCallback(
    function runReadinessCheck(input: {
      /** 현재 요청을 취소하고 새 readiness를 시작할지 여부. */
      force: boolean;
      /** submit attempt와 연결할 외부 signal. */
      signal?: AbortSignal;
    }): Promise<RequestReadinessResponse> {
      /** 이미 진행 중인 readiness 요청. */
      const currentRequest = readinessRequestRef.current;

      if (currentRequest && !input.force) {
        return currentRequest.promise;
      }

      if (currentRequest) {
        currentRequest.controller.abort();
      }

      /** 새 readiness 확인을 중단할 내부 controller. */
      const controller = new AbortController();
      /** 외부 attempt 취소를 readiness 요청에 전달하는 listener. */
      const abortExternalRequest = () => controller.abort();

      if (input.signal) {
        if (input.signal.aborted) {
          controller.abort();
        } else {
          input.signal.addEventListener('abort', abortExternalRequest, {
            once: true,
          });
        }
      }

      /** 새 readiness 요청 번호. */
      const requestId = ++readinessRequestIdRef.current;
      /** readiness 시작 시 이전 성공 form을 보존할지 여부. */
      const preservesReadyForm =
        stateRef.current.readiness.status.kind === 'ready';

      updateState((current) => ({
        ...current,
        readiness: {
          ...current.readiness,
          error: null,
          isFetching: true,
          status: preservesReadyForm
            ? current.readiness.status
            : getWorkerHealthStatus({
                apiReady: undefined,
                hasError: false,
                isInitialChecking: true,
                unavailableMessage,
                workerAvailable: undefined,
              }),
        },
      }));

      /** readiness adapter 호출 결과. 동기 throw도 promise 오류로 정규화한다. */
      const promise = Promise.resolve()
        .then(() => adapter.checkReadiness(controller.signal))
        .then((response) => {
          if (!controller.signal.aborted) {
            updateReadinessSuccess(response, requestId);
          }
          return response;
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            updateReadinessFailure(error, requestId);
          }
          throw error;
        })
        .finally(() => {
          input.signal?.removeEventListener('abort', abortExternalRequest);

          if (readinessRequestRef.current?.id === requestId) {
            readinessRequestRef.current = null;

            if (controller.signal.aborted && mountedRef.current) {
              updateState((current) => ({
                ...current,
                readiness: {
                  ...current.readiness,
                  isFetching: false,
                },
              }));
            }
          }
        });

      const readinessRequest: ReadinessRequest = {
        controller,
        id: requestId,
        promise,
      };
      readinessRequestRef.current = readinessRequest;

      return promise;
    },
    [
      adapter,
      unavailableMessage,
      updateReadinessFailure,
      updateReadinessSuccess,
      updateState,
    ],
  );

  /** 접수 시도와 새 readiness 확인을 시작한다. */
  const submitRequest = useCallback(
    function submitRequest(request: TRequest) {
      /** 접수 시작 당시 lifecycle 상태. */
      const current = stateRef.current;

      if (
        current.job ||
        current.isSubmitting ||
        current.readiness.status.kind !== 'ready'
      ) {
        return;
      }

      /** 이전 시도를 교체할 때 이전 응답은 오류만 무시한다. */
      if (requestAttemptRef.current) {
        requestAttemptRef.current.cancelled = true;
        requestAttemptRef.current.controller.abort();
      }

      /** 이번 접수 시도. */
      const attempt: RequestAttempt = {
        cancelled: false,
        controller: new AbortController(),
      };
      requestAttemptRef.current = attempt;
      setNavigationLocked(true);
      updateState((previous) => ({
        ...previous,
        isSubmitting: true,
        requestError: null,
        requestNotice: '',
        statusError: null,
      }));

      void acceptRequestRef.current?.(request, attempt);
    },
    [setNavigationLocked, updateState],
  );

  /** 실제 readiness 재확인과 job 접수를 수행한다. */
  const acceptRequest = useCallback(
    async function acceptRequest(request: TRequest, attempt: RequestAttempt) {
      try {
        /** submit 직전 최신 readiness. */
        const readiness = await runReadinessCheck({
          force: true,
          signal: attempt.controller.signal,
        });

        if (
          attempt.cancelled ||
          requestAttemptRef.current !== attempt ||
          attempt.controller.signal.aborted
        ) {
          return;
        }

        assertWorkerAvailable(readiness);

        /** adapter가 생성한 서버 job. */
        const job = await adapter.createRequest(
          request,
          attempt.controller.signal,
        );
        /** cancel 또는 현재 attempt와 경쟁한 응답인지 여부. */
        const isAccepted =
          requestAttemptRef.current === attempt || attempt.cancelled;

        if (!isAccepted) {
          return;
        }

        /** 새 접수가 시작되지 않아 현재 route를 갱신할 수 있는지 여부. */
        const ownsRouteState =
          requestAttemptRef.current === null ||
          requestAttemptRef.current === attempt;

        /** browser receipt에 기록할 접수 시각. */
        const acceptedAt = new Date(now()).toISOString();
        /** 서버 job receipt 저장 결과. */
        let storageResult: RequestReceiptStorageResult;

        try {
          storageResult = receiptStore.save(
            adapter.kind,
            job.jobId,
            acceptedAt,
          );
        } catch {
          storageResult = {
            storageFailed: true,
            to: createHistoryDeepLink(adapter.kind, job.jobId),
          };
        }

        if (!ownsRouteState || !mountedRef.current) {
          return;
        }

        /** 현재 화면에서 상태를 확인할 job receipt. */
        const receipt: JobReceipt = {
          acceptedAt,
          jobId: job.jobId,
          kind: adapter.kind,
        };
        /** 저장 실패 시에도 현재 job을 가리킬 history fallback. */
        const historyDestination = storageResult.storageFailed
          ? storageResult.to
          : historyPath;

        setHistoryDestination(historyDestination);
        setNavigationLocked(false);
        updateState((previous) => ({
          ...previous,
          isSubmitting: false,
          job,
          receipt,
          receiptStorageFailed: storageResult.storageFailed,
          requestError: null,
          requestNotice: attempt.cancelled
            ? '요청을 중단하는 동안 서버 작업이 접수되어 요청 내역에 보존했습니다.'
            : '',
          statusError: null,
        }));
      } catch (error) {
        if (
          attempt.cancelled ||
          requestAttemptRef.current !== attempt ||
          isAbortError(error) ||
          !mountedRef.current
        ) {
          return;
        }

        setNavigationLocked(false);
        updateState((previous) => ({
          ...previous,
          isSubmitting: false,
          requestError: error,
          requestNotice: '',
        }));
      } finally {
        if (requestAttemptRef.current === attempt) {
          requestAttemptRef.current = null;

          if (mountedRef.current) {
            setNavigationLocked(false);
            updateState((previous) => ({
              ...previous,
              isSubmitting: false,
            }));
          }
        }
      }
    },
    [
      adapter,
      historyPath,
      now,
      receiptStore,
      runReadinessCheck,
      setHistoryDestination,
      setNavigationLocked,
      updateState,
    ],
  );

  acceptRequestRef.current = acceptRequest;

  /** 현재 accepting 요청을 즉시 중단하고 입력을 보존한다. */
  const cancelRequest = useCallback(
    function cancelRequest() {
      /** 현재 접수 시도. */
      const attempt = requestAttemptRef.current;

      if (!attempt || !stateRef.current.isSubmitting) {
        return false;
      }

      attempt.cancelled = true;
      attempt.controller.abort();
      requestAttemptRef.current = null;
      setNavigationLocked(false);
      updateState((previous) => ({
        ...previous,
        isSubmitting: false,
        requestError: null,
        requestNotice: cancelledMessage,
        statusError: null,
      }));
      return true;
    },
    [cancelledMessage, setNavigationLocked, updateState],
  );

  /** result·error 뒤 route-local request 화면으로 돌아간다. */
  const resetRequest = useCallback(
    function resetRequest() {
      /** 취소할 현재 접수 시도. */
      const attempt = requestAttemptRef.current;

      if (attempt) {
        attempt.cancelled = true;
        attempt.controller.abort();
        requestAttemptRef.current = null;
      }

      setNavigationLocked(false);
      updateState((previous) => ({
        ...previous,
        isSubmitting: false,
        job: null,
        receipt: null,
        receiptStorageFailed: false,
        requestError: null,
        requestNotice: '',
        statusError: null,
      }));
    },
    [setNavigationLocked, updateState],
  );

  /** 요청 오류와 cancel 안내를 지운다. */
  const clearRequestError = useCallback(
    function clearRequestError() {
      updateState((previous) => ({
        ...previous,
        requestError: null,
        requestNotice: '',
      }));
    },
    [updateState],
  );

  /** 요청 phase에서 readiness를 다시 확인한다. */
  const retryReadiness = useCallback(
    function retryReadiness() {
      if (
        stateRef.current.job ||
        stateRef.current.readiness.isFetching ||
        stateRef.current.isSubmitting
      ) {
        return;
      }

      updateState((current) => ({
        ...current,
        requestError: null,
        requestNotice: '',
      }));
      void runReadinessCheck({ force: true }).catch(() => undefined);
    },
    [runReadinessCheck, updateState],
  );

  // Effects.

  useEffect(
    function startInitialReadinessCheck() {
      void runReadinessCheck({ force: true }).catch(() => undefined);
    },
    [runReadinessCheck],
  );

  useEffect(
    function refreshReadinessInBackground() {
      /** readiness background 확인 timer. */
      const timerId = setInterval(() => {
        const current = stateRef.current;

        if (current.job || current.isSubmitting || current.readiness.isFetching) {
          return;
        }

        void runReadinessCheck({ force: true }).catch(() => undefined);
      }, readinessIntervalMs);

      return () => clearInterval(timerId);
    },
    [readinessIntervalMs, runReadinessCheck],
  );

  useEffect(
    function pollActiveJobStatus() {
      /** 현재 polling할 job. */
      const job = stateRef.current.job;
      /** 현재 polling할 receipt. */
      const receipt = stateRef.current.receipt;

      if (!job || !receipt || receipt.kind !== adapter.kind) {
        return;
      }

      /** type guard 이후 현재 polling receipt. */
      const activeReceipt = receipt;

      /** effect가 정리됐는지 여부. */
      let disposed = false;
      /** 다음 상태 조회 timer. */
      let timerId: ReturnType<typeof setTimeout> | undefined;
      /** 일시적 상태 조회 오류 재시도 횟수. */
      let retryCount = 0;
      /** 상태 조회를 취소할 controller. */
      const controller = new AbortController();

      /** active job 상태를 재귀적으로 확인한다. */
      async function pollStatus() {
        try {
          /** adapter가 반환한 최신 job 상태. */
          const nextJob = await adapter.getStatus(
            activeReceipt as JobReceipt & { kind: TKind },
            controller.signal,
          );

          if (disposed || controller.signal.aborted || !mountedRef.current) {
            return;
          }

          retryCount = 0;
          updateState((current) => {
            if (
              current.receipt?.jobId !== activeReceipt.jobId ||
              current.receipt?.kind !== activeReceipt.kind
            ) {
              return current;
            }

            return {
              ...current,
              job: nextJob,
              statusError: null,
            };
          });

          /** terminal이면 polling을 끝내고 아니면 기존 간격을 유지한다. */
          const nextInterval = getJobStatusRefetchInterval(
            nextJob.displayStatus,
          );

          if (nextInterval !== false && !disposed) {
            timerId = setTimeout(pollStatus, nextInterval);
          }
        } catch (error) {
          if (disposed || controller.signal.aborted || isAbortError(error)) {
            return;
          }

          /** 현재 상태 오류가 다음 polling에서 재시도 가능한지 여부. */
          const retryable = shouldRetryJobStatus(retryCount, error);
          updateState((current) => {
            if (
              current.receipt?.jobId !== activeReceipt.jobId ||
              current.receipt?.kind !== activeReceipt.kind
            ) {
              return current;
            }

            return { ...current, statusError: error };
          });

          if (retryable && !disposed) {
            /** exponential backoff를 적용한 다음 상태 조회 지연. */
            const retryDelay = getJobStatusRetryDelay(retryCount);
            retryCount += 1;
            timerId = setTimeout(pollStatus, retryDelay);
          }
        }
      }

      void pollStatus();

      return () => {
        disposed = true;
        controller.abort();

        if (timerId) {
          clearTimeout(timerId);
        }
      };
    },
    [adapter, state.receipt?.jobId, state.receipt?.kind, updateState],
  );

  useEffect(
    function cleanupLifecycleRequests() {
      mountedRef.current = true;

      return () => {
        mountedRef.current = false;
        requestAttemptRef.current?.controller.abort();
        readinessRequestRef.current?.controller.abort();
        setNavigationLocked(false);
      };
    },
    [setNavigationLocked],
  );

  // Computed.

  /** 현재 lifecycle phase. active job이 readiness보다 우선한다. */
  const phase = getLifecyclePhase(state);
  /** lifecycle 오류 우선순위 결과. */
  const error = useMemo(
    () => getLifecycleError(state),
    [state],
  ) as RequestLifecycleError<TJob> | null;
  /** 요청 phase에서 현재 접수를 시작할 수 있는지 여부. */
  const canSubmit =
    phase === 'request' &&
    state.job === null &&
    !state.isSubmitting &&
    state.readiness.status.kind === 'ready';
  /** readiness 실패를 복구할 수 있는 현재 phase인지 여부. */
  const canRetryReadiness =
    phase === 'request' ||
    (phase === 'error' &&
      state.job === null &&
      (state.readiness.status.kind === 'failed' ||
        state.readiness.status.kind === 'unavailable'));

  /** phase에 맞는 action만 외부 interface에 제공한다. */
  const actions: RequestLifecycleActions<TRequest> = {
    cancel: phase === 'accepting' ? cancelRequest : undefined,
    clearRequestError,
    reset:
      phase === 'result' || phase === 'error' ? resetRequest : undefined,
    retryReadiness: canRetryReadiness ? retryReadiness : undefined,
    submit: canSubmit ? submitRequest : undefined,
  };

  return {
    actions,
    canSubmit,
    error,
    job: state.job,
    phase,
    readiness: state.readiness,
    receipt: state.receipt,
    receiptStorageFailed: state.receiptStorageFailed,
    requestNotice: state.requestNotice,
  };
}

/** lifecycle 초기 상태를 만든다. */
function createInitialLifecycleState<TJob extends RequestLifecycleJob>(
  unavailableMessage: string,
): InternalLifecycleState<TJob> {
  return {
    isSubmitting: false,
    job: null,
    receipt: null,
    receiptStorageFailed: false,
    readiness: {
      error: null,
      isFetching: true,
      lastCheckedAt: 0,
      status: getWorkerHealthStatus({
        apiReady: undefined,
        hasError: false,
        isInitialChecking: true,
        unavailableMessage,
        workerAvailable: undefined,
      }),
    },
    requestError: null,
    requestNotice: '',
    statusError: null,
  };
}

/** 현재 state를 외부 phase로 정규화한다. */
function getLifecyclePhase<TJob extends RequestLifecycleJob>(
  state: InternalLifecycleState<TJob>,
): RequestLifecyclePhase {
  if (state.job) {
    if (state.job.displayStatus === 'completed') {
      return 'result';
    }

    if (
      state.job.displayStatus === 'failed' ||
      state.job.displayStatus === 'expired'
    ) {
      return 'error';
    }

    return state.statusError ? 'error' : 'processing';
  }

  if (state.isSubmitting) {
    return 'accepting';
  }

  return state.requestError ? 'error' : 'request';
}

/** lifecycle 내부 오류 후보를 현재 사용자 우선순위 하나로 정한다. */
function getLifecycleError<TJob extends RequestLifecycleJob>(
  state: InternalLifecycleState<TJob>,
): RequestLifecycleError<TJob> | null {
  if (state.statusError) {
    return {
      cause: state.statusError,
      retryable: shouldRetryJobStatus(0, state.statusError),
      source: 'status',
    };
  }

  if (
    state.job &&
    (state.job.displayStatus === 'failed' ||
      state.job.displayStatus === 'expired')
  ) {
    return {
      cause: state.job,
      job: state.job,
      retryable: false,
      source: 'terminal',
    };
  }

  if (state.requestError) {
    return {
      cause: state.requestError,
      retryable: false,
      source: 'request',
    };
  }

  if (
    state.job === null &&
    (state.readiness.status.kind === 'failed' ||
      state.readiness.status.kind === 'unavailable')
  ) {
    return {
      cause: state.readiness.error ?? new WorkerUnavailableError(),
      retryable: true,
      source: 'readiness',
    };
  }

  return null;
}

/** receipt 저장 실패 시에도 접근 가능한 history deep link를 만든다. */
function createHistoryDeepLink(kind: JobReceiptKind, jobId: string) {
  return `/history?kind=${kind}&jobId=${encodeURIComponent(jobId)}`;
}
