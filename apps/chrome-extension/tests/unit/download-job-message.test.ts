import { describe, expect, it } from 'vitest';
import {
  DOWNLOAD_JOB_SUBMIT_MESSAGE_TYPE,
  isDownloadJobSubmitRequest,
} from '../../src/features/download-jobs/download-job-message';

describe('download job submit request guard', () => {
  it('accepts a well-formed submit request', () => {
    expect(
      isDownloadJobSubmitRequest({
        type: DOWNLOAD_JOB_SUBMIT_MESSAGE_TYPE,
        apiBaseUrl: 'https://mytube-extract-api.codeliners.cc',
        localFilename: 'my clip',
        mode: 'audio',
        quality: '192',
        sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
      }),
    ).toBe(true);
  });

  it('accepts an empty localFilename', () => {
    expect(
      isDownloadJobSubmitRequest({
        type: DOWNLOAD_JOB_SUBMIT_MESSAGE_TYPE,
        apiBaseUrl: 'https://mytube-extract-api.codeliners.cc',
        localFilename: '',
        mode: 'video',
        quality: '720',
        sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
      }),
    ).toBe(true);
  });

  it('rejects a different message type', () => {
    expect(
      isDownloadJobSubmitRequest({
        type: 'some-other-message',
        apiBaseUrl: 'https://mytube-extract-api.codeliners.cc',
        localFilename: '',
        mode: 'audio',
        quality: '192',
        sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
      }),
    ).toBe(false);
  });

  it('rejects an unsupported mode', () => {
    expect(
      isDownloadJobSubmitRequest({
        type: DOWNLOAD_JOB_SUBMIT_MESSAGE_TYPE,
        apiBaseUrl: 'https://mytube-extract-api.codeliners.cc',
        localFilename: '',
        mode: 'both',
        quality: '192',
        sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
      }),
    ).toBe(false);
  });

  it('rejects a quality value that is not a fixed download quality', () => {
    expect(
      isDownloadJobSubmitRequest({
        type: DOWNLOAD_JOB_SUBMIT_MESSAGE_TYPE,
        apiBaseUrl: 'https://mytube-extract-api.codeliners.cc',
        localFilename: '',
        mode: 'audio',
        quality: '256',
        sourceUrl: 'https://www.youtube.com/watch?v=abc123_DEF0',
      }),
    ).toBe(false);
  });

  it('rejects non-record values', () => {
    expect(isDownloadJobSubmitRequest(null)).toBe(false);
    expect(isDownloadJobSubmitRequest('nope')).toBe(false);
    expect(isDownloadJobSubmitRequest(undefined)).toBe(false);
  });
});
