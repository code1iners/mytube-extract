import { type DownloadDisplayStatus } from '../../../domain/download-request/download-request';
import { ErrorDetailsDisclosure } from '../../components/error-details-disclosure';
import { AppIcon, type AppIconName } from '../../components/app-icon';
import { PanelTitle } from '../../components/panel-title';
import { RequestFlow } from '../../components/request-flow';
import { RequestReadinessPanel } from '../../components/request-readiness-panel';
import { WorkerHealthStatusNotice } from '../../components/worker-health-status';
import { useVideoExtractLogic } from './_hooks/use-video-extract-logic';

/** 처리 화면에서 표시할 영상 추출 단계. */
const STATUS_ITEMS = [
  { icon: 'queued', key: 'queued', label: '대기' },
  { icon: 'processing', key: 'processing', label: '처리' },
  { icon: 'completed', key: 'completed', label: '완료' },
] as const satisfies Array<{
  /** 상태 아이콘 이름. */
  icon: AppIconName;
  /** 표시 상태 key. */
  key: DownloadDisplayStatus;
  /** 화면 라벨. */
  label: string;
}>;

/** 영상 오류 상세 위에 표시할 평이한 요약. */
const VIDEO_ERROR_DETAIL_SUMMARY =
  '영상 추출 요청이 정상적으로 처리되지 않았습니다.';
/** 영상 route worker health 제목 id. */
const VIDEO_WORKER_HEALTH_TITLE_ID = 'video-worker-health-title';
/** 영상 요청 panel의 Tailwind layout className. */
const VIDEO_REQUEST_PANEL_CLASS_NAME =
  'phase-panel video-request-panel grid min-w-0 w-full max-w-none gap-mytube-24 m-0 p-0 min-[821px]:self-start max-[560px]:gap-mytube-16';
/** 영상 요청 form의 Tailwind layout className. */
const VIDEO_REQUEST_FORM_CLASS_NAME = 'download-form grid gap-mytube-24';
/** 영상 URL field의 Tailwind layout className. */
const VIDEO_URL_FIELD_CLASS_NAME = 'field field--wide grid gap-mytube-8';
/** 영상 URL field label의 Tailwind typography className. */
const VIDEO_URL_FIELD_LABEL_CLASS_NAME =
  'field-label text-mytube-text-primary text-[16px] font-semibold leading-[1.4]';
/** 영상 URL 입력 frame의 Tailwind layout·state className. */
const VIDEO_URL_INPUT_FRAME_CLASS_NAME =
  'url-input-frame grid min-h-[48px] w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center border border-mytube-border rounded-mytube-md bg-mytube-surface focus-within:border-mytube-focus focus-within:outline-2 focus-within:outline-mytube-focus focus-within:outline-offset-2';
/** 영상 URL input의 Tailwind reset·typography className. */
const VIDEO_URL_INPUT_CLASS_NAME =
  'w-full min-w-0 min-h-[44px] border-0 bg-transparent py-[9px] pr-[13px] pl-0 text-mytube-text-primary outline-none focus-visible:!outline-none';
/** 영상 URL 지우기 button의 Tailwind state className. */
const VIDEO_URL_RESET_CLASS_NAME =
  'url-reset-button min-w-[44px] min-h-[44px] mr-mytube-8 px-mytube-8 border border-mytube-border rounded-mytube-sm bg-mytube-surface-alt text-mytube-text-secondary cursor-pointer text-[14px] font-semibold focus-visible:outline-2 focus-visible:outline-mytube-focus focus-visible:outline-offset-2 hover:bg-mytube-surface-alt hover:text-mytube-text-primary';
/** 영상 URL 입력 피드백의 Tailwind typography className. */
const VIDEO_FIELD_FEEDBACK_CLASS_NAME =
  'field-feedback m-[-2px_0_0] text-mytube-text-secondary text-[14px] leading-[1.4]';
