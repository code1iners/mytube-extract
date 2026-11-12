import { type DownloadJob, type DownloadQuality } from '../../domain/download-job/download-job';
import { type DownloadMode } from '../../domain/download-options/download-options';
import {
  DOWNLOAD_JOB_SUBMIT_MESSAGE_TYPE,
  type DownloadJobSubmitFailure,
  type DownloadJobSubmitRequest,
  type DownloadJobSubmitResponse,
} from '../../features/download-jobs/download-job-message';
import {
  type DownloadJobStorageAdapter,
  createDownloadJobStorageAdapter,
} from './download-job-storage';

/** job 제출 입력. */
export type SubmitDownloadJobBridgeInput = {
  /** API base URL. */
  apiBaseUrl: string;
  /** 완료 시 로컬 저장에 사용할 파일명. 비어 있으면 서버 기본 파일명을 사용한다. */
  localFilename: string;
  /** 다운로드 모드. */
  mode: DownloadMode;
  /** 선택 품질 값. */
  quality: DownloadQuality;
  /** 원본 YouTube URL. */
  sourceUrl: string;
};

/** job 제출 실패. Popup이 서버 연결 실패와 접수 거부를 다르게 보여줄 수 있게 원인을 함께 싣는다. */
export class DownloadJobSubmitError extends Error {
  constructor(failure: DownloadJobSubmitFailure, message: string) {
    super(message);
    this.name = 'DownloadJobSubmitError';
    this.failure = failure;
  }

  /** 실패 원인. */
  failure: DownloadJobSubmitFailure;
}

/** Popup이 Background의 download job 추적을 이용하는 창구. */
// job 제출은 메시지로 Background에 위임하고, 상태 조회·구독은 Background가 기록한
// storage만 읽는다 — Popup은 서버를 직접 조회하지 않는다.
export type DownloadJobsBridge = {
  /** Background가 저장해 둔 최근 job 목록을 읽는다. */
  getJobs(): Promise<DownloadJob[]>;
  /** Background가 저장해 둔 최근 job 상태를 읽는다. */
  getLatestJob(): Promise<DownloadJob | null>;
  /** Background에 새 다운로드 job 제출을 요청하고, 생성 직후 상태를 돌려받는다. */
  submitJob(input: SubmitDownloadJobBridgeInput): Promise<DownloadJob>;
  /** 저장된 최근 job이 바뀔 때마다 호출된다. */
  subscribeJobs(listener: (jobs: DownloadJob[]) => void): () => void;
  /** 저장된 최근 job이 바뀔 때마다 호출된다. */
  subscribeLatestJob(listener: (job: DownloadJob) => void): () => void;
};

/** Chrome runtime 기반 download jobs bridge를 만든다. */
export function createDownloadJobsBridge(
  chromeApi: typeof chrome = chrome,
  storage: DownloadJobStorageAdapter = createDownloadJobStorageAdapter(chromeApi),
): DownloadJobsBridge {
  return {
    getJobs() {
      return storage.loadJobs();
    },
    getLatestJob() {
      return storage.loadLatestJob();
    },
    submitJob(input) {
      return new Promise((resolve, reject) => {
        /** Background로 보낼 job 제출 요청. */
        const request: DownloadJobSubmitRequest = {
          apiBaseUrl: input.apiBaseUrl,
          localFilename: input.localFilename,
          mode: input.mode,
          quality: input.quality,
          sourceUrl: input.sourceUrl,
          type: DOWNLOAD_JOB_SUBMIT_MESSAGE_TYPE,
        };

        chromeApi.runtime.sendMessage(
          request,
          (response: DownloadJobSubmitResponse | undefined) => {
            if (chromeApi.runtime.lastError) {
              reject(
                new DownloadJobSubmitError(
                  'rejected',
                  '확장 프로그램 내부 연결에 실패했어요. 다시 시도해 주세요.',
                ),
              );
              return;
            }

            if (!response) {
              reject(new DownloadJobSubmitError('rejected', '추출 요청을 만들지 못했어요.'));
              return;
            }

            if (!response.ok) {
              reject(new DownloadJobSubmitError(response.failure ?? 'rejected', response.message));
              return;
            }

            resolve(response.job);
          },
        );
      });
    },
    subscribeJobs(listener) {
      return storage.subscribeJobs(listener);
    },
    subscribeLatestJob(listener) {
      return storage.subscribeLatestJob(listener);
    },
  };
}
