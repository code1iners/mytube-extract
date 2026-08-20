import {
  type CreateDownloadJobInput,
  type DownloadJob,
} from '../../domain/download-job/download-job';
import { normalizeApiBaseUrl, normalizeSourceUrl } from '../../domain/download-options/download-options';
import { buildDownloadJobUrl, buildDownloadJobsUrl, buildHealthUrl } from './download-url';

/** fetch 호환 함수. */
export type FetchLike = typeof fetch;

/** MyTube Extract API client 의존성. */
export type MyTubeExtractClientDependencies = {
  /** HTTP 요청 실행 함수. */
  fetch?: FetchLike;
};

/** MyTube Extract API client. */
export type MyTubeExtractClient = {
  /** API server health를 확인한다. */
  assertServerAvailable(apiBaseUrl: string): Promise<void>;
  /** 다운로드 job을 생성한다. */
  createDownloadJob(input: CreateDownloadJobInput): Promise<DownloadJob>;
  /** 다운로드 job 상태를 조회한다. */
  getDownloadJob(apiBaseUrl: string, jobId: string): Promise<DownloadJob>;
};

/** 다운로드 job 요청 HTTP 오류. 호출자가 상태 코드로 원인을 구분할 수 있게 한다. */
export class DownloadJobRequestError extends Error {
  constructor(responseStatus: number) {
    super('Download job request failed.');
    this.name = 'DownloadJobRequestError';
    this.responseStatus = responseStatus;
  }

  /** HTTP 응답 상태 코드. */
  responseStatus: number;
}

/** 서버가 내려주는 job 상태 원본 응답. `downloadUrl`은 API base URL 기준 상대 경로다. */
type RawDownloadJobResponse = Omit<DownloadJob, 'downloadUrl'> & {
  /** 완료된 파일의 상대 다운로드 경로. */
  downloadUrl: string | null;
};

/** MyTube Extract API client를 만든다. */
export function createMyTubeExtractClient(
  dependencies: MyTubeExtractClientDependencies = {},
): MyTubeExtractClient {
  /** HTTP 요청 실행 함수. */
  const fetchImplementation = dependencies.fetch ?? fetch;

  return {
    async assertServerAvailable(apiBaseUrl: string) {
      /** API 서버 health check 응답. */
      let response: Response;

      try {
        response = await fetchImplementation(buildHealthUrl(apiBaseUrl));
      } catch {
        throw new Error('Server is unavailable.');
      }

      if (!response.ok) {
        throw new Error('Server is unavailable.');
      }

      /** API 서버 health payload. */
      const payload = (await response.json()) as { ok?: boolean };

      if (payload?.ok !== true) {
        throw new Error('Server health check failed.');
      }
    },

    async createDownloadJob(input: CreateDownloadJobInput) {
      /** 정규화된 API base URL. */
      const apiBaseUrl = normalizeApiBaseUrl(input.apiBaseUrl);
      /** 정규화된 원본 URL. */
      const sourceUrl = normalizeSourceUrl(input.sourceUrl);
      /** job 생성 응답. 파일명은 보내지 않는다 — 서버는 이 필드를 저장 파일명에 반영하지 않는다. */
      let response: Response;

      try {
        response = await fetchImplementation(buildDownloadJobsUrl(apiBaseUrl), {
          body: JSON.stringify({
            quality: input.quality,
            type: input.type,
            url: sourceUrl,
          }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        });
      } catch {
        throw new Error('Could not reach the server to create the download job.');
      }

      if (!response.ok) {
        throw new DownloadJobRequestError(response.status);
      }

      return toDownloadJob((await response.json()) as RawDownloadJobResponse, apiBaseUrl);
    },

    async getDownloadJob(apiBaseUrl: string, jobId: string) {
      /** 정규화된 API base URL. */
      const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
      /** job 상태 조회 응답. */
      let response: Response;

      try {
        response = await fetchImplementation(buildDownloadJobUrl(normalizedApiBaseUrl, jobId));
      } catch {
        throw new Error('Could not reach the server to check the download job.');
      }

      if (!response.ok) {
        throw new DownloadJobRequestError(response.status);
      }

      return toDownloadJob(
        (await response.json()) as RawDownloadJobResponse,
        normalizedApiBaseUrl,
      );
    },
  };
}

/** 서버 원본 job 응답을 상대 경로가 절대 URL로 resolve된 domain 값으로 바꾼다. */
function toDownloadJob(raw: RawDownloadJobResponse, apiBaseUrl: string): DownloadJob {
  return {
    ...raw,
    downloadUrl: raw.downloadUrl ? `${apiBaseUrl}${raw.downloadUrl}` : null,
  };
}
