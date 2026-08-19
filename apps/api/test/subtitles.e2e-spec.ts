import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { MEDIA_DOWNLOADER } from './../src/media/media-downloader.port';
import { PrismaService } from './../src/prisma/prisma.service';
import { R2StorageService } from './../src/downloads/r2-storage.service';

describe('MyTubeExtract API subtitles (e2e)', () => {
  let app: INestApplication;
  /** e2e mock downloader — AppModule 부팅에 필요해 다른 e2e와 동일하게 override. */
  const downloaderMock = {
    download: jest.fn(),
  };
  /** e2e Prisma mock. */
  const prismaMock = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    subtitleJob: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  /** e2e R2 storage mock. */
  const r2Mock = {
    abortMultipartUpload: jest.fn(),
    completeMultipartUpload: jest.fn(),
    createMultipartUpload: jest.fn(),
    createMultipartUploadPartUrl: jest.fn(),
    deleteObject: jest.fn(),
    getObjectMetadata: jest.fn(),
  };
  /** 유효한 upload 요청 body. */
  const validUploadRequest = {
    contentType: 'video/mp4',
    fileName: 'clip.mp4',
    sizeBytes: 1024,
    whisperModel: 'base_en',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MEDIA_DOWNLOADER)
      .useValue(downloaderMock)
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(R2StorageService)
      .useValue(r2Mock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    r2Mock.createMultipartUpload.mockResolvedValue('upload-1');
    r2Mock.createMultipartUploadPartUrl.mockResolvedValue(
      'https://r2.example.invalid/presigned-part-url',
    );
    // 실제 R2StorageService.deleteObject는 async라 항상 Promise를 반환한다 —
    // completeUpload의 실패 보정 경로(.deleteObject().catch(...))가 이 계약에 의존한다.
    r2Mock.deleteObject.mockResolvedValue(undefined);
  });

  it('POST /subtitles/uploads creates an R2 multipart session and signs an upload token', async () => {
    /** 업로드 세션 생성 응답. */
    const response = await request(app.getHttpServer())
      .post('/subtitles/uploads')
      .send(validUploadRequest)
      .expect(201);

    expect(response.body.uploadId).toBe('upload-1');
    expect(response.body.parts).toEqual([
      {
        partNumber: 1,
        uploadUrl: 'https://r2.example.invalid/presigned-part-url',
      },
    ]);
    expect(typeof response.body.uploadToken).toBe('string');
    expect(response.body.uploadToken.length).toBeGreaterThan(0);
    expect(r2Mock.createMultipartUpload).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: 'video/mp4' }),
    );
  });

  it('POST /subtitles/uploads rejects an unsupported file type before touching R2', async () => {
    await request(app.getHttpServer())
      .post('/subtitles/uploads')
      .send({
        ...validUploadRequest,
        contentType: 'application/zip',
        fileName: 'a.zip',
      })
      .expect(400);

    expect(r2Mock.createMultipartUpload).not.toHaveBeenCalled();
  });

  it('POST /subtitles/uploads rejects an invalid whisperModel', async () => {
    await request(app.getHttpServer())
      .post('/subtitles/uploads')
      .send({ ...validUploadRequest, whisperModel: 'large' })
      .expect(400);
  });

  it('POST /subtitles/uploads/complete creates a queued subtitle job after a matching R2 upload', async () => {
    /** 업로드 세션 생성 응답. */
    const uploadResponse = await request(app.getHttpServer())
      .post('/subtitles/uploads')
      .send(validUploadRequest)
      .expect(201);

    r2Mock.getObjectMetadata.mockResolvedValue({
      contentLength: validUploadRequest.sizeBytes,
      contentType: validUploadRequest.contentType,
    });
    prismaMock.subtitleJob.create.mockResolvedValueOnce({
      createdAt: new Date('2026-08-19T00:00:00.000Z'),
      errorCode: null,
      expiresAt: new Date('2026-08-26T00:00:00.000Z'),
      id: 'subtitle-job-1',
      originalFileName: validUploadRequest.fileName,
      resultObjectKey: null,
      status: 'queued',
      whisperModel: validUploadRequest.whisperModel,
    });

    /** 업로드 완료 응답. */
    const completeResponse = await request(app.getHttpServer())
      .post('/subtitles/uploads/complete')
      .send({
        objectKey: uploadResponse.body.objectKey,
        parts: [{ etag: '"etag-1"', partNumber: 1 }],
        uploadId: uploadResponse.body.uploadId,
        uploadToken: uploadResponse.body.uploadToken,
      })
      .expect(201);

    expect(completeResponse.body.jobId).toBe('subtitle-job-1');
    expect(completeResponse.body.status).toBe('queued');
    expect(r2Mock.completeMultipartUpload).toHaveBeenCalledWith(
      expect.objectContaining({ uploadId: 'upload-1' }),
    );
    expect(prismaMock.subtitleJob.create).toHaveBeenCalledTimes(1);
  });

  it('POST /subtitles/uploads/complete rejects a forged upload token', async () => {
    await request(app.getHttpServer())
      .post('/subtitles/uploads/complete')
      .send({
        objectKey: 'subtitles-uploads/forged/clip.mp4',
        parts: [{ etag: '"etag-1"', partNumber: 1 }],
        uploadId: 'upload-1',
        uploadToken: 'not-a-real-token',
      })
      .expect(400);

    expect(r2Mock.completeMultipartUpload).not.toHaveBeenCalled();
  });

  it('POST /subtitles/uploads/complete compensates by deleting the R2 object on metadata mismatch', async () => {
    /** 업로드 세션 생성 응답. */
    const uploadResponse = await request(app.getHttpServer())
      .post('/subtitles/uploads')
      .send(validUploadRequest)
      .expect(201);

    // R2가 실제로는 다른 크기의 object를 완료 처리한 것처럼 mismatch를 재현한다.
    r2Mock.getObjectMetadata.mockResolvedValue({
      contentLength: validUploadRequest.sizeBytes + 1,
      contentType: validUploadRequest.contentType,
    });

    await request(app.getHttpServer())
      .post('/subtitles/uploads/complete')
      .send({
        objectKey: uploadResponse.body.objectKey,
        parts: [{ etag: '"etag-1"', partNumber: 1 }],
        uploadId: uploadResponse.body.uploadId,
        uploadToken: uploadResponse.body.uploadToken,
      })
      .expect(400);

    expect(r2Mock.deleteObject).toHaveBeenCalledWith(
      uploadResponse.body.objectKey,
    );
    expect(prismaMock.subtitleJob.create).not.toHaveBeenCalled();
  });

  it('GET /subtitles/jobs/:jobId returns the job status', async () => {
    prismaMock.subtitleJob.findUnique.mockResolvedValueOnce({
      createdAt: new Date('2026-08-19T00:00:00.000Z'),
      errorCode: null,
      expiresAt: new Date('2026-08-26T00:00:00.000Z'),
      id: 'subtitle-job-1',
      originalFileName: 'clip.mp4',
      resultObjectKey: null,
      status: 'transcribing',
      whisperModel: 'base_en',
    });

    /** job 상태 조회 응답. */
    const response = await request(app.getHttpServer())
      .get('/subtitles/jobs/subtitle-job-1')
      .expect(200);

    expect(response.body.status).toBe('transcribing');
  });

  it('GET /subtitles/jobs/:jobId returns 404 for an unknown job', async () => {
    prismaMock.subtitleJob.findUnique.mockResolvedValueOnce(null);

    await request(app.getHttpServer())
      .get('/subtitles/jobs/does-not-exist')
      .expect(404);
  });
});