/** 영상 요청 fieldset의 Tailwind layout className. */
const VIDEO_OPTION_FIELDSET_CLASS_NAME =
  'grid min-w-0 gap-y-[12px] gap-x-mytube-8 m-0 border-0 p-0';
/** 영상 형식 선택 fieldset의 Tailwind column className. */
const VIDEO_FORMAT_FIELDSET_CLASS_NAME =
  `segmented-control ${VIDEO_OPTION_FIELDSET_CLASS_NAME} grid-cols-2`;
/** 영상 품질 선택 fieldset의 Tailwind column className. */
const VIDEO_QUALITY_FIELDSET_CLASS_NAME =
  `quality-grid ${VIDEO_OPTION_FIELDSET_CLASS_NAME} grid-cols-3`;
/** 영상 option legend의 Tailwind typography className. */
const VIDEO_OPTION_LEGEND_CLASS_NAME =
  'col-span-full m-0 mb-mytube-12 p-0 text-mytube-text-primary text-[16px] font-semibold leading-[1.4]';
/** 영상 option label의 공통 Tailwind layout·state className. */
const VIDEO_OPTION_BASE_CLASS_NAME =
  'flex min-h-[48px] items-center justify-center gap-mytube-8 border border-mytube-border rounded-mytube-md bg-mytube-surface text-mytube-text-secondary cursor-pointer font-semibold focus-within:outline-2 focus-within:outline-mytube-focus focus-within:outline-offset-2 hover:bg-mytube-surface-alt hover:text-mytube-text-primary';
/** 선택된 영상 option의 Tailwind state className. */
const VIDEO_OPTION_SELECTED_CLASS_NAME =
  'is-selected !border-mytube-action-primary bg-mytube-surface !text-mytube-text-primary underline decoration-mytube-text-primary decoration-2 underline-offset-4';
/** 영상 option 안의 native radio input을 시각적으로 숨기는 className. */
const VIDEO_OPTION_INPUT_CLASS_NAME =
  'absolute h-px w-px opacity-0';
/** 영상 제출 button의 Tailwind state className. */
const VIDEO_SUBMIT_BUTTON_CLASS_NAME =
  'video-submit-button inline-flex w-full min-h-[48px] items-center justify-center gap-mytube-8 border border-mytube-action-primary rounded-mytube-md bg-mytube-action-primary text-mytube-on-primary cursor-pointer text-[18px] font-semibold leading-[1] shadow-mytube-soft focus-visible:outline-2 focus-visible:outline-mytube-focus focus-visible:outline-offset-2 enabled:hover:brightness-[0.92] enabled:active:brightness-[0.84] disabled:border-mytube-border disabled:bg-mytube-surface-alt disabled:text-mytube-text-disabled disabled:cursor-not-allowed disabled:!shadow-none';
/** 영상 제출 불가 사유의 Tailwind typography className. */
const VIDEO_SUBMIT_DISABLED_REASON_CLASS_NAME =
  'video-submit-disabled-reason m-[-12px_0_0] text-mytube-text-secondary text-[14px] leading-[1.4] break-keep';
/** 영상 생명주기 panel의 Tailwind surface·layout className. */
const VIDEO_STATUS_PANEL_CLASS_NAME =
  'video-status-panel grid min-w-0 w-full max-w-none m-0 gap-[18px] border border-mytube-border rounded-mytube-lg bg-mytube-surface p-[20px] shadow-mytube-soft max-[821px]:p-mytube-16';
/** 영상 상태 제목 영역의 Tailwind layout className. */
const VIDEO_STATUS_HEAD_CLASS_NAME =
  'video-status-head grid min-w-0 grid-cols-[64px_minmax(0,1fr)] items-center gap-mytube-16 max-[821px]:grid-cols-[52px_minmax(0,1fr)] max-[821px]:gap-mytube-12';
/** 영상 상태 아이콘의 Tailwind shape·layout className. */
const VIDEO_STATUS_ICON_CLASS_NAME =
  'video-status-icon grid size-[64px] shrink-0 place-items-center border rounded-mytube-full max-[821px]:size-[48px]';
