import { type ChangeEvent, type FormEvent, type KeyboardEvent, type RefObject, useEffect, useRef, useState } from 'react';
import { type DownloadJob } from '../domain/download-job/download-job';
import { type DownloadMode, type FileExtension } from '../domain/download-options/download-options';
import { getQualityOptions } from '../domain/download-options/quality-options';
import { type StagePhase, type StageSource, hasStageVideo, isStagePhaseBusy, isStagePhaseProblem } from '../domain/popup-state/popup-state';
import { type PopupDownloadModel, type PopupDownloadSnapshot, createChromePopupDownloadModel } from '../features/popup-download/popup-download-model';
import { type PopupIconName, PopupIcon } from './popup-icons';

/** 추출 버튼에 표시할 아이콘과 접근 가능한 이름. */
type ExtractButtonView = {
  /** 버튼 아이콘. */
  icon: PopupIconName;
  /** 버튼의 접근 가능한 이름. */
  label: string;
  /** 서버 확인처럼 기다리는 중인지 여부. */
  busy: boolean;
};

/** 형식 버튼 정의. */
const MODE_OPTIONS: ReadonlyArray<{ /** 다운로드 형식. */ mode: DownloadMode; /** 형식 아이콘. */ icon: PopupIconName; /** 접근 가능한 이름. */ label: string }> = [
  { icon: 'audio', label: '오디오 MP3', mode: 'audio' },
  { icon: 'video', label: '비디오 MP4', mode: 'video' },
];

/** 잘못된 주소의 이유 한 줄 element ID. 붙여넣기 칸이 aria-describedby로 가리킨다. */
const SOURCE_URL_REASON_ID = 'source-url-reason';

/** Popup download app component. */
export function PopupApp() {
  // Refs.

  /** Popup application model instance. */
  const modelRef = useRef<PopupDownloadModel | null>(null);
  /** 붙여넣기 칸의 주소 입력. 지우기 뒤 다시 붙여넣을 수 있게 포커스를 돌려준다. */
  const sourceInputRef = useRef<HTMLInputElement | null>(null);

  // States.

  /** Popup 화면 snapshot. */
  const [snapshot, setSnapshot] = useState<PopupDownloadSnapshot>(() => getPopupModel().getSnapshot());

  // Computed.

  /** 무대에 올린 원본. */
  const stageSource = snapshot.stageSource;
  /** 추출 버튼 표시. */
  const extractButton = getExtractButtonView(snapshot);
  /** 진행 중이라 형식·품질을 잠그는지 여부. */
  const controlsLocked = isStagePhaseBusy(snapshot.stagePhase);
  /** 진행 단계 live region 문장(서버 확인 중·대기 중·처리 중·다운로드를 시작했어요). 실패 문장은 오류 줄의 alert가 전한다. */
  const stageAnnouncement = controlsLocked || snapshot.stagePhase === 'done' ? snapshot.status.message : '';

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

  useEffect(function listenForPasteOutsideSourceInput() {
    /** 입력칸 밖에서 붙여넣은 주소로 무대 원본을 바꾼다. 탭 영상이 무대에 있어도 다른 영상으로 바꿀 수 있게 한다. */
    function handleDocumentPaste(event: ClipboardEvent) {
      // 입력칸 안의 붙여넣기는 그 입력칸의 change 경로가 처리한다.
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      /** 붙여넣은 글자. */
      const pastedText = event.clipboardData?.getData('text/plain').trim() ?? '';

      if (!pastedText) {
        return;
      }

      event.preventDefault();
      void getPopupModel().updateOption('sourceUrl', pastedText);
    }

    document.addEventListener('paste', handleDocumentPaste);

    return function stopListeningForPaste() {
      document.removeEventListener('paste', handleDocumentPaste);
    };
  }, []);

  // Handlers.

  /** 붙여넣기 칸의 주소 입력을 모델에 반영한다. */
  function handleSourceUrlChange(event: ChangeEvent<HTMLInputElement>) {
    void getPopupModel().updateOption('sourceUrl', event.currentTarget.value);
  }

  /** 잘못 넣은 주소를 지우고 붙여넣기 칸으로 포커스를 돌린다. */
  function handleClearSourceUrl() {
    void getPopupModel().updateOption('sourceUrl', '');
    sourceInputRef.current?.focus();
  }

  /** 다운로드 형식 변경을 모델에 반영한다. */
  function handleModeChange(event: ChangeEvent<HTMLInputElement>) {
    void getPopupModel().updateOption('mode', event.currentTarget.value === 'video' ? 'video' : 'audio');
  }

  /** 품질 막대 선택을 현재 형식의 품질 옵션에 반영한다. */
  function handleQualityChange(event: ChangeEvent<HTMLInputElement>) {
    void getPopupModel().updateOption(snapshot.options.mode === 'audio' ? 'bitrate' : 'resolution', event.currentTarget.value);
  }

  /** 확정한 파일명을 모델에 반영한다. 빈 값이면 모델이 기본 이름으로 돌린다. */
  function handleFilenameCommit(filename: string) {
    void getPopupModel().updateOption('filename', filename.trim());
  }

  /** form submit으로 서버 확인과 다운로드 요청을 시작한다. */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void getPopupModel().submitDownload();
  }

  return <main className="popup-shell" data-phase={snapshot.stagePhase} data-stage={stageSource.kind} data-status={snapshot.status.kind}>
    <PopupHeader />
    <form className="stage-form" onSubmit={handleSubmit}>
      {hasStageVideo(stageSource)
        ? <StageThumbnail key={stageSource.thumbnailUrl} phase={snapshot.stagePhase} thumbnailUrl={stageSource.thumbnailUrl} />
        : <PasteField inputRef={sourceInputRef} invalid={stageSource.kind === 'invalid'} sourceUrl={snapshot.options.sourceUrl} onChange={handleSourceUrlChange} onClear={handleClearSourceUrl} />}
      {hasStageVideo(stageSource)
        ? <FilenameLine key={stageSource.videoId} extension={snapshot.fileExtension} filename={snapshot.stageFilename} locked={controlsLocked} onCommit={handleFilenameCommit} />
        : <StageLine reason={snapshot.status.message} stageSource={stageSource} />}
      <StageProblemLine snapshot={snapshot} />
      <div className="stage-controls">
        <ModeToggle disabled={controlsLocked} mode={snapshot.options.mode} onChange={handleModeChange} />
        <QualityBars disabled={controlsLocked} mode={snapshot.options.mode} value={snapshot.options.mode === 'audio' ? snapshot.options.bitrate : snapshot.options.resolution} onChange={handleQualityChange} />
      </div>
      <button aria-label={extractButton.label} className={extractButton.busy ? 'extract-button is-busy' : 'extract-button'} disabled={!snapshot.canDownload} type="submit">
        <PopupIcon className={extractButton.busy ? 'is-spinning' : undefined} name={extractButton.icon} />
      </button>
      <p aria-live="polite" className="visually-hidden" role="status">{stageAnnouncement}</p>
    </form>
    <RecentJobsList jobs={snapshot.jobs} />
  </main>;
}

