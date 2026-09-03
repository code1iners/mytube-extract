/** 입력 중인 element에서는 route 단축키를 실행하지 않는다. */
export function isTextEditingTarget(target: EventTarget | null) {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
}

/** 브라우저 기본 단축키와 겹치지 않는 unmodified key event인지 확인한다. */
export function isUnmodifiedShortcut(
  event: KeyboardEvent,
  code: string,
) {
  return (
    event.code === code &&
    !event.defaultPrevented &&
    !event.repeat &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    !isTextEditingTarget(event.target)
  );
}
