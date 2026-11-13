/** Popup과 YouTube 썸네일 Overlay가 함께 쓰는 선 아이콘 이름. 모양은 승인 시안(extension-a-states.html)의 아이콘을 따른다. */
export type LineIconName =
  | 'alert'
  | 'audio'
  | 'back'
  | 'check'
  | 'chevron'
  | 'clock'
  | 'clock-off'
  | 'cloud-off'
  | 'down'
  | 'grid'
  | 'inbox'
  | 'link'
  | 'link-off'
  | 'loader'
  | 'monitor'
  | 'moon'
  | 'pencil'
  | 'retry'
  | 'shield'
  | 'sliders'
  | 'sun'
  | 'video'
  | 'x';

/** SVG 도형 하나의 태그와 속성. React와 DOM 렌더러가 같은 이름의 속성으로 그린다. */
export type LineIconShape = [tag: 'circle' | 'path' | 'rect', attributes: Record<string, string>];

/** 아이콘별 SVG 도형. viewBox는 모두 `0 0 24 24`다. 한 곳에서만 고쳐 Popup과 Overlay 모양이 어긋나지 않게 한다. */
export const LINE_ICON_SHAPES: Record<LineIconName, readonly LineIconShape[]> = {
  alert: [['path', { d: 'M12 6v8M12 18.5v.01' }]],
  audio: [['path', { d: 'M4 10v4M8 6v12M12 3v18M16 8v8M20 10.5v3' }]],
  back: [['path', { d: 'M15 5l-7 7 7 7' }]],
  check: [['path', { d: 'M5 12.5l4.5 4.5L19 7' }]],
  chevron: [['path', { d: 'M9 5l7 7-7 7' }]],
  clock: [
    ['circle', { cx: '12', cy: '12', r: '8.5' }],
    ['path', { d: 'M12 7.5V12l3 2' }],
  ],
  'clock-off': [
    ['circle', { cx: '12', cy: '12', r: '8.5' }],
    ['path', { d: 'M12 7.5V12M4 4l16 16' }],
  ],
  'cloud-off': [
    ['path', { d: 'M8 7.5A5.5 5.5 0 0 1 17.4 10H18a4 4 0 0 1 2.3 7.3M16 18H7a4.5 4.5 0 0 1-1.6-8.7M3 3l18 18' }],
  ],
  down: [['path', { d: 'M12 4v11M6.5 10l5.5 5.5 5.5-5.5M5 20h14' }]],
  grid: [
    ['rect', { height: '7', rx: '1.5', width: '8', x: '3', y: '4' }],
    ['rect', { height: '7', rx: '1.5', width: '8', x: '13', y: '4' }],
    ['rect', { height: '7', rx: '1.5', width: '8', x: '3', y: '13' }],
    ['rect', { height: '7', rx: '1.5', width: '8', x: '13', y: '13' }],
  ],
  inbox: [['path', { d: 'M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5' }]],
  link: [
    ['path', { d: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1' }],
  ],
  'link-off': [
    ['path', { d: 'M15.66 14l3-3a4 4 0 0 0-5.66-5.66l-1 1M8.34 10l-3 3a4 4 0 0 0 5.66 5.66l1-1M4 4l16 16' }],
  ],
  loader: [['path', { d: 'M12 3a9 9 0 1 0 9 9' }]],
  monitor: [
    ['rect', { height: '12', rx: '2', width: '18', x: '3', y: '4' }],
    ['path', { d: 'M8 20h8M12 16v4' }],
  ],
  moon: [['path', { d: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z' }]],
  pencil: [['path', { d: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4' }]],
  retry: [['path', { d: 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v4.5H9' }]],
  shield: [['path', { d: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z' }]],
  sliders: [
    ['path', { d: 'M4 7h9M17 7h3M4 17h3M11 17h9' }],
    ['circle', { cx: '15', cy: '7', r: '2' }],
    ['circle', { cx: '9', cy: '17', r: '2' }],
  ],
  sun: [
    ['circle', { cx: '12', cy: '12', r: '4' }],
    ['path', { d: 'M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4' }],
  ],
  video: [
    ['rect', { height: '14', rx: '3', width: '18', x: '3', y: '5' }],
    ['path', { d: 'M10 9.2v5.6l4.8-2.8z', fill: 'currentColor' }],
  ],
  x: [['path', { d: 'M6 6l12 12M18 6L6 18' }]],
};
