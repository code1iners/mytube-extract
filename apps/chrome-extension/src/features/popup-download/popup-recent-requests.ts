import { type DownloadJobsBridge } from '../../adapters/chrome/download-jobs-bridge';
import { type DownloadsAdapter } from '../../adapters/chrome/downloads';
import { type DownloadJob, getDownloadJobVideoId } from '../../domain/download-job/download-job';
import { getFileExtension } from '../../domain/download-options/download-options';
import { type RecentRequest, deriveRecentRequest } from '../../domain/recent-request/recent-request';
import { buildTitleFilenameStem } from '../../shared/sanitize-filename';

/** Popup이 그리는 최근 요청 하나. 도출한 표시 정보에 이 Popup에서 행동을 실행 중인지를 더한다. */
export type PopupRecentRequest = RecentRequest & {
  /** 다시 다운로드·다시 시도·다시 요청을 실행하는 중인지 여부. 실행 중에는 같은 항목의 행동을 막는다. */
  pending: boolean;
  /** 같은 영상의 다른 요청이 진행 중이라 다시 시도·다시 요청을 잠갔는지 여부. 무대의 같은 영상 제출 잠금과 같은 규칙이다. */
  locked: boolean;
};

/** 마지막 최근 요청 행동의 결과. recent 화면이 live region과 오류 줄로 알린다. */
export type RecentActionResult = {
  /** 행동을 시작했으면 `started`, 실패했으면 `failed`다. */
  kind: 'started' | 'failed';
  /** 알릴 문장. */
  message: string;
};

/** 최근 요청 행동 하나를 끝낸 결과. */
export type RecentActionOutcome = {
  /** 화면에 알릴 결과. */
  result: RecentActionResult;
  /** 다시 시도·다시 요청으로 새로 생긴 job. 다시 다운로드거나 실패했으면 null이다. */
  submittedJob: DownloadJob | null;
};

/** 최근 요청 목록의 표시 정보와 항목 행동(다시 다운로드·다시 시도·다시 요청)을 맡는다. */
export type PopupRecentRequestActions = {
  /** job 목록을 최근 요청 표시 정보로 바꾼다. `isVideoInProgress`가 참인 영상은 다시 시도·다시 요청을 잠근다. */
  describe(
    jobs: readonly DownloadJob[],
    isVideoInProgress: (videoId: string | null) => boolean,
    now: number,
  ): PopupRecentRequest[];
  /** 항목 행동을 실행할 수 있는지 확인한다. 행동이 없거나 잠겼거나 이미 실행 중이면 false다. */
  canRun(request: PopupRecentRequest | undefined): request is PopupRecentRequest;
  /** 항목 행동을 실행한다. 실행 중 표시가 붙은 직후 `onStart`를 부른다. */
  run(
    request: PopupRecentRequest,
    job: DownloadJob,
    apiBaseUrl: string,
    onStart: () => void,
  ): Promise<RecentActionOutcome>;
};

/** 최근 요청 행동 창구를 만든다. */
export function createPopupRecentRequestActions(dependencies: {
  /** Background의 job 제출 창구. */
  downloadJobs: Pick<DownloadJobsBridge, 'submitJob'>;
  /** Chrome downloads adapter. */
  downloads: DownloadsAdapter;
}): PopupRecentRequestActions {
  /** 행동을 실행 중인 job ID. */
  const pendingJobIds = new Set<string>();

  return {
    describe(jobs, isVideoInProgress, now) {
      return jobs.map((job) => {
        /** 도출한 표시 정보. */
        const request = deriveRecentRequest(job, now);

        return {
          ...request,
          locked:
            (request.action === 'retry' || request.action === 'rerequest') &&
            isVideoInProgress(request.videoId),
          pending: pendingJobIds.has(job.jobId),
        };
      });
    },
    canRun(request): request is PopupRecentRequest {
      return Boolean(request?.action && !request.locked && !pendingJobIds.has(request.jobId));
    },
    async run(request, job, apiBaseUrl, onStart) {
      pendingJobIds.add(job.jobId);
      onStart();

      /** 행동이 실패한 이유. 성공하면 null이다. */
      let failureMessage: string | null = null;
      /** 재제출로 새로 생긴 job. */
      let submittedJob: DownloadJob | null = null;

      try {
        if (request.action === 'redownload') {
          // 보관 기간 안의 완료 파일은 재처리 없이 같은 주소에서 로컬 다운로드만 다시 시작한다.
          await dependencies.downloads.startDownload(
            job.downloadUrl ?? '',
            buildDefaultLocalFilename(job) || undefined,
          );
        } else {
          // 알림의 다시 시도와 같은 Background 제출 경로로, job의 원본·형식·품질과 기본 이름을 쓴다.
          submittedJob = await dependencies.downloadJobs.submitJob({
            apiBaseUrl,
            localFilename: buildDefaultLocalFilename(job),
            mode: job.type,
            quality: job.quality,
            sourceUrl: job.sourceUrl ?? '',
          });
        }
      } catch (error) {
        failureMessage =
          error instanceof Error && error.message ? error.message : '요청을 처리하지 못했어요.';
      }

      pendingJobIds.delete(job.jobId);

      return {
        result: failureMessage
          ? { kind: 'failed', message: failureMessage }
          : {
              kind: 'started',
              message: request.action === 'redownload' ? '다운로드를 다시 시작했어요' : '다시 요청했어요',
            },
        submittedJob,
      };
    },
  };
}

/** 최근 요청을 다시 받을 때 쓸 기본 파일명. 제목 기반 정리(실패 시 영상 ID)에 형식 확장자를 붙이고, 영상 ID를 모르면 서버 기본 이름을 쓰도록 비운다. */
function buildDefaultLocalFilename(job: DownloadJob): string {
  /** job 원본의 영상 ID. */
  const videoId = getDownloadJobVideoId(job);

  return videoId
    ? `${buildTitleFilenameStem(job.title ?? '', videoId)}.${getFileExtension(job.type)}`
    : '';
}
