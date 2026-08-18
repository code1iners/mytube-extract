import { describe, expect, it } from 'vitest';
import {
  getYoutubeOverlayQualityOptions,
  isYoutubeOverlayQuality,
} from '../../src/features/youtube-overlay/quality-options';
import {
  createYoutubeOverlayDownloadOptions,
  sanitizeYoutubeOverlayFilename,
} from '../../src/features/youtube-overlay/youtube-overlay-download';
import {
  isYoutubeOverlayDownloadRequest,
  YOUTUBE_OVERLAY_DOWNLOAD_MESSAGE_TYPE,
} from '../../src/features/youtube-overlay/youtube-overlay-message';

describe('YouTube overlay contract', () => {
  it('exposes the approved numeric audio and video quality options', () => {
    expect(getYoutubeOverlayQualityOptions('audio')).toEqual([128, 192, 320]);
    expect(getYoutubeOverlayQualityOptions('video')).toEqual([360, 720, 1080]);
    expect(isYoutubeOverlayQuality('audio', 192)).toBe(true);
    expect(isYoutubeOverlayQuality('video', 192)).toBe(false);
  });

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
