import {
  applyYoutubeClientOptions,
  normalizeYoutubeDlError,
  runYoutubeClientAttempts,
} from '@mytube-extract/media-downloader';
import { youtubeDl } from 'youtube-dl-exec';
import {
  createVideoPreflightDecision,
  WorkerJobFailure,
} from './worker.logic';

/** metadata preflight에 주입할 단일 yt-dlp 실행 함수. */
export type YoutubeMetadataRun = (
  sourceUrl: string,
  youtubeOptions: Record<string, unknown>,
) => Promise<unknown>;

/** video metadata preflight 입력. */
export type VideoPreflightInput = {
  /** worker가 처리할 canonical YouTube URL. */
  sourceUrl: string;
  /** worker 다운로드와 동일한 yt-dlp format selector. */
  format: string;
  /** 테스트에서 대체 가능한 metadata runner. */
  run?: YoutubeMetadataRun;
  /** retry delay를 대체하는 테스트 seam. */
  wait?: (milliseconds: number) => Promise<void>;
};

/** worker video metadata preflight에 공통 YouTube client 정책을 적용한다. */
export async function runVideoPreflight(input: VideoPreflightInput) {
  /** 실제 metadata를 요청할 runner. */
  const runMetadata: YoutubeMetadataRun =
    input.run ??
    ((sourceUrl, youtubeOptions) => youtubeDl(sourceUrl, youtubeOptions));
  /** fallback 이후 최종 metadata. */
  let metadata: unknown;

  await runYoutubeClientAttempts({
    createYoutubeOptions: (client) =>
      applyYoutubeClientOptions(
        {
          dumpSingleJson: true,
          format: input.format,
          jsRuntimes: 'node',
          noPlaylist: true,
        },
        client,
      ),
    run: async ({ sourceUrl, youtubeOptions }) => {
      try {
        metadata = await runMetadata(sourceUrl, youtubeOptions);
      } catch (error) {
        throw normalizeYoutubeDlError(error);
      }
    },
    sourceUrl: input.sourceUrl,
    wait: input.wait,
  });

  /** worker 처리 가능 여부. */
  const decision = createVideoPreflightDecision(metadata);

  if (!decision.ok) {
    throw new WorkerJobFailure(decision.errorCode, decision.message);
  }

  console.log(
    `Video preflight passed: formats=${decision.formatIds.join(',') || 'unknown'} estimatedBytes=${
      decision.estimatedBytes ?? 'unknown'
    }`,
  );
}
