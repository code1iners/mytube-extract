import { type DownloadJob } from '../../domain/download-job/download-job';
import {
  type MyTubeExtractClient,
  ServerUnreachableError,
} from '../../services/mytube-extract/mytube-extract-client';
import {
  type DownloadJobManager,
  type SubmitDownloadJobInput,
} from './download-job-manager';
import { type DownloadJobSubmitRequest, type DownloadJobSubmitResponse } from './download-job-message';

/** job 제출 handler 의존성. */
export type DownloadJobSubmitHandlerDependencies = {
  /** MyTube Extract API client. */
  myTubeExtractClient: Pick<MyTubeExtractClient, 'assertServerAvailable'>;
  /** Download job manager. */
  jobManager: Pick<DownloadJobManager, 'submitJob'>;
};

/** Popup의 job 제출 요청을 처리하는 함수. */
export type DownloadJobSubmitHandler = (
  request: DownloadJobSubmitRequest,
) => Promise<DownloadJobSubmitResponse>;

/** job 제출 요청 handler를 만든다. */
// 서버 확인과 job 생성이 끝나는 즉시 응답하고, 완료까지의 폴링은 job manager 안에서
// 계속 진행된다 — Popup이 응답을 기다리는 동안 닫혀도 추적이 끊기지 않아야 하기 때문이다.
export function createDownloadJobSubmitHandler(
  dependencies: DownloadJobSubmitHandlerDependencies,
): DownloadJobSubmitHandler {
  return async function handleDownloadJobSubmit(request) {
    try {
      await dependencies.myTubeExtractClient.assertServerAvailable(request.apiBaseUrl);
    } catch (error) {
      // health check는 서버에 닿았는지만 보므로 어떤 실패든 연결 문제로 알린다.
      return {
        failure: 'unreachable',
        message: getErrorMessage(error, '서버에 연결할 수 없어요.'),
        ok: false,
      };
    }

    return new Promise<DownloadJobSubmitResponse>((resolve) => {
      /** 이미 응답했는지 여부. 이후 폴링에서 발생하는 상태 변경에는 다시 응답하지 않는다. */
      let responded = false;

      /** job manager에 전달할 제출 입력. */
      const submitInput: SubmitDownloadJobInput = {
        apiBaseUrl: request.apiBaseUrl,
        localFilename: request.localFilename,
        onStatusChange(job: DownloadJob) {
          if (responded) {
            return;
          }

          responded = true;
          resolve({ job, ok: true });
        },
        quality: request.quality,
        sourceUrl: request.sourceUrl,
        type: request.mode,
      };

      dependencies.jobManager.submitJob(submitInput).catch((error: unknown) => {
        if (responded) {
          return;
        }

        responded = true;
        resolve({
          failure: error instanceof ServerUnreachableError ? 'unreachable' : 'rejected',
          message: getErrorMessage(error, '추출 요청을 만들지 못했어요.'),
          ok: false,
        });
      });
    });
  };
}

/** 다양한 오류 값을 사용자 메시지로 변환한다. */
function getErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof Error && error.message ? error.message : fallbackMessage;
}
