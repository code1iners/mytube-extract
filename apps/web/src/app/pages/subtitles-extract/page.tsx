import { ErrorDetailsDisclosure } from '../../components/error-details-disclosure';
import { AppIcon, type AppIconName } from '../../components/app-icon';
import { PanelTitle } from '../../components/panel-title';
import { RequestFlow } from '../../components/request-flow';
import { RequestReadinessPanel } from '../../components/request-readiness-panel';
import { WorkerHealthStatusNotice } from '../../components/worker-health-status';
import { type SubtitleStepKey, type SubtitleStatusTone, useSubtitlesExtractLogic } from './_hooks/use-subtitles-extract-logic';

/** 처리 화면에서 표시할 자막 단계. */
const SUBTITLE_STEPS: Array<{ /** 단계 key. */ key: SubtitleStepKey; /** 화면 라벨. */ label: string }> = [
  { key: 'queued', label: '대기' },
  { key: 'extracting_audio', label: '음성 추출' },
  { key: 'transcribing', label: '영어 SRT 생성' },
  { key: 'completed', label: '완료' },
];

/** 선택 화면에서 안내할 자막 처리 방식. */
const SUBTITLE_PROCESSING_OPTIONS = [
  {
    description: '파일을 빠르게 영어 자막으로 만들고 싶을 때',
    icon: 'processing',
    label: '속도 우선',
    technicalDetail: 'base.en · 상대적으로 빠른 처리',
    value: 'base_en',
  },
  {
    description: '음성을 더 꼼꼼하게 영어 자막으로 옮기고 싶을 때',
    icon: 'subtitle',
    label: '정확도 우선',
    technicalDetail: 'small.en · 인식 정확도를 우선하는 처리',
    value: 'small_en',
  },
] as const;

/** 자막 처리 방식 선택을 시작하게 하는 사용자 중심 안내. */
const SUBTITLE_PROCESSING_GUIDANCE =
  '파일의 음성을 영어 자막 파일(SRT)로 만들 처리 방향을 선택하세요.';
/** 접힌 처리 정보에서 설명할 기술적인 실행 환경. */
const SUBTITLE_PROCESSING_TECHNICAL_NOTE =
  '영어 전용 자막은 로컬 Whisper로 처리합니다.';

/** 자막 오류 상세 위에 표시할 평이한 요약. */
const SUBTITLE_ERROR_DETAIL_SUMMARY =
  '영어 SRT 생성 요청이 정상적으로 처리되지 않았습니다.';
/** 자막 원본 파일 선택 control의 accessible name. */
const SUBTITLE_FILE_PICKER_LABEL = '영상 선택 또는 드래그 (로컬 영상 파일)';
/** 자막 파일 검증 안내를 연결할 id. */
const SUBTITLE_FILE_FEEDBACK_ID = 'subtitle-file-feedback';
/** 자막 route worker health 제목 id. */
const SUBTITLE_WORKER_HEALTH_TITLE_ID = 'subtitle-worker-health-title';
/** 자막 요청 제목 row의 Tailwind margin className. */
const SUBTITLE_REQUEST_TITLE_CLASS_NAME = '!mb-0';
/** 자막 요청 panel의 Tailwind layout className. */
const SUBTITLE_REQUEST_PANEL_CLASS_NAME =
  'phase-panel subtitle-request-panel grid min-w-0 w-full max-w-none gap-mytube-24 m-0 p-0 min-[821px]:self-start max-[561px]:gap-mytube-8';
/** 자막 요청 form의 Tailwind layout className. */
const SUBTITLE_REQUEST_FORM_CLASS_NAME =
  'subtitle-form grid gap-mytube-16 max-[561px]:gap-mytube-4';
/** 자막 파일 field의 Tailwind layout className. */
const SUBTITLE_FILE_FIELD_CLASS_NAME = 'field grid gap-mytube-8';
/** 자막 파일 field label의 Tailwind typography className. */
const SUBTITLE_FILE_FIELD_LABEL_CLASS_NAME =
  'field-label text-mytube-text-primary text-[16px] font-semibold leading-[1.4]';
/** 자막 파일 picker의 Tailwind layout·state className. */
const SUBTITLE_DROPZONE_CLASS_NAME =
  'subtitle-dropzone grid min-h-[160px] w-full min-w-0 place-items-center gap-[10px] p-mytube-12 border border-dashed border-mytube-border rounded-mytube-lg bg-mytube-surface-alt text-mytube-text-secondary cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-mytube-focus focus-visible:outline-offset-2 hover:border-mytube-text-secondary hover:bg-mytube-surface hover:text-mytube-text-primary max-[561px]:min-h-[140px]';
/** 자막 파일 picker icon의 Tailwind size·color className. */
const SUBTITLE_DROPZONE_ICON_CLASS_NAME =
  '!size-[32px] text-mytube-action-primary';
