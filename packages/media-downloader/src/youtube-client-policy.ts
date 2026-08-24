import { rm } from 'node:fs/promises';
import {
  getDownloaderDiagnostic,
  type DownloaderAttemptDiagnostic,
} from './media-log-redaction';
import {
  runYoutubeDl,
  type YoutubeDlExecute,
  type YoutubeDlRunInput,
} from './youtube-dl-runner';

/** YouTube 추출 정책이 사용할 player client. */
export type YoutubeClient = 'default' | 'web_embedded';

/** 정책이 주입받는 single-attempt runner. */
export type YoutubeDlRun = (input: YoutubeDlRunInput) => Promise<void>;

/** 공통 client 정책이 실행할 metadata 또는 artifact 단일 시도 입력. */
export type YoutubeClientAttemptInput = {
  /** 현재 실행할 player client. */
  client: YoutubeClient;
  /** 현재 client에서 실행할 시도 번호. */
  attempt: number;
  /** 정규화된 YouTube source URL. */
  sourceUrl: string;
  /** 실행 취소 신호. */
  signal?: AbortSignal;
  /** 현재 client에 맞게 만들어진 yt-dlp option. */
  youtubeOptions: Record<string, unknown>;
};

/** 공통 client 정책에 주입하는 단일 시도 runner. */
export type YoutubeClientAttemptRun = (
  input: YoutubeClientAttemptInput,
) => Promise<void>;

/** 공통 client 정책 입력. */
export type YoutubeClientAttemptsInput = {
  /** client별 yt-dlp option을 만드는 함수. */
  createYoutubeOptions: (client: YoutubeClient) => Record<string, unknown>;
  /** 정규화된 YouTube source URL. */
  sourceUrl: string;
  /** 실행 취소 신호. */
  signal?: AbortSignal;
  /** metadata 또는 artifact 단일 시도 runner. */
  run: YoutubeClientAttemptRun;
  /** 같은 client transient retry 사이에 대기하는 함수. */
  wait?: (milliseconds: number) => Promise<void>;
  /** 실패한 결과를 다음 시도 전에 정리하는 함수. */
  cleanupOutput?: () => Promise<void>;
  /** 같은 client 재시도 직전 server-safe 진단을 남기는 callback. */
  onRetry?: (input: {
    attempt: number;
    client: YoutubeClient;
    error: unknown;
  }) => void;
};

/** YouTube client 정책 실행 입력. */
export type YoutubeClientPolicyInput = {
  /** worker 또는 API가 전달하는 yt-dlp process starter. */
  execute: YoutubeDlExecute;
  /** client별 yt-dlp option을 만드는 함수. */
  createYoutubeOptions: (client: YoutubeClient) => Record<string, unknown>;
  /** 최종 output artifact 경로. */
  outputPath: string;
  /** 정규화된 YouTube source URL. */
  sourceUrl: string;
  /** 실행 취소 신호. */
  signal?: AbortSignal;
  /** 테스트에서 대체 가능한 single-attempt runner. */
  run?: YoutubeDlRun;
  /** 같은 client transient retry 사이에 대기하는 함수. */
  wait?: (milliseconds: number) => Promise<void>;
  /** 실패한 final artifact를 다음 시도 전에 정리하는 함수. */
  cleanupOutput?: (outputPath: string) => Promise<void>;
  /** 같은 client 재시도 직전 server-safe 진단을 남기는 callback. */
  onRetry?: (input: {
    attempt: number;
    client: YoutubeClient;
    error: unknown;
  }) => void;
};

/** 정책에서 사용할 같은 client retry 횟수. */
const MAX_DEFAULT_CLIENT_ATTEMPTS = 2;

/** client 전환 전 transient retry 사이의 기본 대기 시간. */
const RETRY_DELAY_MS = 500;

/** yt-dlp player client를 option에 반영한다. */
export function applyYoutubeClientOptions(
  options: Record<string, unknown>,
  client: YoutubeClient,
) {
  /** 기존 client option을 제거한 기본 option 복사본. */
  const clientOptions = { ...options };
  delete clientOptions.extractorArgs;

  if (client === 'web_embedded') {
    clientOptions.extractorArgs = 'youtube:player_client=web_embedded';
  }

  return clientOptions;
}

