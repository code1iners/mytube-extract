import { ConfigService } from '@nestjs/config';
import { getDownloaderDiagnostic } from '@mytube-extract/media-downloader';
import { existsSync, statSync } from 'fs';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { AudioService } from '../../src/audio/audio.service';
import { MediaDownloadService } from '../../src/media/media-download.service';
import { YoutubeDlMediaDownloader } from '../../src/media/youtube-dl-media-downloader';
import { VideoService } from '../../src/video/video.service';

/**
 * 이 스위트는 mock 없이 실제 yt-dlp 바이너리로 실제 YouTube 영상을 다운로드한다.
 * `pnpm --filter api run test:e2e:real`로만 실행되며 `test:e2e`(mock e2e)와는 분리돼 있다.
 * 삭제/지역제한 위험이 가장 낮은 고정 테스트 영상(YouTube 최초 업로드, 19초)을 사용한다.
 */
const REAL_TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

/** 우리 코드가 고칠 수 없는 환경 요인 — 이 reason이면 실패시키지 않고 경고만 남긴다. */
const SKIPPABLE_DIAGNOSTIC_REASONS = new Set([
  'network-unreachable',
  'youtube-auth-required',
]);

describe('실제 yt-dlp 통합 (network 필요)', () => {
  /** 테스트별 임시 작업 디렉터리. */
  let workDir: string;
  /** 로컬 FFMPEG_LOCATION을 그대로 전달하는 최소 ConfigService stub. */
  const configService = {
    get: (key: string) =>
      key === 'FFMPEG_LOCATION' ? process.env.FFMPEG_LOCATION : undefined,
  } as unknown as ConfigService;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'mytube-extract-real-e2e-'));
  });

  afterEach(async () => {
    await rm(workDir, { force: true, recursive: true });
  });

  it('실제 영상을 mp4로 다운로드한다 (video)', async () => {
    /** video.service.ts와 동일한 job 생성 로직 — mediaDownloadService는 이 메서드에서 쓰이지 않는다. */
    const videoService = new VideoService(
      undefined as unknown as MediaDownloadService,
    );
    const job = videoService.createVideoDownloadJob({
      filename: 'real-e2e-video',
      resolution: 360,
      source: {
        kind: 'youtube-id',
        safeLabel: 'youtube:jNQXAC9IVRw',
        url: REAL_TEST_VIDEO_URL,
      },
    });
    const outputPath = join(workDir, 'real-e2e-video.mp4');
    const downloader = new YoutubeDlMediaDownloader(configService);

    const completed = await downloadOrSkip(() =>
      downloader.download({
        format: job.format,
        kind: job.kind,
        mergeOutputFormat: job.mergeOutputFormat,
        outputPath,
        sourceUrl: job.source.url,
      }),
    );

    if (completed) {
      assertNonEmptyFile(outputPath);
    }
  });

  it('실제 영상을 mp3로 다운로드한다 (audio)', async () => {
    /** audio.service.ts와 동일한 job 생성 로직. */
    const audioService = new AudioService(
      undefined as unknown as MediaDownloadService,
    );
    const job = audioService.createAudioDownloadJob({
      bitrate: 128,
      filename: 'real-e2e-audio',
      source: {
        kind: 'youtube-id',
        safeLabel: 'youtube:jNQXAC9IVRw',
        url: REAL_TEST_VIDEO_URL,
      },
    });
    const outputPath = join(workDir, 'real-e2e-audio.mp3');
    const downloader = new YoutubeDlMediaDownloader(configService);

    const completed = await downloadOrSkip(() =>
      downloader.download({
        audioFormat: job.audioFormat,
        extractAudio: job.extractAudio,
        format: job.format,
        kind: job.kind,
        outputPath,
        sourceUrl: job.source.url,
      }),
    );

    if (completed) {
      assertNonEmptyFile(outputPath);
    }
  });
});

/**
 * 실제 다운로드를 실행하고, 네트워크 단절/YouTube 봇 차단처럼 우리 코드가 고칠 수 없는
 * 환경 요인 실패는 경고만 남기고 통과시킨다. 그 외 실패(코드가 원인인 실패)는 그대로 던져
 * 테스트를 실패시키고 pre-push를 막는다.
 */
async function downloadOrSkip(download: () => Promise<void>) {
  try {
    await download();
    return true;
  } catch (error) {
    /** 실패 원인 분류. */
    const diagnostic = getDownloaderDiagnostic(error);

    if (
      diagnostic?.reason &&
      SKIPPABLE_DIAGNOSTIC_REASONS.has(diagnostic.reason)
    ) {
      // eslint-disable-next-line no-console
      console.warn(
        `[real-e2e] 환경 요인으로 스킵합니다 (reason=${diagnostic.reason})`,
      );
      return false;
    }

    throw error;
  }
}

/** 결과 파일이 실제로 만들어졌고 비어있지 않은지 확인한다. */
function assertNonEmptyFile(path: string) {
  expect(existsSync(path)).toBe(true);
  expect(statSync(path).size).toBeGreaterThan(0);
}
