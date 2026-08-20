import { describe, expect, it } from 'vitest';
import {
  DEFAULT_QUALITY_OPTION,
  getQualityOptions,
  isQualityOption,
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
