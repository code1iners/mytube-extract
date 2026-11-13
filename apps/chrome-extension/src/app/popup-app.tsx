import { type ChangeEvent, type FormEvent, type KeyboardEvent, type RefObject, useEffect, useRef, useState } from 'react';
import { type DownloadMode, type FileExtension } from '../domain/download-options/download-options';
import { getQualityOptions } from '../domain/download-options/quality-options';
import { type PopupView, type StagePhase, type StageSource, hasStageVideo, isStagePhaseBusy, isStagePhaseProblem } from '../domain/popup-state/popup-state';
import { type RecentRequestAction, type RecentRequestState, RECENT_REQUEST_STRIP_LIMIT } from '../domain/recent-request/recent-request';
import { type PopupDownloadModel, type PopupDownloadSnapshot, type PopupRecentRequest, type RecentActionResult, type YoutubeOverlaySnapshot, type YoutubeOverlayStatus, createChromePopupDownloadModel } from '../features/popup-download/popup-download-model';
import { type ThemePreference, getThemePreference, setThemePreference } from '../shared/theme-preference';
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

/** 최근 요청 상태별 배지·상태 아이콘. 상태는 색만으로 구분하지 않도록 상태마다 다른 아이콘을 쓴다. */
const RECENT_STATE_ICONS: Record<RecentRequestState, PopupIconName> = {
  completed: 'check',
  expired: 'clock-off',
  failed: 'alert',
  processing: 'loader',
  queued: 'clock',
};

/** 최근 요청 행동별 아이콘과 접근 가능한 이름. */
const RECENT_ACTION_VIEWS: Record<RecentRequestAction, { /** 행동 아이콘. */ icon: PopupIconName; /** 접근 가능한 이름. */ label: string }> = {
  redownload: { icon: 'down', label: '다시 내려받기' },
  rerequest: { icon: 'retry', label: '다시 요청' },
  retry: { icon: 'retry', label: '다시 시도' },
};

/** 테마 선호 세 칸. */
const THEME_OPTIONS: ReadonlyArray<{ /** 테마 선호. */ preference: ThemePreference; /** 테마 아이콘. */ icon: PopupIconName; /** 접근 가능한 이름. */ label: string }> = [
  { icon: 'monitor', label: '시스템 테마', preference: 'system' },
  { icon: 'sun', label: '라이트 테마', preference: 'light' },
  { icon: 'moon', label: '다크 테마', preference: 'dark' },
];

/** 헤더 격자 아이콘의 접근 가능한 이름. 점 색이 전하는 권한 상태를 이름으로도 전한다. */
const OVERLAY_BUTTON_LABELS: Record<YoutubeOverlayStatus, string> = {
  checking: '썸네일 버튼 권한 확인 중',
  denied: '썸네일 버튼 권한 거부됨',
  disabled: '썸네일 버튼 켜기',
  enabled: '썸네일 버튼 켜짐',
  error: '썸네일 버튼 오류',
  requesting: '썸네일 버튼 권한 요청 중',
};

/** 화면을 바꾼 뒤 무대로 돌아올 때 포커스를 돌려줄 버튼. */
type ReturnFocusTarget = 'more' | 'overlay' | 'settings';

/** 썸네일 버튼 행 이름 element ID. 스위치가 aria-labelledby로 가리킨다. */
const OVERLAY_SWITCH_LABEL_ID = 'overlay-switch-label';

/** 잘못된 주소의 이유 한 줄 element ID. 붙여넣기 칸이 aria-describedby로 가리킨다. */
const SOURCE_URL_REASON_ID = 'source-url-reason';

