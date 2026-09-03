import {
  type KeyboardEvent,
  type SyntheticEvent,
  useId,
  useRef,
  useState,
} from 'react';

/** 헤더에서 다시 확인할 수 있는 제품 사용 안내. */
export function UsageGuideDisclosure() {
  // States.

  /** 사용 안내 disclosure의 현재 열림 상태. */
  const [isOpen, setIsOpen] = useState(false);

  // Refs.

  /** native details element. Escape로 닫을 때 상태를 확인한다. */
  const detailsRef = useRef<HTMLDetailsElement>(null);
  /** 닫은 뒤 포커스를 되돌릴 summary element. */
  const summaryRef = useRef<HTMLElement>(null);

  // Identifiers.

  /** 사용 안내 summary의 accessible name id. */
  const summaryId = useId();
  /** 사용 안내 본문 region id. */
  const contentId = useId();

  // Handlers.

  /** native summary click 뒤의 open 상태를 React 접근성 상태에 반영한다. */
  function handleSummaryClick() {
    setIsOpen((previousIsOpen) => !previousIsOpen);
  }

  /** native details의 open 상태를 React 상태와 동기화한다. */
  function handleToggle(event: SyntheticEvent<HTMLDetailsElement>) {
    setIsOpen(event.currentTarget.open);
  }

  /** 열린 사용 안내를 Escape로 닫고 summary에 포커스를 돌린다. */
  function handleKeyDown(event: KeyboardEvent<HTMLDetailsElement>) {
    if (event.key !== 'Escape' || !detailsRef.current?.open) {
      return;
    }

    event.preventDefault();
    detailsRef.current.open = false;
    setIsOpen(false);
    window.requestAnimationFrame(() => summaryRef.current?.focus());
  }

  return (
    <details
      className="usage-guide"
      ref={detailsRef}
      onKeyDown={handleKeyDown}
      onToggle={handleToggle}
    >
      <summary
        aria-controls={contentId}
        aria-expanded={isOpen}
        id={summaryId}
        ref={summaryRef}
        onClick={handleSummaryClick}
      >
        사용 안내
      </summary>
      <div
        aria-labelledby={summaryId}
        className="usage-guide__content"
        id={contentId}
        role="region"
      >
        <ul>
          <li>
            <strong>요청 상태</strong>
            <span>API 응답을 기준으로 표시합니다.</span>
          </li>
          <li>
            <strong>요청 내역</strong>
            <span>현재 브라우저에만 남습니다.</span>
          </li>
          <li>
            <strong>완료 파일</strong>
            <span>기본 7일 보관됩니다.</span>
          </li>
          <li>
            <strong>단축키</strong>
            <span>
              <kbd>U</kbd>는 영상 URL 입력, <kbd>F</kbd>는 자막 파일 선택에
              포커스합니다.
            </span>
          </li>
        </ul>
      </div>
    </details>
  );
}
