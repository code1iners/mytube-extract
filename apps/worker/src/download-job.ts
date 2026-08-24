import { ExtractionType } from '@mytube-extract/db';
import {
  applyYoutubeClientOptions,
  runYoutubeClientPolicy,
  type YoutubeClient,
  type YoutubeDlExecute,
  type YoutubeDlRun,
} from '@mytube-extract/media-downloader';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/** worker extraction artifact를 만드는 입력. */
export type DownloadExtractionJobInput = {
  /** worker가 처리할 canonical YouTube URL. */
  sourceUrl: string;
  /** 결과 artifact type. */
  type: ExtractionType;
  /** youtube-dl-exec process를 시작하는 함수. */
  execute: YoutubeDlExecute;
  /** output path에 맞춰 yt-dlp 옵션을 만드는 함수. */
  createYoutubeOptions: (outputPath: string) => Record<string, unknown>;
  /** 테스트에서 대체 가능한 단일-attempt runner. */
  run?: YoutubeDlRun;
  /** retry delay를 대체하는 테스트 seam. */
  wait?: (milliseconds: number) => Promise<void>;
  /** 재시도 직전 server-safe log를 남길 worker callback. */
  onRetry?: (input: {
    attempt: number;
    client: YoutubeClient;
    error: unknown;
  }) => void;
};

/** 실제 extraction에 성공한 final artifact path를 반환한다. */
export async function downloadExtractionJob(input: DownloadExtractionJobInput) {
  /** 요청별 worker 임시 디렉터리. */
  const workDir = await mkdtemp(join(tmpdir(), `mytube-worker-${input.type}-`));
  /** 출력 파일 확장자. */
  const extension = input.type === ExtractionType.audio ? 'mp3' : 'mp4';
  /** yt-dlp final artifact 경로. */
  const outputPath = resolve(workDir, `output.${extension}`);
  try {
    await runYoutubeClientPolicy({
      createYoutubeOptions: (client) =>
        applyYoutubeClientOptions(
          input.createYoutubeOptions(outputPath),
          client,
        ),
      execute: input.execute,
      onRetry: input.onRetry,
      outputPath,
      run: input.run,
      sourceUrl: input.sourceUrl,
      wait: input.wait,
    });

    return outputPath;
  } catch (error) {
    await rm(workDir, { force: true, recursive: true });
    throw error;
  }
}
