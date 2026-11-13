import { describe, expect, it } from 'vitest';
import { buildTitleFilenameStem, sanitizeFilenameSegment } from '../../src/shared/sanitize-filename';

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

describe('buildTitleFilenameStem', () => {
  it('uses the sanitized title as the filename stem', () => {
    expect(buildTitleFilenameStem('A / B: live\nrecording', 'abc123_DEF0')).toBe('A B: live recording');
  });

  it('falls back to the given stem when the title cannot be used as a filename', () => {
    expect(buildTitleFilenameStem(' /\\\n\r\0 ', 'abc123_DEF0')).toBe('abc123_DEF0');
    expect(buildTitleFilenameStem('..', 'abc123_DEF0')).toBe('abc123_DEF0');
  });
});
