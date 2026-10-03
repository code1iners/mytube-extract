import type { SubtitleUploadProgress } from '../../api/mytube-extract.api';
import type { DownloadDraft, DownloadResponse } from '../../domain/download-request/download-request';
import type { SubtitleJobResponse } from '../../domain/subtitle-request/subtitle-request';
import type { RequestLifecycleAdapter } from '../hooks/use-extraction-request-lifecycle';
import { setDownloadPreferences, setSubtitleWhisperModelPreference } from '../utils/request-preference.util';
import { createSubtitleRequestAdapter, type SubtitleRequest } from './subtitle-request.adapter';
import { createVideoRequestAdapter } from './video-request.adapter';

/** 내역에서 확정한 원래 조건과 이번에 다시 선택한 파일. */
export type HistoryRequest =
  | { kind: 'video'; input: DownloadDraft }
  | { kind: 'subtitle'; input: SubtitleRequest };

/** 통신 순서는 기존 어댑터에 맡기고 한 생명주기에서 요청 종류만 분기한다. */
export function createHistoryRequestAdapter(options: {
  /** 기존 서버 주소. */
  apiBaseUrl?: string;
  /** 현재 시도의 실제 전송 진행률. */
  onProgress: (progress: SubtitleUploadProgress | null) => void;
}): RequestLifecycleAdapter<HistoryRequest, DownloadResponse | SubtitleJobResponse, 'video' | 'subtitle'> {
  /** 영상·오디오 통신을 담당하는 기존 어댑터. */
  const video = createVideoRequestAdapter(options);
  /** 취소한 업로드의 늦은 정리가 새 진행률을 지우지 않도록 구분한다. */
  let latestSignal: AbortSignal | null = null;
  return {
    kind: (request) => request.kind,
    checkReadiness: video.checkReadiness,
    async createRequest(request, signal) {
      latestSignal = signal;
      options.onProgress(null);
      if (request.kind === 'video') {
        /** 실제 접수 성공 때만 기본값을 갱신한다. */
        const job = await video.createRequest(request.input, signal);
        setDownloadPreferences({ mode: request.input.mode, quality: request.input.quality });
        return job;
      }
      /** 진행 콜백은 이 시도의 취소와 최신 여부를 확인한다. */
      const subtitle = createSubtitleRequestAdapter({
        apiBaseUrl: options.apiBaseUrl,
        onProgress: (progress) => {
          if (latestSignal === signal && !signal.aborted) options.onProgress(progress);
        },
      });
      /** complete의 늦은 성공도 기존 어댑터가 반환하면 접수로 기록한다. */
      const job = await subtitle.createRequest(request.input, signal);
      setSubtitleWhisperModelPreference(request.input.whisperModel);
      return job;
    },
    getStatus: (receipt, signal) => receipt.kind === 'video'
      ? video.getStatus({ ...receipt, kind: 'video' }, signal)
      : createSubtitleRequestAdapter(options).getStatus({ ...receipt, kind: 'subtitle' }, signal),
  };
}
