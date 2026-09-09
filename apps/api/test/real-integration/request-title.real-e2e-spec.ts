import { ConfigService } from '@nestjs/config';
import { ExtractionType, PrismaClient } from '@mytube-extract/db';
import { randomUUID } from 'node:crypto';
import { DownloadsService } from '../../src/downloads/downloads.service';

/** 실제 PostgreSQL과 재사용 결과물의 요청 제목 보존을 검증하는 스위트. */
describe('실제 DB 요청 제목 보존 통합 (PostgreSQL 필요)', () => {
  /** 테스트에 사용할 실제 Prisma client. */
  let prisma: PrismaClient | undefined;
  /** 테스트 실행마다 충돌을 피할 YouTube ID prefix. */
  let runVideoId: string;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        'DATABASE_URL is required for request-title.real-e2e-spec.ts',
      );
    }

    prisma = new PrismaClient();
    await prisma.$connect();
    runVideoId = randomUUID().replaceAll('-', '').slice(0, 11);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('reuses a title, keeps it after asset changes and cleanup, and supports titleless reuse', async () => {
    /** 제목이 확보된 재사용 결과물의 YouTube ID. */
    const titledVideoId = `${runVideoId.slice(0, 9)}A1`;
    /** 제목이 없는 재사용 결과물의 YouTube ID. */
    const titlelessVideoId = `${runVideoId.slice(0, 9)}B2`;
    /** 실제 DB에 연결된 테스트 대상 service. */
    const service = createDownloadsService(prisma!);

    try {
      /** 제목이 있는 재사용 결과물 row. */
      const reusableAsset = await prisma!.extractedAsset.create({
        data: {
          expiresAt: new Date('2099-01-01T00:00:00.000Z'),
          objectKey: `real-test/${titledVideoId}/audio-192.mp3`,
          quality: '192',
          title: 'First acquired title',
          type: ExtractionType.audio,
          videoId: titledVideoId,
        },
      });

      /** 서버 접수 시 결과물 제목을 요청에 복사한 응답. */
      const accepted = await service.create({
        quality: '192',
        type: 'audio',
        url: `https://www.youtube.com/watch?v=${titledVideoId}`,
      });

      expect(accepted).toMatchObject({
        displayStatus: 'completed',
        sourceUrl: `https://www.youtube.com/watch?v=${titledVideoId}`,
        title: 'First acquired title',
      });

      await expect(service.get(accepted.jobId)).resolves.toMatchObject({
        displayStatus: 'completed',
        title: 'First acquired title',
      });

      await prisma!.extractedAsset.update({
        data: {
          expiresAt: new Date('2000-01-01T00:00:00.000Z'),
          title: 'Later asset title',
        },
        where: { id: reusableAsset.id },
      });

      await expect(service.get(accepted.jobId)).resolves.toMatchObject({
        displayStatus: 'expired',
        title: 'First acquired title',
      });

      await prisma!.extractedAsset.delete({
        where: { id: reusableAsset.id },
      });

      await expect(service.get(accepted.jobId)).resolves.toMatchObject({
        displayStatus: 'expired',
        title: 'First acquired title',
      });

      await prisma!.extractedAsset.create({
        data: {
          expiresAt: new Date('2099-01-01T00:00:00.000Z'),
          objectKey: `real-test/${titlelessVideoId}/audio-192.mp3`,
          quality: '192',
          title: null,
          type: ExtractionType.audio,
          videoId: titlelessVideoId,
        },
      });

      /** 제목 없는 결과물을 재사용한 접수 응답. */
      const titlelessAccepted = await service.create({
        quality: '192',
        type: 'audio',
        url: `https://www.youtube.com/watch?v=${titlelessVideoId}`,
      });

      expect(titlelessAccepted).toMatchObject({
        displayStatus: 'completed',
        sourceUrl: `https://www.youtube.com/watch?v=${titlelessVideoId}`,
        title: null,
      });
      await expect(service.get(titlelessAccepted.jobId)).resolves.toMatchObject(
        {
          displayStatus: 'completed',
          sourceUrl: `https://www.youtube.com/watch?v=${titlelessVideoId}`,
          title: null,
        },
      );
    } finally {
      await prisma!.extractionJob.deleteMany({
        where: { videoId: { in: [titledVideoId, titlelessVideoId] } },
      });
      await prisma!.extractedAsset.deleteMany({
        where: { videoId: { in: [titledVideoId, titlelessVideoId] } },
      });
    }
  });
});

/** 실제 PostgreSQL에 연결된 service를 테스트 대역과 함께 만든다. */
function createDownloadsService(prisma: PrismaClient) {
  /** 테스트에서 사용할 R2 object 존재 확인 대역. */
  const r2Storage = {
    objectExists: async () => true,
  };
  /** 테스트에서 사용할 보관 기간 설정 대역. */
  const config = {
    get: (key: string) => (key === 'ASSET_RETENTION_DAYS' ? '7' : undefined),
  } as unknown as ConfigService;

  return new DownloadsService(prisma as never, config, r2Storage as never);
}