/** 로고와 썸네일 버튼·설정 아이콘을 둔 헤더. 두 아이콘의 동작은 설정 화면에서 연결한다. */
function PopupHeader() {
  return <header className="popup-header">
    <span aria-label="MyTube Extract" className="popup-logo" role="img"><PopupIcon name="down" /></span>
    <button aria-label="썸네일 버튼" className="icon-button" disabled type="button"><PopupIcon name="grid" /></button>
    <button aria-label="설정" className="icon-button" disabled type="button"><PopupIcon name="sliders" /></button>
  </header>;
}

/** 무대의 16:9 썸네일. 이미지를 불러오지 못하면 중립 배경과 비디오 아이콘으로 바꾼다. 진행·문제 단계는 그 위에 덮개로 얹는다. */
function StageThumbnail(props: { /** 무대 진행 단계. */ phase: StagePhase; /** YouTube 썸네일 주소. */ thumbnailUrl: string }) {
  /** 썸네일 로드 실패 여부. 영상이 바뀌면 key로 새로 시작한다. */
  const [failed, setFailed] = useState(false);

  return <figure className="stage" data-thumbnail={failed ? 'fallback' : 'image'}>
    {failed
      ? <span className="stage__fallback"><PopupIcon name="video" /></span>
      : <img alt="" className="stage__image" decoding="async" src={props.thumbnailUrl} onError={() => setFailed(true)} />}
    <StageVeil phase={props.phase} />
  </figure>;
}

/** 무대 위 덮개. 의미는 live region과 오류 줄이 전하므로 덮개 자체는 장식이다. */
function StageVeil(props: { /** 무대 진행 단계. */ phase: StagePhase }) {
  if (props.phase === 'idle') {
    return null;
  }

  return <div aria-hidden="true" className={`stage-veil stage-veil--${props.phase}`} data-veil={props.phase}>
    {isStagePhaseBusy(props.phase) ? <StageRing /> : null}
    {props.phase === 'queued' ? <PopupIcon className="stage-veil__icon stage-veil__icon--inner" name="clock" /> : null}
    {props.phase === 'done' ? <PopupIcon className="stage-veil__icon" name="check" /> : null}
    {props.phase === 'failed' ? <PopupIcon className="stage-veil__icon" name="alert" /> : null}
    {props.phase === 'unreachable' ? <PopupIcon className="stage-veil__icon" name="cloud-off" /> : null}
  </div>;
}

