import type { DownloadDraft } from '../../domain/download-request/download-request';
import type { SubtitleWhisperModel } from '../../domain/subtitle-request/subtitle-request';
import { getRequestPreferences } from './request-preference.util';

/** 메뉴 전환 동안 유지하는 입력. 접수된 입력은 현재 화면의 복구에만 사용한다. */
type RequestDraft<T> = {
  /** 현재 화면이 보관하는 원본과 선택값. */
  value: T;
  /** 서버 접수가 확인되어 다음 화면 진입에서는 버려야 하는지 여부. */
  accepted: boolean;
  /** 직접 편집 이후 이전 접수 응답을 구분할 입력 버전. */
  revision: number;
};

/** 실제 파일은 탭 메모리에만 보관하는 자막 입력. */
type SubtitleDraft = {
  /** 분할 업로드에 사용할 원본 파일. */
  file: File | null;
  /** 현재 초안에서 선택한 처리 방식. */
  whisperModel: SubtitleWhisperModel;
};

/** 영상 전용 보관 공간. */
let videoDraft: RequestDraft<DownloadDraft> | null = null;
/** 영상 초안과 독립적인 자막 전용 보관 공간. */
let subtitleDraft: RequestDraft<SubtitleDraft> | null = null;

/** 메뉴 복귀 시 미제출 파일을 복원하고 접수된 원본은 새 입력에서 제외한다. */
export function getSubtitleRequestDraft(): RequestDraft<SubtitleDraft> {
  if (!subtitleDraft || subtitleDraft.accepted) {
    subtitleDraft = {
      accepted: false,
      revision: 0,
      value: { file: null, whisperModel: getRequestPreferences().whisperModel },
    };
  }

  return subtitleDraft;
}

/** 탭 메모리에서 미제출 입력을 복원하거나 기억한 선택으로 새 입력을 만든다. */
export function getVideoRequestDraft(): RequestDraft<DownloadDraft> {
  if (!videoDraft || videoDraft.accepted) {
    videoDraft = {
      accepted: false,
      revision: 0,
      value: { sourceUrl: '', ...getRequestPreferences().download },
    };
  }

  return videoDraft;
}
