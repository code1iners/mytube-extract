import { ExtractionType } from '@mytube-extract/db';
import {
  createAssetObjectKey,
  createContentType,
  createExpiresAt,
  createYtDlpFormat,
  getWorkerFailureCode,
  type WorkerFailureCode,
} from './worker.logic';

/** claim된 다운로드 job 처리에 필요한 표면. */
export type ClaimedDownloadJob = {
  /** job ID. */
  id: string;
  /** 요청 URL. */
  url: string;
  /** YouTube video ID. */
  videoId: string;
  /** 추출 type. */
  type: ExtractionType;
  /** 선택 품질. */
  quality: string;
};

/** 이미 존재하는 재사용 가능 asset의 표면. */
export type ReusableDownloadAsset = {
  /** asset ID. */
  id: string;
  /** R2 object key. */
  objectKey: string;
};

/** 재사용 asset을 조회할 때 필요한 식별값. */
export type FindReusableDownloadAssetInput = {
  /** 현재 시각보다 이후에 만료되는 asset만 찾기 위한 시각. */
  now: Date;
  /** 선택 품질. */
  quality: string;
  /** 추출 type. */
  type: ExtractionType;
  /** YouTube video ID. */
  videoId: string;
};

/** 새로 저장할 추출 결과물의 값. */
export type UpsertDownloadAssetInput = {
  /** asset 보관 만료 시각. */
  expiresAt: Date;
  /** R2 object key. */
  objectKey: string;
  /** 선택 품질. */
  quality: string;
  /** 원본 영상 제목. */
  title: string | null;
  /** 추출 type. */
  type: ExtractionType;
  /** YouTube video ID. */
  videoId: string;
};

/** 요청 하나의 상태와 결과물 저장을 감싸는 경계. */
export type DownloadJobStore = {
  /** 재사용 가능한 asset을 찾는다. */
  findReusableAsset: (
    input: FindReusableDownloadAssetInput,
  ) => Promise<ReusableDownloadAsset | null>;
  /** object가 사라진 재사용 asset row를 삭제한다. */
  deleteAsset: (assetId: string) => Promise<void>;
  /** 업로드한 결과물 asset을 생성하거나 갱신한다. */
  upsertAsset: (input: UpsertDownloadAssetInput) => Promise<{ id: string }>;
  /** 요청을 완료 상태로 전환한다. */
  markCompleted: (jobId: string, assetId: string) => Promise<void>;
  /** 요청을 실패 상태로 전환한다. */
  markFailed: (
    jobId: string,
    errorCode: WorkerFailureCode,
    error: unknown,
  ) => Promise<void>;
};

/** video preflight에 전달할 최소 입력. */
export type DownloadJobPreflightInput = {
  /** yt-dlp format selector. */
  format: string;
  /** worker가 처리할 canonical YouTube URL. */
  sourceUrl: string;
};

/** 추출 artifact를 만드는 입력. */
export type DownloadJobArtifactInput = {
  /** 처리 중인 job. */
  job: ClaimedDownloadJob;
  /** yt-dlp format selector. */
  format: string;
};

/** 추출 artifact를 R2에 업로드하는 입력. */
export type UploadDownloadArtifactInput = {
  /** R2 object key. */
  objectKey: string;
  /** 로컬 임시 artifact 경로. */
  outputPath: string;
  /** 업로드할 MIME type. */
  contentType: string;
};

/** 한 건의 다운로드 job을 처리하는 외부 의존성 경계. */
export type DownloadJobProcessorDependencies = {
  /** 요청·asset 상태 저장 경계. */
  assetStore: DownloadJobStore;
  /** 다운로드가 만든 임시 디렉터리를 정리한다. */
  cleanupOutputDirectory: (outputPath: string) => Promise<void>;
  /** yt-dlp로 추출 artifact를 만든다. */
  download: (input: DownloadJobArtifactInput) => Promise<string>;
  /** R2 object 존재 여부를 확인한다. */
  hasObject: (objectKey: string) => Promise<boolean>;
  /** 원본 영상 제목을 best-effort로 읽는다. */
  readTitle: (sourceUrl: string) => Promise<string | null>;
  /** asset 보관 기간. */
  retentionDays: number;
  /** video 추출 전에 metadata를 검증한다. */
  runVideoPreflight: (
    input: DownloadJobPreflightInput,
  ) => Promise<void>;
  /** 로컬 artifact를 R2에 업로드한다. */
  upload: (input: UploadDownloadArtifactInput) => Promise<void>;
};

/** claim된 다운로드 job 하나를 기존 순서대로 추출·업로드·완료 처리한다. */
export async function processDownloadJob(
  job: ClaimedDownloadJob,
  dependencies: DownloadJobProcessorDependencies,
) {
  try {
    /** worker 처리 직전 재사용 가능한 asset 후보. */
    const reusableAsset = await dependencies.assetStore.findReusableAsset({
      now: new Date(),
      quality: job.quality,
      type: job.type,
      videoId: job.videoId,
    });

    if (reusableAsset) {
      if (await dependencies.hasObject(reusableAsset.objectKey)) {
        await dependencies.assetStore.markCompleted(job.id, reusableAsset.id);
        return;
      }

      await dependencies.assetStore.deleteAsset(reusableAsset.id);
    }

    /** yt-dlp format selector. */
    const format = createYtDlpFormat(job.type, job.quality);

    if (job.type === ExtractionType.video) {
      await dependencies.runVideoPreflight({
        format,
        sourceUrl: job.url,
      });
    }

    /** R2 object key. */
    const objectKey = createAssetObjectKey(job.videoId, job.type, job.quality);
    /** 원본 영상 제목. */
    const title = await dependencies.readTitle(job.url);
    /** 추출 결과 임시 파일 경로. */
    const outputPath = await dependencies.download({
      format,
      job,
    });

    try {
      await dependencies.upload({
        contentType: createContentType(job.type),
        objectKey,
        outputPath,
      });
    } catch (error) {
      await dependencies.assetStore.markFailed(job.id, 'UPLOAD_FAILED', error);
      return;
    } finally {
      await dependencies.cleanupOutputDirectory(outputPath);
    }

    /** 업로드 완료 후 저장할 asset row. */
    const asset = await dependencies.assetStore.upsertAsset({
      expiresAt: createExpiresAt(dependencies.retentionDays),
      objectKey,
      quality: job.quality,
      title,
      type: job.type,
      videoId: job.videoId,
    });

    await dependencies.assetStore.markCompleted(job.id, asset.id);
  } catch (error) {
    await dependencies.assetStore.markFailed(
      job.id,
      getWorkerFailureCode(error),
      error,
    );
  }
}
