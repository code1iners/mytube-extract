import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addJobReceipt,
  acceptJobReceipt,
  listJobReceipts,
  parseJobReceiptStorageKey,
  removeJobReceipt,
} from '../../src/app/utils/job-receipt.util';

const VIDEO_ID = '4f8f82b3-cf37-4e31-9d56-d27eb526a922';
const SUBTITLE_ID = '067b084b-c84a-4574-952f-950cb8fa2157';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('job receipt', () => {
  it('parses only exact receipt storage keys', () => {
    expect(
      parseJobReceiptStorageKey(
        `mytube-extract:job-receipt:v2:video:${VIDEO_ID}`,
      ),
    ).toEqual({ kind: 'video', jobId: VIDEO_ID });
    expect(parseJobReceiptStorageKey(null)).toBeNull();
    expect(
      parseJobReceiptStorageKey(
        `mytube-extract:job-receipt:v2:audio:${VIDEO_ID}`,
      ),
    ).toBeNull();
    expect(
      parseJobReceiptStorageKey(
        `mytube-extract:job-receipt:v2:video:${VIDEO_ID}:extra`,
      ),
    ).toBeNull();
    expect(
      parseJobReceiptStorageKey('mytube-extract:job-receipt:v2:video:not-a-uuid'),
    ).toBeNull();
  });

  it('adds valid receipts and lists them newest first without duplicates', () => {
    const storage = createStorage();
    vi.stubGlobal('localStorage', storage);

    expect(addJobReceipt('video', VIDEO_ID, '2026-08-11T00:00:00.000Z')).toBe(true);
    expect(addJobReceipt('subtitle', SUBTITLE_ID, '2026-08-11T01:00:00.000Z')).toBe(true);
    expect(addJobReceipt('video', VIDEO_ID, '2026-08-11T02:00:00.000Z')).toBe(true);

    expect(listJobReceipts()).toEqual({
      receipts: [
        { kind: 'video', jobId: VIDEO_ID, acceptedAt: '2026-08-11T02:00:00.000Z' },
        { kind: 'subtitle', jobId: SUBTITLE_ID, acceptedAt: '2026-08-11T01:00:00.000Z' },
      ],
      storageAvailable: true,
    });
  });

  it('removes exactly one receipt and preserves other IDs', () => {
    const storage = createStorage();
    vi.stubGlobal('localStorage', storage);
    addJobReceipt('video', VIDEO_ID, '2026-08-11T00:00:00.000Z');
    addJobReceipt('subtitle', SUBTITLE_ID, '2026-08-11T01:00:00.000Z');

    expect(removeJobReceipt('video', VIDEO_ID)).toBe(true);
    expect(listJobReceipts().receipts).toEqual([
      { kind: 'subtitle', jobId: SUBTITLE_ID, acceptedAt: '2026-08-11T01:00:00.000Z' },
    ]);
  });

  it('stores an accepted job and creates its exact history deep link', () => {
    vi.stubGlobal('localStorage', createStorage());

    expect(acceptJobReceipt('subtitle', SUBTITLE_ID)).toEqual({
      storageFailed: false,
      to: `/history?kind=subtitle&jobId=${SUBTITLE_ID}`,
    });
    expect(listJobReceipts().receipts).toHaveLength(1);
  });

  it('keeps only the newest 20 valid receipts', () => {
    const storage = createStorage();
    vi.stubGlobal('localStorage', storage);

    for (let index = 0; index < 21; index += 1) {
      addJobReceipt(
        'video',
        `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        new Date(Date.UTC(2026, 7, 11, 0, index)).toISOString(),
      );
    }

    const receipts = listJobReceipts().receipts;
    expect(receipts).toHaveLength(20);
    expect(receipts[0]?.jobId).toBe('00000000-0000-4000-8000-000000000020');
    expect(receipts.at(-1)?.jobId).toBe('00000000-0000-4000-8000-000000000001');
  });

  it('isolates malformed keys and values without touching unrelated storage', () => {
    const storage = createStorage({
      'mytube-extract:job-receipt:v2:video:not-a-uuid': JSON.stringify({ acceptedAt: '2026-08-11T00:00:00.000Z' }),
      [`mytube-extract:job-receipt:v2:subtitle:${SUBTITLE_ID}`]: '{bad json',
      unrelated: 'keep-me',
    });
    vi.stubGlobal('localStorage', storage);

    expect(listJobReceipts()).toEqual({ receipts: [], storageAvailable: true });
    expect(storage.getItem('unrelated')).toBe('keep-me');
    expect(storage.length).toBe(1);
  });

  it('rejects invalid input and survives storage access exceptions', () => {
    const storage = createStorage();
    vi.stubGlobal('localStorage', storage);

    expect(addJobReceipt('video', 'not-a-uuid', '2026-08-11T00:00:00.000Z')).toBe(false);
    expect(addJobReceipt('video', VIDEO_ID, 'not-a-date')).toBe(false);

    vi.stubGlobal('localStorage', createThrowingStorage());
    expect(listJobReceipts()).toEqual({ receipts: [], storageAvailable: false });
    expect(addJobReceipt('subtitle', SUBTITLE_ID)).toBe(false);
    expect(acceptJobReceipt('subtitle', SUBTITLE_ID)).toEqual({
      storageFailed: true,
      to: `/history?kind=subtitle&jobId=${SUBTITLE_ID}`,
    });
    expect(removeJobReceipt('subtitle', SUBTITLE_ID)).toBe(false);
  });
});

function createStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial));

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

function createThrowingStorage(): Storage {
  const fail = () => {
    throw new DOMException('Storage is disabled.', 'SecurityError');
  };

  return {
    get length() {
      return fail();
    },
    clear: fail,
    getItem: fail,
    key: fail,
    removeItem: fail,
    setItem: fail,
  };
}