/** 숫자 없는 흰 회전 링. API 진행률은 실제 값이 아니라서 호만 돌린다. */
function StageRing() {
  return <svg aria-hidden="true" className="stage-ring" focusable="false" viewBox="0 0 40 40">
    <circle className="stage-ring__track" cx="20" cy="20" r="17" />
    <circle className="stage-ring__arc" cx="20" cy="20" pathLength="100" r="17" />
  </svg>;
}

/** 실패·서버 연결 실패·설정 저장 실패를 무대 아래 한 줄로 알린다. */
function StageProblemLine(props: { /** 현재 popup snapshot. */ snapshot: PopupDownloadSnapshot }) {
  /** 표시할 오류 문장. */
  const message = isStagePhaseProblem(props.snapshot.stagePhase) || props.snapshot.status.kind === 'options-save-failed' ? props.snapshot.status.message : '';

  if (!message) {
    return null;
  }

  return <p className="stage-problem" role="alert">
    <PopupIcon name={props.snapshot.stagePhase === 'unreachable' ? 'cloud-off' : 'alert'} />
    <span>{message}</span>
  </p>;
}

/** 무대 자리의 붙여넣기 칸. 붙여넣기와 타이핑 모두 받는 실제 주소 입력이다. */
function PasteField(props: { /** 주소 입력 ref. */ inputRef: RefObject<HTMLInputElement | null>; /** 잘못된 주소 여부. */ invalid: boolean; /** 현재 입력값. */ sourceUrl: string; /** 입력 변경. */ onChange: (event: ChangeEvent<HTMLInputElement>) => void; /** 지우기. */ onClear: () => void }) {
  return <div className={props.invalid ? 'paste-field is-invalid' : 'paste-field'}>
    <PopupIcon className="paste-field__icon" name={props.invalid ? 'link-off' : 'link'} />
    <div className="paste-field__row">
      <input ref={props.inputRef} aria-describedby={props.invalid ? SOURCE_URL_REASON_ID : undefined} aria-invalid={props.invalid || undefined} aria-label="YouTube 주소" autoComplete="off" autoFocus className="paste-field__input" name="sourceUrl" placeholder="YouTube 주소 붙여넣기" spellCheck={false} type="url" value={props.sourceUrl} onChange={props.onChange} />
      {props.sourceUrl ? <button aria-label="주소 지우기" className="icon-button" type="button" onClick={props.onClear}><PopupIcon name="x" /></button> : null}
    </div>
  </div>;
}

/** 무대 아래 제목 줄 = 저장 파일명. 연필로 입력칸과 확장자 표시로 바꾸고, Enter나 체크 버튼으로 확정한다. 영상이 바뀌면 key로 새로 시작한다. */
function FilenameLine(props: { /** 지금 저장될 파일명(확장자 제외). */ filename: string; /** 지금 형식의 확장자. */ extension: FileExtension; /** 진행 중이라 편집을 막는지 여부. */ locked: boolean; /** 파일명 확정. */ onCommit: (filename: string) => void }) {
  // Refs.

  /** 연필 버튼. 편집을 끝내면 포커스를 돌려준다. */
  const editButtonRef = useRef<HTMLButtonElement | null>(null);
  /** 편집을 끝낸 직후인지 여부. 처음 그릴 때는 연필에 포커스를 옮기지 않는다. */
  const returnFocusRef = useRef(false);

  // States.

  /** 편집 중 입력값. null이면 편집 중이 아니다. */
  const [draft, setDraft] = useState<string | null>(null);

  // Computed.

  /** 편집 입력칸을 보여 주는지 여부. */
  const editing = draft !== null && !props.locked;

  // Effects.

  useEffect(function discardDraftWhenLocked() {
    // 진행이 시작되면 편집을 버린다. 남겨 두면 진행이 끝난 뒤 예전 입력이 저절로 다시 열린다.
    if (props.locked) {
      setDraft(null);
    }
  }, [props.locked]);

  useEffect(function returnFocusToEditButton() {
    // 확정·취소 뒤 키보드 사용자가 같은 자리에서 이어 갈 수 있게 연필로 포커스를 돌린다.
    if (!editing && returnFocusRef.current) {
      returnFocusRef.current = false;
      editButtonRef.current?.focus();
    }
  }, [editing]);

  // Handlers.

  /** 편집을 닫고 연필로 포커스를 돌려준다. */
  function closeEditor() {
    returnFocusRef.current = true;
    setDraft(null);
  }

  /** 입력값을 확정하고 제목 줄로 돌아간다. */
  function commit() {
    props.onCommit(draft ?? '');
    closeEditor();
  }

  /** Enter는 form 제출 대신 파일명 확정, Escape는 편집 취소로 쓴다. */
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeEditor();
    }
  }

  if (editing) {
    return <div className="stage-line stage-line--editing">
      <input aria-label="파일명" autoFocus className="stage-line__input" name="filename" spellCheck={false} type="text" value={draft} onChange={(event) => setDraft(event.currentTarget.value)} onFocus={(event) => event.currentTarget.select()} onKeyDown={handleKeyDown} />
      <span className="stage-line__extension">.{props.extension}</span>
      <button aria-label="파일명 저장" className="icon-button" type="button" onClick={commit}><PopupIcon name="check" /></button>
    </div>;
  }

  return <div className="stage-line stage-line--title">
    <p className="stage-line__text" title={props.filename}>{props.filename}</p>
    {props.locked ? null : <button ref={editButtonRef} aria-label="파일명 바꾸기" className="icon-button" type="button" onClick={() => setDraft(props.filename)}><PopupIcon name="pencil" /></button>}
  </div>;
}