/** 기본 client와 제한적 fallback을 실행하는 공통 정책. */
export async function runYoutubeClientPolicy(
  input: YoutubeClientPolicyInput,
): Promise<void> {
  /** 사용할 single-attempt runner. */
  const run = input.run ?? runYoutubeDl;
  /** 실패한 final artifact를 정리하는 함수. */
  const cleanupOutput = input.cleanupOutput ?? cleanupYoutubeOutput;

  await runYoutubeClientAttempts({
    createYoutubeOptions: input.createYoutubeOptions,
    cleanupOutput: () => cleanupOutput(input.outputPath),
    onRetry: input.onRetry,
    run: ({ signal, sourceUrl, youtubeOptions }) =>
      run({
        execute: input.execute,
        outputPath: input.outputPath,
        signal,
        sourceUrl,
        youtubeOptions,
      }),
    signal: input.signal,
    sourceUrl: input.sourceUrl,
    wait: input.wait,
  });
}

/** 기본 client와 제한적 fallback을 metadata와 artifact에 공통 적용한다. */
export async function runYoutubeClientAttempts(
  input: YoutubeClientAttemptsInput,
): Promise<void> {
  /** 같은 client retry 대기 함수. */
  const wait = input.wait ?? sleep;
  /** 현재 실행할 player client. */
  let client: YoutubeClient = 'default';
  /** 현재 client에서 실행할 시도 번호. */
  let attempt = 1;
  /** 모든 client 시도의 server-only 진단. */
  const attempts: DownloaderAttemptDiagnostic[] = [];

  while (true) {
    try {
      await input.run({
        attempt,
        client,
        signal: input.signal,
        sourceUrl: input.sourceUrl,
        youtubeOptions: input.createYoutubeOptions(client),
      });

      return;
    } catch (error) {
      const diagnostic = getDownloaderDiagnostic(error);
      attempts.push(createAttemptDiagnostic(client, attempt, diagnostic));

      if (
        client === 'default' &&
        diagnostic?.reason === 'client-switch-required'
      ) {
        await input.cleanupOutput?.();
        client = 'web_embedded';
        attempt = 1;
        continue;
      }

      if (
        client === 'default' &&
        attempt < MAX_DEFAULT_CLIENT_ATTEMPTS &&
        isSameClientRetryable(error)
      ) {
        await input.cleanupOutput?.();
        input.onRetry?.({ client, attempt, error });
        await wait(RETRY_DELAY_MS);
        attempt += 1;
        continue;
      }

      throw attachAttemptDiagnostics(error, attempts);
    }
  }
}

/** 실패한 final artifact만 지우고 yt-dlp resume data는 유지한다. */
export async function cleanupYoutubeOutput(outputPath: string) {
  await rm(outputPath, { force: true });
}

/** 기본 client가 같은 client로 한 번 더 시도할 수 있는 오류인지 판정한다. */
function isSameClientRetryable(error: unknown) {
  /** 공통 runner가 수집한 structured diagnostic. */
  const diagnostic = getDownloaderDiagnostic(error);

  return !(
    diagnostic?.killed ||
    diagnostic?.signal ||
    diagnostic?.reason === 'aborted' ||
    diagnostic?.reason === 'spawn-failed' ||
    diagnostic?.reason === 'youtube-auth-required' ||
    diagnostic?.reason === 'embed-disabled' ||
    diagnostic?.reason === 'client-switch-required'
  );
}

/** 한 번의 client 실행 결과를 server-only 진단 항목으로 정리한다. */
function createAttemptDiagnostic(
  client: YoutubeClient,
  attempt: number,
  diagnostic: ReturnType<typeof getDownloaderDiagnostic>,
): DownloaderAttemptDiagnostic {
  return {
    attempt,
    client,
    exitCode: diagnostic?.exitCode,
    killed: diagnostic?.killed,
    reason: diagnostic?.reason,
    signal: diagnostic?.signal,
    stderrTail: diagnostic?.stderrTail,
    stdoutTail: diagnostic?.stdoutTail,
  };
}

/** 최종 오류에 모든 client 시도의 진단을 보존한다. */
function attachAttemptDiagnostics(
  error: unknown,
  attempts: readonly DownloaderAttemptDiagnostic[],
) {
  if (!(error instanceof Error)) {
    return error;
  }

  /** 마지막 시도의 기본 진단. */
  const diagnostic = getDownloaderDiagnostic(error);
  /** 최종 오류에 대응하는 마지막 client 시도. */
  const lastAttempt = attempts[attempts.length - 1];

  return Object.assign(error, {
    diagnostic: {
      ...diagnostic,
      attempt: lastAttempt?.attempt,
      attempts,
      client: lastAttempt?.client,
    },
  });
}

/** 지정 시간만큼 대기한다. */
function sleep(milliseconds: number) {
  return new Promise<void>((resolvePromise) => {
    setTimeout(resolvePromise, milliseconds);
  });
}
