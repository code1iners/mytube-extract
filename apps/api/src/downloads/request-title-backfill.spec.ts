import { backfillRequestTitles } from './request-title-backfill';

describe('backfillRequestTitles', () => {
  /** 이관 함수가 사용하는 Prisma extractionJob 대역. */
  const clientMock = {
    extractionJob: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('copies only valid asset titles into untitled requests', async () => {
    clientMock.extractionJob.findMany.mockResolvedValueOnce([
      {
        asset: { title: '  Legacy asset title  ' },
        id: 'missing-title',
        title: null,
      },
      {
        asset: { title: 'Later asset title' },
        id: 'existing-title',
        title: 'First request title',
      },
      {
        asset: { title: '   ' },
        id: 'blank-asset-title',
        title: null,
      },
      {
        asset: null,
        id: 'missing-asset',
        title: null,
      },
    ]);
    clientMock.extractionJob.updateMany.mockResolvedValueOnce({ count: 1 });

    await expect(
      backfillRequestTitles(clientMock as never, { apply: true }),
    ).resolves.toEqual({
      candidates: 1,
      scanned: 4,
      updated: 1,
    });
    expect(clientMock.extractionJob.updateMany).toHaveBeenCalledWith({
      data: { title: 'Legacy asset title' },
      where: { id: 'missing-title', title: null },
    });
  });

  it('supports a dry run without changing rows', async () => {
    clientMock.extractionJob.findMany.mockResolvedValueOnce([
      {
        asset: { title: 'Legacy asset title' },
        id: 'missing-title',
        title: '   ',
      },
    ]);

    await expect(backfillRequestTitles(clientMock as never)).resolves.toEqual({
      candidates: 1,
      scanned: 1,
      updated: 0,
    });
    expect(clientMock.extractionJob.updateMany).not.toHaveBeenCalled();
  });
});
