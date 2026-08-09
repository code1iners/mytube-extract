/** 화면에서 쓰는 flat 아이콘 이름. */
export type AppIconName =
  | 'audio'
  | 'completed'
  | 'download'
  | 'expired'
  | 'failed'
  | 'info'
  | 'link'
  | 'newRequest'
  | 'processing'
  | 'queued'
  | 'subtitle'
  | 'video';

/** AppIcon 속성. */
type AppIconProps = {
  /** 추가 className. */
  className?: string;
  /** 렌더링할 아이콘 이름. */
  name: AppIconName;
};

/** Nintendo 스타일 flat stroke 아이콘. currentColor를 상속받는다. */
export function AppIcon({ className = '', name }: AppIconProps) {
  /** SVG className. */
  const svgClassName = ['app-icon', className].filter(Boolean).join(' ');

  return (
    <svg
      aria-hidden="true"
      className={svgClassName}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
    >
      {renderAppIcon(name)}
    </svg>
  );
}

/**
 * 서비스 로고 아이콘. favicon·확장 아이콘(public/mytube-extract-icon.svg)과
 * 동일한 글리프를 써서 브랜드 마크를 하나로 통일한다. 테마와 무관하게
 * 고정 색상(Nintendo red + 흰색)을 쓴다.
 */
export function AppMark() {
  return (
    <svg
      aria-hidden="true"
      className="app-mark"
      focusable="false"
      viewBox="0 0 512 512"
    >
      <rect width="512" height="512" rx="112" fill="#e60012" />
      <g
        fill="none"
        stroke="#ffffff"
        strokeWidth="34"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M256 96 L256 320" />
        <path d="M160 245 L256 341 L352 245" />
        <path d="M96 405 L416 405" />
      </g>
    </svg>
  );
}

/** 아이콘 이름에 맞는 flat path 묶음을 반환한다. */
function renderAppIcon(name: AppIconName) {
  if (name === 'audio') {
    return (
      <>
        <path d="M9 18V6l10-2v12" />
        <circle cx="7" cy="18" r="2.5" />
        <circle cx="17" cy="16" r="2.5" />
      </>
    );
  }

  if (name === 'video') {
    return (
      <>
        <rect height="12" rx="2" width="15" x="3" y="6" />
        <path d="M18 10l4-2.5v9L18 14" />
      </>
    );
  }

  if (name === 'link') {
    return (
      <>
        <path d="M10 14a4 4 0 0 0 5.66 0l2.83-2.83a4 4 0 1 0-5.66-5.66l-1.42 1.41" />
        <path d="M14 10a4 4 0 0 0-5.66 0L5.5 12.83a4 4 0 1 0 5.66 5.66l1.42-1.41" />
      </>
    );
  }

  if (name === 'subtitle') {
    return (
      <>
        <rect height="14" rx="2" width="18" x="3" y="5" />
        <path d="M7 10h3M7 14h7M13 10h4" />
      </>
    );
  }

  if (name === 'download') {
    return (
      <>
        <path d="M12 4v11" />
        <path d="M7.5 11.5L12 16l4.5-4.5" />
        <path d="M4 19h16" />
      </>
    );
  }

  if (name === 'newRequest') {
    return (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    );
  }

  if (name === 'info') {
    return (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5.5" />
        <circle cx="12" cy="7.75" fill="currentColor" r="0.75" stroke="none" />
      </>
    );
  }

  if (name === 'queued') {
    return (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </>
    );
  }

  if (name === 'processing') {
    return (
      <>
        <path d="M4 12a8 8 0 0 1 13.66-5.66L20 9" />
        <path d="M20 5v4h-4" />
        <path d="M20 12a8 8 0 0 1-13.66 5.66L4 15" />
        <path d="M4 19v-4h4" />
      </>
    );
  }

  if (name === 'completed') {
    return (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12.5l2.5 2.5L16 9" />
      </>
    );
  }

  if (name === 'failed') {
    return (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9 9l6 6M15 9l-6 6" />
      </>
    );
  }

  // expired
  return (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
      <path d="M5 5l14 14" />
    </>
  );
}