/** 자막 파일 picker의 주요 문구 Tailwind typography className. */
const SUBTITLE_DROPZONE_PRIMARY_COPY_CLASS_NAME =
  'text-mytube-text-primary text-[16px]';
/** 자막 파일 picker의 형식 안내 Tailwind typography className. */
const SUBTITLE_DROPZONE_HINT_CLASS_NAME =
  'text-mytube-text-secondary text-[14px]';
/** 자막 파일 검증 feedback의 Tailwind typography className. */
const SUBTITLE_FILE_FEEDBACK_CLASS_NAME =
  'field-feedback m-[-2px_0_0] text-mytube-text-secondary text-[14px] leading-[1.4]';
/** 선택 파일 row의 Tailwind layout·surface className. */
const SUBTITLE_SELECTED_FILE_ROW_CLASS_NAME =
  'selected-file-row grid min-w-0 grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-mytube-12 p-mytube-12 border border-mytube-border rounded-mytube-md bg-mytube-surface-alt';
/** 선택 파일 icon의 Tailwind size·color className. */
const SUBTITLE_SELECTED_FILE_ICON_CLASS_NAME =
  '!size-6 text-mytube-text-secondary';
/** 선택 파일 이름의 Tailwind overflow·typography className. */
const SUBTITLE_SELECTED_FILE_NAME_CLASS_NAME =
  'block min-w-0 truncate text-mytube-text-primary text-[16px] font-semibold';
/** 선택 파일 메타의 Tailwind overflow·typography className. */
const SUBTITLE_SELECTED_FILE_META_CLASS_NAME =
  'mt-mytube-4 block min-w-0 truncate text-mytube-text-secondary text-[13px]';
/** 선택 파일 제거 button의 Tailwind layout·state className. */
const SUBTITLE_SELECTED_FILE_CLEAR_CLASS_NAME =
  'inline-flex min-w-[44px] min-h-[44px] items-center justify-center px-mytube-8 border border-mytube-border rounded-mytube-sm bg-mytube-surface text-mytube-text-secondary cursor-pointer text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-mytube-focus focus-visible:outline-offset-2 hover:bg-mytube-surface-alt hover:text-mytube-text-primary';
/** 자막 처리 방식 fieldset의 Tailwind layout className. */
const SUBTITLE_PROCESSING_METHOD_CLASS_NAME =
  'segmented-control subtitle-processing-method grid min-w-0 grid-cols-1 gap-mytube-8 m-0 border-0 p-0 max-[561px]:gap-mytube-4';
/** 자막 처리 방식 legend의 Tailwind typography className. */
const SUBTITLE_PROCESSING_LEGEND_CLASS_NAME =
  'col-span-full m-0 p-0 text-mytube-text-primary text-[16px] font-semibold leading-[1.4]';
/** 자막 처리 방식 사용자 안내의 Tailwind typography className. */
const SUBTITLE_PROCESSING_GUIDANCE_CLASS_NAME =
  'subtitle-processing-method__description col-span-full m-[0_0_4px] text-mytube-text-secondary text-[14px] leading-[1.4]';
/** 자막 처리 방식 선택지의 공통 Tailwind layout·state className. */
const SUBTITLE_PROCESSING_OPTION_BASE_CLASS_NAME =
  'segment subtitle-processing-option flex min-w-0 w-full min-h-[48px] items-center justify-start gap-mytube-8 px-mytube-12 py-mytube-8 border border-mytube-border rounded-mytube-md bg-mytube-surface text-mytube-text-secondary cursor-pointer text-left font-semibold focus-within:outline-2 focus-within:outline-mytube-focus focus-within:outline-offset-2 hover:bg-mytube-surface-alt hover:text-mytube-text-primary';
/** 선택된 자막 처리 방식의 Tailwind state className. */
const SUBTITLE_PROCESSING_OPTION_SELECTED_CLASS_NAME =
  'is-selected !border-mytube-action-primary bg-mytube-surface !text-mytube-text-primary underline decoration-mytube-text-primary decoration-2 underline-offset-4';
/** 자막 처리 방식 radio input의 Tailwind visually-hidden className. */
const SUBTITLE_PROCESSING_OPTION_INPUT_CLASS_NAME =
  'absolute h-px w-px opacity-0';
/** 자막 처리 방식 설명 묶음의 Tailwind layout className. */
const SUBTITLE_PROCESSING_OPTION_COPY_CLASS_NAME =
  'subtitle-processing-option__copy grid min-w-0 gap-mytube-4';
/** 자막 처리 방식 제목의 Tailwind typography className. */
const SUBTITLE_PROCESSING_OPTION_TITLE_CLASS_NAME =
  'text-mytube-text-primary text-[16px] leading-[1.4]';
