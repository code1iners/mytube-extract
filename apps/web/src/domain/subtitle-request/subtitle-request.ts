/** 자막 job 상태. */
export type SubtitleJobStatus =
  | 'queued'
  | 'extracting_audio'
  | 'transcribing'
  | 'completed'
  | 'failed';

/** 자막 화면 표시 상태. */
export type SubtitleDisplayStatus = SubtitleJobStatus | 'expired';

/** 자막 실패 코드. */
export type SubtitleErrorCode =
  | 'AUDIO_TOO_LARGE'
  | 'INVALID_FILE'
  | 'SOURCE_DOWNLOAD_FAILED'
  | 'TRANSCRIPTION_FAILED'
  | 'UPLOAD_FAILED'
  | 'UNKNOWN';

/** 영어 SRT 생성에 사용할 Whisper 모델. */
export type SubtitleWhisperModel = 'base_en' | 'small_en';

/** 자막 API 응답. */
export type SubtitleJobResponse = {
  /** 자막 job ID. */
  jobId: string;
  /** 실제 job 상태. */
  status: SubtitleJobStatus;
  /** 만료까지 반영한 표시 상태. */
  displayStatus: SubtitleDisplayStatus;
  /** 상태 기반 진행률. */
  progress: number | null;
  /** worker 처리 단계. */
  stage: SubtitleJobStatus;
  /** 업로드한 원본 파일명. */
  fileName: string;
  /** job 생성 시 선택한 Whisper 모델. */
  whisperModel: SubtitleWhisperModel;
  /** 요청 시작 시각. */
  createdAt: string;
  /** 보관 기간 일수. */
  retentionDays: number;
  /** 완료된 SRT 다운로드 URL. */
  downloadUrl: string | null;
  /** 실패 코드. */
  errorCode: SubtitleErrorCode | null;
  /** 사용자 표시 메시지. */
  message: string;
};

/** 자막 파일 입력 검증 결과. */
export type SubtitleFileValidation =
  | {
      /** 검증 상태. */
      kind: 'empty';
      /** 사용자 표시 메시지. */
      message: string;
    }
  | {
      /** 검증 상태. */
      kind: 'invalid';
      /** 사용자 표시 메시지. */
      message: string;
    }
  | {
      /** 검증 상태. */
      kind: 'ready';
      /** 사용자 표시 메시지. */
      message: string;
    };

/** 지원하는 업로드 확장자. */
const SUPPORTED_SUBTITLE_VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm'];

/** 지원하는 업로드 MIME type. */
const SUPPORTED_SUBTITLE_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
];

/** 드래그 중 MIME만으로 분류할 수 있는 자막 영상 형식 상태. */
export type SubtitleVideoMimeTypeClassification =
  | 'supported'
  | 'unknown'
  | 'unsupported';

/** 드래그 중 MIME 형식만 사용해 자막 영상 형식을 사전 분류한다. */
export function classifySubtitleVideoMimeType(
  mimeType: string,
): SubtitleVideoMimeTypeClassification {
  /** 브라우저가 제공하는 MIME 형식을 비교 가능한 소문자로 정규화한다. */
  const normalizedMimeType = mimeType.trim().toLowerCase();

  // 빈 값과 일반 바이너리 값은 파일 형식을 확정할 정보가 없으므로 보류한다.
  if (!normalizedMimeType || normalizedMimeType === 'application/octet-stream') {
    return 'unknown';
  }

  if (SUPPORTED_SUBTITLE_VIDEO_TYPES.includes(normalizedMimeType)) {
    return 'supported';
  }

  return 'unsupported';
}

/** terminal 상태인지 확인한다. */
export function isSubtitleTerminalStatus(status: SubtitleDisplayStatus) {
  return status === 'completed' || status === 'failed' || status === 'expired';
}

/** 선택된 영상 파일을 검증한다. */
export function validateSubtitleFile(
  file: File | null,
): SubtitleFileValidation {
  if (!file) {
    return {
      kind: 'empty',
      message: '영상 파일을 선택해 주세요.',
    };
  }

  /** 선택한 파일 확장자. */
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (
    !SUPPORTED_SUBTITLE_VIDEO_EXTENSIONS.includes(extension) ||
    !SUPPORTED_SUBTITLE_VIDEO_TYPES.includes(file.type)
  ) {
    return {
      kind: 'invalid',
      message: 'mp4, mov, webm 영상 파일만 사용할 수 있습니다.',
    };
  }

  return {
    kind: 'ready',
    message: '영어 SRT 생성을 시작할 수 있습니다.',
  };
}
