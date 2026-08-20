import { type DownloadMode } from '../download-options/download-options';

/** 다운로드 job 실제 상태. */
export type DownloadJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

/** 만료를 반영한 화면 표시 상태. */
export type DownloadJobDisplayStatus = DownloadJobStatus | 'expired';

/** 다운로드 화질 값. */
export type DownloadQuality = '128' | '192' | '320' | '360' | '720' | '1080';

/** 다운로드 job 실패 코드. */
export type DownloadJobErrorCode =
  | 'INVALID_URL'
  | 'EXTRACTION_FAILED'
  | 'VIDEO_TOO_LARGE'
  | 'YOUTUBE_AUTH_REQUIRED'
  | 'YOUTUBE_FORMAT_UNAVAILABLE'
  | 'UPLOAD_FAILED'
  | 'UNKNOWN';

/** 다운로드 job 상태 snapshot. */
export type DownloadJob = {
  /** job ID. */
  jobId: string;
  /** 실제 job 상태. */
  status: DownloadJobStatus;
  /** 화면 표시 상태. */
  displayStatus: DownloadJobDisplayStatus;
  /** 상태 기반 진행률. */
  progress: number | null;
  /** 추출 형식. */
  type: DownloadMode;
  /** 선택 품질 값. */
  quality: DownloadQuality;
  /** 요청 생성 시각. */
  createdAt: string;
  /** 보관 기간 일수. */
  retentionDays: number;
  /** 완료된 파일의 절대 다운로드 URL. API base URL 기준으로 이미 resolve된 값이다. */
  downloadUrl: string | null;
  /** 실패 코드. */
  errorCode: DownloadJobErrorCode | null;
  /** 사용자 표시 메시지. */
  message: string;
};

/** 다운로드 job 생성 입력. */
export type CreateDownloadJobInput = {
  /** API base URL. */
  apiBaseUrl: string;
  /** 다운로드 형식. */
  type: DownloadMode;
  /** 원본 YouTube URL. */
  sourceUrl: string;
  /** 선택 품질 값. */
  quality: DownloadQuality;
};
