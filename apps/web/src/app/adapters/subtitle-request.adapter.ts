import {
  abortSubtitleUpload,
  completeSubtitleUpload,
  createSubtitleUpload,
  getSubtitleJob,
  getWorkerHealth,
  type MyTubeExtractFetch,
  type SubtitleUploadProgress,
  type SubtitleUploadResponse,
  uploadSubtitleFileParts,
} from '../../api/mytube-extract.api';
import type {
  SubtitleJobResponse,
  SubtitleWhisperModel,
} from '../../domain/subtitle-request/subtitle-request';
import type { JobReceipt } from '../utils/job-receipt.util';
import type {
  RequestLifecycleAdapter,
  RequestReadinessResponse,
} from '../hooks/use-extraction-request-lifecycle';

/** 자막 요청 lifecycle adapter에 전달하는 검증된 요청 입력. */
export type SubtitleRequest = {
  /** 업로드할 로컬 영상 파일. */
  file: File;
  /** 영어 SRT 생성에 사용할 Whisper 모델. */
  whisperModel: SubtitleWhisperModel;
};

/** 자막 요청 adapter 생성에 사용할 운영 통신 설정. */
export type SubtitleRequestAdapterOptions = {
  /** API base URL. */
  apiBaseUrl?: string;
  /** 테스트에서 대체할 fetch 함수. */
  fetcher?: MyTubeExtractFetch;
  /** multipart 업로드 byte progress와 종료를 관찰할 callback. */
  onProgress?: (progress: SubtitleUploadProgress | null) => void;
};

/** 자막 추출 요청의 운영 API와 multipart 통신을 감싼 lifecycle adapter를 만든다. */
export function createSubtitleRequestAdapter(
  options: SubtitleRequestAdapterOptions = {},
): RequestLifecycleAdapter<SubtitleRequest, SubtitleJobResponse, 'subtitle'> {
  /** 자막 요청 adapter. */
  const adapter: RequestLifecycleAdapter<
    SubtitleRequest,
    SubtitleJobResponse,
    'subtitle'
  > = {
    kind: 'subtitle',
    /** API와 worker readiness를 확인한다. */
    checkReadiness(signal: AbortSignal): Promise<RequestReadinessResponse> {
      return getWorkerHealth({
        apiBaseUrl: options.apiBaseUrl,
        fetcher: options.fetcher,
        signal,
      });
    },
    /** multipart upload를 완료하고 생성된 자막 job을 반환한다. */
    async createRequest(
      request: SubtitleRequest,
      signal: AbortSignal,
    ): Promise<SubtitleJobResponse> {
      /** 생성된 multipart upload session. */
      let upload: SubtitleUploadResponse | null = null;
      /** 업로드 progress callback이 시작됐는지 여부. */
      let progressStarted = false;

      try {
        upload = await createSubtitleUpload(
          request.file,
          request.whisperModel,
          {
            apiBaseUrl: options.apiBaseUrl,
            fetcher: options.fetcher,
            signal,
          },
        );

        progressStarted = true;
        options.onProgress?.({
          percent: 0,
          totalBytes: request.file.size,
          uploadedBytes: 0,
        });

        /** R2에 업로드된 multipart part 목록. */
        const parts = await uploadSubtitleFileParts(
          request.file,
          upload,
          {
            fetcher: options.fetcher,
            onProgress: options.onProgress ?? undefined,
            signal,
          },
        );

        // complete는 서버가 job을 만든 응답을 받도록 caller의 abort signal을 전달하지 않는다.
        return await completeSubtitleUpload(upload, parts, {
          apiBaseUrl: options.apiBaseUrl,
          fetcher: options.fetcher,
        });
      } catch (error) {
        if (upload) {
          // 원래 오류와 cancel 결과를 보존하기 위해 cleanup 오류는 무시한다.
          void abortSubtitleUpload(upload, {
            apiBaseUrl: options.apiBaseUrl,
            fetcher: options.fetcher,
          }).catch(() => undefined);
        }

        throw error;
      } finally {
        if (progressStarted) {
          options.onProgress?.(null);
        }
      }
    },
    /** 접수된 자막 job의 현재 상태를 조회한다. */
    getStatus(
      receipt: JobReceipt & { kind: 'subtitle' },
      signal: AbortSignal,
    ): Promise<SubtitleJobResponse> {
      return getSubtitleJob(receipt.jobId, {
        apiBaseUrl: options.apiBaseUrl,
        fetcher: options.fetcher,
        signal,
      });
    },
  };

  return adapter;
}