/** 영상 상태 제목과 설명을 감싸는 Tailwind overflow className. */
const VIDEO_STATUS_COPY_CLASS_NAME = 'min-w-0';
/** 영상 상태 제목의 Tailwind typography className. */
const VIDEO_STATUS_TITLE_CLASS_NAME =
  'm-0 text-[21px] font-semibold leading-[1.3] max-[821px]:text-[19px]';
/** 영상 상태 설명의 Tailwind typography·overflow className. */
const VIDEO_STATUS_MESSAGE_CLASS_NAME =
  'm-[6px_0_0] text-mytube-text-secondary text-[16px] leading-[1.4] break-keep break-words';
/** 영상 상태 제목·아이콘 tone에 적용할 Tailwind className 묶음. */
type VideoStatusToneClassNames = {
  /** 상태 아이콘의 테두리·색상. */
  icon: string;
  /** 상태 제목의 색상. */
  title: string;
};
/** 영상 상태별 semantic token 연결. */
const VIDEO_STATUS_TONE_CLASS_NAMES: Record<
  DownloadDisplayStatus,
  VideoStatusToneClassNames
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
/** 영상 작업 단계 목록의 Tailwind layout className. */
const VIDEO_STEP_TABS_CLASS_NAME =
  'video-step-tabs grid min-w-0 grid-cols-4 gap-mytube-8';
/** 영상 작업 단계 항목의 Tailwind surface·typography className. */
const VIDEO_STEP_TAB_BASE_CLASS_NAME =
  'video-step-tab inline-flex min-w-0 min-h-[44px] items-center justify-center gap-[6px] border border-mytube-border rounded-mytube-md bg-mytube-surface text-mytube-text-secondary font-semibold max-[821px]:min-h-[40px] max-[821px]:text-[13px]';
/** 현재 영상 작업 단계의 Tailwind state className. */
const VIDEO_STEP_TAB_SELECTED_CLASS_NAME =
  'border-mytube-status-processing bg-mytube-surface-alt text-mytube-status-processing';
/** 영상 진행률 meter의 Tailwind layout className. */
const VIDEO_PROGRESS_METER_CLASS_NAME =
  'video-progress-meter grid min-w-0 grid-cols-10 gap-mytube-4';
/** 영상 진행률 cell의 기본 Tailwind surface className. */
const VIDEO_PROGRESS_CELL_CLASS_NAME =
  'h-[8px] rounded-mytube-full bg-mytube-surface-alt';
/** 채워진 영상 진행률 cell의 Tailwind status className. */
const VIDEO_PROGRESS_FILLED_CELL_CLASS_NAME =
  'bg-mytube-status-processing';
/** 영상 진행률 보조 문구의 Tailwind typography className. */
const VIDEO_PROGRESS_LABEL_CLASS_NAME =
  'video-progress-label m-0 text-mytube-status-processing text-[16px] font-semibold text-center';
/** 영상 상태 상세 목록의 Tailwind layout className. */
const VIDEO_STATUS_DETAILS_CLASS_NAME =
  'video-status-details grid min-w-0 gap-0 m-0 border-t border-mytube-border';
/** 영상 상태 상세 한 행의 Tailwind layout·border className. */
const VIDEO_STATUS_DETAIL_ROW_CLASS_NAME =
  'grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-mytube-16 border-b border-mytube-border py-[11px]';
/** 영상 상태 상세 label의 Tailwind typography className. */
const VIDEO_STATUS_DETAIL_LABEL_CLASS_NAME =
  'm-0 text-mytube-text-secondary text-[14px] font-normal';
/** 영상 상태 상세 value의 Tailwind typography·overflow className. */
const VIDEO_STATUS_DETAIL_VALUE_CLASS_NAME =
  'm-0 min-w-0 text-mytube-text-primary text-[14px] font-semibold text-right [overflow-wrap:anywhere]';
