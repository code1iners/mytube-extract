import {
  type MyTubeExtractFetch,
  createDownloadJob,
  getDownloadJob,
  getWorkerHealth,
} from '../../api/mytube-extract.api';
import type { DownloadDraft, DownloadResponse } from '../../domain/download-request/download-request';
import type {
  RequestLifecycleAdapter,
  RequestReadinessResponse,
} from '../hooks/use-extraction-request-lifecycle';

/** 영상 요청 adapter 생성에 사용할 운영 통신 설정. */
export type VideoRequestAdapterOptions = {
  /** API base URL. */
  apiBaseUrl?: string;
  /** 테스트에서 대체할 fetch 함수. */
  fetcher?: MyTubeExtractFetch;
};

/** 영상 추출 요청의 운영 API 통신 adapter를 만든다. */
export function createVideoRequestAdapter(
  options: VideoRequestAdapterOptions = {},
): RequestLifecycleAdapter<DownloadDraft, DownloadResponse, 'video'> {
  /** 영상 요청 adapter. */
  const adapter: RequestLifecycleAdapter<
    DownloadDraft,
    DownloadResponse,
    'video'
  > = {
    kind: 'video',
    checkReadiness(signal: AbortSignal): Promise<RequestReadinessResponse> {
      return getWorkerHealth({
        apiBaseUrl: options.apiBaseUrl,
        fetcher: options.fetcher,
        signal,
      });
    },
    createRequest(
      draft: DownloadDraft,
      signal: AbortSignal,
    ): Promise<DownloadResponse> {
      return createDownloadJob(draft, {
        apiBaseUrl: options.apiBaseUrl,
        fetcher: options.fetcher,
        signal,
      });
    },
    getStatus(
      receipt,
      signal: AbortSignal,
    ): Promise<DownloadResponse> {
      return getDownloadJob(receipt.jobId, {
        apiBaseUrl: options.apiBaseUrl,
        fetcher: options.fetcher,
        signal,
      });
    },
  };

  return adapter;
}
