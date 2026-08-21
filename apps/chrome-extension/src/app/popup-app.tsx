import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react';
import { type QualityOption, getQualityOptions } from '../domain/download-options/quality-options';
import { type DownloadJob } from '../domain/download-job/download-job';
import { type PopupDownloadModel, type PopupDownloadSnapshot, type YoutubeOverlaySnapshot, createChromePopupDownloadModel } from '../features/popup-download/popup-download-model';
import { type ThemePreference, getThemePreference, setThemePreference } from '../shared/theme-preference';

/** 형식별 옵션 필드 copy. */
type AdaptiveOptionCopy = {
  /** 옵션 입력 안내 문구. */
  description: string;
  /** 옵션 label. */
  label: string;
  /** 옵션 select name. */
  name: 'bitrate' | 'resolution';
  /** 서버가 지원하는 고정 선택지. */
  options: readonly QualityOption[];
  /** 선택지 옆에 붙일 단위. */
  unit: string;
  /** 옵션 select 값. */
  value: string;
};

/** URL 입력 아래에 표시할 피드백. */
type SourceUrlFeedback = {
  /** URL 입력 오류 여부. */
  hasInputError: boolean;
  /** 사용자에게 표시할 피드백 문구. */
  message: string;
};

/** Popup download app component. */
export function PopupApp() {
  // Refs.

  /** Popup application model instance. */
  const modelRef = useRef<PopupDownloadModel | null>(null);

  // States.

  /** Popup 화면 snapshot. */
  const [snapshot, setSnapshot] = useState<PopupDownloadSnapshot>(() => getPopupModel().getSnapshot());
  /** 사용자가 선택한 popup theme 방식. */
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(getThemePreference);

  // Computed.

  /** 현재 다운로드 모드. */
  const selectedMode = snapshot.options.mode;
  /** 제출 버튼 문구. */
  const submitLabel = getSubmitLabel(snapshot);
  /** 원본 URL 입력 피드백. */
  const sourceUrlFeedback = getSourceUrlFeedback(snapshot);
  /** 형식별 옵션 필드 copy. */
  const adaptiveOption = getAdaptiveOptionCopy(snapshot);

  // Functions.

  /** popup model을 지연 생성한다. */
  function getPopupModel() {
    if (!modelRef.current) {
      modelRef.current = createChromePopupDownloadModel();
    }

    return modelRef.current;
  }

  /** model 변경을 React snapshot에 반영한다. */
  function syncSnapshot() {
    setSnapshot(getPopupModel().getSnapshot());
  }

  // Effects.

  useEffect(function initializePopupModel() {
    /** Popup application model. */
    const popupModel = getPopupModel();
    /** Snapshot 구독 해제 함수. */
    const unsubscribe = popupModel.subscribe(syncSnapshot);

    void popupModel.initialize();

    return unsubscribe;
  }, []);

  // Handlers.

  /** 다운로드 형식 변경을 모델에 반영한다. */
  function handleModeChange(event: ChangeEvent<HTMLInputElement>) {
    /** 선택된 다운로드 모드. */
    const mode = event.currentTarget.value === 'video' ? 'video' : 'audio';
    void getPopupModel().updateOption('mode', mode);
  }

  /** 텍스트 기반 다운로드 옵션을 모델에 반영한다. */
  function handleTextOptionChange<Key extends 'sourceUrl' | 'filename'>(key: Key) {
    return function updateTextOption(event: ChangeEvent<HTMLInputElement>) {
      void getPopupModel().updateOption(key, event.currentTarget.value);
    };
  }

  /** 고정 선택지 품질 옵션을 모델에 반영한다. */
  function handleQualityOptionChange<Key extends 'bitrate' | 'resolution'>(key: Key) {
    return function updateQualityOption(event: ChangeEvent<HTMLSelectElement>) {
      void getPopupModel().updateOption(key, event.currentTarget.value);
    };
  }

  /** form submit으로 서버 확인과 다운로드 요청을 시작한다. */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void getPopupModel().submitDownload();
  }

  /** 현재 탭의 YouTube URL을 form에 가져온다. */
  function handleImportCurrentTabUrl() {
    void getPopupModel().importCurrentTabUrl();
  }

  /** YouTube 썸네일 Overlay 권한 요청과 현재 탭 활성화를 시작한다. */
  function handleActivateYoutubeOverlay() {
    void getPopupModel().activateYoutubeOverlay();
  }

  /** native select theme 선택을 localStorage와 화면에 반영한다. */
  function handleThemeChange(event: ChangeEvent<HTMLSelectElement>) {
    /** 선택한 theme 방식. */
    const preference = event.currentTarget.value as ThemePreference;
    setThemePreferenceState(preference);
    setThemePreference(preference);
  }

  return <main className="popup-shell" data-phase="request" data-status={snapshot.status.kind}>
    <header className="popup-header">
      <div><h1 className="popup-title">MyTube <span>Extract</span></h1><p>영상 추출 도구</p></div>
      <label className="popup-theme-control"><span>테마</span><select value={themePreference} onChange={handleThemeChange}><option value="system">시스템</option><option value="light">라이트</option><option value="dark">다크</option></select></label>
    </header>
    <p className="policy-strip">저작권 및 플랫폼 정책을 준수해 사용하세요.</p>
    <RequestForm snapshot={snapshot} selectedMode={selectedMode} adaptiveOption={adaptiveOption} sourceUrlFeedback={sourceUrlFeedback} submitLabel={submitLabel} onActivateYoutubeOverlay={handleActivateYoutubeOverlay} onImportCurrentTabUrl={handleImportCurrentTabUrl} onModeChange={handleModeChange} onQualityOptionChange={handleQualityOptionChange} onSubmit={handleSubmit} onTextOptionChange={handleTextOptionChange} />
    <RecentJobsList jobs={snapshot.jobs} />
  </main>;
}

