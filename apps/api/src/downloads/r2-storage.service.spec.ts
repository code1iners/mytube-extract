import { Readable } from 'node:stream';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mockClient } from 'aws-sdk-client-mock';
import { R2StorageService } from './r2-storage.service';

describe('R2StorageService', () => {
  /** S3 compatible client mock. */
  const s3Mock = mockClient(S3Client);
  /** 테스트용 R2 설정 값. */
  const r2Env: Record<string, string> = {
    R2_ACCESS_KEY_ID: 'test-access-key',
    R2_BUCKET: 'test-bucket',
    R2_ENDPOINT: 'https://r2.example.invalid',
    R2_SECRET_ACCESS_KEY: 'test-secret-key',
  };
  /** config service mock. */
  const configServiceMock = {
    get: jest.fn((key: string) => r2Env[key]),
  };
  /** 테스트 대상 service. */
  let service: R2StorageService;
  /** public CDN fallback 테스트가 덮어쓰기 전의 원본 fetch. */
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    s3Mock.reset();
    configServiceMock.get.mockImplementation((key: string) => r2Env[key]);
    service = new R2StorageService(
      configServiceMock as unknown as ConfigService,
    );
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('throws when any R2 env var is missing', async () => {
    configServiceMock.get.mockImplementation((key: string) =>
      key === 'R2_ACCESS_KEY_ID' ? undefined : r2Env[key],
    );

    await expect(
      service.deleteObject('extracts/a/audio-192.mp3'),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('putObject sends a PutObjectCommand with the given body and metadata', async () => {
    s3Mock.on(PutObjectCommand).resolves({});

    await service.putObject({
      body: Buffer.from('payload'),
      contentDisposition: 'attachment; filename="a.mp3"',
      contentType: 'audio/mpeg',
      objectKey: 'extracts/a/audio-192.mp3',
    });

    expect(s3Mock.commandCalls(PutObjectCommand)).toHaveLength(1);
    expect(
      s3Mock.commandCalls(PutObjectCommand)[0].args[0].input,
    ).toMatchObject({
      Bucket: 'test-bucket',
      ContentDisposition: 'attachment; filename="a.mp3"',
      ContentType: 'audio/mpeg',
      Key: 'extracts/a/audio-192.mp3',
    });
  });

  it('deleteObject sends a DeleteObjectCommand for the given key', async () => {
    s3Mock.on(DeleteObjectCommand).resolves({});

    await service.deleteObject('extracts/a/audio-192.mp3');

    expect(
      s3Mock.commandCalls(DeleteObjectCommand)[0].args[0].input,
    ).toMatchObject({ Bucket: 'test-bucket', Key: 'extracts/a/audio-192.mp3' });
  });

  it('createMultipartUpload returns the upload ID', async () => {
    s3Mock.on(CreateMultipartUploadCommand).resolves({ UploadId: 'upload-1' });

    await expect(
      service.createMultipartUpload({
        contentType: 'video/mp4',
        objectKey: 'extracts/a/video-720.mp4',
      }),
    ).resolves.toBe('upload-1');
  });

  it('createMultipartUpload rejects when R2 does not return an upload ID', async () => {
    s3Mock.on(CreateMultipartUploadCommand).resolves({});

    await expect(
      service.createMultipartUpload({
        contentType: 'video/mp4',
        objectKey: 'extracts/a/video-720.mp4',
      }),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('createMultipartUploadPartUrl returns a presigned URL for the given part', async () => {
    /** presigned URL. */
    const url = await service.createMultipartUploadPartUrl({
      expiresInSeconds: 60,
      objectKey: 'extracts/a/video-720.mp4',
      partNumber: 1,
      uploadId: 'upload-1',
    });

    expect(url).toContain('extracts/a/video-720.mp4');
    expect(url).toContain('uploadId=upload-1');
    expect(url).toContain('partNumber=1');
  });

  it('completeMultipartUpload maps parts to the R2 API shape', async () => {
    s3Mock.on(CompleteMultipartUploadCommand).resolves({});

    await service.completeMultipartUpload({
      objectKey: 'extracts/a/video-720.mp4',
      parts: [
        { etag: '"etag-1"', partNumber: 1 },
        { etag: '"etag-2"', partNumber: 2 },
      ],
      uploadId: 'upload-1',
    });

    expect(
      s3Mock.commandCalls(CompleteMultipartUploadCommand)[0].args[0].input,
    ).toMatchObject({
      MultipartUpload: {
        Parts: [
          { ETag: '"etag-1"', PartNumber: 1 },
          { ETag: '"etag-2"', PartNumber: 2 },
        ],
      },
      UploadId: 'upload-1',
    });
  });

  it('abortMultipartUpload sends an AbortMultipartUploadCommand', async () => {
    s3Mock.on(AbortMultipartUploadCommand).resolves({});

    await service.abortMultipartUpload({
      objectKey: 'extracts/a/video-720.mp4',
      uploadId: 'upload-1',
    });

    expect(
      s3Mock.commandCalls(AbortMultipartUploadCommand)[0].args[0].input,
    ).toMatchObject({ Key: 'extracts/a/video-720.mp4', UploadId: 'upload-1' });
  });

  it('getObjectMetadata normalizes missing fields to null', async () => {
    s3Mock.on(HeadObjectCommand).resolves({});

    await expect(
      service.getObjectMetadata('extracts/a/audio-192.mp3'),
    ).resolves.toEqual({ contentLength: null, contentType: null });
  });

  it('getObjectMetadata returns R2-reported size and type', async () => {
    s3Mock
      .on(HeadObjectCommand)
      .resolves({ ContentLength: 1024, ContentType: 'audio/mpeg' });

    await expect(
      service.getObjectMetadata('extracts/a/audio-192.mp3'),
    ).resolves.toEqual({ contentLength: 1024, contentType: 'audio/mpeg' });
  });

  it('getObjectStream returns the R2 body stream when it exists', async () => {
    /** R2가 반환하는 stub body stream. */
    const bodyStream = Readable.from(Buffer.from('audio bytes'));

    s3Mock.on(GetObjectCommand).resolves({ Body: bodyStream as never });

    await expect(
      service.getObjectStream('extracts/a/audio-192.mp3'),
    ).resolves.toBe(bodyStream);
  });

  it('getObjectStream falls back to the public CDN when R2 reports a missing key', async () => {
    r2Env.R2_PUBLIC_BASE_URL = 'https://cdn.example.invalid';
    s3Mock
      .on(GetObjectCommand)
      .rejects(Object.assign(new Error('not found'), { Code: 'NoSuchKey' }));

    /** public CDN 응답 stub. */
    const fetchMock = jest.fn().mockResolvedValue({
      body: Readable.toWeb(Readable.from(Buffer.from('cdn bytes'))),
      ok: true,
    });
    globalThis.fetch = fetchMock as never;

    try {
      await service.getObjectStream('extracts/a/audio-192.mp3');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://cdn.example.invalid/extracts/a/audio-192.mp3',
      );
    } finally {
      delete r2Env.R2_PUBLIC_BASE_URL;
    }
  });

  it('getObjectStream rejects a missing key without a configured public CDN', async () => {
    s3Mock
      .on(GetObjectCommand)
      .rejects(Object.assign(new Error('not found'), { Code: 'NoSuchKey' }));

    await expect(
      service.getObjectStream('extracts/a/audio-192.mp3'),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('objectExists returns true when R2 HEAD succeeds', async () => {
    s3Mock.on(HeadObjectCommand).resolves({});

    await expect(
      service.objectExists('extracts/a/audio-192.mp3'),
    ).resolves.toBe(true);
  });

  it('objectExists falls back to the public CDN when R2 reports 404', async () => {
    r2Env.R2_PUBLIC_BASE_URL = 'https://cdn.example.invalid';
    s3Mock.on(HeadObjectCommand).rejects(
      Object.assign(new Error('not found'), {
        $metadata: { httpStatusCode: 404 },
      }),
    );

    /** public CDN HEAD 응답 stub. */
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    globalThis.fetch = fetchMock as never;

    try {
      await expect(
        service.objectExists('extracts/a/audio-192.mp3'),
      ).resolves.toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://cdn.example.invalid/extracts/a/audio-192.mp3',
        { method: 'HEAD' },
      );
    } finally {
      delete r2Env.R2_PUBLIC_BASE_URL;
    }
  });

  it('objectExists returns false when neither R2 nor the public CDN has the object', async () => {
    s3Mock.on(HeadObjectCommand).rejects(
      Object.assign(new Error('not found'), {
        $metadata: { httpStatusCode: 404 },
      }),
    );

    await expect(
      service.objectExists('extracts/a/audio-192.mp3'),
    ).resolves.toBe(false);
  });

  it('objectExists rethrows unrelated R2 errors', async () => {
    s3Mock.on(HeadObjectCommand).rejects(new Error('unexpected R2 failure'));

    await expect(
      service.objectExists('extracts/a/audio-192.mp3'),
    ).rejects.toThrow('unexpected R2 failure');
  });
});
