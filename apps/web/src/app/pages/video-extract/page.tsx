import { type DownloadDisplayStatus } from '../../../domain/download-request/download-request';
import { ErrorDetailsDisclosure } from '../../components/error-details-disclosure';
import { AppIcon, type AppIconName } from '../../components/app-icon';
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
  'phase-panel video-request-panel grid min-w-0 gap-mytube-24 p-0 max-[560px]:gap-mytube-16';
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
      <section className="console-panel phase-panel status-panel" aria-labelledby="status-title">
        <PanelTitle icon="processing" id="status-title">영상 추출</PanelTitle>
        <RequestFlow current="extract" />
        {requestNotice ? <RequestNotice message={requestNotice} /> : null}
        <StatusHead icon={statusIconName} tone={statusTone} title={statusTitle} message={statusMessage} />
        <div className="step-tabs" aria-label="작업 단계">
          {STATUS_ITEMS.map((item) => (
            <span
              aria-current={statusJob.displayStatus === item.key ? 'step' : undefined}
              className={statusJob.displayStatus === item.key ? 'step-tab is-selected' : 'step-tab'}
              key={item.key}
            >
              <AppIcon name={item.icon} />
              {item.label}
            </span>
          ))}
        </div>
        <ProgressMeter filledCells={filledProgressCells} label={progressLabel} value={statusJob.progress} />
        <dl className="status-details">
          <div><dt>형식</dt><dd>{statusTypeLabel}</dd></div>
          <div><dt>품질</dt><dd>{statusQualityLabel}</dd></div>
          <div><dt>요청 시작</dt><dd>{createdTime}</dd></div>
          <div><dt>보관 기간</dt><dd>완료 후 {statusJob.retentionDays}일</dd></div>
        </dl>
      </section>
    );
  }

  if (viewPhase === 'accepting') {
    return (
      <section className="console-panel phase-panel status-panel" aria-labelledby="accepting-title">
        <PanelTitle icon="processing" id="accepting-title">영상 추출</PanelTitle>
        <RequestFlow current="extract" />
        <StatusHead icon={statusIconName} tone={statusTone} title={statusTitle} message={statusMessage} />
        <button className="secondary-button request-cancel-button" type="button" onClick={cancelRequest}>
          요청 취소
        </button>
        <p className="request-cancel-boundary">서버 작업이 생성되기 전 요청만 중단합니다.</p>
      </section>
    );
  }

  if (viewPhase === 'result') {
    return (
      <section className="console-panel phase-panel status-panel" aria-labelledby="result-title">
        <PanelTitle icon="completed" id="result-title">영상 추출</PanelTitle>
        <RequestFlow current="receipt" />
        {requestNotice ? <RequestNotice message={requestNotice} /> : null}
        <StatusHead icon="completed" tone="completed" title={statusTitle} message={statusMessage} />
        <dl className="status-details">
          <div><dt>결과 형식</dt><dd>{statusTypeLabel}</dd></div>
          <div><dt>품질</dt><dd>{statusQualityLabel}</dd></div>
          <div><dt>보관 기간</dt><dd>완료 후 {statusJob.retentionDays}일</dd></div>
        </dl>
        <p className="result-context">
          완료 파일은 {statusJob.retentionDays}일 동안 보관되며, 요청 내역은 이 브라우저에만 남습니다.
        </p>
        <div className="result-actions result-actions--video">
          <a className="download-button" download href={downloadHref}><AppIcon name="download" />다운로드</a>
          <button className="secondary-button secondary-button--new-request" type="button" onClick={returnToRequest}><AppIcon name="newRequest" />새 요청</button>
        </div>
      </section>
    );
  }

  return (
    <section className="console-panel phase-panel status-panel" aria-labelledby="error-title">
      <PanelTitle icon="failed" id="error-title">영상 추출</PanelTitle>
      <RequestFlow current="extract" />
      <StatusHead icon="failed" tone="failed" title={statusTitle} message={statusMessage} isAlert />
      {workerHealthFailed ? (
        <button className="secondary-button" disabled={workerHealthIsFetching} type="button" onClick={retryWorkerHealth}>다시 확인</button>
      ) : null}
      <ErrorDetailsDisclosure
        detail={statusErrorDetail}
        summary={VIDEO_ERROR_DETAIL_SUMMARY}
      />
      <button className="primary-button" type="button" onClick={returnToRequest}>요청 설정으로 돌아가기</button>
    </section>
  );
}

/** 화면별 panel heading을 일정한 구조로 렌더링한다. */
function PanelTitle(props: { /** 아이콘 이름. */ icon: AppIconName; /** heading id. */ id: string; /** 기존 ready form을 유지한 채 health를 갱신하는지 여부. */ isRefreshing?: boolean; /** 제목. */ children: string }) {
  return <div className="panel-title-row"><h2 id={props.id}><AppIcon name={props.icon} />{props.children}{props.isRefreshing ? <span aria-hidden="true" className="panel-title__refresh" title="서비스 상태 새로 확인 중"><AppIcon name="processing" /></span> : null}</h2></div>;
}

/** 상태 제목과 안내 문구를 렌더링한다. */
function StatusHead(props: { /** 상태 아이콘. */ icon: AppIconName; /** 상태 색상. */ tone: string; /** 상태 제목. */ title: string; /** 상태 설명. */ message: string; /** 오류 알림 여부. */ isAlert?: boolean }) {
  return <div className={`status-head status-head--${props.tone}`}><span className="status-icon" aria-hidden="true"><AppIcon name={props.icon} /></span><div><h3>{props.title}</h3><p role={props.isAlert ? 'alert' : 'status'} aria-live="polite">{props.message}</p></div></div>;
}

/** 10칸 진행률과 보조 텍스트를 렌더링한다. */
function ProgressMeter(props: { /** 채울 pixel cell 수. */ filledCells: number; /** 진행률 라벨. */ label: string; /** API 진행률 값. */ value: number | null }) {
  return <><div className="progress-meter" aria-label="진행률" aria-valuemax={100} aria-valuemin={0} aria-valuenow={props.value ?? undefined} role="progressbar">{Array.from({ length: 10 }).map((_, index) => <span className={index < props.filledCells ? 'is-filled' : ''} key={index} />)}</div><p className="progress-label">{props.label}</p></>;
}

/** 요청 중단·접수 경쟁 결과를 현재 화면에 알린다. */
function RequestNotice(props: { /** 사용자에게 전달할 안내 문구. */ message: string }) {
  return <p className="request-notice" role="status" aria-live="polite">{props.message}</p>;
}