/** 자막 처리 방식 설명의 Tailwind typography className. */
const SUBTITLE_PROCESSING_OPTION_DESCRIPTION_CLASS_NAME =
  'subtitle-processing-option__description block text-mytube-text-secondary text-[14px] font-normal leading-[1.4] break-keep';
/** 자막 기술 정보 disclosure의 Tailwind layout·surface className. */
const SUBTITLE_PROCESSING_DETAILS_CLASS_NAME =
  'subtitle-processing-method__details col-span-full border-t border-mytube-border open:bg-mytube-surface-alt open:pb-mytube-8';
/** 자막 기술 정보 disclosure summary의 Tailwind layout·state className. */
const SUBTITLE_PROCESSING_SUMMARY_CLASS_NAME =
  'relative flex min-h-[44px] items-center justify-between pr-mytube-24 text-mytube-text-primary cursor-pointer text-[14px] font-semibold list-none focus-visible:outline-2 focus-visible:outline-mytube-focus focus-visible:outline-offset-2 hover:bg-mytube-surface-alt hover:text-mytube-text-primary';
/** 자막 기술 정보 내용의 Tailwind layout·typography className. */
const SUBTITLE_PROCESSING_TECHNICAL_CLASS_NAME =
  'subtitle-processing-method__technical col-span-full grid gap-mytube-4 m-0 pt-mytube-8 pr-0 pb-0 pl-mytube-16 text-mytube-text-secondary text-[14px] leading-[1.4]';
/** 자막 제출 button의 Tailwind layout·state className. */
const SUBTITLE_SUBMIT_BUTTON_CLASS_NAME =
  'subtitle-submit-button inline-flex w-full min-h-[48px] items-center justify-center gap-mytube-8 border border-mytube-action-primary rounded-mytube-md bg-mytube-action-primary text-mytube-on-primary cursor-pointer text-[18px] font-semibold leading-[1] shadow-mytube-soft focus-visible:outline-2 focus-visible:outline-mytube-focus focus-visible:outline-offset-2 enabled:hover:brightness-[0.92] enabled:active:brightness-[0.84] disabled:border-mytube-border disabled:bg-mytube-surface-alt disabled:text-mytube-text-disabled disabled:cursor-not-allowed disabled:shadow-none';
/** 자막 제출 불가 사유의 Tailwind typography className. */
const SUBTITLE_SUBMIT_DISABLED_REASON_CLASS_NAME =
  'subtitle-submit-disabled-reason m-[-12px_0_0] text-mytube-text-secondary text-[14px] leading-[1.4] break-keep [overflow-wrap:anywhere]';
/** 자막 생명주기 panel의 Tailwind surface·layout className. */
const SUBTITLE_STATUS_PANEL_CLASS_NAME =
  'subtitle-status-panel grid min-w-0 w-full max-w-none m-0 gap-[18px] border border-mytube-border rounded-mytube-lg bg-mytube-surface p-[20px] shadow-mytube-soft max-[821px]:p-mytube-16';
/** 자막 상태 제목 영역의 Tailwind layout className. */
const SUBTITLE_STATUS_HEAD_CLASS_NAME =
  'subtitle-status-head grid min-w-0 grid-cols-[64px_minmax(0,1fr)] items-center gap-mytube-16 max-[821px]:grid-cols-[52px_minmax(0,1fr)] max-[821px]:gap-mytube-12';
/** 자막 상태 아이콘의 Tailwind shape·layout className. */
const SUBTITLE_STATUS_ICON_CLASS_NAME =
  'subtitle-status-icon grid size-[64px] shrink-0 place-items-center border rounded-mytube-full max-[821px]:size-[48px]';
/** 자막 상태 제목과 설명을 감싸는 Tailwind overflow className. */
const SUBTITLE_STATUS_COPY_CLASS_NAME = 'min-w-0';
/** 자막 상태 제목의 Tailwind typography className. */
const SUBTITLE_STATUS_TITLE_CLASS_NAME =
  'm-0 text-[21px] font-semibold leading-[1.3] max-[821px]:text-[19px]';
/** 자막 상태 설명의 Tailwind typography·overflow className. */
const SUBTITLE_STATUS_MESSAGE_CLASS_NAME =
  'm-[6px_0_0] text-mytube-text-secondary text-[16px] leading-[1.4] break-keep break-words';
/** 자막 상태 tone별 Tailwind className 묶음. */
type SubtitleStatusToneClassNames = {
  /** 상태 아이콘의 테두리·색상. */
  icon: string;
  /** 상태 제목의 색상. */
  title: string;
};
/** 자막 상태별 semantic token 연결. */
const SUBTITLE_STATUS_TONE_CLASS_NAMES: Record<
  SubtitleStatusTone,
  SubtitleStatusToneClassNames
