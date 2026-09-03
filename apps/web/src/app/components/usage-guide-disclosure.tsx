import {
  type KeyboardEvent,
  type MouseEvent,
  type SyntheticEvent,
  useId,
  useEffect,
  useRef,
  useState,
} from 'react';
import { NavLink } from 'react-router';
import { ROUTE_PATHS } from '../constants/route-paths.constant';
import { useNavigation } from './navigation-context';

/** 헤더에서 다시 확인할 수 있는 제품 사용 안내. */
export function UsageGuideDisclosure() {
  // Hooks.

  /** 추출 요청 중 설정 route로 이동할 수 없는지 여부. */
  const { navigationLocked } = useNavigation();

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
  /** 설정 route의 이동 잠금 사유를 link에 연결할 id. */
  const settingsLockDescriptionId = useId();

  // Handlers.

  /** native summary click 뒤의 open 상태를 React 접근성 상태에 반영한다. */
  function handleSummaryClick() {
    setIsOpen((previousIsOpen) => !previousIsOpen);
  }

  /** native details의 open 상태를 React 상태와 동기화한다. */
  function handleToggle(event: SyntheticEvent<HTMLDetailsElement>) {
    setIsOpen(event.currentTarget.open);
  }

  /** 추출 요청 중 설정 route로 이동하지 않는다. */
  function handleSettingsClick(event: MouseEvent<HTMLAnchorElement>) {
    if (navigationLocked) {
      event.preventDefault();
      return;
    }

    closeDisclosure();
  }

  /** 열린 더보기 메뉴를 닫고 summary로 포커스를 되돌린다. */
  function closeDisclosure(restoreFocus = false) {
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }

    setIsOpen(false);

    if (restoreFocus) {
      window.requestAnimationFrame(() => summaryRef.current?.focus());
    }
  }

  /** 열린 사용 안내를 Escape로 닫고 summary에 포커스를 돌린다. */
  function handleKeyDown(event: KeyboardEvent<HTMLDetailsElement>) {
    if (event.key !== 'Escape' || !detailsRef.current?.open) {
      return;
    }

    event.preventDefault();
    closeDisclosure(true);
  }

  useEffect(
    function closeDisclosureOnOutsidePointerDown() {
      /** 바깥 pointer 입력으로 disclosure를 닫고 summary로 포커스를 복귀한다. */
      function handlePointerDown(event: PointerEvent) {
        const detailsElement = detailsRef.current;

        if (!detailsElement?.open || detailsElement.contains(event.target as Node)) {
          return;
        }

        closeDisclosure(true);
      }

      document.addEventListener('pointerdown', handlePointerDown);
      return () => document.removeEventListener('pointerdown', handlePointerDown);
    },
    [],
  );

  return (
    <details
      className="usage-guide"
      ref={detailsRef}
      onKeyDown={handleKeyDown}
      onToggle={handleToggle}
    >
      <summary
        aria-haspopup="menu"
        aria-controls={contentId}
        aria-expanded={isOpen}
        id={summaryId}
        ref={summaryRef}
        onClick={handleSummaryClick}
      >
        더보기
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
        <div aria-label="더보기 메뉴" className="usage-guide__menu" role="menu">
          <NavLink
            aria-disabled={navigationLocked || undefined}
            aria-describedby={
              navigationLocked ? settingsLockDescriptionId : undefined
            }
            className={
              navigationLocked
                ? 'settings-link usage-guide__settings is-disabled'
                : 'settings-link usage-guide__settings'
            }
            role="menuitem"
            to={ROUTE_PATHS.settings}
            onClick={handleSettingsClick}
          >
            설정
          </NavLink>
        </div>
        {navigationLocked ? (
          <span className="visually-hidden" id={settingsLockDescriptionId}>
            요청 접수 중에는 현재 작업을 마칠 때까지 설정으로 이동할 수 없습니다.
          </span>
        ) : null}
      </div>
    </details>
  );
}
