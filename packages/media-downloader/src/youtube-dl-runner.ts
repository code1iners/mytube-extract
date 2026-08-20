import { stat } from 'node:fs/promises';
import type { Readable } from 'node:stream';
import type { DownloaderDiagnostic } from './media-log-redaction';

/** yt-dlp 실패 원인 확인에 남길 stream tail line 수. */
const DIAGNOSTIC_TAIL_LINES = 12;

/** youtube-dl-exec child process 중 runner가 필요한 이벤트/제어 표면. */
export type YoutubeDlProcess = {
  /** child process 이벤트 리스너. */
  on: {
    (event: 'error', listener: (error: Error) => void): void;
    (
      event: 'close',
      listener: (code: number | null, signal: NodeJS.Signals | null) => void,
    ): void;
  };
  /** tinyspawn Promise rejection을 소비한다. */
  catch?: (listener: (error: Error) => void) => void;
  /** abort 시 가능한 경우 child process를 종료한다. */
  kill?: () => void;
  /** process kill 여부. */
  killed?: boolean;
  /** stdout stream. */
  stdout?: Readable;
  /** stderr stream. */
  stderr?: Readable;
};

/** yt-dlp process를 시작하는 주입 가능한 함수. */
export type YoutubeDlExecute = (
  sourceUrl: string,
  youtubeOptions: Record<string, unknown>,
) => YoutubeDlProcess;

/** 단일 yt-dlp 실행 입력. */
export type YoutubeDlRunInput = {
  /** yt-dlp에 전달할 정규화된 source URL. */
  sourceUrl: string;
  /** yt-dlp output 옵션과 일치해야 하는 최종 파일 경로. */
  outputPath: string;
  /** yt-dlp child process를 시작하는 함수. */
  execute: YoutubeDlExecute;
  /** 실행에 전달할 yt-dlp 옵션. */
  youtubeOptions: Record<string, unknown>;
  /** 실행 취소 신호. */
  signal?: AbortSignal;
};

/** server-only diagnostic을 가진 yt-dlp runner 오류. */
export type YoutubeDlRunError = Error & {
  /** client에 직접 노출하지 않는 subprocess 진단 정보. */
  diagnostic: DownloaderDiagnostic;
};