> = {
  queued: {
    icon: 'border-mytube-status-queued text-mytube-status-queued',
    title: 'text-mytube-text-primary',
  },
  processing: {
    icon: 'border-mytube-status-processing text-mytube-status-processing',
    title: 'text-mytube-text-primary',
  },
  completed: {
    icon: 'border-mytube-status-completed text-mytube-status-completed',
    title: 'text-mytube-status-completed',
  },
  failed: {
    icon: 'border-mytube-status-failed text-mytube-status-failed',
    title: 'text-mytube-status-failed',
  },
  expired: {
    icon: 'border-mytube-status-expired text-mytube-status-expired',
    title: 'text-mytube-status-expired',
  },
};
/** 자막 작업 단계 목록의 Tailwind layout className. */
const SUBTITLE_STEP_TABS_CLASS_NAME =
  'subtitle-step-tabs grid min-w-0 grid-cols-4 gap-mytube-8 max-[821px]:grid-cols-1';
/** 자막 작업 단계 항목의 Tailwind surface·typography className. */
const SUBTITLE_STEP_TAB_BASE_CLASS_NAME =
  'subtitle-step-tab inline-flex min-w-0 min-h-[44px] items-center justify-center gap-[6px] border border-mytube-border rounded-mytube-md bg-mytube-surface text-mytube-text-secondary font-semibold max-[821px]:min-h-[40px] max-[821px]:text-[13px]';
/** 현재 자막 작업 단계의 Tailwind state className. */
const SUBTITLE_STEP_TAB_SELECTED_CLASS_NAME =
  'border-mytube-status-processing bg-mytube-surface-alt text-mytube-status-processing';
/** 자막 진행률 meter의 Tailwind layout className. */
const SUBTITLE_PROGRESS_METER_CLASS_NAME =
  'subtitle-progress-meter grid min-w-0 grid-cols-10 gap-mytube-4';
/** 자막 진행률 cell의 기본 Tailwind surface className. */
const SUBTITLE_PROGRESS_CELL_CLASS_NAME =
  'h-[8px] rounded-mytube-full bg-mytube-surface-alt';
/** 채워진 자막 진행률 cell의 Tailwind status className. */
const SUBTITLE_PROGRESS_FILLED_CELL_CLASS_NAME =
  'bg-mytube-status-processing';
/** 자막 진행률 보조 문구의 Tailwind typography className. */
const SUBTITLE_PROGRESS_LABEL_CLASS_NAME =
  'subtitle-progress-label m-0 text-mytube-status-processing text-[16px] font-semibold text-center';
/** 자막 상태 상세 목록의 Tailwind layout className. */
const SUBTITLE_STATUS_DETAILS_CLASS_NAME =
  'subtitle-status-details grid min-w-0 gap-0 m-0 border-t border-mytube-border';
/** 자막 상태 상세 한 행의 Tailwind layout·border className. */
const SUBTITLE_STATUS_DETAIL_ROW_CLASS_NAME =
  'grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-mytube-16 border-b border-mytube-border py-[11px]';
/** 자막 상태 상세 label의 Tailwind typography className. */
const SUBTITLE_STATUS_DETAIL_LABEL_CLASS_NAME =
  'm-0 text-mytube-text-secondary text-[14px] font-normal';
/** 자막 상태 상세 value의 Tailwind typography·overflow className. */
const SUBTITLE_STATUS_DETAIL_VALUE_CLASS_NAME =
  'm-0 min-w-0 text-mytube-text-primary text-[14px] font-semibold text-right [overflow-wrap:anywhere]';
/** 자막 완료 결과 보조 문구의 Tailwind typography·overflow className. */
const SUBTITLE_RESULT_CONTEXT_CLASS_NAME =
  'm-0 text-mytube-text-secondary text-[14px] leading-[1.4] break-keep [overflow-wrap:anywhere]';
/** 자막 완료 결과 action 영역의 Tailwind layout className. */
const SUBTITLE_RESULT_ACTIONS_CLASS_NAME =
  'subtitle-result-actions grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-mytube-12 mt-[20px] max-[561px]:grid-cols-1';
/** 자막 완료 결과 다운로드 link의 Tailwind button className. */
const SUBTITLE_DOWNLOAD_BUTTON_CLASS_NAME =
  'subtitle-download-button inline-flex w-full min-h-[48px] items-center justify-center gap-mytube-8 border border-mytube-action-primary rounded-mytube-md bg-mytube-action-primary text-mytube-on-primary cursor-pointer text-[18px] font-semibold leading-[1] no-underline shadow-mytube-soft focus-visible:outline-2 focus-visible:outline-mytube-focus focus-visible:outline-offset-2 hover:brightness-[0.92] active:brightness-[0.84]';