/** Popup download app component. */
export function PopupApp() {
  // Refs.

  /** Popup application model instance. */
  const modelRef = useRef<PopupDownloadModel | null>(null);
  /** 붙여넣기 칸의 주소 입력. 지우기 뒤 다시 붙여넣을 수 있게 포커스를 돌려준다. */
  const sourceInputRef = useRef<HTMLInputElement | null>(null);
  /** 화면을 바꾼 뒤 포커스를 옮길 대상. 처음 그릴 때는 비어 있어 포커스를 건드리지 않는다. */
  const pendingFocusRef = useRef<PopupView | null>(null);
  /** recent 화면의 뒤로 버튼. 화면을 열면 여기로 포커스를 옮긴다. */
  const backButtonRef = useRef<HTMLButtonElement | null>(null);
  /** 무대 아래 최근 요청 더보기 버튼. recent 화면에서 무대로 돌아오면 여기로 포커스를 돌려준다. */
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  /** 헤더 격자(썸네일 버튼) 아이콘. 이 버튼으로 연 설정에서 돌아오면 포커스를 돌려준다. */
  const overlayButtonRef = useRef<HTMLButtonElement | null>(null);
  /** 헤더 설정 아이콘. 이 버튼으로 연 설정에서 돌아오면 포커스를 돌려준다. */
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null);
  /** 무대로 돌아올 때 포커스를 돌려줄 버튼. 화면을 연 버튼이다. */
  const returnFocusRef = useRef<ReturnFocusTarget>('more');

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

  useEffect(function moveFocusAfterViewChange() {
    // 화면이 통째로 바뀌면 포커스가 사라지므로 키보드 사용자가 이어 갈 자리로 옮긴다.
    if (pendingFocusRef.current !== snapshot.view) {
      return;
    }

    pendingFocusRef.current = null;

    if (snapshot.view !== 'main') {
      backButtonRef.current?.focus();
      return;
    }

    /** 화면을 연 버튼별 ref. */
    const returnTargets: Record<ReturnFocusTarget, RefObject<HTMLButtonElement | null>> = { more: moreButtonRef, overlay: overlayButtonRef, settings: settingsButtonRef };

    returnTargets[returnFocusRef.current].current?.focus();
  }, [snapshot.view]);

  // Handlers.

  /** Popup 안의 화면을 바꾸고, 바뀐 화면에서 포커스를 받을 자리를 기록한다. 무대를 떠날 때는 돌아와 포커스를 줄 버튼도 기록한다. */
  function handleOpenView(view: PopupView, opener?: ReturnFocusTarget) {
    pendingFocusRef.current = view;

    if (opener) {
      returnFocusRef.current = opener;
    }

    getPopupModel().openView(view);
  }

  /** 썸네일 버튼 스위치·권한 다시 요청을 처리한다. 켜져 있으면 끄고(권한 해제), 아니면 켠다(권한 요청). */
  function handleToggleYoutubeOverlay() {
    /** Popup model. */
    const model = getPopupModel();

    void (snapshot.youtubeOverlay.status === 'enabled' ? model.deactivateYoutubeOverlay() : model.activateYoutubeOverlay());
  }

  /** 최근 요청 항목의 행동을 실행한다. */
  function handleRecentRequestAction(jobId: string) {
    void getPopupModel().runRecentRequestAction(jobId);
  }

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

  if (snapshot.view === 'settings') {
    return <main className="popup-shell" data-view="settings">
      <ViewBar backButtonRef={backButtonRef} title="설정" onBack={() => handleOpenView('main')} />
      <SettingsPanel retentionDays={snapshot.retentionDays} youtubeOverlay={snapshot.youtubeOverlay} onToggleYoutubeOverlay={handleToggleYoutubeOverlay} />
    </main>;
  }

  if (snapshot.view === 'recent') {
    return <main className="popup-shell" data-view="recent">
      <ViewBar backButtonRef={backButtonRef} title="최근 요청" onBack={() => handleOpenView('main')} />
      <RecentRequestList result={snapshot.recentActionResult} requests={snapshot.recentRequests} onAction={handleRecentRequestAction} />
    </main>;
  }

  return <main className="popup-shell" data-view="main" data-phase={snapshot.stagePhase} data-stage={stageSource.kind} data-status={snapshot.status.kind}>
    <PopupHeader overlayButtonRef={overlayButtonRef} settingsButtonRef={settingsButtonRef} youtubeOverlay={snapshot.youtubeOverlay} onOpenSettings={(opener) => handleOpenView('settings', opener)} />
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
    {snapshot.recentRequests.length ? <RecentRequestStrip moreButtonRef={moreButtonRef} requests={snapshot.recentRequests} onOpen={() => handleOpenView('recent', 'more')} /> : null}
  </main>;
}

