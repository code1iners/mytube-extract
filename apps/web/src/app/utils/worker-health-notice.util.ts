/** Worker health 안내 역할. */
type WorkerHealthNoticeRole = 'alert' | 'status';

/** 요청 전 worker health 상태 종류. */
export type WorkerHealthStatusKind =
  | 'checking'
  | 'ready'
  | 'unavailable'
  | 'failed';

/** 요청 전 worker health 상태 표시값. */
export type WorkerHealthStatus = {
  /** 상태 분류. */
  kind: WorkerHealthStatusKind;
  /** 사용자가 바로 읽을 상태명. */
  label: string;
  /** 상태에 대한 평이한 설명. */
  message: string;
  /** 보조 기술에 전달할 안내 역할. */
  role: WorkerHealthNoticeRole;
};

/** worker health 상태 설명을 가리킬 id를 만든다. */
export function getWorkerHealthStatusMessageId(headingId: string) {
  return `${headingId}-message`;
}

/** worker health 상태 표시값을 만드는 입력. */
export type WorkerHealthStatusInput = {
  /** API process가 정상이라고 응답했는지 여부. */
  apiReady: boolean | undefined;
  /** health 요청 자체가 실패했는지 여부. */
  hasError: boolean;
  /** 현재 health 요청 또는 재확인 요청 진행 여부. */
  isFetching: boolean;
  /** worker가 작업을 받을 수 있는지 여부. */
  workerAvailable: boolean | undefined;
  /** worker 미가용 시 표시할 제품별 안내 문구. */
  unavailableMessage: string;
};

/** 요청 전 서버와 worker health 상태를 화면 표시값으로 바꾼다. */
export function getWorkerHealthStatus(
  input: WorkerHealthStatusInput,
): WorkerHealthStatus {
  if (input.isFetching) {
    return {
      kind: 'checking',
      label: '확인 중',
      message: '서버 연결과 worker 준비 상태를 확인하고 있습니다.',
      role: 'status',
    };
  }

  if (input.hasError || input.apiReady !== true) {
    return {
      kind: 'failed',
      label: '확인 실패',
      message: 'API 상태를 확인하지 못했습니다. 다시 확인해 주세요.',
      role: 'alert',
    };
  }

  if (input.workerAvailable === false) {
    return {
      kind: 'unavailable',
      label: 'worker 중단',
      message: `API는 응답했지만 worker가 작업을 받을 수 없습니다. ${input.unavailableMessage}`,
      role: 'alert',
    };
  }

  if (input.workerAvailable === true) {
    return {
      kind: 'ready',
      label: '준비됨',
      message: '서버 연결됨 · worker가 작업을 받을 준비가 되었습니다.',
      role: 'status',
    };
  }

  return {
    kind: 'checking',
    label: '확인 중',
    message: '서버 연결과 worker 준비 상태를 확인하고 있습니다.',
    role: 'status',
  };
}

/** worker health와 입력 상태를 기준으로 제출 버튼의 차단 이유를 만든다. */
export function getWorkerHealthSubmitReason(input: {
  /** worker health 상태. */
  healthStatus: WorkerHealthStatusKind;
  /** 요청 접수 mutation 진행 여부. */
  isSubmitting: boolean;
  /** 현재 입력값이 제출 가능한지 여부. */
  validationReady: boolean;
  /** 입력값이 제출 불가할 때의 안내 문구. */
  validationMessage: string;
}) {
  if (input.isSubmitting) {
    return '요청을 접수하는 동안 잠시 기다려 주세요.';
  }

  if (input.healthStatus === 'checking') {
    return '서버 연결과 worker 준비 상태를 확인하는 동안 요청할 수 없습니다.';
  }

  if (input.healthStatus === 'unavailable') {
    return 'worker가 준비되지 않아 요청할 수 없습니다.';
  }

  if (input.healthStatus === 'failed') {
    return '서버 상태를 확인하지 못해 요청할 수 없습니다.';
  }

  return input.validationReady ? '' : input.validationMessage;
}

/** 마지막 worker health 확인 시각을 읽기 좋은 시간으로 표시한다. */
export function formatWorkerHealthCheckedAt(timestamp: number) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return '확인 전';
  }

  /** health 확인 시각. */
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return '확인 전';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

/** Worker health 안내에 필요한 상태. */
type WorkerHealthNoticeInput = {
  /** Health 요청 실패 여부. */
  failed: boolean;
  /** 최초 health 요청 대기 여부. */
  pending: boolean;
  /** Worker 미가용 여부. */
  unavailable: boolean;
  /** Worker 미가용 시 표시할 제품별 안내 문구. */
  unavailableMessage: string;
};

/** 요청 설정 화면에 표시할 worker health 안내. */
export type WorkerHealthNotice = {
  /** 사용자에게 표시할 안내 문구. */
  message: string;
  /** 보조 기술에 전달할 안내 역할. */
  role: WorkerHealthNoticeRole;
  /** 상태 재확인 행동 노출 여부. */
  showRetry: boolean;
};

/** Worker health 상태를 요청 설정용 인라인 안내로 바꾼다. */
export function getWorkerHealthNotice(
  input: WorkerHealthNoticeInput,
): WorkerHealthNotice | null {
  if (input.unavailable) {
    return {
      message: input.unavailableMessage,
      role: 'alert',
      showRetry: true,
    };
  }

  if (input.failed) {
    return {
      message: '서버 상태를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.',
      role: 'alert',
      showRetry: true,
    };
  }

  if (input.pending) {
    return {
      message: '서비스 상태를 확인 중입니다.',
      role: 'status',
      showRetry: false,
    };
  }

  return null;
}
