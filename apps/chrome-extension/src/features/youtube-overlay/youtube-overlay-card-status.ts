import { type DownloadJob, getDownloadJobVideoId } from '../../domain/download-job/download-job';
import { type DownloadMode } from '../../domain/download-options/download-options';
import { isQualityOption, type QualityOption } from '../../domain/download-options/quality-options';
import { isDownloadJobExpired } from '../../domain/recent-request/recent-request';
import { MAX_RECENT_DOWNLOAD_JOBS } from '../download-jobs/download-job-manager';

/** 완료 배지를 썸네일 위에 남겨 두는 시간(ms). */
export const OVERLAY_COMPLETED_BADGE_MS = 3000;

/** 썸네일 카드 위에 남기는 상태. 표시할 상태가 없으면 null로 다룬다. */
export type OverlayCardStatus =
  | {
      /** 대기·처리·완료 상태. */
      state: 'queued' | 'processing' | 'completed';
    }
  | {
      /** 실패 상태. 배지가 다시 시도 버튼이 된다. */
      state: 'failed';
      /** 다시 제출할 형식. */
      mode: DownloadMode;
      /** 다시 제출할 품질. */
      quality: QualityOption;
    };

/** 저장된 최근 job 목록으로 카드별 상태를 고르는 tracker. 페이지마다 하나 둔다. */
export type OverlayCardStatusTracker = {
  /** storage에서 읽거나 변경 이벤트로 받은 최근 job 목록을 반영한다. */
  update(jobs: readonly DownloadJob[], now: number): void;
  /** 카드 영상 ID에 해당하는 상태를 반환한다. */
  getStatus(videoId: string, now: number): OverlayCardStatus | null;
  /** 완료 배지가 다음으로 사라질 때까지 남은 시간(ms). 사라질 배지가 없으면 null이다. */
  getNextChangeDelay(now: number): number | null;
};

/** Overlay 카드 상태 tracker를 만든다. */
export function createOverlayCardStatusTracker(): OverlayCardStatusTracker {
  /** 영상 ID별 가장 최신 job. 최근 5건 안에 있는 job만 담는다. */
  let latestJobByVideoId = new Map<string, DownloadJob>();
  /** 직전에 받은 job ID별 상태. 처음 받기 전에는 null이다. */
  let previousStatusByJobId: Map<string, DownloadJob['status']> | null = null;
  /** 이 페이지에서 완료로 바뀌는 것을 본 job ID와 그 시각. */
  const completedAtByJobId = new Map<string, number>();

  /** 완료 배지가 아직 보여야 하는 job의 완료 시각. 없거나 지났으면 null이다. */
  function getVisibleCompletedAt(job: DownloadJob, now: number): number | null {
    /** 완료를 본 시각. */
    const completedAt = completedAtByJobId.get(job.jobId);

    return completedAt !== undefined && now < completedAt + OVERLAY_COMPLETED_BADGE_MS
      ? completedAt
      : null;
  }

  return {
    update(jobs, now) {
      /** 생성 시각 최신순으로 자른 최근 job. Background의 보관 정책과 같은 개수만 본다. */
      const recentJobs = [...jobs]
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, MAX_RECENT_DOWNLOAD_JOBS);

      latestJobByVideoId = new Map();
      recentJobs.forEach((job) => {
        /** job 원본 영상 ID. */
        const videoId = getDownloadJobVideoId(job);

        // 최신순으로 돌기 때문에 영상마다 처음 만난 job이 가장 최신이다.
        if (videoId && !latestJobByVideoId.has(videoId)) {
          latestJobByVideoId.set(videoId, job);
        }

        // 페이지를 연 뒤 진행 중이던 job이 완료로 바뀐 때만 완료 배지를 띄운다.
        // 처음 읽은 목록의 완료 job은 이미 끝난 일이라 다시 알리지 않는다.
        /** 직전 상태. */
        const previousStatus = previousStatusByJobId?.get(job.jobId);

        if (
          job.status === 'completed' &&
          previousStatus !== undefined &&
          previousStatus !== 'completed'
        ) {
          completedAtByJobId.set(job.jobId, now);
        }
      });
      previousStatusByJobId = new Map(recentJobs.map((job) => [job.jobId, job.status]));
    },
    getStatus(videoId, now) {
      /** 카드 영상의 최신 job. */
      const job = latestJobByVideoId.get(videoId);

      if (!job || isDownloadJobExpired(job, now)) {
        return null;
      }

      switch (job.status) {
        case 'queued':
        case 'processing':
          return { state: job.status };
        case 'completed':
          return getVisibleCompletedAt(job, now) === null ? null : { state: 'completed' };
        case 'failed': {
          /** 저장된 품질 문자열을 Overlay 메시지 품질 값으로 바꾼 값. */
          const quality = Number(job.quality);

          return isQualityOption(job.type, quality)
            ? { mode: job.type, quality, state: 'failed' }
            : null;
        }
      }
    },
    getNextChangeDelay(now) {
      /** 아직 보이는 완료 배지들이 사라지기까지 남은 시간. */
      const delays = [...latestJobByVideoId.values()].flatMap((job) => {
        /** 완료 배지가 보이기 시작한 시각. */
        const completedAt = job.status === 'completed' ? getVisibleCompletedAt(job, now) : null;

        return completedAt === null ? [] : [completedAt + OVERLAY_COMPLETED_BADGE_MS - now];
      });

      return delays.length > 0 ? Math.min(...delays) : null;
    },
  };
}