/** 영상 완료 결과 보조 문구의 Tailwind typography·overflow className. */
const VIDEO_RESULT_CONTEXT_CLASS_NAME =
  'm-0 text-mytube-text-secondary text-[14px] leading-[1.4] break-keep [overflow-wrap:anywhere]';
/** 영상 완료 결과 action 영역의 Tailwind layout className. */
const VIDEO_RESULT_ACTIONS_CLASS_NAME =
  'video-result-actions grid min-w-0 grid-cols-[minmax(0,1fr)_160px] gap-mytube-12 mt-[20px] max-[561px]:grid-cols-1';
/** 영상 완료 결과 다운로드 link의 Tailwind button className. */
const VIDEO_DOWNLOAD_BUTTON_CLASS_NAME =
  'video-download-button inline-flex w-full min-h-[48px] items-center justify-center gap-mytube-8 border border-mytube-action-primary rounded-mytube-md bg-mytube-action-primary text-mytube-on-primary cursor-pointer text-[18px] font-semibold leading-[1] no-underline shadow-mytube-soft focus-visible:outline-2 focus-visible:outline-mytube-focus focus-visible:outline-offset-2 hover:brightness-[0.92] active:brightness-[0.84]';
/** 영상 보조 button의 공통 Tailwind className. */
const VIDEO_SECONDARY_BUTTON_CLASS_NAME =
  'inline-flex min-h-[44px] items-center justify-center border border-mytube-border rounded-mytube-md bg-mytube-surface text-mytube-text-primary cursor-pointer text-[16px] font-semibold focus-visible:outline-2 focus-visible:outline-mytube-focus focus-visible:outline-offset-2 hover:bg-mytube-surface-alt hover:text-mytube-text-primary disabled:text-mytube-text-disabled disabled:cursor-not-allowed';
/** 영상 완료 결과의 새 요청 button className. */
const VIDEO_NEW_REQUEST_BUTTON_CLASS_NAME =
  `${VIDEO_SECONDARY_BUTTON_CLASS_NAME} min-h-[48px] gap-mytube-8 px-mytube-16`;
/** 영상 오류 재시도·복귀 primary button의 Tailwind className. */
const VIDEO_PRIMARY_BUTTON_CLASS_NAME =
  'inline-flex min-h-[48px] items-center justify-center gap-mytube-8 border border-mytube-action-primary rounded-mytube-md bg-mytube-action-primary text-mytube-on-primary cursor-pointer text-[18px] font-semibold leading-[1] shadow-mytube-soft focus-visible:outline-2 focus-visible:outline-mytube-focus focus-visible:outline-offset-2 hover:brightness-[0.92] active:brightness-[0.84] disabled:border-mytube-border disabled:bg-mytube-surface-alt disabled:text-mytube-text-disabled disabled:cursor-not-allowed disabled:shadow-none';
/** 영상 접수 중 취소 button의 Tailwind width className. */
const VIDEO_CANCEL_BUTTON_CLASS_NAME =
  `${VIDEO_SECONDARY_BUTTON_CLASS_NAME} w-full`;
/** 영상 접수 중 경계 안내의 Tailwind typography className. */
const VIDEO_CANCEL_BOUNDARY_CLASS_NAME =
  'video-cancel-boundary m-0 text-mytube-text-secondary text-[14px] leading-[1.5] break-keep [overflow-wrap:anywhere]';
/** 영상 요청 경합 결과 안내의 Tailwind typography className. */
const VIDEO_REQUEST_NOTICE_CLASS_NAME =
  'video-request-notice m-0 text-mytube-text-primary text-[14px] leading-[1.5] break-keep [overflow-wrap:anywhere]';

