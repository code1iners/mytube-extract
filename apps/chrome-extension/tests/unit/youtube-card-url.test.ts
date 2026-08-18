import { describe, expect, it } from 'vitest';
import { parseStandardYoutubeWatchUrl } from '../../src/features/youtube-overlay/youtube-card-url';

describe('YouTube standard card URL parser', () => {
  it('normalizes standard watch links to a video ID', () => {
    expect(
      parseStandardYoutubeWatchUrl(
        'https://www.youtube.com/watch?v=abc123_DEF0&list=PL123',
      ),
    ).toEqual({
      videoId: 'abc123_DEF0',
      sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
    });
  });

  it('rejects Shorts, non-YouTube links, and malformed IDs', () => {
    expect(
      parseStandardYoutubeWatchUrl(
        'https://www.youtube.com/shorts/abc123_DEF0',
      ),
    ).toBeNull();
    expect(parseStandardYoutubeWatchUrl('https://example.com/watch?v=abc123_DEF0')).toBeNull();
    expect(
      parseStandardYoutubeWatchUrl('https://www.youtube.com/watch?v=invalid'),
    ).toBeNull();
  });
});
