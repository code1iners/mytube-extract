import { ConfigService } from '@nestjs/config';
import {
  ExtractionJobStatus,
  ExtractionType,
  PrismaClient,
} from '@mytube-extract/db';
import { randomUUID } from 'node:crypto';
import { DownloadsService } from '../../src/downloads/downloads.service';
import {
  processDownloadJob,
  type DownloadJobProcessorDependencies,
} from '../../../worker/src/download-job-processor';
import { saveRequestTitleIfMissing } from '../../../worker/src/request-title-store';

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

  it('exposes a title before download completes and keeps it after extraction failure', async () => {
    /** 제목 조기 저장을 확인할 테스트 job의 YouTube ID. */
    const videoId = `${runVideoId.slice(0, 9)}C3`;
    /** 제목이 조기 저장된 뒤 다운로드를 멈출 요청 URL. */
    const sourceUrl = `https://www.youtube.com/watch?v=${videoId}`;
    /** 실제 DB에 연결된 상태 조회 service. */
    const service = createDownloadsService(prisma!);
    /** 제목 확보 후 다운로드를 멈출 테스트 job. */
    const job = await prisma!.extractionJob.create({
      data: {
        quality: '320',
        status: ExtractionJobStatus.processing,
        title: null,
        type: ExtractionType.audio,
        url: sourceUrl,
        videoId,
      },
    });
    /** 다운로드 시작을 관찰할 promise. */
    let resolveDownloadStarted!: () => void;
    const downloadStarted = new Promise<void>((resolve) => {
      resolveDownloadStarted = resolve;
    });
    /** 다운로드 실패를 재개할 함수. */
    let releaseDownload!: () => void;
    const downloadRelease = new Promise<void>((resolve) => {
      releaseDownload = resolve;
    });
    /** 제목을 확보한 뒤 발생시킬 추출 오류. */
    const extractionError = new Error('controlled extraction failure');
    /** 실제 DB 저장 경계를 사용하는 처리 의존성. */
    const dependencies = createDatabaseProcessorDependencies(prisma!);
    dependencies.readTitle = async () => 'Acquired before extraction';
    dependencies.download = async () => {
      resolveDownloadStarted();
      await downloadRelease;
      throw extractionError;
    };
    /** 제목 조기 저장을 확인할 처리 promise. */
    let processing: Promise<void> | undefined;

    try {
      /** 제목 조회·저장·다운로드를 실제 처리 경계로 시작한다. */
      processing = processDownloadJob(job, dependencies);

      await downloadStarted;
      await expect(
        prisma!.extractionJob.findUnique({
          select: { status: true, title: true },
          where: { id: job.id },
        }),
      ).resolves.toEqual({
        status: ExtractionJobStatus.processing,
        title: 'Acquired before extraction',
      });
      await expect(service.get(job.id)).resolves.toMatchObject({
        displayStatus: 'processing',
        sourceUrl,
        title: 'Acquired before extraction',
      });

      releaseDownload();
      await processing;

      await expect(service.get(job.id)).resolves.toMatchObject({
        displayStatus: 'failed',
        sourceUrl,
        title: 'Acquired before extraction',
      });
    } finally {
      releaseDownload();
      await processing?.catch(() => undefined);
      await prisma!.extractionJob.deleteMany({ where: { id: job.id } });
    }
  });

  it('keeps a title when upload fails after title acquisition', async () => {
    /** 업로드 실패 후 제목 보존을 확인할 audio job의 YouTube ID. */
    const videoId = `${runVideoId.slice(0, 9)}G7`;
    /** 업로드 실패 요청의 canonical YouTube URL. */
    const sourceUrl = `https://www.youtube.com/watch?v=${videoId}`;
    /** 실제 DB에 연결된 상태 조회 service. */
    const service = createDownloadsService(prisma!);
    /** 제목 확보 후 업로드에서 실패할 테스트 job. */
    const job = await prisma!.extractionJob.create({
      data: {
        quality: '192',
        status: ExtractionJobStatus.processing,
        title: null,
        type: ExtractionType.audio,
        url: sourceUrl,
        videoId,
      },
    });
    /** 제목 확보·업로드 실패를 제어할 실제 DB 처리 의존성. */
    const dependencies = createDatabaseProcessorDependencies(prisma!);
    dependencies.readTitle = async () => 'Acquired before upload';
    dependencies.upload = async () => {
      throw new Error('controlled upload failure');
    };

    try {
      await processDownloadJob(job, dependencies);

      await expect(service.get(job.id)).resolves.toMatchObject({
        displayStatus: 'failed',
        sourceUrl,
        title: 'Acquired before upload',
      });
    } finally {
      await prisma!.extractionJob.deleteMany({ where: { id: job.id } });
      await prisma!.extractedAsset.deleteMany({ where: { videoId } });
    }
  });

  it('continues extraction without a title and preserves the source link', async () => {
    /** 제목 조회 실패를 확인할 테스트 job의 YouTube ID. */
    const videoId = `${runVideoId.slice(0, 9)}D4`;
    /** 제목 없는 요청의 canonical YouTube URL. */
    const sourceUrl = `https://www.youtube.com/watch?v=${videoId}`;
    /** 제목 조회 실패 후에도 완료되어야 하는 테스트 job. */
    const job = await prisma!.extractionJob.create({
      data: {
        quality: '192',
        status: ExtractionJobStatus.processing,
        title: null,
        type: ExtractionType.audio,
        url: sourceUrl,
        videoId,
      },
    });
    /** 실제 DB 저장 경계를 사용하는 처리 의존성. */
    const dependencies = createDatabaseProcessorDependencies(prisma!);
    dependencies.readTitle = async () => null;

    try {
      await processDownloadJob(job, dependencies);

      await expect(
        createDownloadsService(prisma!).get(job.id),
      ).resolves.toMatchObject({
        displayStatus: 'completed',
        sourceUrl,
        title: null,
      });
      await expect(
        prisma!.extractedAsset.findUnique({
          where: {
            videoId_type_quality: {
              quality: '192',
              type: ExtractionType.audio,
              videoId,
            },
          },
        }),
      ).resolves.toMatchObject({ title: null });
    } finally {
      await prisma!.extractionJob.deleteMany({ where: { id: job.id } });
      await prisma!.extractedAsset.deleteMany({ where: { videoId } });
    }
  });

  it('keeps the source link when processing fails before title acquisition', async () => {
    /** 제목 확보 전 실패를 확인할 video job의 YouTube ID. */
    const videoId = `${runVideoId.slice(0, 9)}E5`;
    /** preflight 실패 요청의 canonical YouTube URL. */
    const sourceUrl = `https://www.youtube.com/watch?v=${videoId}`;
    /** 제목 확보 전에 실패해야 하는 video job. */
    const job = await prisma!.extractionJob.create({
      data: {
        quality: '720',
        status: ExtractionJobStatus.processing,
        title: null,
        type: ExtractionType.video,
        url: sourceUrl,
        videoId,
      },
    });
    /** 제목 조회 실행 여부. */
    let titleLookupCalled = false;
    /** 실제 DB 저장 경계를 사용하는 처리 의존성. */
    const dependencies = createDatabaseProcessorDependencies(prisma!);
    dependencies.runVideoPreflight = async () => {
      throw new Error('controlled preflight failure');
    };
    dependencies.readTitle = async () => {
      titleLookupCalled = true;
      return 'Title must not be saved';
    };

    try {
      await processDownloadJob(job, dependencies);

      expect(titleLookupCalled).toBe(false);
      await expect(
        createDownloadsService(prisma!).get(job.id),
      ).resolves.toMatchObject({
        displayStatus: 'failed',
        sourceUrl,
        title: null,
      });
    } finally {
      await prisma!.extractionJob.deleteMany({ where: { id: job.id } });
    }
  });

  it('keeps the first stored title across concurrent and repeated saves', async () => {
    /** 조건부 제목 저장 경쟁을 확인할 테스트 job의 YouTube ID. */
    const videoId = `${runVideoId.slice(0, 9)}F6`;
    /** 재실행 저장 경쟁 대상 job. */
    const job = await prisma!.extractionJob.create({
      data: {
        quality: '320',
        status: ExtractionJobStatus.processing,
        title: null,
        type: ExtractionType.audio,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        videoId,
      },
    });

    try {
      /** 비어 있는 요청에 처음 제목을 저장하려는 동시 시도. */
      const concurrentResults = await Promise.all([
        saveRequestTitleIfMissing(prisma!, job.id, 'Concurrent title A'),
        saveRequestTitleIfMissing(prisma!, job.id, 'Concurrent title B'),
      ]);
      /** 동시 시도 중 실제로 먼저 저장된 제목. */
      const storedJob = await prisma!.extractionJob.findUnique({
        select: { title: true },
        where: { id: job.id },
      });
      /** 첫 저장값을 덮어쓰려는 순차 재실행 저장 시도. */
      const rerunResult = await saveRequestTitleIfMissing(
        prisma!,
        job.id,
        'Rerun title',
      );

      expect(concurrentResults.filter(Boolean)).toHaveLength(1);
      expect(rerunResult).toBe(false);
      expect(['Concurrent title A', 'Concurrent title B']).toContain(
        storedJob?.title,
      );
      await expect(
        prisma!.extractionJob.findUnique({
          select: { title: true },
          where: { id: job.id },
        }),
      ).resolves.toEqual(storedJob);
    } finally {
      await prisma!.extractionJob.deleteMany({ where: { id: job.id } });
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

/** 실제 PostgreSQL 요청을 처리 경계에 연결할 worker 의존성을 만든다. */
function createDatabaseProcessorDependencies(
  prisma: PrismaClient,
): DownloadJobProcessorDependencies {
  /** 실제 DB 요청·asset 저장 경계. */
  const assetStore: DownloadJobProcessorDependencies['assetStore'] = {
    deleteAsset: async (assetId) => {
      await prisma.extractedAsset.delete({ where: { id: assetId } });
    },
    findReusableAsset: async () => null,
    markCompleted: async (jobId, assetId) => {
      await prisma.extractionJob.update({
        data: {
          assetId,
          errorCode: null,
          errorDetail: null,
          status: ExtractionJobStatus.completed,
        },
        where: { id: jobId },
      });
    },
    markFailed: async (jobId, errorCode, error) => {
      await prisma.extractionJob.update({
        data: {
          errorCode,
          errorDetail: error instanceof Error ? error.message : String(error),
          status: ExtractionJobStatus.failed,
        },
        where: { id: jobId },
      });
    },
    setRequestTitleIfMissing: async (jobId, title) => {
      await saveRequestTitleIfMissing(prisma, jobId, title);
    },
    upsertAsset: async ({
      expiresAt,
      objectKey,
      quality,
      title,
      type,
      videoId,
    }) =>
      prisma.extractedAsset.upsert({
        create: {
          expiresAt,
          objectKey,
          quality,
          title,
          type,
          videoId,
        },
        update: {
          expiresAt,
          objectKey,
          title,
        },
        where: {
          videoId_type_quality: {
            quality,
            type,
            videoId,
          },
        },
      }),
  };

  return {
    assetStore,
    cleanupOutputDirectory: async () => {},
    download: async () => '/tmp/controlled-output.mp3',
    hasObject: async () => false,
    readTitle: async () => null,
    retentionDays: 7,
    runVideoPreflight: async () => {},
    upload: async () => {},
  };
}
