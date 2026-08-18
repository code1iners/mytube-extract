import { describe, expect, it } from 'vitest';
import {
  isSupportedYoutubePagePath,
  isSupportedYoutubePageUrl,
} from '../../src/features/youtube-overlay/youtube-page';

describe('YouTube overlay page scope', () => {
  it('supports the four standard YouTube surfaces', () => {
    expect(isSupportedYoutubePageUrl('https://www.youtube.com/')).toBe(true);
    expect(
      isSupportedYoutubePageUrl(
        'https://www.youtube.com/results?search_query=music',
      ),
    ).toBe(true);
    expect(
      isSupportedYoutubePageUrl(
        'https://www.youtube.com/feed/subscriptions',
      ),
    ).toBe(true);
    expect(
      isSupportedYoutubePageUrl(
        'https://www.youtube.com/watch?v=abc123_DEF0',
      ),
    ).toBe(true);
  });

  it('excludes Shorts and non-YouTube pages', () => {
    expect(
      isSupportedYoutubePageUrl('https://www.youtube.com/shorts/abc123_DEF0'),
    ).toBe(false);
    expect(isSupportedYoutubePageUrl('https://example.com/')).toBe(false);
  });

  it('excludes Shorts during YouTube SPA navigation', () => {
    expect(isSupportedYoutubePagePath('/')).toBe(true);
    expect(isSupportedYoutubePagePath('/watch')).toBe(true);
    expect(isSupportedYoutubePagePath('/shorts/abc123_DEF0')).toBe(false);
  });
});
