/** 글자 크기를 따르는 회전 고리의 Tailwind className. 움직임 줄이기에서는 멈춘 고리로 남는다. */
const LOADING_SPINNER_CLASS_NAME =
  'loading-spinner inline-block size-[1em] shrink-0 rounded-mytube-full border-2 border-current/30 border-t-current animate-spin motion-reduce:animate-none';

/** 옆 문구가 상태를 전하는 자리에 두는 장식용 진행 표시. */
export function LoadingSpinner() {
  return <span aria-hidden="true" className={LOADING_SPINNER_CLASS_NAME} />;
}
