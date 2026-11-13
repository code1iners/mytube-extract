import { describe, expect, it } from 'vitest';
import {
  DEFAULT_QUALITY_OPTION,
  getQualityOptions,
  getQualityUnit,
  isQualityOption,
  parseQualityOption,
  toDownloadQuality,
} from '../../src/domain/download-options/quality-options';

describe('quality options', () => {
  it('exposes the approved numeric audio and video quality options', () => {
    expect(getQualityOptions('audio')).toEqual([128, 192, 320]);
    expect(getQualityOptions('video')).toEqual([360, 720, 1080]);
  });

  it('accepts only quality values approved for the given mode', () => {
    expect(isQualityOption('audio', 192)).toBe(true);
    expect(isQualityOption('video', 192)).toBe(false);
    expect(isQualityOption('video', 720)).toBe(true);
    expect(isQualityOption('audio', 720)).toBe(false);
  });

  it('rejects non-numeric or out-of-range values', () => {
    expect(isQualityOption('audio', '192')).toBe(false);
    expect(isQualityOption('audio', undefined)).toBe(false);
    expect(isQualityOption('video', 1080.5)).toBe(false);
  });

  it('exposes a default quality per download mode that is itself a valid option', () => {
    expect(isQualityOption('audio', DEFAULT_QUALITY_OPTION.audio)).toBe(true);
    expect(isQualityOption('video', DEFAULT_QUALITY_OPTION.video)).toBe(true);
  });
});

describe('quality value conversion', () => {
  it('names the quality unit of each format', () => {
    expect(getQualityUnit('audio')).toBe(' kbps');
    expect(getQualityUnit('video')).toBe('p');
  });

  it('reads a stored or job quality string back as a fixed option of that format', () => {
    expect(parseQualityOption('audio', '320')).toBe(320);
    expect(parseQualityOption('video', '1080')).toBe(1080);
  });

  it.each([
    ['a quality of the other format', 'video', '192'],
    ['an unsupported value', 'audio', '256'],
    ['a non-number', 'audio', 'high'],
  ] as const)('returns null for %s', (_label, mode, value) => {
    expect(parseQualityOption(mode, value)).toBeNull();
  });

  it('turns a fixed option into the job quality value', () => {
    expect(toDownloadQuality(128)).toBe('128');
    expect(toDownloadQuality(720)).toBe('720');
  });
});
