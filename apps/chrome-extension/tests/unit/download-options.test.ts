import { describe, expect, it } from 'vitest';
import { mergeStoredDownloadOptions } from '../../src/domain/download-options/download-options';

describe('mergeStoredDownloadOptions', () => {
  it('keeps stored bitrate and resolution when they are valid fixed quality options', () => {
    expect(
      mergeStoredDownloadOptions({ bitrate: '320', resolution: '1080' }),
    ).toMatchObject({ bitrate: '320', resolution: '1080' });
  });

  it('falls back to the audio default when the stored bitrate is not a fixed option', () => {
    expect(mergeStoredDownloadOptions({ bitrate: '256' })).toMatchObject({
      bitrate: '192',
    });
    expect(mergeStoredDownloadOptions({ bitrate: 'not-a-number' })).toMatchObject({
      bitrate: '192',
    });
  });

  it('falls back to the video default when the stored resolution is not a fixed option', () => {
    expect(mergeStoredDownloadOptions({ resolution: '480' })).toMatchObject({
      resolution: '720',
    });
    expect(mergeStoredDownloadOptions({ resolution: 'not-a-number' })).toMatchObject({
      resolution: '720',
    });
  });

  it('falls back to the fixed defaults when no bitrate or resolution was ever stored', () => {
    expect(mergeStoredDownloadOptions({})).toMatchObject({
      bitrate: '192',
      resolution: '720',
    });
  });
});