/** popup의 요청 설정 form을 렌더링한다. */
function RequestForm(props: { /** 현재 popup snapshot. */ snapshot: PopupDownloadSnapshot; /** 선택 mode. */ selectedMode: 'audio' | 'video'; /** mode별 옵션. */ adaptiveOption: AdaptiveOptionCopy; /** URL 입력 피드백. */ sourceUrlFeedback: SourceUrlFeedback | null; /** CTA 문구. */ submitLabel: string; /** YouTube 썸네일 Overlay 활성화. */ onActivateYoutubeOverlay: () => void; /** 현재 탭 URL 가져오기. */ onImportCurrentTabUrl: () => void; /** mode 변경. */ onModeChange: (event: ChangeEvent<HTMLInputElement>) => void; /** 고정 선택지 품질 option 변경 handler 생성기. */ onQualityOptionChange: <Key extends 'bitrate' | 'resolution'>(key: Key) => (event: ChangeEvent<HTMLSelectElement>) => void; /** form 제출. */ onSubmit: (event: FormEvent<HTMLFormElement>) => void; /** 텍스트 option 변경 handler 생성기. */ onTextOptionChange: <Key extends 'sourceUrl' | 'filename'>(key: Key) => (event: ChangeEvent<HTMLInputElement>) => void }) {
  return <form className="download-form" onSubmit={props.onSubmit}>
    <YoutubeOverlayActivation overlay={props.snapshot.youtubeOverlay} onActivate={props.onActivateYoutubeOverlay} />
    <label className={props.sourceUrlFeedback?.hasInputError ? 'field source-field has-warning' : 'field source-field'}><span className="field-label">추출 URL</span><span className="field-description">YouTube watch, Shorts, youtu.be URL을 붙여넣으세요.</span><input aria-describedby={props.sourceUrlFeedback ? 'source-url-feedback' : undefined} aria-invalid={props.sourceUrlFeedback?.hasInputError || undefined} autoComplete="off" name="sourceUrl" placeholder="https://www.youtube.com/watch?v=..." type="url" value={props.snapshot.options.sourceUrl} onChange={props.onTextOptionChange('sourceUrl')} /><button className="secondary-button" disabled={props.snapshot.submitting} type="button" onClick={props.onImportCurrentTabUrl}>현재 탭 사용</button>{props.sourceUrlFeedback ? <p className={props.sourceUrlFeedback.hasInputError ? 'field-feedback field-feedback--error' : 'field-feedback'} id="source-url-feedback" role={props.sourceUrlFeedback.hasInputError ? 'alert' : undefined}>{props.sourceUrlFeedback.message}</p> : null}</label>
    <fieldset className="mode-group"><legend>추출 형식</legend><label className={props.selectedMode === 'audio' ? 'mode-option is-selected' : 'mode-option'}><input checked={props.selectedMode === 'audio'} name="mode" type="radio" value="audio" onChange={props.onModeChange} />오디오</label><label className={props.selectedMode === 'video' ? 'mode-option is-selected' : 'mode-option'}><input checked={props.selectedMode === 'video'} name="mode" type="radio" value="video" onChange={props.onModeChange} />비디오</label></fieldset>
    <label className="field"><span className="field-label">파일명</span><span className="field-description">비워두면 서버 기본값을 사용합니다.</span><input autoComplete="off" name="filename" type="text" value={props.snapshot.options.filename} onChange={props.onTextOptionChange('filename')} /></label>
    <label className="field"><span className="field-label">{props.adaptiveOption.label}</span><span className="field-description">{props.adaptiveOption.description}</span><select name={props.adaptiveOption.name} value={props.adaptiveOption.value} onChange={props.onQualityOptionChange(props.adaptiveOption.name)}>{props.adaptiveOption.options.map((option) => <option key={option} value={option}>{option}{props.adaptiveOption.unit}</option>)}</select></label>
    <button className="primary-button" disabled={!props.snapshot.canDownload} type="submit">{props.submitLabel}</button>
    <RequestStatusFeedback snapshot={props.snapshot} />
  </form>;
}

