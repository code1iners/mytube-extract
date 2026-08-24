import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  applyYoutubeClientOptions,
  createSafeDiagnosticLog,
  createSafeErrorLog,
  runYoutubeClientPolicy,
  type YoutubeClientFallbackEvent,
  type YoutubeDlExecute,
} from '@mytube-extract/media-downloader';
import { existsSync } from 'fs';
import { exec as youtubeExec } from 'youtube-dl-exec';
import { MediaDownloaderOptions } from './media-download-options';
import { MediaDownloader } from './media-downloader.port';

/** youtube-dl-exec를 API media downloader port 뒤에 격리하는 adapter. */
@Injectable()
export class YoutubeDlMediaDownloader implements MediaDownloader {
  /** API downloader의 fallback 관찰 로그. */
  private readonly logger = new Logger(YoutubeDlMediaDownloader.name);

  constructor(private readonly configService: ConfigService) {}

  /** API의 단일 실행 계약을 공통 yt-dlp runner에 위임한다. */
  async download(options: MediaDownloaderOptions) {
    /** ffmpeg 경로는 호출 옵션을 우선하고 환경 설정을 fallback으로 사용한다. */
    const ffmpegLocation =
      options.ffmpegLocation ?? this.configService.get('FFMPEG_LOCATION');
    /** 실제 존재하는 ffmpeg 경로만 yt-dlp에 전달한다. */
    const availableFfmpegLocation =
      ffmpegLocation && existsSync(ffmpegLocation) ? ffmpegLocation : '';
    /** client와 무관한 API 공통 yt-dlp option. */
    const youtubeOptions = {
      addMetadata: true,
      format: options.format,
      jsRuntimes: 'node' as const,
      output: options.outputPath,
      ...(availableFfmpegLocation
        ? { ffmpegLocation: availableFfmpegLocation }
        : {}),
      ...(options.audioFormat ? { audioFormat: options.audioFormat } : {}),
      ...(options.extractAudio ? { extractAudio: options.extractAudio } : {}),
      ...(options.mergeOutputFormat
        ? { mergeOutputFormat: options.mergeOutputFormat }
        : {}),
    };

    await runYoutubeClientPolicy({
      createYoutubeOptions: (client) =>
        applyYoutubeClientOptions(youtubeOptions, client),
      execute: youtubeExec as unknown as YoutubeDlExecute,
      onFallback: (event) => this.logFallback(event),
      outputPath: options.outputPath,
      signal: options.signal,
      sourceUrl: options.sourceUrl,
    });
  }

  /** URL 없이 client 전환과 성공 결과만 API server log에 남긴다. */
  private logFallback(event: YoutubeClientFallbackEvent) {
    const diagnostic = event.error ? createSafeDiagnosticLog(event.error) : '';
    const errorName = event.error ? createSafeErrorLog(event.error) : '';

    this.logger.warn(
      `YouTube client fallback: outcome=${event.outcome} from=${event.fromClient} to=${event.toClient} attempt=${event.attempt}${
        diagnostic ? ` ${diagnostic}` : errorName ? ` ${errorName}` : ''
      }`,
    );
  }
}