/** 영상 추출 route page. */
export function VideoExtractPage() {
  // Hooks.

  /** 영상 추출 form, job 상태, 사용자 동작. */
  const {
    canSubmit,
    cancelRequest,
    clearRequestError,
    createdTime,
    downloadHref,
    draft,
    filledProgressCells,
    handleDownloadFormSubmit,
    handleModeChange,
    handleSourceUrlReset,
    isDownloadPending,
    progressLabel,
    qualityOptions,
    register,
    requestNotice,
    retryWorkerHealth,
    returnToRequest,
    statusErrorDetail,
    statusIconName,
    statusJob,
    statusMessage,
    statusQualityLabel,
    statusTitle,
    statusTone,
    statusTypeLabel,
    submitDisabledReason,
    validation,
    viewPhase,
    workerHealthFailed,
    workerHealthCheckedAt,
    workerHealthDetail,
    workerHealthIsFetching,
    workerHealthIsRefreshing,
    workerHealthStatus,
  } = useVideoExtractLogic();

  if (
    viewPhase === 'request' &&
    workerHealthStatus.kind !== 'ready'
  ) {
    return (
      <RequestReadinessPanel
        healthId={VIDEO_WORKER_HEALTH_TITLE_ID}
        icon="download"
        id="request-title"
        isFetching={workerHealthIsFetching}
        lastCheckedAt={workerHealthCheckedAt}
        status={workerHealthStatus}
        technicalDetail={workerHealthDetail}
        title="영상 추출"
        onRetry={retryWorkerHealth}
      />
    );
  }

  if (viewPhase === 'request') {
    return (
      <section className={VIDEO_REQUEST_PANEL_CLASS_NAME} aria-labelledby="request-title">
        <PanelTitle
          icon="download"
          id="request-title"
          isRefreshing={workerHealthIsRefreshing}
        >
          영상 추출
        </PanelTitle>
        <WorkerHealthStatusNotice
          id={VIDEO_WORKER_HEALTH_TITLE_ID}
          isFetching={workerHealthIsFetching}
          lastCheckedAt={workerHealthCheckedAt}
          status={workerHealthStatus}
          technicalDetail={workerHealthDetail}
          onRetry={retryWorkerHealth}
        />
        <RequestFlow current="source" />
        {requestNotice ? <RequestNotice message={requestNotice} /> : null}

        <form className={VIDEO_REQUEST_FORM_CLASS_NAME} onSubmit={handleDownloadFormSubmit}>
          <label className={`${VIDEO_URL_FIELD_CLASS_NAME}${validation.kind === 'invalid' ? ' has-error' : ''}`}>
            <span className={VIDEO_URL_FIELD_LABEL_CLASS_NAME}>YouTube URL</span>
            <span className={`${VIDEO_URL_INPUT_FRAME_CLASS_NAME}${validation.kind === 'invalid' ? ' !border-mytube-status-failed' : ''}`}>
              <AppIcon className="input-icon justify-self-center text-mytube-text-secondary" name="link" />
              <input
                autoComplete="off"
                aria-describedby={validation.kind === 'ready' ? undefined : 'video-source-url-feedback'}
                aria-invalid={validation.kind === 'invalid' || undefined}
                className={VIDEO_URL_INPUT_CLASS_NAME}
                placeholder="https://www.youtube.com/watch?v=..."
                type="url"
                {...register('sourceUrl', { onChange: clearRequestError })}
              />
              {draft.sourceUrl ? (
                <button
                  className={VIDEO_URL_RESET_CLASS_NAME}
                  type="button"
                  onClick={handleSourceUrlReset}
                >
                  지우기
                </button>
              ) : null}
            </span>
            {validation.kind !== 'ready' ? <p className={`${VIDEO_FIELD_FEEDBACK_CLASS_NAME}${validation.kind === 'invalid' ? ' text-mytube-status-failed' : ''}`} id="video-source-url-feedback" role={validation.kind === 'invalid' ? 'alert' : undefined}>{validation.message}</p> : null}
            <p className="keyboard-shortcut-hint"><kbd>U</kbd> 키로 URL 입력에 바로 포커스</p>
          </label>

          <fieldset className={VIDEO_FORMAT_FIELDSET_CLASS_NAME}>
            <legend className={VIDEO_OPTION_LEGEND_CLASS_NAME}>추출 형식</legend>
            <label className={`${VIDEO_OPTION_BASE_CLASS_NAME}${draft.mode === 'audio' ? ` ${VIDEO_OPTION_SELECTED_CLASS_NAME}` : ''} segment`}>
              <input className={VIDEO_OPTION_INPUT_CLASS_NAME} checked={draft.mode === 'audio'} type="radio" value="audio" {...register('mode', { onChange: handleModeChange })} />
              <AppIcon className={draft.mode === 'audio' ? 'text-mytube-action-primary' : ''} name="audio" />
              오디오 (MP3)
            </label>
            <label className={`${VIDEO_OPTION_BASE_CLASS_NAME}${draft.mode === 'video' ? ` ${VIDEO_OPTION_SELECTED_CLASS_NAME}` : ''} segment`}>
              <input className={VIDEO_OPTION_INPUT_CLASS_NAME} checked={draft.mode === 'video'} type="radio" value="video" {...register('mode', { onChange: handleModeChange })} />
              <AppIcon className={draft.mode === 'video' ? 'text-mytube-action-primary' : ''} name="video" />
              비디오 (MP4)
            </label>
          </fieldset>

          <fieldset className={VIDEO_QUALITY_FIELDSET_CLASS_NAME}>
            <legend className={VIDEO_OPTION_LEGEND_CLASS_NAME}>품질</legend>
            {qualityOptions.map((option) => (
              <label className={`${VIDEO_OPTION_BASE_CLASS_NAME}${draft.quality === option.value ? ` ${VIDEO_OPTION_SELECTED_CLASS_NAME}` : ''} quality-chip`} key={option.value}>
                <input className={VIDEO_OPTION_INPUT_CLASS_NAME} type="radio" value={option.value} {...register('quality', { onChange: clearRequestError })} />
                {option.label}
              </label>
            ))}
          </fieldset>

          <button
            aria-describedby={
              !canSubmit && submitDisabledReason
                ? 'video-submit-disabled-reason'
                : undefined
            }
            className={VIDEO_SUBMIT_BUTTON_CLASS_NAME}
            disabled={!canSubmit}
            type="submit"
          >
            <AppIcon name="download" />
            {isDownloadPending ? '요청 중' : '추출 요청'}
          </button>
          {!canSubmit && submitDisabledReason ? (
            <p className={VIDEO_SUBMIT_DISABLED_REASON_CLASS_NAME} id="video-submit-disabled-reason">
              {submitDisabledReason}
            </p>
          ) : null}
        </form>
      </section>
    );
  }

  if (viewPhase === 'processing') {
    return (
      <section className={VIDEO_STATUS_PANEL_CLASS_NAME} aria-labelledby="status-title">
        <PanelTitle icon="processing" id="status-title">영상 추출</PanelTitle>
        <RequestFlow current="extract" />
        {requestNotice ? <RequestNotice message={requestNotice} /> : null}
        <StatusHead icon={statusIconName} tone={statusTone} title={statusTitle} message={statusMessage} />
        <div className={VIDEO_STEP_TABS_CLASS_NAME} aria-label="작업 단계">
          {STATUS_ITEMS.map((item) => (
            <span
              aria-current={statusJob.displayStatus === item.key ? 'step' : undefined}
              className={
                statusJob.displayStatus === item.key
                  ? `${VIDEO_STEP_TAB_BASE_CLASS_NAME} ${VIDEO_STEP_TAB_SELECTED_CLASS_NAME}`
                  : VIDEO_STEP_TAB_BASE_CLASS_NAME
              }
              key={item.key}
            >
              <AppIcon name={item.icon} />
              {item.label}
            </span>
          ))}
        </div>
        <ProgressMeter filledCells={filledProgressCells} label={progressLabel} value={statusJob.progress} />
        <dl className={VIDEO_STATUS_DETAILS_CLASS_NAME}>
          <div className={VIDEO_STATUS_DETAIL_ROW_CLASS_NAME}><dt className={VIDEO_STATUS_DETAIL_LABEL_CLASS_NAME}>형식</dt><dd className={VIDEO_STATUS_DETAIL_VALUE_CLASS_NAME}>{statusTypeLabel}</dd></div>
          <div className={VIDEO_STATUS_DETAIL_ROW_CLASS_NAME}><dt className={VIDEO_STATUS_DETAIL_LABEL_CLASS_NAME}>품질</dt><dd className={VIDEO_STATUS_DETAIL_VALUE_CLASS_NAME}>{statusQualityLabel}</dd></div>
          <div className={VIDEO_STATUS_DETAIL_ROW_CLASS_NAME}><dt className={VIDEO_STATUS_DETAIL_LABEL_CLASS_NAME}>요청 시작</dt><dd className={VIDEO_STATUS_DETAIL_VALUE_CLASS_NAME}>{createdTime}</dd></div>
          <div className={VIDEO_STATUS_DETAIL_ROW_CLASS_NAME}><dt className={VIDEO_STATUS_DETAIL_LABEL_CLASS_NAME}>보관 기간</dt><dd className={VIDEO_STATUS_DETAIL_VALUE_CLASS_NAME}>완료 후 {statusJob.retentionDays}일</dd></div>
        </dl>
      </section>
    );
  }

  if (viewPhase === 'accepting') {
    return (
      <section className={VIDEO_STATUS_PANEL_CLASS_NAME} aria-labelledby="accepting-title">
        <PanelTitle icon="processing" id="accepting-title">영상 추출</PanelTitle>
        <RequestFlow current="extract" />
        <StatusHead icon={statusIconName} tone={statusTone} title={statusTitle} message={statusMessage} />
        <button className={VIDEO_CANCEL_BUTTON_CLASS_NAME} type="button" onClick={cancelRequest}>
          요청 취소
        </button>
        <p className={VIDEO_CANCEL_BOUNDARY_CLASS_NAME}>서버 작업이 생성되기 전 요청만 중단합니다.</p>
      </section>
    );
  }

  if (viewPhase === 'result') {
    return (
      <section className={VIDEO_STATUS_PANEL_CLASS_NAME} aria-labelledby="result-title">
        <PanelTitle icon="completed" id="result-title">영상 추출</PanelTitle>
        <RequestFlow current="receipt" />
        {requestNotice ? <RequestNotice message={requestNotice} /> : null}
        <StatusHead icon="completed" tone="completed" title={statusTitle} message={statusMessage} />
        <dl className={VIDEO_STATUS_DETAILS_CLASS_NAME}>
          <div className={VIDEO_STATUS_DETAIL_ROW_CLASS_NAME}><dt className={VIDEO_STATUS_DETAIL_LABEL_CLASS_NAME}>결과 형식</dt><dd className={VIDEO_STATUS_DETAIL_VALUE_CLASS_NAME}>{statusTypeLabel}</dd></div>
          <div className={VIDEO_STATUS_DETAIL_ROW_CLASS_NAME}><dt className={VIDEO_STATUS_DETAIL_LABEL_CLASS_NAME}>품질</dt><dd className={VIDEO_STATUS_DETAIL_VALUE_CLASS_NAME}>{statusQualityLabel}</dd></div>
          <div className={VIDEO_STATUS_DETAIL_ROW_CLASS_NAME}><dt className={VIDEO_STATUS_DETAIL_LABEL_CLASS_NAME}>보관 기간</dt><dd className={VIDEO_STATUS_DETAIL_VALUE_CLASS_NAME}>완료 후 {statusJob.retentionDays}일</dd></div>
        </dl>
        <p className={VIDEO_RESULT_CONTEXT_CLASS_NAME}>
          완료 파일은 {statusJob.retentionDays}일 동안 보관되며, 요청 내역은 이 브라우저에만 남습니다.
        </p>
        <div className={VIDEO_RESULT_ACTIONS_CLASS_NAME}>
          <a className={VIDEO_DOWNLOAD_BUTTON_CLASS_NAME} download href={downloadHref}><AppIcon name="download" />다운로드</a>
          <button className={VIDEO_NEW_REQUEST_BUTTON_CLASS_NAME} type="button" onClick={returnToRequest}><AppIcon name="newRequest" />새 요청</button>
        </div>
      </section>
    );
  }

  return (
    <section className={VIDEO_STATUS_PANEL_CLASS_NAME} aria-labelledby="error-title">
      <PanelTitle icon={statusIconName} id="error-title">영상 추출</PanelTitle>
      <RequestFlow current="extract" />
      <StatusHead icon={statusIconName} tone={statusTone} title={statusTitle} message={statusMessage} isAlert />
      {workerHealthFailed ? (
        <button className={VIDEO_SECONDARY_BUTTON_CLASS_NAME} disabled={workerHealthIsFetching} type="button" onClick={retryWorkerHealth}>다시 확인</button>
      ) : null}
      <ErrorDetailsDisclosure
        detail={statusErrorDetail}
        summary={VIDEO_ERROR_DETAIL_SUMMARY}
      />
      <button className={VIDEO_PRIMARY_BUTTON_CLASS_NAME} type="button" onClick={returnToRequest}>요청 설정으로 돌아가기</button>
    </section>
  );
}

