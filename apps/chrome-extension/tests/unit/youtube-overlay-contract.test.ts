import { describe, expect, it } from 'vitest';
import {
  createYoutubeOverlayDownloadOptions,
  sanitizeYoutubeOverlayFilename,
} from '../../src/features/youtube-overlay/youtube-overlay-download';
import {
  isYoutubeOverlayDownloadRequest,
  YOUTUBE_OVERLAY_DOWNLOAD_MESSAGE_TYPE,
} from '../../src/features/youtube-overlay/youtube-overlay-message';

describe('YouTube overlay contract', () => {
  // 고정 품질 선택지 자체는 tests/unit/quality-options.test.ts에서 검증한다.

  it('accepts only validated overlay download messages', () => {
    expect(
      isYoutubeOverlayDownloadRequest({
        type: YOUTUBE_OVERLAY_DOWNLOAD_MESSAGE_TYPE,
        mode: 'audio',
        quality: 192,
        title: 'Example title',
        videoId: 'abc123_DEF0',
      }),
    ).toBe(true);

    expect(
      isYoutubeOverlayDownloadRequest({
        type: YOUTUBE_OVERLAY_DOWNLOAD_MESSAGE_TYPE,
        mode: 'video',
        quality: 192,
        title: 'Example title',
        videoId: 'abc123_DEF0',
      }),
    ).toBe(false);

    expect(
      isYoutubeOverlayDownloadRequest({
        type: YOUTUBE_OVERLAY_DOWNLOAD_MESSAGE_TYPE,
        mode: 'audio',
        quality: 320,
        title: 'Example title',
        videoId: 'invalid',
      }),
    ).toBe(false);
  });

  it('creates an API-compatible download option from a YouTube card', () => {
    const options = createYoutubeOverlayDownloadOptions({
      mode: 'audio',
      quality: 192,
      title: 'A / B: live\nrecording',
      videoId: 'abc123_DEF0',
    });

    expect(options).toMatchObject({
      bitrate: '192',
      filename: 'A B: live recording',
      mode: 'audio',
      resolution: '',
      sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
    });
  });

  it('falls back to the video ID when the title cannot be used as a filename', () => {
    expect(sanitizeYoutubeOverlayFilename(' /\\\n\r\0 ', 'abc123_DEF0')).toBe('abc123_DEF0');
    expect(sanitizeYoutubeOverlayFilename('..', 'abc123_DEF0')).toBe('abc123_DEF0');
  });
});