/** 자막 보조 button의 공통 Tailwind className. */
const SUBTITLE_SECONDARY_BUTTON_CLASS_NAME =
  'subtitle-secondary-button inline-flex min-h-[44px] items-center justify-center border border-mytube-border rounded-mytube-md bg-mytube-surface text-mytube-text-primary cursor-pointer text-[16px] font-semibold focus-visible:outline-2 focus-visible:outline-mytube-focus focus-visible:outline-offset-2 hover:bg-mytube-surface-alt hover:text-mytube-text-primary disabled:text-mytube-text-disabled disabled:cursor-not-allowed';
/** 자막 완료 결과의 새 요청 button className. */
const SUBTITLE_NEW_REQUEST_BUTTON_CLASS_NAME =
  `${SUBTITLE_SECONDARY_BUTTON_CLASS_NAME} min-h-[48px] gap-mytube-8 px-mytube-16`;
/** 자막 오류 복귀 primary button의 Tailwind className. */
const SUBTITLE_PRIMARY_BUTTON_CLASS_NAME =
  'subtitle-primary-button inline-flex min-h-[48px] items-center justify-center gap-mytube-8 border border-mytube-action-primary rounded-mytube-md bg-mytube-action-primary text-mytube-on-primary cursor-pointer text-[18px] font-semibold leading-[1] shadow-mytube-soft focus-visible:outline-2 focus-visible:outline-mytube-focus focus-visible:outline-offset-2 hover:brightness-[0.92] active:brightness-[0.84] disabled:border-mytube-border disabled:bg-mytube-surface-alt disabled:text-mytube-text-disabled disabled:cursor-not-allowed disabled:shadow-none';
/** 자막 접수 중 취소 button의 Tailwind width className. */
const SUBTITLE_CANCEL_BUTTON_CLASS_NAME =
  `${SUBTITLE_SECONDARY_BUTTON_CLASS_NAME} w-full`;
/** 자막 접수 중 경계 안내의 Tailwind typography className. */
const SUBTITLE_CANCEL_BOUNDARY_CLASS_NAME =
  'subtitle-cancel-boundary m-0 text-mytube-text-secondary text-[14px] leading-[1.5] break-keep [overflow-wrap:anywhere]';
/** 자막 요청 경합 결과 안내의 Tailwind typography className. */
const SUBTITLE_REQUEST_NOTICE_CLASS_NAME =
  'subtitle-request-notice m-0 text-mytube-text-primary text-[14px] leading-[1.5] break-keep [overflow-wrap:anywhere]';

