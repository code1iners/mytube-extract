import { BadRequestException } from '@nestjs/common';
import { ExtractionType } from '@mytube-extract/db';
import {
  createAssetObjectKey,
  createCanonicalYoutubeUrl,
  createDownloadUrl,
  parseDownloadQuality,
  parseDownloadType,
  parseYoutubeVideoId,
} from './downloads.util';

describe('parseYoutubeVideoId', () => {
  it('extracts the video ID from a youtu.be short URL', () => {
    expect(parseYoutubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    );
  });

  it('extracts the video ID from a youtube.com watch URL', () => {
    expect(
      parseYoutubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    ).toBe('dQw4w9WgXcQ');
  });

  it('extracts the video ID from a youtube.com shorts URL', () => {
    expect(parseYoutubeVideoId('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    );
  });

  it('rejects a missing URL', () => {
    expect(() => parseYoutubeVideoId(undefined)).toThrow(BadRequestException);
  });

  it('rejects an unparsable URL', () => {
    expect(() => parseYoutubeVideoId('not a url')).toThrow(BadRequestException);
  });

  it('rejects an unsupported host', () => {
    expect(() => parseYoutubeVideoId('https://vimeo.com/12345')).toThrow(
      BadRequestException,
    );
  });

  it('rejects a malformed video ID', () => {
    expect(() =>
      parseYoutubeVideoId('https://www.youtube.com/watch?v=short'),
    ).toThrow(BadRequestException);
  });
});

describe('createCanonicalYoutubeUrl', () => {
  it('builds a canonical watch URL from a video ID', () => {
    expect(createCanonicalYoutubeUrl('dQw4w9WgXcQ')).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );
  });
});

describe('parseDownloadType', () => {
  it('passes through a valid type', () => {
    expect(parseDownloadType(ExtractionType.audio)).toBe(ExtractionType.audio);
  });

  it('rejects an unsupported type', () => {
    expect(() => parseDownloadType('image')).toThrow(BadRequestException);
  });
});

describe('parseDownloadQuality', () => {
  it('returns the default audio quality when omitted', () => {
    expect(parseDownloadQuality(ExtractionType.audio, undefined)).toBe('320');
  });

  it('returns the default video quality for the legacy "default" value', () => {
    expect(parseDownloadQuality(ExtractionType.video, 'default')).toBe('1080');
  });

  it('accepts a supported audio quality', () => {
    expect(parseDownloadQuality(ExtractionType.audio, '192')).toBe('192');
  });

  it('rejects a quality unsupported for the given type', () => {
    // "1080"은 video 전용 값이라 audio 요청에서는 거부되어야 한다.
    expect(() => parseDownloadQuality(ExtractionType.audio, '1080')).toThrow(
      BadRequestException,
    );
  });
});

describe('createAssetObjectKey', () => {
  it('builds an mp3 key for audio', () => {
    expect(
      createAssetObjectKey('dQw4w9WgXcQ', ExtractionType.audio, '192'),
    ).toBe('extracts/dQw4w9WgXcQ/audio-192.mp3');
  });

  it('builds an mp4 key for video', () => {
    expect(
      createAssetObjectKey('dQw4w9WgXcQ', ExtractionType.video, '720'),
    ).toBe('extracts/dQw4w9WgXcQ/video-720.mp4');
  });
});

describe('createDownloadUrl', () => {
  it('joins a base URL and object key without doubling slashes', () => {
    expect(
      createDownloadUrl(
        'https://cdn.example.invalid/',
        '/extracts/a/audio-192.mp3',
      ),
    ).toBe('https://cdn.example.invalid/extracts/a/audio-192.mp3');
  });

  it('joins a base URL without a trailing slash', () => {
    expect(
      createDownloadUrl(
        'https://cdn.example.invalid',
        'extracts/a/audio-192.mp3',
      ),
    ).toBe('https://cdn.example.invalid/extracts/a/audio-192.mp3');
  });
});
