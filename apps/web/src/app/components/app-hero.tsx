import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
} from 'react';
import { NavLink } from 'react-router';
import { ROUTE_PATHS } from '../constants/route-paths.constant';
import { type ThemePreference } from '../utils/theme-preference.util';
import { AppMark } from './app-icon';
import { useNavigationLock } from './navigation-lock-context';

/** AppHero 입력값. */
type AppHeroProps = {
  /** 현재 theme 선택. */
  themePreference: ThemePreference;
  /** theme 변경 콜백. */
  onThemePreferenceChange: (preference: ThemePreference) => void;
};

/** 헤더에서 바로 고를 수 있는 theme 방식. */
const THEME_OPTIONS = [
  { label: '시스템', value: 'system' },
  { label: '라이트', value: 'light' },
  { label: '다크', value: 'dark' },
] as const satisfies ReadonlyArray<{
  /** 화면에 표시할 theme 이름. */
  label: string;
  /** 저장할 theme preference 값. */
  value: ThemePreference;
}>;

/** 타이틀과 아이콘 사이 여백(px). CSS `.brand-lockup { gap }`과 값을 맞춘다. */
const BRAND_LOCKUP_GAP = 12;

/** 모든 route에서 공유하는 앱 상단 브랜드 영역. */
export function AppHero(props: AppHeroProps) {
  // Hooks.

  /** 추출 요청 중 route 이동 차단 상태. */
  const { navigationLocked } = useNavigationLock();

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

  /** native radio의 theme 값을 기존 앱 state에 전달한다. */
  function handleThemeChange(event: ChangeEvent<HTMLInputElement>) {
    props.onThemePreferenceChange(event.currentTarget.value as ThemePreference);
  }

  /** 추출 요청 중 요청 내역 route로 이동하지 않는다. */
  function handleHistoryClick(event: MouseEvent<HTMLAnchorElement>) {
    if (navigationLocked) {
      event.preventDefault();
    }
  }

  return (
    <header className="console-hero">
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
        <NavLink
          aria-disabled={navigationLocked || undefined}
          className={navigationLocked ? 'history-link is-disabled' : 'history-link'}
          to={ROUTE_PATHS.history}
          onClick={handleHistoryClick}
        >
          요청 내역
        </NavLink>
        <fieldset className="theme-control">
          <legend>테마</legend>
          <div className="theme-toggle">
            {THEME_OPTIONS.map((option) => (
              <label className="theme-toggle__option" key={option.value}>
                <input
                  checked={props.themePreference === option.value}
                  name="theme-preference"
                  type="radio"
                  value={option.value}
                  onChange={handleThemeChange}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </header>
  );
}
