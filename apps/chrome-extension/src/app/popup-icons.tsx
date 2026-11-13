import { createElement } from 'react';
import { type LineIconName, LINE_ICON_SHAPES } from '../shared/line-icon-shapes';

/** Popup에서 쓰는 선 아이콘 이름. */
export type PopupIconName = LineIconName;

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
      {LINE_ICON_SHAPES[props.name].map(([tag, attributes], index) => createElement(tag, { ...attributes, key: index }))}
    </svg>
  );
}