/** 자막 추출 route page. */
export function SubtitlesExtractPage() {
  // Hooks.

  /** 자막 업로드 form, job 상태, 사용자 동작. */
  const {
    canSubmit, canChangeWhisperModel, cancelRequest, clearSelectedFile, currentStepKey, downloadHref, fileInputRef,
    fileFeedbackIsError, fileFeedbackMessage, filePickerButtonRef,
    filledProgressCells, handleDropzoneDragOver, handleDropzoneDrop, handleFileInputChange,
    handleFilePickerOpen, handleSubtitleSubmit, handleWhisperModelChange, isSubtitlePending,
    requestNotice, retryWorkerHealth, returnToRequest, selectedFile, selectedFileMeta,
    selectedWhisperModel, statusErrorDetail, statusIconName, statusJob, statusMessage, statusTitle,
    statusTone, submitDisabledReason, viewPhase, workerHealthCheckedAt, workerHealthFailed,
    workerHealthDetail, workerHealthIsFetching, workerHealthIsRefreshing, workerHealthStatus,
  } = useSubtitlesExtractLogic();

  if (
    viewPhase === 'request' &&
    workerHealthStatus.kind !== 'ready'
  ) {
    return (
      <RequestReadinessPanel
        healthId={SUBTITLE_WORKER_HEALTH_TITLE_ID}
        icon="subtitle"
        id="subtitles-title"
        isFetching={workerHealthIsFetching}
        lastCheckedAt={workerHealthCheckedAt}
        status={workerHealthStatus}
        technicalDetail={workerHealthDetail}
        title="자막 추출"
        onRetry={retryWorkerHealth}
      />
    );
  }

  if (viewPhase === 'request') {
    return <section className={SUBTITLE_REQUEST_PANEL_CLASS_NAME} aria-labelledby="subtitles-title">
        <PanelTitle
          className={SUBTITLE_REQUEST_TITLE_CLASS_NAME}
          icon="subtitle"
          id="subtitles-title"
        isRefreshing={workerHealthIsRefreshing}
      >
        자막 추출
      </PanelTitle>
      <WorkerHealthStatusNotice
        id={SUBTITLE_WORKER_HEALTH_TITLE_ID}
        isFetching={workerHealthIsFetching}
        lastCheckedAt={workerHealthCheckedAt}
        status={workerHealthStatus}
        technicalDetail={workerHealthDetail}
        onRetry={retryWorkerHealth}
      />
      <RequestFlow current="source" />
      {requestNotice ? <RequestNotice message={requestNotice} /> : null}
      <form className={SUBTITLE_REQUEST_FORM_CLASS_NAME} onSubmit={handleSubtitleSubmit}>
        <div className={`${SUBTITLE_FILE_FIELD_CLASS_NAME}${fileFeedbackIsError ? ' has-error' : ''}`}>
          <span className={SUBTITLE_FILE_FIELD_LABEL_CLASS_NAME}>로컬 영상 파일</span>
          <input
            accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
            aria-hidden="true"
            className="subtitle-file-input hidden"
            hidden
            ref={fileInputRef}
            tabIndex={-1}
            type="file"
            onChange={handleFileInputChange}
          />
          <button
            aria-describedby={fileFeedbackMessage ? SUBTITLE_FILE_FEEDBACK_ID : undefined}
            aria-label={SUBTITLE_FILE_PICKER_LABEL}
            className={`${SUBTITLE_DROPZONE_CLASS_NAME}${fileFeedbackIsError ? ' !border-mytube-status-failed' : ''}`}
            ref={filePickerButtonRef}
            type="button"
            onClick={handleFilePickerOpen}
            onDragOver={handleDropzoneDragOver}
            onDrop={handleDropzoneDrop}
          >
            <AppIcon className={SUBTITLE_DROPZONE_ICON_CLASS_NAME} name="subtitle" />
            <strong className={SUBTITLE_DROPZONE_PRIMARY_COPY_CLASS_NAME}>영상 선택 또는 드래그</strong>
            <span className={SUBTITLE_DROPZONE_HINT_CLASS_NAME}>mp4, mov, webm</span>
          </button>
          <p className="keyboard-shortcut-hint"><kbd>F</kbd> 키로 파일 선택에 바로 포커스</p>
          {fileFeedbackMessage ? (
            <p
              className={`${SUBTITLE_FILE_FEEDBACK_CLASS_NAME}${fileFeedbackIsError ? ' !text-mytube-status-failed' : ''}`}
              id={SUBTITLE_FILE_FEEDBACK_ID}
              role={fileFeedbackIsError ? 'alert' : undefined}
            >
              {fileFeedbackMessage}
            </p>
          ) : null}
        </div>
        {selectedFile ? <div className={SUBTITLE_SELECTED_FILE_ROW_CLASS_NAME}><AppIcon className={SUBTITLE_SELECTED_FILE_ICON_CLASS_NAME} name="video" /><div className="min-w-0"><strong className={SUBTITLE_SELECTED_FILE_NAME_CLASS_NAME}>{selectedFile.name}</strong><span className={SUBTITLE_SELECTED_FILE_META_CLASS_NAME}>{selectedFileMeta}</span></div><button className={SUBTITLE_SELECTED_FILE_CLEAR_CLASS_NAME} type="button" onClick={clearSelectedFile}>지우기</button></div> : null}
        <fieldset
          aria-describedby="subtitle-processing-guidance"
          className={SUBTITLE_PROCESSING_METHOD_CLASS_NAME}
        >
          <legend className={SUBTITLE_PROCESSING_LEGEND_CLASS_NAME}>처리 방식</legend>
          <p className={SUBTITLE_PROCESSING_GUIDANCE_CLASS_NAME} id="subtitle-processing-guidance">
            {SUBTITLE_PROCESSING_GUIDANCE}
          </p>
          {SUBTITLE_PROCESSING_OPTIONS.map((option) => (
            <label
              className={`${SUBTITLE_PROCESSING_OPTION_BASE_CLASS_NAME}${selectedWhisperModel === option.value ? ` ${SUBTITLE_PROCESSING_OPTION_SELECTED_CLASS_NAME}` : ''}`}
              key={option.value}
            >
              <input
                checked={selectedWhisperModel === option.value}
                className={SUBTITLE_PROCESSING_OPTION_INPUT_CLASS_NAME}
                disabled={!canChangeWhisperModel}
                name="subtitle-whisper-model"
                type="radio"
                value={option.value}
                onChange={handleWhisperModelChange}
              />
              <AppIcon className={selectedWhisperModel === option.value ? 'text-mytube-action-primary' : undefined} name={option.icon} />
              <span className={SUBTITLE_PROCESSING_OPTION_COPY_CLASS_NAME}>
                <strong className={SUBTITLE_PROCESSING_OPTION_TITLE_CLASS_NAME}>{option.label}</strong>
                <span className={SUBTITLE_PROCESSING_OPTION_DESCRIPTION_CLASS_NAME}>{option.description}</span>
              </span>
            </label>
          ))}
          <details className={SUBTITLE_PROCESSING_DETAILS_CLASS_NAME}>
            <summary className={SUBTITLE_PROCESSING_SUMMARY_CLASS_NAME}>기술적인 처리 정보</summary>
            <div className={SUBTITLE_PROCESSING_TECHNICAL_CLASS_NAME}>
              <p className="m-0">{SUBTITLE_PROCESSING_TECHNICAL_NOTE}</p>
              {SUBTITLE_PROCESSING_OPTIONS.map((option) => (
                <p className="m-0" key={option.value}>{option.label}: {option.technicalDetail}</p>
              ))}
            </div>
          </details>
        </fieldset>
        <button
          aria-describedby={
            !canSubmit && submitDisabledReason
              ? 'subtitle-submit-disabled-reason'
              : undefined
          }
          className={SUBTITLE_SUBMIT_BUTTON_CLASS_NAME}
          disabled={!canSubmit}
          type="submit"
        >
          <AppIcon name="subtitle" />
          {isSubtitlePending ? '요청 중' : '영어 SRT 생성'}
        </button>
        {!canSubmit && submitDisabledReason ? (
          <p className={SUBTITLE_SUBMIT_DISABLED_REASON_CLASS_NAME} id="subtitle-submit-disabled-reason">
            {submitDisabledReason}
          </p>
        ) : null}
      </form>
    </section>;
  }

  if (viewPhase === 'processing') {
    return <section className={SUBTITLE_STATUS_PANEL_CLASS_NAME} aria-labelledby="subtitle-status-title">
      <PanelTitle icon="processing" id="subtitle-status-title">자막 추출</PanelTitle>
      <RequestFlow current="extract" />
      {requestNotice ? <RequestNotice message={requestNotice} /> : null}
      <StatusHead icon={statusIconName} tone={statusTone} title={statusTitle} message={statusMessage} />
      <div className={SUBTITLE_STEP_TABS_CLASS_NAME} aria-label="영어 SRT 처리 단계">
        {SUBTITLE_STEPS.map((step) => (
          <span
            aria-current={currentStepKey === step.key ? 'step' : undefined}
            className={
              currentStepKey === step.key
                ? `${SUBTITLE_STEP_TAB_BASE_CLASS_NAME} ${SUBTITLE_STEP_TAB_SELECTED_CLASS_NAME}`
                : SUBTITLE_STEP_TAB_BASE_CLASS_NAME
            }
            key={step.key}
          >
            {step.label}
          </span>
        ))}
      </div>
      <ProgressMeter filledCells={filledProgressCells} value={statusJob.progress} />
    </section>;
  }

  if (viewPhase === 'accepting') {
    return <section className={SUBTITLE_STATUS_PANEL_CLASS_NAME} aria-labelledby="subtitle-accepting-title">
      <PanelTitle icon="processing" id="subtitle-accepting-title">자막 추출</PanelTitle>
      <RequestFlow current="extract" />
      <StatusHead icon={statusIconName} tone={statusTone} title={statusTitle} message={statusMessage} />
      <button className={SUBTITLE_CANCEL_BUTTON_CLASS_NAME} type="button" onClick={cancelRequest}>
        요청 취소
      </button>
      <p className={SUBTITLE_CANCEL_BOUNDARY_CLASS_NAME}>서버 작업이 생성되기 전 요청만 중단합니다.</p>
    </section>;
  }

  if (viewPhase === 'result') {
    return <section className={SUBTITLE_STATUS_PANEL_CLASS_NAME} aria-labelledby="subtitle-result-title">
      <PanelTitle icon="completed" id="subtitle-result-title">자막 추출</PanelTitle>
      <RequestFlow current="receipt" />
      {requestNotice ? <RequestNotice message={requestNotice} /> : null}
      <StatusHead icon="completed" tone="completed" title={statusTitle} message={statusMessage} />
      <dl className={SUBTITLE_STATUS_DETAILS_CLASS_NAME}>
        <div className={SUBTITLE_STATUS_DETAIL_ROW_CLASS_NAME}><dt className={SUBTITLE_STATUS_DETAIL_LABEL_CLASS_NAME}>원본 파일</dt><dd className={SUBTITLE_STATUS_DETAIL_VALUE_CLASS_NAME}>{statusJob.fileName}</dd></div>
        <div className={SUBTITLE_STATUS_DETAIL_ROW_CLASS_NAME}><dt className={SUBTITLE_STATUS_DETAIL_LABEL_CLASS_NAME}>결과 형식</dt><dd className={SUBTITLE_STATUS_DETAIL_VALUE_CLASS_NAME}>영어 SRT</dd></div>
        <div className={SUBTITLE_STATUS_DETAIL_ROW_CLASS_NAME}><dt className={SUBTITLE_STATUS_DETAIL_LABEL_CLASS_NAME}>보관 기간</dt><dd className={SUBTITLE_STATUS_DETAIL_VALUE_CLASS_NAME}>완료 후 {statusJob.retentionDays}일</dd></div>
      </dl>
      <p className={SUBTITLE_RESULT_CONTEXT_CLASS_NAME}>
        완료 파일은 {statusJob.retentionDays}일 동안 보관되며, 요청 내역은 이 브라우저에만 남습니다.
      </p>
      <div className={SUBTITLE_RESULT_ACTIONS_CLASS_NAME}>
        <a className={SUBTITLE_DOWNLOAD_BUTTON_CLASS_NAME} download href={downloadHref}><AppIcon name="download" />영어 SRT 다운로드</a>
        <button className={SUBTITLE_NEW_REQUEST_BUTTON_CLASS_NAME} type="button" onClick={returnToRequest}>새 요청</button>
      </div>
    </section>;
  }

  return <section className={SUBTITLE_STATUS_PANEL_CLASS_NAME} aria-labelledby="subtitle-error-title">
    <PanelTitle icon={statusIconName} id="subtitle-error-title">자막 추출</PanelTitle>
    <RequestFlow current="extract" />
    <StatusHead icon={statusIconName} tone={statusTone} title={statusTitle} message={statusMessage} isAlert />
    {workerHealthFailed ? <button className={SUBTITLE_SECONDARY_BUTTON_CLASS_NAME} disabled={workerHealthIsFetching} type="button" onClick={retryWorkerHealth}>다시 확인</button> : null}
    <ErrorDetailsDisclosure detail={statusErrorDetail} summary={SUBTITLE_ERROR_DETAIL_SUMMARY} />
    <button className={SUBTITLE_PRIMARY_BUTTON_CLASS_NAME} type="button" onClick={returnToRequest}>요청 설정으로 돌아가기</button>
  </section>;
}

