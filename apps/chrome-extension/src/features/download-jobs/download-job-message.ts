import { type DownloadJob, type DownloadQuality } from '../../domain/download-job/download-job';
import { isDownloadMode, type DownloadMode } from '../../domain/download-options/download-options';

/** Popup에서 Background로 job 제출을 요청하는 메시지 종류. */
export const DOWNLOAD_JOB_SUBMIT_MESSAGE_TYPE = 'download-job-submit' as const;

/** job 상태로 허용되는 고정 화질 값 목록. */
const DOWNLOAD_QUALITIES = new Set<DownloadQuality>(['128', '192', '320', '360', '720', '1080']);

/** Popup에서 Background로 전달하는 job 제출 요청. */
export type DownloadJobSubmitRequest = {
  /** 요청 종류. */
  type: typeof DOWNLOAD_JOB_SUBMIT_MESSAGE_TYPE;
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

/** Background의 job 제출 처리 결과. */
export type DownloadJobSubmitResponse =
  | {
      /** 성공 여부. */
      ok: true;
      /** 생성 직후 job 상태. */
      job: DownloadJob;
    }
  | {
      /** 성공 여부. */
      ok: false;
      /** 사용자에게 전달할 실패 메시지. */
      message: string;
    };

/** 알 수 없는 runtime message가 job 제출 요청인지 확인한다. */
export function isDownloadJobSubmitRequest(message: unknown): message is DownloadJobSubmitRequest {
  if (!isRecord(message)) {
    return false;
  }

  return (
    message.type === DOWNLOAD_JOB_SUBMIT_MESSAGE_TYPE &&
    typeof message.apiBaseUrl === 'string' &&
    typeof message.localFilename === 'string' &&
    isDownloadMode(message.mode) &&
    isDownloadQuality(message.quality) &&
    typeof message.sourceUrl === 'string'
  );
}

/** 값이 job 상태의 고정 화질 값인지 확인한다. */
function isDownloadQuality(value: unknown): value is DownloadQuality {
  return DOWNLOAD_QUALITIES.has(value as DownloadQuality);
}

/** 알 수 없는 값을 record 형태로 좁힌다. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
