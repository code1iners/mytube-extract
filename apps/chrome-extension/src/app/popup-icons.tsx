import { type ReactNode } from 'react';

/** Popup에서 쓰는 선 아이콘 이름. 모양은 승인 시안(extension-a-states.html)의 아이콘을 따른다. */
export type PopupIconName =
  | 'audio'
  | 'down'
  | 'grid'
  | 'link'
  | 'link-off'
  | 'loader'
  | 'retry'
  | 'sliders'
  | 'video'
  | 'x';

/** 아이콘별 SVG 내용. viewBox는 모두 `0 0 24 24`다. */
const ICON_PATHS: Record<PopupIconName, ReactNode> = {
  audio: <path d="M4 10v4M8 6v12M12 3v18M16 8v8M20 10.5v3" />,
  down: <path d="M12 4v11M6.5 10l5.5 5.5 5.5-5.5M5 20h14" />,
  grid: (
    <>
      <rect x="3" y="4" width="8" height="7" rx="1.5" />
      <rect x="13" y="4" width="8" height="7" rx="1.5" />
      <rect x="3" y="13" width="8" height="7" rx="1.5" />
      <rect x="13" y="13" width="8" height="7" rx="1.5" />
    </>
  ),
  link: (
    <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
  ),
  'link-off': (
    <path d="M15.66 14l3-3a4 4 0 0 0-5.66-5.66l-1 1M8.34 10l-3 3a4 4 0 0 0 5.66 5.66l1-1M4 4l16 16" />
  ),
  loader: <path d="M12 3a9 9 0 1 0 9 9" />,
  retry: <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v4.5H9" />,
  sliders: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M10 9.2v5.6l4.8-2.8z" fill="currentColor" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6L6 18" />,
};

/** 장식용 선 아이콘. 의미는 감싼 control의 접근 가능한 이름이 전달한다. */
export function PopupIcon(props: {
  /** 아이콘 이름. */
  name: PopupIconName;
  /** 크기·회전 같은 표시용 className. */
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={props.className ? `icon ${props.className}` : 'icon'}
      focusable="false"
      viewBox="0 0 24 24"
    >
      {ICON_PATHS[props.name]}
    </svg>
  );
}