/** 단일 yt-dlp subprocess를 실행하고 최종 output artifact를 검증한다. */
export function runYoutubeDl(input: YoutubeDlRunInput): Promise<void> {
  if (input.signal?.aborted) {
    return Promise.reject(
      createRunnerError('yt-dlp execution was aborted', {
        reason: 'aborted',
        tool: 'yt-dlp',
      }),
    );
  }

  return new Promise<void>((resolvePromise, rejectPromise) => {
    /** 중복 child event로 Promise가 두 번 settle되는 것을 막는 상태. */
    let settled = false;
    /** 실행 중인 yt-dlp child process. */
    let process: YoutubeDlProcess;
    /** stdout 마지막 줄 수집기. */
    let stdoutTail = () => '';
    /** stderr 마지막 줄 수집기. */
    let stderrTail = () => '';

    /** abort listener를 제거하고 Promise를 한 번만 settle한다. */
    const settle = (callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      input.signal?.removeEventListener('abort', abortDownload);
      callback();
    };

    /** cancellation을 child kill과 server-only diagnostic으로 바꾼다. */
    const abortDownload = () => {
      process?.kill?.();

      settle(() => {
        rejectPromise(
          createRunnerError('yt-dlp execution was aborted', {
            killed: process?.killed,
            reason: 'aborted',
            stderrTail: stderrTail(),
            stdoutTail: stdoutTail(),
            tool: 'yt-dlp',
          }),
        );
      });
    };

    try {
      process = input.execute(input.sourceUrl, input.youtubeOptions);
    } catch {
      settle(() => {
        rejectPromise(
          createRunnerError('yt-dlp process could not start', {
            reason: 'spawn-failed',
            tool: 'yt-dlp',
          }),
        );
      });
      return;
    }

    stdoutTail = createStreamTail(process.stdout);
    stderrTail = createStreamTail(process.stderr);

    input.signal?.addEventListener('abort', abortDownload, { once: true });

    // tinyspawn Promise rejection은 close event가 결과 코드와 stream tail을 완성할 때까지 소비만 한다.
    process.catch?.(() => undefined);

    process.on('error', () => {
      settle(() => {
        rejectPromise(
          createRunnerError('yt-dlp process could not start', {
            killed: process.killed,
            reason: 'spawn-failed',
            stderrTail: stderrTail(),
            stdoutTail: stdoutTail(),
            tool: 'yt-dlp',
          }),
        );
      });
    });

    process.on('close', (code, signal) => {
      void settleAfterClose(code, signal);
    });

    /** close는 일반 성공과 non-zero 실패를 판정하는 authoritative event다. */
    async function settleAfterClose(
      code: number | null,
      signal: NodeJS.Signals | null,
    ) {
      if (settled) {
        return;
      }

      if (code !== 0) {
        settle(() => {
          rejectPromise(
            createRunnerError(`yt-dlp exited with code ${code}`, {
              exitCode: code,
              killed: process.killed,
              reason: detectDiagnosticReason(stderrTail()),
              signal,
              stderrTail: stderrTail(),
              stdoutTail: stdoutTail(),
              tool: 'yt-dlp',
            }),
          );
        });
        return;
      }

      try {
        /** 성공으로 인정할 최종 artifact 상태. */
        const output = await stat(input.outputPath);

        if (output.size <= 0) {
          throw new Error('output is empty');
        }

        settle(resolvePromise);
      } catch {
        settle(() => {
          rejectPromise(
            createRunnerError('yt-dlp did not create a non-empty output', {
              exitCode: code,
              killed: process.killed,
              reason: 'output-missing',
              signal,
              stderrTail: stderrTail(),
              stdoutTail: stdoutTail(),
              tool: 'yt-dlp',
            }),
          );
        });
      }
    }
  });
}

/** stream 마지막 일부를 line 단위로 보관한다. */
function createStreamTail(stream: Readable | undefined) {
  /** 지금까지 받은 마지막 line 목록. */
  const lines: string[] = [];

  stream?.on('data', (chunk: Buffer | string) => {
    /** stream chunk를 문자열 line으로 변환한다. */
    const chunkLines = String(chunk).split(/\r?\n/).filter(Boolean);

    lines.push(...chunkLines);

    if (lines.length > DIAGNOSTIC_TAIL_LINES) {
      lines.splice(0, lines.length - DIAGNOSTIC_TAIL_LINES);
    }
  });

  return () => lines.join('\n');
}

/**
 * stderr에서 재시도로 해결되지 않는 네트워크 단절 신호를 찾는 패턴.
 * 'TransportError'는 실제 yt-dlp 2026.07.04에서 DNS 실패·connection refused를
 * 모두 감싸는 공통 wrapper라 실측으로 확인해 추가했다. 나머지는 구버전 yt-dlp나
 * 다른 OS의 Python urllib 메시지 형태를 대비한 보조 패턴이다.
 */
const NETWORK_UNREACHABLE_STDERR_PATTERNS = [
  'TransportError',
  'Connection refused',
  'URLError',
  'Network is unreachable',
  'Temporary failure in name resolution',
  'nodename nor servname',
  'getaddrinfo',
];

/** stderr에서 알려진 YouTube 인증 실패 또는 네트워크 단절을 분류한다. */
function detectDiagnosticReason(stderrTail: string) {
  if (
    stderrTail.includes('Sign in to confirm you') ||
    stderrTail.includes('LOGIN_REQUIRED')
  ) {
    return 'youtube-auth-required';
  }

  if (
    NETWORK_UNREACHABLE_STDERR_PATTERNS.some((pattern) =>
      stderrTail.includes(pattern),
    )
  ) {
    return 'network-unreachable';
  }

  return undefined;
}

/** raw upstream error 원문을 보관하지 않는 runner error를 만든다. */
function createRunnerError(message: string, diagnostic: DownloaderDiagnostic) {
  return Object.assign(new Error(message), { diagnostic }) as YoutubeDlRunError;
}
