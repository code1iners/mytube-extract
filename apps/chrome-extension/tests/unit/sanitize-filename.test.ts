import { describe, expect, it } from 'vitest';
import { sanitizeFilenameSegment } from '../../src/shared/sanitize-filename';

describe('sanitizeFilenameSegment', () => {
  it('replaces path separators with spaces', () => {
    expect(sanitizeFilenameSegment('a/b\\c')).toBe('a b c');
  });

  it('replaces control characters with spaces', () => {
    expect(sanitizeFilenameSegment('a\rb\nc')).toBe('a b c');
  });

  it('collapses repeated whitespace and trims the result', () => {
    expect(sanitizeFilenameSegment('  my   clip  ')).toBe('my clip');
  });

  it('keeps regular unicode text untouched', () => {
    expect(sanitizeFilenameSegment('영상 제목: 라이브')).toBe('영상 제목: 라이브');
  });
});
