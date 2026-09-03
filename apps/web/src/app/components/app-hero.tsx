import {
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import { NavLink } from 'react-router';
import { ROUTE_PATHS } from '../constants/route-paths.constant';
import { AppMark } from './app-icon';
import { useNavigation } from './navigation-context';
import { PrimaryNavigation } from './primary-navigation';
import { UsageGuideDisclosure } from './usage-guide-disclosure';

/** 타이틀과 아이콘 사이 여백(px). CSS `.brand-lockup { gap }`과 값을 맞춘다. */
const BRAND_LOCKUP_GAP = 12;

/** 모든 route에서 공유하는 앱 상단 브랜드 영역. */
export function AppHero() {
  // Hooks.

  /** 추출 요청 중 route 이동 차단 상태. */
  const { navigationLocked } = useNavigation();

  // States.

  /** 타이틀이 줄바꿈될 만큼 좁은지 여부. true면 로고만 남기고 텍스트를 시각적으로 숨긴다. */
  const [isTitleCramped, setIsTitleCramped] = useState(false);

  // Refs.

  /** 아이콘+타이틀을 감싸는 영역. 실제 가용 폭을 관찰한다. */
  const lockupRef = useRef<HTMLDivElement>(null);
  /** 로고 아이콘 폭을 재기 위한 ref. */
  const markRef = useRef<HTMLDivElement>(null);
  /** 줄바꿈 없이 렌더링해 타이틀의 필요 폭을 재는 숨김 측정용 element. */
  const measureRef = useRef<HTMLParagraphElement>(null);

  // Identifiers.

  /** 설정 route의 이동 잠금 사유를 link에 연결할 id. */
  const settingsLockDescriptionId = useId();

  // Effects.

  useEffect(
    function observeTitleAvailableWidth() {
      /** 아이콘+타이틀 영역. */
      const lockupElement = lockupRef.current;

      if (!lockupElement) {
        return;
      }

      /** 실제 가용 폭과 타이틀이 필요로 하는 폭을 비교해 줄바꿈 여부를 다시 계산한다. */
      function checkTitleFits() {
        if (!lockupElement || !markRef.current || !measureRef.current) {
          return;
        }

        /** 아이콘이 차지하는 폭(간격 포함). */
        const markWidth = markRef.current.offsetWidth + BRAND_LOCKUP_GAP;
        /** 타이틀에 남는 가용 폭. */
        const availableWidth = lockupElement.clientWidth - markWidth;
        /** 줄바꿈 없이 타이틀을 그리는 데 필요한 폭. */
        const requiredWidth = measureRef.current.scrollWidth;

        setIsTitleCramped(requiredWidth > availableWidth);
      }

      checkTitleFits();

      const resizeObserver = new ResizeObserver(checkTitleFits);
      resizeObserver.observe(lockupElement);

      return () => resizeObserver.disconnect();
    },
    [],
  );

  // Handlers.

  /** 추출 요청 중 설정 route로 이동하지 않는다. */
  function handleSettingsClick(event: MouseEvent<HTMLAnchorElement>) {
    if (navigationLocked) {
      event.preventDefault();
    }
  }

  return (
    <header className="app-header">
      <div className="brand-lockup" ref={lockupRef}>
        <div className="brand-mark" ref={markRef} aria-hidden="true">
          <AppMark />
        </div>
        <h1
          id="page-title"
          className={isTitleCramped ? 'page-title page-title--hidden' : 'page-title'}
        >
          MyTube <span>Extract</span>
        </h1>
        {/* 줄바꿈 여부만 재는 항상-숨김 측정용 사본. 실제 폭 계산에 쓰인다. */}
        <p aria-hidden="true" className="page-title page-title--measure" ref={measureRef}>
          MyTube Extract
        </p>
      </div>
      <div className="hero-utilities">
        <UsageGuideDisclosure />
        <NavLink
          aria-disabled={navigationLocked || undefined}
          aria-describedby={navigationLocked ? settingsLockDescriptionId : undefined}
          className={navigationLocked ? 'settings-link is-disabled' : 'settings-link'}
          to={ROUTE_PATHS.settings}
          onClick={handleSettingsClick}
        >
          설정
        </NavLink>
        {navigationLocked ? (
          <span className="visually-hidden" id={settingsLockDescriptionId}>
            요청 접수 중에는 현재 작업을 마칠 때까지 설정으로 이동할 수 없습니다.
          </span>
        ) : null}
      </div>
      <PrimaryNavigation className="primary-navigation--desktop" />
    </header>
  );
}
