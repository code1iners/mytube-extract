import { type CreateDownloadJobInput, type DownloadJob } from '../../domain/download-job/download-job';
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

/** 다운로드 job 요청 HTTP 오류. 호출자가 상태 코드와 서버 안내 메시지로 원인을 구분할 수 있게 한다. */
export class DownloadJobRequestError extends Error {
  constructor(responseStatus: number, responseMessage: string | undefined) {
    super(responseMessage || 'Download job request failed.');
    this.name = 'DownloadJobRequestError';
    this.responseStatus = responseStatus;
    this.responseMessage = responseMessage;
  }

  /** HTTP 응답 상태 코드. */
  responseStatus: number;
  /** 서버가 내려준 안내 메시지(있는 경우). */
  responseMessage: string | undefined;
}

/** 서버가 내려주는 job 상태 원본 응답. `downloadUrl`은 API base URL 기준 상대 경로다. */
type RawDownloadJobResponse = DownloadJob;

/** MyTube Extract API client를 만든다. */
export function createMyTubeExtractClient(
  dependencies: MyTubeExtractClientDependencies = {},
): MyTubeExtractClient {
  /** HTTP 요청 실행 함수. */
  const fetchImplementation = dependencies.fetch ?? fetch;

  /** job 생성/조회 요청을 실행하고 원본 응답을 돌려준다. 네트워크 오류와 HTTP 오류를 구분해서 던진다. */
  async function requestDownloadJob(
    url: string,
    init: RequestInit | undefined,
    networkErrorMessage: string,
  ): Promise<RawDownloadJobResponse> {
    /** job 요청 응답. */
    let response: Response;

    try {
      response = await fetchImplementation(url, init);
    } catch {
      throw new Error(networkErrorMessage);
    }

    if (!response.ok) {
      /** 오류 응답 body에서 읽은 서버 안내 메시지. body가 JSON이 아니면 무시한다. */
      const responseMessage = await readErrorMessage(response);

      throw new DownloadJobRequestError(response.status, responseMessage);
    }

    return (await response.json()) as RawDownloadJobResponse;
  }

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
      /** job 생성 원본 응답. 파일명은 보내지 않는다 — 서버는 이 필드를 저장 파일명에 반영하지 않는다. */
      const raw = await requestDownloadJob(
        buildDownloadJobsUrl(apiBaseUrl),
        {
          body: JSON.stringify({
            quality: input.quality,
            type: input.type,
            url: sourceUrl,
          }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        },
        'Could not reach the server to create the download job.',
      );

      return toDownloadJob(raw, apiBaseUrl);
    },

    async getDownloadJob(apiBaseUrl: string, jobId: string) {
      /** 정규화된 API base URL. */
      const normalizedApiBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
      /** job 상태 원본 응답. */
      const raw = await requestDownloadJob(
        buildDownloadJobUrl(normalizedApiBaseUrl, jobId),
        undefined,
        'Could not reach the server to check the download job.',
      );

      return toDownloadJob(raw, normalizedApiBaseUrl);
    },
  };
}

/** 오류 응답 body에서 서버 안내 메시지를 읽는다. body가 없거나 JSON이 아니면 undefined를 돌려준다. */
async function readErrorMessage(response: Response): Promise<string | undefined> {
  try {
    /** 오류 응답 payload. */
    const payload = (await response.json()) as { message?: unknown };

    return typeof payload?.message === 'string' ? payload.message : undefined;
  } catch {
    return undefined;
  }
}

/** 서버 원본 job 응답을 상대 경로가 절대 URL로 resolve된 domain 값으로 바꾼다. */
function toDownloadJob(raw: RawDownloadJobResponse, apiBaseUrl: string): DownloadJob {
  return {
    ...raw,
    downloadUrl: raw.downloadUrl ? `${apiBaseUrl}${raw.downloadUrl}` : null,
  };
}
