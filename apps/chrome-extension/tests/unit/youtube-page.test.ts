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

  it('supports channel home, videos tab and in-channel search', () => {
    expect(isSupportedYoutubePagePath('/@handle')).toBe(true);
    expect(isSupportedYoutubePagePath('/@handle/')).toBe(true);
    expect(isSupportedYoutubePagePath('/@handle/featured')).toBe(true);
    expect(isSupportedYoutubePagePath('/@handle/videos')).toBe(true);
    expect(isSupportedYoutubePagePath('/@handle/search')).toBe(true);
    expect(
      isSupportedYoutubePageUrl(
        'https://www.youtube.com/@handle/search?query=music',
      ),
    ).toBe(true);
    expect(
      isSupportedYoutubePagePath('/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw/videos'),
    ).toBe(true);
    expect(isSupportedYoutubePagePath('/c/SomeName')).toBe(true);
    expect(isSupportedYoutubePagePath('/user/SomeName/videos')).toBe(true);
  });

  it('excludes other channel tabs and non-channel pages', () => {
    expect(isSupportedYoutubePagePath('/@handle/shorts')).toBe(false);
    expect(isSupportedYoutubePagePath('/@handle/streams')).toBe(false);
    expect(isSupportedYoutubePagePath('/@handle/playlists')).toBe(false);
    expect(isSupportedYoutubePagePath('/@handle/videos/extra')).toBe(false);
    expect(isSupportedYoutubePagePath('/@')).toBe(false);
    expect(isSupportedYoutubePagePath('/channel')).toBe(false);
    expect(isSupportedYoutubePagePath('/playlist')).toBe(false);
    expect(isSupportedYoutubePagePath('/feed/history')).toBe(false);
  });
});