/** 로고와 썸네일 버튼·설정 아이콘을 둔 헤더. 격자 아이콘의 점이 썸네일 버튼 권한 상태를 보여주고, 두 아이콘 모두 설정 화면을 연다. */
function PopupHeader(props: { /** 썸네일 버튼 권한 상태. */ youtubeOverlay: YoutubeOverlaySnapshot; /** 격자 아이콘 ref. */ overlayButtonRef: RefObject<HTMLButtonElement | null>; /** 설정 아이콘 ref. */ settingsButtonRef: RefObject<HTMLButtonElement | null>; /** 설정 화면 열기. 누른 버튼을 함께 넘긴다. */ onOpenSettings: (opener: ReturnFocusTarget) => void }) {
  return <header className="popup-header">
    <span aria-label="MyTube Extract" className="popup-logo" role="img"><PopupIcon name="down" /></span>
    <button ref={props.overlayButtonRef} aria-label={OVERLAY_BUTTON_LABELS[props.youtubeOverlay.status]} className="icon-button" data-overlay={props.youtubeOverlay.indicator} type="button" onClick={() => props.onOpenSettings('overlay')}>
      <PopupIcon name="grid" />
      <span aria-hidden="true" className={`overlay-dot overlay-dot--${props.youtubeOverlay.indicator}`} />
    </button>
    <button ref={props.settingsButtonRef} aria-label="설정" className="icon-button" type="button" onClick={() => props.onOpenSettings('settings')}><PopupIcon name="sliders" /></button>
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

/** 붙여넣기 단축키 키캡. macOS는 Command, 그 밖의 운영체제는 Ctrl이다. */
const PASTE_SHORTCUT_KEYS: readonly string[] = [isMacPlatform() ? '⌘' : 'Ctrl', 'V'];

/** 지금 브라우저가 macOS에서 도는지 확인한다. */
function isMacPlatform(): boolean {
  /** userAgentData를 아직 타입에 갖지 않은 navigator. */
  const browserNavigator = navigator as Navigator & { userAgentData?: { platform?: string } };
  /** 운영체제 이름. userAgentData가 없으면 예전 platform 값을 쓴다. */
  const platform = browserNavigator.userAgentData?.platform ?? browserNavigator.platform ?? '';

  return /mac/i.test(platform);
}

/** 무대 자리의 붙여넣기 칸. 붙여넣기와 타이핑 모두 받는 실제 주소 입력이다. */
function PasteField(props: { /** 주소 입력 ref. */ inputRef: RefObject<HTMLInputElement | null>; /** 잘못된 주소 여부. */ invalid: boolean; /** 현재 입력값. */ sourceUrl: string; /** 입력 변경. */ onChange: (event: ChangeEvent<HTMLInputElement>) => void; /** 지우기. */ onClear: () => void }) {
  return <div className={props.invalid ? 'paste-field is-invalid' : 'paste-field'}>
    <PopupIcon className="paste-field__icon" name={props.invalid ? 'link-off' : 'link'} />
    <div className="paste-field__row">
      <div className="paste-field__control">
        <input ref={props.inputRef} aria-describedby={props.invalid ? SOURCE_URL_REASON_ID : undefined} aria-invalid={props.invalid || undefined} aria-label="YouTube 주소" autoComplete="off" autoFocus className="paste-field__input" name="sourceUrl" spellCheck={false} type="url" value={props.sourceUrl} onChange={props.onChange} />
        {/* 붙여넣기 단축키 안내. 장식이라 읽지 않고, 입력이 시작되면 숨긴다. 클릭은 입력칸으로 통과한다. */}
        {props.sourceUrl ? null : <span aria-hidden="true" className="paste-field__keys">{PASTE_SHORTCUT_KEYS.map((key) => <kbd key={key} className="keycap">{key}</kbd>)}</span>}
      </div>
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

/** recent·settings 화면 위쪽의 뒤로 버튼과 화면 제목. */
function ViewBar(props: { /** 뒤로 버튼 ref. 화면을 열면 포커스를 받는다. */ backButtonRef: RefObject<HTMLButtonElement | null>; /** 화면 제목. */ title: string; /** 무대로 돌아가기. */ onBack: () => void }) {
  return <header className="popup-header">
    <button ref={props.backButtonRef} aria-label="뒤로" className="icon-button" type="button" onClick={props.onBack}><PopupIcon name="back" /></button>
    <h1 className="popup-header__title">{props.title}</h1>
  </header>;
}

/** 설정 화면: 테마 세 칸, 썸네일 버튼 행, 정책 안내, 완료 파일 보관 기간 안내. */
function SettingsPanel(props: { /** 썸네일 버튼 권한 상태. */ youtubeOverlay: YoutubeOverlaySnapshot; /** 완료 파일 보관 일수. */ retentionDays: number; /** 스위치·권한 다시 요청. */ onToggleYoutubeOverlay: () => void }) {
  // States.

  /** 테마 선호. 저장은 기존처럼 theme-preference가 맡고, 화면은 선택 표시만 따른다. */
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(getThemePreference);

  // Handlers.

  /** 테마 선호를 저장하고 바로 적용한다. */
  function handleThemeChange(preference: ThemePreference) {
    setThemePreference(preference);
    setThemePreferenceState(preference);
  }

  return <div className="settings">
    <div aria-label="테마" className="settings-row" role="group">
      <div className="theme-segments">
        {THEME_OPTIONS.map((option) => <button key={option.preference} aria-label={option.label} aria-pressed={themePreference === option.preference} className="theme-segments__option" type="button" onClick={() => handleThemeChange(option.preference)}>
          <PopupIcon name={option.icon} />
        </button>)}
      </div>
    </div>
    <OverlayPermissionRow youtubeOverlay={props.youtubeOverlay} onToggle={props.onToggleYoutubeOverlay} />
    <div className="settings-row">
      <PopupIcon name="shield" />
      <p className="settings-row__note">저작권과 플랫폼 정책을 지켜 사용하세요.</p>
    </div>
    <p className="settings-fine">완료 파일은 {props.retentionDays}일 뒤 만료돼요.</p>
  </div>;
}

/** 썸네일 버튼 행. 꺼짐·켜짐은 스위치, 권한 요청 중은 회전 아이콘, 거부·오류는 crimson 행과 이유 한 줄·권한 다시 요청 버튼이다. 끄지 못했으면 켜진 스위치 아래에 이유 한 줄을 둔다. */
function OverlayPermissionRow(props: { /** 썸네일 버튼 권한 상태. */ youtubeOverlay: YoutubeOverlaySnapshot; /** 스위치·권한 다시 요청. */ onToggle: () => void }) {
  /** 권한 상태. */
  const status = props.youtubeOverlay.status;

  if (props.youtubeOverlay.indicator === 'problem') {
    return <>
      <div className="settings-row is-problem" data-overlay-status={status}>
        <PopupIcon className="settings-row__warn" name="grid" />
        <span className="settings-row__name">썸네일 버튼</span>
        <button aria-label="권한 다시 요청" className="settings-row__retry" type="button" onClick={props.onToggle}><PopupIcon name="retry" /></button>
      </div>
      <p className="stage-problem settings-problem" role="alert"><PopupIcon name="alert" /><span>{props.youtubeOverlay.message}</span></p>
    </>;
  }

  return <>
    <div className="settings-row" data-overlay-status={status}>
      <PopupIcon name="grid" />
      <span className="settings-row__name" id={OVERLAY_SWITCH_LABEL_ID}>썸네일 버튼</span>
      {status === 'requesting'
        ? <span aria-label="권한 요청 중" className="settings-row__wait" role="img"><PopupIcon className="is-spinning" name="loader" /></span>
        : <button aria-checked={status === 'enabled'} aria-labelledby={OVERLAY_SWITCH_LABEL_ID} className="switch" disabled={status === 'checking'} role="switch" type="button" onClick={props.onToggle} />}
    </div>
    {props.youtubeOverlay.turnOffError ? <p className="stage-problem settings-problem" role="alert"><PopupIcon name="alert" /><span>{props.youtubeOverlay.turnOffError}</span></p> : null}
  </>;
}

/** 무대 아래 최근 요청 줄. 최신 썸네일 몇 개와 더보기 버튼만 두고, 어느 쪽을 눌러도 recent 화면을 연다. */
function RecentRequestStrip(props: { /** 최신순 최근 요청. */ requests: PopupRecentRequest[]; /** 더보기 버튼 ref. 무대로 돌아오면 포커스를 받는다. */ moreButtonRef: RefObject<HTMLButtonElement | null>; /** recent 화면 열기. */ onOpen: () => void }) {
  return <nav aria-label="최근 요청" className="recent-strip">
    <ul className="recent-strip__list">
      {props.requests.slice(0, RECENT_REQUEST_STRIP_LIMIT).map((request) => <li key={request.jobId} className="recent-strip__item">
        <button aria-label={`${request.title}, ${request.stateLabel}`} className="recent-strip__thumb" data-state={request.state} type="button" onClick={props.onOpen}>
          <RecentThumbnail request={request} />
          <span aria-hidden="true" className={`recent-badge recent-badge--${request.state}`}><PopupIcon className={request.state === 'processing' ? 'is-spinning' : undefined} name={RECENT_STATE_ICONS[request.state]} /></span>
        </button>
      </li>)}
    </ul>
    <button ref={props.moreButtonRef} aria-label="최근 요청 모두 보기" className="recent-strip__more" type="button" onClick={props.onOpen}><PopupIcon name="chevron" /></button>
  </nav>;
}

/** 최근 요청 썸네일. 원본 정보가 없는 예전 job이나 이미지를 불러오지 못한 경우 중립 배경과 형식 아이콘을 그린다. */
function RecentThumbnail(props: { /** 그릴 최근 요청. */ request: PopupRecentRequest }) {
  /** 썸네일 로드 실패 여부. */
  const [failed, setFailed] = useState(false);

  return <span className="recent-thumb" data-thumbnail={props.request.thumbnailUrl && !failed ? 'image' : 'fallback'}>
    {props.request.thumbnailUrl && !failed
      ? <img alt="" className="recent-thumb__image" decoding="async" src={props.request.thumbnailUrl} onError={() => setFailed(true)} />
      : <PopupIcon name={props.request.mode} />}
  </span>;
}

/** recent 화면의 최근 요청 목록. 비어 있으면 빈 상자 아이콘만 보여준다. */
function RecentRequestList(props: { /** 최신순 최근 요청. */ requests: PopupRecentRequest[]; /** 마지막 행동의 결과. */ result: RecentActionResult | null; /** 항목 행동 실행. */ onAction: (jobId: string) => void }) {
  if (!props.requests.length) {
    return <div className="recent-empty" role="status">
      <PopupIcon name="inbox" />
      <span className="visually-hidden">아직 보낸 요청이 없어요</span>
    </div>;
  }

  return <>
    {props.result?.kind === 'failed' ? <p className="stage-problem" role="alert"><PopupIcon name="alert" /><span>{props.result.message}</span></p> : null}
    <p aria-live="polite" className="visually-hidden" role="status">{props.result?.kind === 'started' ? props.result.message : ''}</p>
    <ul aria-label="최근 요청" className="recent-list">
      {props.requests.map((request) => <RecentRequestRow key={request.jobId} request={request} onAction={props.onAction} />)}
    </ul>
  </>;
}

/** 최근 요청 한 줄: 썸네일, 제목, 형식·품질과 요청 시각, 상태, 행동 하나. */
function RecentRequestRow(props: { /** 그릴 최근 요청. */ request: PopupRecentRequest; /** 항목 행동 실행. */ onAction: (jobId: string) => void }) {
  /** 화면에는 숫자만 두고 스크린리더에만 읽힐 품질 단위. */
  const qualityUnit = props.request.mode === 'audio' ? ' kbps' : 'p';

  return <li className="recent-row" data-job-id={props.request.jobId} data-state={props.request.state}>
    <RecentThumbnail request={props.request} />
    <div className="recent-row__meta">
      <strong className="recent-row__title" title={props.request.title}>{props.request.title}</strong>
      <span className="recent-row__option">
        <PopupIcon name={props.request.mode} />
        <span className="visually-hidden">{props.request.mode === 'audio' ? '오디오 MP3' : '비디오 MP4'}</span>
        <span>{props.request.quality}<span className="visually-hidden">{qualityUnit}</span></span>
        <span aria-hidden="true">·</span>
        <time dateTime={props.request.createdAt}>{formatRecentJobTime(props.request.createdAt)}</time>
      </span>
      <span className={`recent-row__state recent-row__state--${props.request.state}`}><PopupIcon name={RECENT_STATE_ICONS[props.request.state]} />{props.request.stateLabel}</span>
    </div>
    <RecentRequestActionButton request={props.request} onAction={props.onAction} />
  </li>;
}

/** 최근 요청 행동 버튼. 대기·처리 중이거나 행동이 없으면 상태 아이콘만 둔다. */
function RecentRequestActionButton(props: { /** 그릴 최근 요청. */ request: PopupRecentRequest; /** 항목 행동 실행. */ onAction: (jobId: string) => void }) {
  if (!props.request.action) {
    return props.request.state === 'queued' || props.request.state === 'processing'
      ? <span aria-hidden="true" className={`recent-row__wait recent-row__wait--${props.request.state}`}><PopupIcon className={props.request.state === 'processing' ? 'is-spinning' : undefined} name={RECENT_STATE_ICONS[props.request.state]} /></span>
      : <span aria-hidden="true" className="recent-row__wait" />;
  }

  /** 행동 아이콘과 이름. */
  const action = RECENT_ACTION_VIEWS[props.request.action];

  return <button aria-busy={props.request.pending || undefined} aria-label={action.label} className={props.request.action === 'redownload' ? 'recent-row__action' : 'recent-row__action is-retry'} disabled={props.request.pending || props.request.locked} type="button" onClick={() => props.onAction(props.request.jobId)}>
    <PopupIcon className={props.request.pending ? 'is-spinning' : undefined} name={props.request.pending ? 'loader' : action.icon} />
  </button>;
}

/** 최근 요청 시각을 한 줄에 들어가는 짧은 형식으로 표시한다. 오늘이면 시각(19:50), 아니면 날짜(11월 4일)만 쓴다. */
function formatRecentJobTime(createdAt: string): string {
  /** 요청 시각. */
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  if (date.toDateString() === new Date().toDateString()) {
    return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', hourCycle: 'h23', minute: '2-digit' }).format(date);
  }

  return new Intl.DateTimeFormat('ko-KR', { day: 'numeric', month: 'long' }).format(date);
}

/** 추출 버튼의 아이콘과 접근 가능한 이름을 정한다. */
function getExtractButtonView(snapshot: PopupDownloadSnapshot): ExtractButtonView {
  if (snapshot.stagePhase === 'checking') return { busy: true, icon: 'loader', label: '서버 확인 중' };
  if (snapshot.stagePhase === 'queued') return { busy: true, icon: 'loader', label: '대기 중' };
  if (snapshot.stagePhase === 'processing') return { busy: true, icon: 'loader', label: '처리 중' };
  if (isStagePhaseProblem(snapshot.stagePhase)) return { busy: false, icon: 'retry', label: '다시 시도' };
  return { busy: false, icon: 'down', label: '추출 시작' };
}
