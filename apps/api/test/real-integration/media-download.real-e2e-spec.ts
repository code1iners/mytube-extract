import { ConfigService } from '@nestjs/config';
import { getDownloaderDiagnostic } from '@mytube-extract/media-downloader';
import { execFile } from 'child_process';
import { existsSync, statSync } from 'fs';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import { AudioService } from '../../src/audio/audio.service';
import { MediaDownloadService } from '../../src/media/media-download.service';
import { createUrlMediaSource } from '../../src/media/media-source-policy';
import { YoutubeDlMediaDownloader } from '../../src/media/youtube-dl-media-downloader';
import { VideoService } from '../../src/video/video.service';

/**
 * 이 스위트는 mock 없이 실제 yt-dlp 바이너리로 실제 YouTube 영상을 다운로드한다.
 * `pnpm --filter api run test:e2e:real`로만 실행되며 `test:e2e`(mock e2e)와는 분리돼 있다.
 * 기존 고정 테스트 영상과 이번 fallback 회귀 대상 URL을 같은 direct 경계에서 검증한다.
 */
const REAL_MEDIA_CASES = [
  {
    allowEnvironmentSkip: true,
    description: '기존 고정 영상을 mp4 360p로 다운로드한다',
    expectedFormat: 'bestvideo[height<=360]+bestaudio/best[height<=360]',
    filename: 'real-e2e-video',
    kind: 'video',
    quality: 360,
    url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
  },
  {
    allowEnvironmentSkip: true,
    description: '기존 고정 영상을 mp3 128kbps로 다운로드한다',
    expectedFormat: 'bestaudio[abr<=128]/best[abr<=128]',
    filename: 'real-e2e-audio',
    kind: 'audio',
    quality: 128,
    url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
  },
  {
    allowEnvironmentSkip: false,
    description: 'known-good 영상을 mp3 320kbps로 다운로드한다',
    expectedFormat: 'bestaudio[abr<=320]/best[abr<=320]',
    filename: 'real-e2e-known-good-audio-320',
    kind: 'audio',
    quality: 320,
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  },
  {
    allowEnvironmentSkip: false,
    description: 'known-good 영상을 mp4 1080p로 다운로드한다',
    expectedFormat: 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
    filename: 'real-e2e-known-good-video-1080',
    kind: 'video',
    quality: 1080,
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  },
  {
    allowEnvironmentSkip: false,
    description: '기존 실패 영상을 mp3 320kbps로 다운로드한다',
    expectedFormat: 'bestaudio[abr<=320]/best[abr<=320]',
    filename: 'real-e2e-failed-audio-320',
    kind: 'audio',
    quality: 320,
    url: 'https://youtu.be/a0iBRRoDnDw?si=PGGG5psGrOm34WkG',
  },
  {
    allowEnvironmentSkip: false,
    description: '기존 실패 영상을 mp4 1080p로 다운로드한다',
    expectedFormat: 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
    filename: 'real-e2e-failed-video-1080',
    kind: 'video',
    quality: 1080,
    url: 'https://youtu.be/a0iBRRoDnDw?si=PGGG5psGrOm34WkG',
  },
] as const;

/** ffprobe subprocess 호출 함수. */
const execFileAsync = promisify(execFile);

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

  it.each(REAL_MEDIA_CASES)('$description', async (testCase) => {
    /** API direct 경계에서 service와 downloader 사이에 전달할 검증된 source. */
    const source = createUrlMediaSource(testCase.url);
    /** video service job builder — mediaDownloadService는 이 메서드에서 쓰이지 않는다. */
    const videoService = new VideoService(
      undefined as unknown as MediaDownloadService,
    );
    /** audio service job builder. */
    const audioService = new AudioService(
      undefined as unknown as MediaDownloadService,
    );
    /** 요청 품질에 맞춰 service가 만든 direct media job. */
    const job =
      testCase.kind === 'audio'
        ? audioService.createAudioDownloadJob({
            bitrate: testCase.quality,
            filename: testCase.filename,
            source,
          })
        : videoService.createVideoDownloadJob({
            filename: testCase.filename,
            resolution: testCase.quality,
            source,
          });
    /** yt-dlp가 만들어야 하는 최종 artifact 경로. */
    const outputPath = join(workDir, job.downloadName);
    /** API direct yt-dlp adapter. */
    const downloader = new YoutubeDlMediaDownloader(configService);

    expect(job.format).toBe(testCase.expectedFormat);

    /** 실제 direct media 요청 완료 여부. */
    const completed = await downloadOrSkip(
      () =>
        downloader.download({
          audioFormat: job.audioFormat,
          extractAudio: job.extractAudio,
          format: job.format,
          kind: job.kind,
          mergeOutputFormat: job.mergeOutputFormat,
          outputPath,
          sourceUrl: source.url,
        }),
      testCase.allowEnvironmentSkip,
    );

    if (completed) {
      assertNonEmptyFile(outputPath);
      await assertQualityCap(outputPath, testCase);
    }
  });
});

/**
 * 실제 다운로드를 실행하고, 네트워크 단절/YouTube 봇 차단처럼 우리 코드가 고칠 수 없는
 * 환경 요인 실패는 경고만 남기고 통과시킨다. 그 외 실패(코드가 원인인 실패)는 그대로 던져
 * 테스트를 실패시키고 pre-push를 막는다.
 */
async function downloadOrSkip(
  download: () => Promise<void>,
  allowEnvironmentSkip: boolean,
) {
  try {
    await download();
    return true;
  } catch (error) {
    /** 실패 원인 분류. */
    const diagnostic = getDownloaderDiagnostic(error);

    if (
      allowEnvironmentSkip &&
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

/** ffprobe가 확인한 media stream 품질 메타데이터의 최소 구조. */
type FfprobeOutput = {
  /** media stream 목록. */
  streams?: Array<{
    /** audio bitrate 또는 video height. */
    bit_rate?: string;
    /** video stream 높이. */
    height?: number;
  }>;
  /** stream에 bitrate가 없을 때 사용할 container metadata. */
  format?: {
    /** 전체 container bitrate. */
    bit_rate?: string;
  };
};

/** 실제 artifact의 audio bitrate 또는 video height가 요청 상한 이하인지 확인한다. */
async function assertQualityCap(
  path: string,
  testCase: (typeof REAL_MEDIA_CASES)[number],
) {
  /** 품질 확인에 사용할 ffprobe field. */
  const field = testCase.kind === 'audio' ? 'stream=bit_rate' : 'stream=height';
  /** ffprobe 출력에서 읽을 stream 종류. */
  const stream = testCase.kind === 'audio' ? 'a:0' : 'v:0';
  /** 실제 media metadata. */
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    stream,
    '-show_entries',
    `${field}:format=bit_rate`,
    '-of',
    'json',
    path,
  ]);
  /** ffprobe JSON 결과. */
  const metadata = JSON.parse(stdout) as FfprobeOutput;
  /** 확인할 실제 품질 값. */
  const rawValue =
    testCase.kind === 'audio'
      ? (metadata.streams?.[0]?.bit_rate ?? metadata.format?.bit_rate)
      : metadata.streams?.[0]?.height;
  /** 숫자로 변환한 실제 품질 값. */
  const measuredValue = Number(rawValue);

  expect(Number.isFinite(measuredValue)).toBe(true);

  if (testCase.kind === 'audio') {
    expect(measuredValue).toBeLessThanOrEqual(testCase.quality * 1000);
    return;
  }

  expect(measuredValue).toBeLessThanOrEqual(testCase.quality);
}
