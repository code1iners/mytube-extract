import { describe, expect, it } from 'vitest';
import { getDownloadJobVideoId } from '../../src/domain/download-job/download-job';

describe('download job video ID', () => {
  it.each([
    ['watch', 'https://www.youtube.com/watch?v=abc123_DEF0&t=42', 'abc123_DEF0'],
    ['Shorts', 'https://www.youtube.com/shorts/abc123_DEF0', 'abc123_DEF0'],
    ['youtu.be', 'https://youtu.be/abc123_DEF0?si=share', 'abc123_DEF0'],
  ])('reads the video ID from a %s source URL', (_label, sourceUrl, expectedVideoId) => {
    expect(getDownloadJobVideoId({ sourceUrl })).toBe(expectedVideoId);
  });

  it('returns null for a job stored without a source URL', () => {
    expect(getDownloadJobVideoId({ sourceUrl: null })).toBeNull();
  });

  it.each([
    ['a non-YouTube URL', 'https://example.com/watch?v=abc123_DEF0'],
    ['a malformed URL', 'not a url'],
    ['a watch URL with an invalid ID', 'https://www.youtube.com/watch?v=short'],
  ])('returns null for %s', (_label, sourceUrl) => {
    expect(getDownloadJobVideoId({ sourceUrl })).toBeNull();
  });
});