/** 서버 확인 또는 최신 job 상태를 form 아래에 짧게 안내한다. */
function RequestStatusFeedback(props: { /** 현재 popup snapshot. */ snapshot: PopupDownloadSnapshot }) {
  const visibleStatuses = new Set([
    'checking-server',
    'job-queued',
    'job-processing',
    'download-started',
    'download-failed',
  ]);

  if (!visibleStatuses.has(props.snapshot.status.kind)) {
    return null;
  }

  /** 서버 확인 중인지 또는 오류인지 여부. */
  const isAlert = props.snapshot.status.kind === 'download-failed';
  /** 상태에 맞는 CSS tone. */
  const tone =
    props.snapshot.status.kind === 'download-failed'
      ? 'danger'
      : props.snapshot.status.kind === 'download-started'
        ? 'success'
        : 'info';

  return <p className={`request-status request-status--${tone}`} role={isAlert ? 'alert' : 'status'} aria-live="polite"><span aria-hidden="true" className="request-status__icon">{tone === 'danger' ? '!' : tone === 'success' ? '✓' : '…'}</span><span>{props.snapshot.status.message}</span></p>;
}

/** Popup에 표시할 최근 job 목록을 렌더링한다. */
function RecentJobsList(props: { /** 최신순 최근 job 목록. */ jobs: DownloadJob[] }) {
  return <section className="recent-jobs" aria-labelledby="recent-jobs-title">
    <div className="recent-jobs__header"><h2 id="recent-jobs-title">최근 요청</h2><span>{props.jobs.length}건</span></div>
    {props.jobs.length ? <ol className="recent-jobs__list">{props.jobs.map((job) => <RecentJobItem key={job.jobId} job={job} />)}</ol> : <p className="recent-jobs__empty">아직 보낸 요청이 없습니다.</p>}
  </section>;
}

/** 최근 job 하나의 상태와 요청 옵션을 표시한다. */
function RecentJobItem(props: { /** 표시할 job. */ job: DownloadJob }) {
  /** job 상태 표시 정보. */
  const status = getRecentJobStatus(props.job);
  /** 표시할 요청 형식과 화질. */
  const optionLabel = props.job.type === 'audio' ? `오디오 · ${props.job.quality} kbps` : `비디오 · ${props.job.quality}p`;

  return <li className={`recent-job recent-job--${status.kind}`} data-job-id={props.job.jobId}>
    <div className="recent-job__heading"><span className="recent-job__icon" aria-hidden="true">{status.icon}</span><strong>{status.label}</strong><span className="recent-job__option">{optionLabel}</span><time dateTime={props.job.createdAt}>{formatRecentJobTime(props.job.createdAt)}</time></div>
    <p className="recent-job__message">{props.job.message}</p>
  </li>;
}