/** 무대 아래 한 줄. 붙여넣기 칸 상태에서 잘못된 주소의 이유를 보여준다. */
function StageLine(props: { /** 무대 원본. */ stageSource: StageSource; /** 잘못된 주소의 이유. */ reason: string }) {
  if (props.stageSource.kind === 'invalid') {
    return <p className="stage-line stage-line--error" id={SOURCE_URL_REASON_ID} role="alert">{props.reason}</p>;
  }

  // 붙여넣기 칸만 있을 때도 아래 조작의 위치가 흔들리지 않게 같은 높이를 비워 둔다.
  return <p aria-hidden="true" className="stage-line" />;
}

/** 오디오·비디오 형식 아이콘 두 칸. */
function ModeToggle(props: { /** 진행 중 잠금 여부. */ disabled: boolean; /** 선택 형식. */ mode: DownloadMode; /** 형식 변경. */ onChange: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return <div aria-label="형식" className="mode-toggle" role="radiogroup">
    {MODE_OPTIONS.map((option) => <label key={option.mode} className="mode-toggle__option">
      <input aria-label={option.label} checked={props.mode === option.mode} disabled={props.disabled} className="visually-hidden-input" name="mode" type="radio" value={option.mode} onChange={props.onChange} />
      <PopupIcon name={option.icon} />
    </label>)}
  </div>;
}

/** 높이가 다른 품질 막대 세 개. 선택한 값 이하의 막대를 채운다. */
function QualityBars(props: { /** 진행 중 잠금 여부. */ disabled: boolean; /** 현재 형식. */ mode: DownloadMode; /** 선택 품질 값. */ value: string; /** 품질 변경. */ onChange: (event: ChangeEvent<HTMLInputElement>) => void }) {
  /** 현재 형식의 고정 품질 선택지. */
  const options = getQualityOptions(props.mode);
  /** 선택 품질의 순서. */
  const selectedIndex = options.findIndex((option) => String(option) === props.value);
  /** 접근 가능한 이름에 붙일 단위. */
  const unit = props.mode === 'audio' ? ' kbps' : 'p';

  return <div aria-label="품질" className="quality-bars" role="radiogroup">
    {options.map((option, index) => <label key={option} className={index <= selectedIndex ? 'quality-bars__option is-filled' : 'quality-bars__option'}>
      <input aria-label={`${option}${unit}`} checked={index === selectedIndex} disabled={props.disabled} className="visually-hidden-input" name="quality" type="radio" value={String(option)} onChange={props.onChange} />
      <i aria-hidden="true" className="quality-bars__bar" />
      <span aria-hidden="true" className="quality-bars__value">{option}</span>
    </label>)}
  </div>;
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

/** 추출 버튼의 아이콘과 접근 가능한 이름을 정한다. */
function getExtractButtonView(snapshot: PopupDownloadSnapshot): ExtractButtonView {
  if (snapshot.stagePhase === 'checking') return { busy: true, icon: 'loader', label: '서버 확인 중' };
  if (snapshot.stagePhase === 'queued') return { busy: true, icon: 'loader', label: '대기 중' };
  if (snapshot.stagePhase === 'processing') return { busy: true, icon: 'loader', label: '처리 중' };
  if (isStagePhaseProblem(snapshot.stagePhase)) return { busy: false, icon: 'retry', label: '다시 시도' };
  return { busy: false, icon: 'down', label: '추출 시작' };
}