/** 상태 제목과 안내 문구를 렌더링한다. */
function StatusHead(props: { /** 상태 아이콘. */ icon: AppIconName; /** 상태 색상. */ tone: DownloadDisplayStatus; /** 상태 제목. */ title: string; /** 상태 설명. */ message: string; /** 오류 알림 여부. */ isAlert?: boolean }) {
  /** 현재 상태에 맞춘 semantic tone className. */
  const toneClassNames = VIDEO_STATUS_TONE_CLASS_NAMES[props.tone];

  return <div className={VIDEO_STATUS_HEAD_CLASS_NAME}><span className={`${VIDEO_STATUS_ICON_CLASS_NAME} ${toneClassNames.icon}`} aria-hidden="true"><AppIcon name={props.icon} /></span><div className={VIDEO_STATUS_COPY_CLASS_NAME}><h3 className={`${VIDEO_STATUS_TITLE_CLASS_NAME} ${toneClassNames.title}`}>{props.title}</h3><p className={VIDEO_STATUS_MESSAGE_CLASS_NAME} role={props.isAlert ? 'alert' : 'status'} aria-live="polite">{props.message}</p></div></div>;
}

/** 10칸 진행률과 보조 텍스트를 렌더링한다. */
function ProgressMeter(props: { /** 채울 pixel cell 수. */ filledCells: number; /** 진행률 라벨. */ label: string; /** API 진행률 값. */ value: number | null }) {
  return <><div className={VIDEO_PROGRESS_METER_CLASS_NAME} aria-label="진행률" aria-valuemax={100} aria-valuemin={0} aria-valuenow={props.value ?? undefined} role="progressbar">{Array.from({ length: 10 }).map((_, index) => <span className={index < props.filledCells ? `${VIDEO_PROGRESS_CELL_CLASS_NAME} ${VIDEO_PROGRESS_FILLED_CELL_CLASS_NAME}` : VIDEO_PROGRESS_CELL_CLASS_NAME} key={index} />)}</div><p className={VIDEO_PROGRESS_LABEL_CLASS_NAME}>{props.label}</p></>;
}

/** 요청 중단·접수 경쟁 결과를 현재 화면에 알린다. */
function RequestNotice(props: { /** 사용자에게 전달할 안내 문구. */ message: string }) {
  return <p className={VIDEO_REQUEST_NOTICE_CLASS_NAME} role="status" aria-live="polite">{props.message}</p>;
}
