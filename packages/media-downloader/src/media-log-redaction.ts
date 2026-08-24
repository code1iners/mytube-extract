/** URL 원문 대신 로그에 남길 수 있는 host 중심 표현으로 줄인다. */
export function redactUrlForLog(url: string) {
  try {
    /** 파싱된 원본 URL. */
    const parsedUrl = new URL(url);

    return `${parsedUrl.protocol}//${parsedUrl.host}`;
  } catch {
    return '[invalid-url]';
  }
}

/** server-only 진단 로그에 허용하는 최대 문자 수. */
const DIAGNOSTIC_TEXT_LIMIT = 1200;

/** downloader가 에러에 붙이는 server-only 진단 정보. */
export type DownloaderAttemptDiagnostic = {
  /** 실행한 YouTube player client. */
  client: string;
  /** 해당 client의 시도 번호. */
  attempt: number;
  /** 알려진 downloader 실패 분류. */
  reason?: string;
  /** 프로세스 종료 코드. */
  exitCode?: number | null;
  /** 프로세스 종료 signal. */
  signal?: string | null;
  /** 프로세스 kill 여부. */
  killed?: boolean;
  /** stdout 마지막 일부. */
  stdoutTail?: string;
  /** stderr 마지막 일부. */
  stderrTail?: string;
};

/** downloader가 에러에 붙이는 server-only 진단 정보. */
export type DownloaderDiagnostic = {
  /** 마지막으로 실행한 YouTube player client. */
  client?: string;
  /** 마지막 client의 시도 번호. */
  attempt?: number;
  /** 진단 대상 도구 이름. */
  tool?: string;
  /** 알려진 downloader 실패 분류. */
  reason?: string;
  /** 프로세스 종료 코드. */
  exitCode?: number | null;
  /** 프로세스 종료 signal. */
  signal?: string | null;
  /** 프로세스 kill 여부. */
  killed?: boolean;
  /** stdout 마지막 일부. */
  stdoutTail?: string;
  /** stderr 마지막 일부. */
  stderrTail?: string;
  /** client별 시도 진단 목록. */
  attempts?: readonly DownloaderAttemptDiagnostic[];
};

/** Error에 server-only 진단 정보를 붙인 후보. */
type ErrorWithDiagnostic = Error & {
  /** client에 노출하지 않는 운영 진단 정보. */
  diagnostic?: DownloaderDiagnostic;
};

/** Error 객체 원문을 client 또는 일반 로그에 넘기지 않게 한다. */
export function createSafeErrorLog(error: unknown) {
  if (error instanceof Error) {
    return error.name || 'Error';
  }

  return 'UnknownError';
}

/** Error에 붙은 server-only 진단 정보를 안전한 한 줄 로그로 만든다. */
export function createSafeDiagnosticLog(error: unknown) {
  if (!(error instanceof Error)) {
    return '';
  }

  /** downloader가 붙인 server-only 진단 정보. */
  const diagnostic = (error as ErrorWithDiagnostic).diagnostic;

  if (!diagnostic) {
    return '';
  }

  /** 로그에 포함할 key=value 조각. */
  const parts = [
    formatDiagnosticPart('client', diagnostic.client),
    formatDiagnosticPart('attempt', diagnostic.attempt),
    formatDiagnosticPart('tool', diagnostic.tool),
    formatDiagnosticPart('reason', diagnostic.reason),
    formatDiagnosticPart('exitCode', diagnostic.exitCode),
    formatDiagnosticPart('signal', diagnostic.signal),
    formatDiagnosticPart('killed', diagnostic.killed),
    formatDiagnosticPart('stderrTail', diagnostic.stderrTail),
    formatDiagnosticPart('stdoutTail', diagnostic.stdoutTail),
    formatDiagnosticAttempts(diagnostic.attempts),
  ].filter(Boolean);

  return parts.join(' ');
}

/** Error에서 구조화된 downloader 진단만 꺼낸다. */
export function getDownloaderDiagnostic(error: unknown) {
  if (!(error instanceof Error)) {
    return undefined;
  }

  return (error as ErrorWithDiagnostic).diagnostic;
}

/** 진단 값 하나를 key=value 형태로 안전하게 줄인다. */
function formatDiagnosticPart(key: string, value: unknown) {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  return `${key}=${sanitizeDiagnosticText(String(value))}`;
}

/** client별 시도 진단을 안전한 한 줄 문자열로 만든다. */
function formatDiagnosticAttempts(
  attempts: readonly DownloaderAttemptDiagnostic[] | undefined,
) {
  if (!attempts || attempts.length === 0) {
    return '';
  }

  /** client별 시도 결과를 쉼표로 구분한 표현. */
  const formattedAttempts = attempts.map((attempt) => {
    const parts = [
      formatDiagnosticPart('client', attempt.client),
      formatDiagnosticPart('attempt', attempt.attempt),
      formatDiagnosticPart('reason', attempt.reason),
      formatDiagnosticPart('exitCode', attempt.exitCode),
      formatDiagnosticPart('signal', attempt.signal),
      formatDiagnosticPart('killed', attempt.killed),
      formatDiagnosticPart('stderrTail', attempt.stderrTail),
      formatDiagnosticPart('stdoutTail', attempt.stdoutTail),
    ].filter(Boolean);

    return `{${parts.join(',')}}`;
  });

  return sanitizeDiagnosticText(`attempts=${formattedAttempts.join('|')}`);
}

/** stderr/stdout tail에서 민감하거나 과한 내용을 줄인다. */
function sanitizeDiagnosticText(value: string) {
  return value
    .replace(/https?:\/\/[^\s'"]+/g, (url) => redactUrlForLog(url))
    .replace(/\/(?:tmp|var|app|home|Users|private)\/[^\s'"]+/g, '[local-path]')
    .replace(/\b(?:cookie|set-cookie):[^\r\n]*/gi, redactCookieHeader)
    .replace(
      /(\b(?:token|key|secret|password|cookie)=)[^\s&'"]+/gi,
      '$1[redacted]',
    )
    .replace(
      /\b(?:authorization|proxy-authorization):\s*Bearer\s+[^\s'"]+/gi,
      '[redacted-bearer]',
    )
    .replace(/([?&]?(?:token|key|secret|password)=)[^\s&'"]+/gi, '$1[redacted]')
    .replace(/\s+/g, ' ')
    .slice(0, DIAGNOSTIC_TEXT_LIMIT);
}

/** Cookie header의 여러 key/value를 하나의 redacted 값으로 바꾼다. */
function redactCookieHeader(header: string) {
  /** Cookie header 이름과 구분자를 포함하는 위치. */
  const separatorIndex = header.indexOf(':');

  return `${header.slice(0, separatorIndex + 1)} [redacted]`;
}