/** 최근 job 상태의 텍스트·아이콘을 함께 만든다. */
function getRecentJobStatus(job: DownloadJob): { icon: string; kind: DownloadJob['displayStatus']; label: string } {
  if (job.displayStatus === 'expired') return { icon: '!', kind: 'expired', label: '만료됨' };
  if (job.status === 'queued') return { icon: '○', kind: 'queued', label: '대기 중' };
  if (job.status === 'processing') return { icon: '◌', kind: 'processing', label: '처리 중' };
  if (job.status === 'completed') return { icon: '✓', kind: 'completed', label: '완료' };
  return { icon: '!', kind: 'failed', label: '실패' };
}

/** YouTube Overlay 권한 상태를 텍스트와 함께 전달할 아이콘으로 바꾼다. */
function getYoutubeOverlayStatusIcon(status: YoutubeOverlaySnapshot['status']): string {
  if (status === 'enabled') return '✓';
  if (status === 'denied' || status === 'error') return '!';
  if (status === 'checking' || status === 'requesting') return '…';

  return '○';
}

/** 최근 job 생성 시각을 popup에 맞는 짧은 형식으로 표시한다. */
function formatRecentJobTime(createdAt: string): string {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'numeric',
  }).format(date);
}

/** YouTube 썸네일 Overlay의 최초 활성화와 현재 권한 상태를 보여준다. */
function YoutubeOverlayActivation(props: { /** Overlay 권한 상태. */ overlay: YoutubeOverlaySnapshot; /** 권한 요청 handler. */ onActivate: () => void }) {
  // Computed.

  /** 권한 요청 중 여부. */
  const isRequesting = props.overlay.status === 'requesting';
  /** 이미 권한이 허용된 상태인지 여부. */
  const isEnabled = props.overlay.status === 'enabled';
  /** 거부·오류 상태인지 여부. */
  const isProblem = props.overlay.status === 'denied' || props.overlay.status === 'error';

  return <div className="youtube-overlay-activation" aria-labelledby="youtube-overlay-title">
    <span aria-hidden="true" className="youtube-overlay-activation__icon">{getYoutubeOverlayStatusIcon(props.overlay.status)}</span><div><strong id="youtube-overlay-title" className="youtube-overlay-activation__title">YouTube 썸네일 버튼</strong><p className={isProblem ? 'youtube-overlay-activation__message youtube-overlay-activation__message--problem' : 'youtube-overlay-activation__message'} role={isProblem ? 'alert' : 'status'} aria-live="polite">{props.overlay.message}</p></div>
    {!isEnabled ? <button aria-label="YouTube 썸네일 버튼 활성화" className="secondary-button secondary-button--compact" disabled={isRequesting} type="button" onClick={props.onActivate}>{isRequesting ? '활성화 중' : '버튼 활성화'}</button> : null}
  </div>;
}

/** 제출 버튼에 표시할 문구를 반환한다. */
function getSubmitLabel(snapshot: PopupDownloadSnapshot) {
  if (snapshot.submitting || snapshot.status.kind === 'checking-server') return '서버 확인 중';
  if (snapshot.status.kind === 'download-failed' && snapshot.canDownload) return '다시 시도';
  return '추출 시작';
}

/** Popup status를 URL 입력 피드백으로 바꾼다. */
function getSourceUrlFeedback(snapshot: PopupDownloadSnapshot): SourceUrlFeedback | null {
  if (snapshot.status.kind !== 'missing-source-url' && snapshot.status.kind !== 'invalid-source-url') {
    return null;
  }

  return {
    hasInputError:
      snapshot.status.kind === 'invalid-source-url' && !snapshot.canDownload,
    message: snapshot.status.message,
  };
}

/** 현재 추출 형식에 맞는 단일 옵션 필드 copy를 만든다. */
function getAdaptiveOptionCopy(snapshot: PopupDownloadSnapshot): AdaptiveOptionCopy {
  if (snapshot.options.mode === 'video') return { description: '서버가 지원하는 해상도 중에서 고를 수 있습니다.', label: '최대 해상도', name: 'resolution', options: getQualityOptions('video'), unit: 'p', value: snapshot.options.resolution };
  return { description: '서버가 지원하는 비트레이트 중에서 고를 수 있습니다.', label: '최대 비트레이트', name: 'bitrate', options: getQualityOptions('audio'), unit: ' kbps', value: snapshot.options.bitrate };
}
