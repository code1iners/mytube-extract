import { ConfigService } from '@nestjs/config';
import { runYoutubeClientPolicy } from '@mytube-extract/media-downloader';
import { existsSync } from 'fs';
import { exec as youtubeExec } from 'youtube-dl-exec';
import { YoutubeDlMediaDownloader } from './youtube-dl-media-downloader';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
}));

jest.mock('youtube-dl-exec', () => ({
  exec: jest.fn(),
}));

jest.mock('@mytube-extract/media-downloader', () => ({
  ...jest.requireActual('@mytube-extract/media-downloader'),
  runYoutubeClientPolicy: jest.fn(),
}));

describe('YoutubeDlMediaDownloader', () => {
  /** API downloader adapter. */
  let downloader: YoutubeDlMediaDownloader;
  /** injected YouTube client policy mock. */
  const runYoutubeClientPolicyMock = jest.mocked(runYoutubeClientPolicy);
  /** original yt-dlp process starter. */
  const youtubeExecMock = jest.mocked(youtubeExec);
  /** configured ffmpeg path existence check. */
  const existsSyncMock = jest.mocked(existsSync);

  beforeEach(() => {
    jest.clearAllMocks();
    existsSyncMock.mockReturnValue(true);
    runYoutubeClientPolicyMock.mockResolvedValue();

    downloader = new YoutubeDlMediaDownloader({
      get: jest.fn().mockReturnValue('/usr/bin/ffmpeg'),
    } as unknown as ConfigService);
  });

  it('delegates the base options and client factory to the shared policy', async () => {
    await expect(
      downloader.download({
        audioFormat: 'mp3',
        extractAudio: true,
        format: 'bestaudio/best',
        kind: 'audio',
        outputPath: '/tmp/sample.mp3',
        sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
      }),
    ).resolves.toBeUndefined();

    expect(runYoutubeClientPolicyMock).toHaveBeenCalledTimes(1);
    expect(runYoutubeClientPolicyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        execute: youtubeExecMock,
        outputPath: '/tmp/sample.mp3',
        sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
      }),
    );
    /** shared policy input captured from the API adapter. */
    const policyInput = runYoutubeClientPolicyMock.mock.calls[0]?.[0];
    const defaultOptions = policyInput?.createYoutubeOptions('default');
    const fallbackOptions = policyInput?.createYoutubeOptions('web_embedded');

    expect(defaultOptions).toEqual({
      addMetadata: true,
      audioFormat: 'mp3',
      extractAudio: true,
      ffmpegLocation: '/usr/bin/ffmpeg',
      format: 'bestaudio/best',
      jsRuntimes: 'node',
      output: '/tmp/sample.mp3',
    });
    expect(fallbackOptions).toMatchObject({
      extractorArgs: 'youtube:player_client=web_embedded',
    });
    expect(defaultOptions).not.toHaveProperty('ignoreErrors');
  });

  it('omits a configured ffmpeg path that does not exist locally', async () => {
    existsSyncMock.mockReturnValue(false);

    await downloader.download({
      format: 'bestvideo+bestaudio/best',
      kind: 'video',
      mergeOutputFormat: 'mp4',
      outputPath: '/tmp/sample.mp4',
      sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
    });

    expect(runYoutubeClientPolicyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        createYoutubeOptions: expect.any(Function),
      }),
    );
    expect(
      runYoutubeClientPolicyMock.mock.calls[0]?.[0].createYoutubeOptions(
        'default',
      ),
    ).not.toHaveProperty('ffmpegLocation', '/usr/bin/ffmpeg');
  });

  it('forwards abort signals to the shared runner without adding API retries', async () => {
    /** API request cancellation signal. */
    const abortController = new AbortController();

    await downloader.download({
      format: 'bestaudio/best',
      kind: 'audio',
      outputPath: '/tmp/sample.mp3',
      signal: abortController.signal,
      sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
    });

    expect(runYoutubeClientPolicyMock).toHaveBeenCalledTimes(1);
    expect(runYoutubeClientPolicyMock).toHaveBeenCalledWith(
      expect.objectContaining({ signal: abortController.signal }),
    );
  });
});