/** 상태 제목과 안내 문구를 렌더링한다. */
function StatusHead(props: { /** 상태 아이콘. */ icon: AppIconName; /** 상태 색상. */ tone: SubtitleStatusTone; /** 상태 제목. */ title: string; /** 상태 설명. */ message: string; /** 오류 알림 여부. */ isAlert?: boolean }) {
  /** 현재 상태에 맞춘 semantic tone className. */
  const toneClassNames = SUBTITLE_STATUS_TONE_CLASS_NAMES[props.tone];

  return <div className={SUBTITLE_STATUS_HEAD_CLASS_NAME}><span className={`${SUBTITLE_STATUS_ICON_CLASS_NAME} ${toneClassNames.icon}`} aria-hidden="true"><AppIcon name={props.icon} /></span><div className={SUBTITLE_STATUS_COPY_CLASS_NAME}><h3 className={`${SUBTITLE_STATUS_TITLE_CLASS_NAME} ${toneClassNames.title}`}>{props.title}</h3><p className={SUBTITLE_STATUS_MESSAGE_CLASS_NAME} role={props.isAlert ? 'alert' : 'status'} aria-live="polite">{props.message}</p></div></div>;
}

/** 자막 job 진행률을 meter와 화면 표시 문구로 렌더링한다. */
function ProgressMeter(props: { /** 채울 pixel cell 수. */ filledCells: number; /** API 진행률 값. */ value: number | null }) {
  /** 시각 사용자와 보조 기술에 함께 제공할 진행률 문구. */
  const progressLabel = props.value === null ? '처리 중' : `진행률 ${props.value}%`;

  return <><div className={SUBTITLE_PROGRESS_METER_CLASS_NAME} aria-label="진행률" aria-valuemax={100} aria-valuemin={0} aria-valuenow={props.value ?? undefined} aria-valuetext={progressLabel} role="progressbar">{Array.from({ length: 10 }).map((_, index) => <span className={index < props.filledCells ? `${SUBTITLE_PROGRESS_CELL_CLASS_NAME} ${SUBTITLE_PROGRESS_FILLED_CELL_CLASS_NAME}` : SUBTITLE_PROGRESS_CELL_CLASS_NAME} key={index} />)}</div><p className={SUBTITLE_PROGRESS_LABEL_CLASS_NAME}>{progressLabel}</p></>;
}

/** 요청 중단·접수 경쟁 결과를 현재 화면에 알린다. */
function RequestNotice(props: { /** 사용자에게 전달할 안내 문구. */ message: string }) {
  return <p className={SUBTITLE_REQUEST_NOTICE_CLASS_NAME} role="status" aria-live="polite">{props.message}</p>;
}
