import { ErrorDetailsDisclosure } from '../../components/error-details-disclosure';
import { AppIcon, type AppIconName } from '../../components/app-icon';
import { RequestFlow } from '../../components/request-flow';
import { RequestReadinessPanel } from '../../components/request-readiness-panel';
import { WorkerHealthStatusNotice } from '../../components/worker-health-status';
import { type SubtitleStepKey, useSubtitlesExtractLogic } from './_hooks/use-subtitles-extract-logic';

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
  '파일의 음성을 영어 SRT 자막으로 만들 처리 방향을 선택하세요.';
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
    workerHealthDetail, workerHealthIsFetching, workerHealthStatus,
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
        title="영어 SRT 생성"
        onRetry={retryWorkerHealth}
      />
    );
  }

  if (viewPhase === 'request') {
    return <section className="phase-panel subtitle-request-panel" aria-labelledby="subtitles-title">
      <PanelTitle icon="subtitle" id="subtitles-title">영어 SRT 생성</PanelTitle>
      <RequestFlow current="source" />
      {requestNotice ? <RequestNotice message={requestNotice} /> : null}
      <form className="subtitle-form" onSubmit={handleSubtitleSubmit}>
        <div className={fileFeedbackIsError ? 'field has-error' : 'field'}>
          <span className="field-label">로컬 영상 파일</span>
          <input
            accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
            aria-hidden="true"
            className="subtitle-file-input"
            hidden
            ref={fileInputRef}
            tabIndex={-1}
            type="file"
            onChange={handleFileInputChange}
          />
          <button
            aria-describedby={fileFeedbackMessage ? SUBTITLE_FILE_FEEDBACK_ID : undefined}
            aria-label={SUBTITLE_FILE_PICKER_LABEL}
            className="subtitle-dropzone"
            ref={filePickerButtonRef}
            type="button"
            onClick={handleFilePickerOpen}
            onDragOver={handleDropzoneDragOver}
            onDrop={handleDropzoneDrop}
          >
            <AppIcon name="subtitle" />
            <strong>영상 선택 또는 드래그</strong>
            <span>mp4, mov, webm</span>
          </button>
          <p className="keyboard-shortcut-hint"><kbd>F</kbd> 키로 파일 선택에 바로 포커스</p>
          {fileFeedbackMessage ? (
            <p
              className={fileFeedbackIsError ? 'field-feedback field-feedback--error' : 'field-feedback'}
              id={SUBTITLE_FILE_FEEDBACK_ID}
              role={fileFeedbackIsError ? 'alert' : undefined}
            >
              {fileFeedbackMessage}
            </p>
          ) : null}
        </div>
        {selectedFile ? <div className="selected-file-row"><AppIcon name="video" /><div><strong>{selectedFile.name}</strong><span>{selectedFileMeta}</span></div><button type="button" onClick={clearSelectedFile}>지우기</button></div> : null}
        <fieldset
          aria-describedby="subtitle-processing-guidance"
          className="segmented-control subtitle-processing-method"
        >
          <legend>처리 방식</legend>
          <p className="subtitle-processing-method__description" id="subtitle-processing-guidance">
            {SUBTITLE_PROCESSING_GUIDANCE}
          </p>
          {SUBTITLE_PROCESSING_OPTIONS.map((option) => (
            <label
              className={selectedWhisperModel === option.value ? 'segment subtitle-processing-option is-selected' : 'segment subtitle-processing-option'}
              key={option.value}
            >
              <input
                checked={selectedWhisperModel === option.value}
                disabled={!canChangeWhisperModel}
                name="subtitle-whisper-model"
                type="radio"
                value={option.value}
                onChange={handleWhisperModelChange}
              />
              <AppIcon name={option.icon} />
              <span className="subtitle-processing-option__copy">
                <strong>{option.label}</strong>
                <span className="subtitle-processing-option__description">{option.description}</span>
              </span>
            </label>
          ))}
          <details className="subtitle-processing-method__details">
            <summary>기술적인 처리 정보</summary>
            <div className="subtitle-processing-method__technical">
              <p>{SUBTITLE_PROCESSING_TECHNICAL_NOTE}</p>
              {SUBTITLE_PROCESSING_OPTIONS.map((option) => (
                <p key={option.value}>{option.label}: {option.technicalDetail}</p>
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
          className="primary-button"
          disabled={!canSubmit}
          type="submit"
        >
          <AppIcon name="subtitle" />
          {isSubtitlePending ? '요청 중' : '영어 SRT 생성'}
        </button>
        {!canSubmit && submitDisabledReason ? (
          <p className="submit-disabled-reason" id="subtitle-submit-disabled-reason">
            {submitDisabledReason}
          </p>
        ) : null}
      </form>
      <WorkerHealthStatusNotice
        id={SUBTITLE_WORKER_HEALTH_TITLE_ID}
        isFetching={workerHealthIsFetching}
        lastCheckedAt={workerHealthCheckedAt}
        status={workerHealthStatus}
        technicalDetail={workerHealthDetail}
        onRetry={retryWorkerHealth}
      />
    </section>;
  }

  if (viewPhase === 'processing') {
    return <section className="console-panel phase-panel status-panel" aria-labelledby="subtitle-status-title">
      <PanelTitle icon="processing" id="subtitle-status-title">처리 상태</PanelTitle>
      <RequestFlow current="extract" />
      {requestNotice ? <RequestNotice message={requestNotice} /> : null}
      <StatusHead icon={statusIconName} tone={statusTone} title={statusTitle} message={statusMessage} />
      <div className="subtitle-step-tabs" aria-label="영어 SRT 처리 단계">{SUBTITLE_STEPS.map((step) => <span aria-current={currentStepKey === step.key ? 'step' : undefined} className={currentStepKey === step.key ? 'step-tab is-selected' : 'step-tab'} key={step.key}>{step.label}</span>)}</div>
      <ProgressMeter filledCells={filledProgressCells} value={statusJob.progress} />
    </section>;
  }

  if (viewPhase === 'accepting') {
    return <section className="console-panel phase-panel status-panel" aria-labelledby="subtitle-accepting-title">
      <PanelTitle icon="processing" id="subtitle-accepting-title">요청 접수 중</PanelTitle>
      <RequestFlow current="extract" />
      <StatusHead icon={statusIconName} tone={statusTone} title={statusTitle} message={statusMessage} />
      <button className="secondary-button request-cancel-button" type="button" onClick={cancelRequest}>
        요청 취소
      </button>
      <p className="request-cancel-boundary">서버 작업이 생성되기 전 요청만 중단합니다.</p>
    </section>;
  }

  if (viewPhase === 'result') {
    return <section className="console-panel phase-panel status-panel" aria-labelledby="subtitle-result-title">
      <PanelTitle icon="completed" id="subtitle-result-title">영어 SRT 준비 완료</PanelTitle>
      <RequestFlow current="receipt" />
      {requestNotice ? <RequestNotice message={requestNotice} /> : null}
      <StatusHead icon="completed" tone="completed" title={statusTitle} message={statusMessage} />
      <div className="result-actions"><a className="download-button" download href={downloadHref}><AppIcon name="download" />영어 SRT 다운로드</a><button className="secondary-button" type="button" onClick={returnToRequest}>새 요청</button></div>
    </section>;
  }

  return <section className="console-panel phase-panel status-panel" aria-labelledby="subtitle-error-title">
    <PanelTitle icon="failed" id="subtitle-error-title">요청을 완료하지 못했습니다</PanelTitle>
    <RequestFlow current="extract" />
    <StatusHead icon="failed" tone="failed" title={statusTitle} message={statusMessage} isAlert />
    {workerHealthFailed ? <button className="secondary-button" disabled={workerHealthIsFetching} type="button" onClick={retryWorkerHealth}>다시 확인</button> : null}
    <ErrorDetailsDisclosure detail={statusErrorDetail} summary={SUBTITLE_ERROR_DETAIL_SUMMARY} />
    <button className="primary-button" type="button" onClick={returnToRequest}>요청 설정으로 돌아가기</button>
  </section>;
}

/** 화면별 panel heading을 일정한 구조로 렌더링한다. */
function PanelTitle(props: { /** 아이콘 이름. */ icon: AppIconName; /** heading id. */ id: string; /** 제목. */ children: string }) {
  return <div className="panel-title-row"><h2 id={props.id}><AppIcon name={props.icon} />{props.children}</h2></div>;
}

/** 상태 제목과 안내 문구를 렌더링한다. */
function StatusHead(props: { /** 상태 아이콘. */ icon: AppIconName; /** 상태 색상. */ tone: string; /** 상태 제목. */ title: string; /** 상태 설명. */ message: string; /** 오류 알림 여부. */ isAlert?: boolean }) {
  return <div className={`status-head status-head--${props.tone}`}><span className="status-icon" aria-hidden="true"><AppIcon name={props.icon} /></span><div><h3>{props.title}</h3><p role={props.isAlert ? 'alert' : 'status'} aria-live="polite">{props.message}</p></div></div>;
}

/** 자막 job 진행률을 meter와 화면 표시 문구로 렌더링한다. */
function ProgressMeter(props: { /** 채울 pixel cell 수. */ filledCells: number; /** API 진행률 값. */ value: number | null }) {
  /** 시각 사용자와 보조 기술에 함께 제공할 진행률 문구. */
  const progressLabel = props.value === null ? '처리 중' : `진행률 ${props.value}%`;

  return <><div className="progress-meter" aria-label="진행률" aria-valuemax={100} aria-valuemin={0} aria-valuenow={props.value ?? undefined} aria-valuetext={progressLabel} role="progressbar">{Array.from({ length: 10 }).map((_, index) => <span className={index < props.filledCells ? 'is-filled' : ''} key={index} />)}</div><p className="progress-label">{progressLabel}</p></>;
}

/** 요청 중단·접수 경쟁 결과를 현재 화면에 알린다. */
function RequestNotice(props: { /** 사용자에게 전달할 안내 문구. */ message: string }) {
  return <p className="request-notice" role="status" aria-live="polite">{props.message}</p>;
}
