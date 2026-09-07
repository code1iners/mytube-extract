import { Suspense, useEffect, useState } from 'react';
import { Outlet } from 'react-router';
import { AppHero } from './app-hero';
import { BottomTabBar } from './bottom-tab-bar';
import { NavigationProvider } from './navigation-context';
import {
  applyTheme,
  getThemePreference,
  setThemePreference,
  type ThemePreference,
} from '../utils/theme-preference.util';

/** 모든 Web route가 공유하는 app shell의 Tailwind layout className. */
// Tailwind v4의 max variant는 경계값을 제외하므로 기존 max-width 820/560px를 위해 1px을 더한다.
export const APP_SHELL_CLASS_NAME =
  'app-shell min-h-screen px-[var(--layout-content-gutter)] pt-[28px] pb-mytube-32 max-[821px]:pt-[14px] max-[821px]:pb-[calc(var(--layout-bottom-nav-height)_+_var(--layout-bottom-nav-clearance)_+_env(safe-area-inset-bottom))] max-[561px]:px-[10px] max-[561px]:pt-[10px]';

/** 모든 Web route가 공유하는 본문 workspace의 Tailwind layout className. */
export const WORKSPACE_CLASS_NAME =
  'workspace mx-auto grid w-full max-w-[var(--layout-content-max-width)] gap-mytube-16 max-[821px]:gap-[14px] min-[821px]:gap-[var(--layout-route-top-gap)]';

/** 모든 web route가 공유하는 화면 레이아웃. */
export function AppLayout() {
  // States.

  /** 사용자가 선택한 전체 앱 theme 방식. */
  const [themePreference, setThemePreferenceState] =
    useState<ThemePreference>(getThemePreference);

  // Effects.

  useEffect(
    function synchronizeThemePreference() {
      applyTheme(themePreference);

      if (themePreference !== 'system') {
        return;
      }

      /** 운영체제 테마 변경을 현재 문서에 반영할 media query. */
      const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      /** 시스템 테마가 바뀌면 semantic token과 browser chrome 색을 함께 갱신한다. */
      function handleColorSchemeChange() {
        applyTheme('system');
      }

      colorSchemeQuery.addEventListener('change', handleColorSchemeChange);
      return () =>
        colorSchemeQuery.removeEventListener('change', handleColorSchemeChange);
    },
    [themePreference],
  );

  // Handlers.

  /** theme 선택을 storage와 화면에 함께 반영한다. */
  function handleThemePreferenceChange(preference: ThemePreference) {
    setThemePreferenceState(preference);
    setThemePreference(preference);
  }

  return (
    <NavigationProvider>
      <main className={APP_SHELL_CLASS_NAME}>
        <section className={WORKSPACE_CLASS_NAME} aria-labelledby="page-title">
          <AppHero />
          <Suspense fallback={<RouteLoadingFallback />}>
            <Outlet
              context={{
                onThemePreferenceChange: handleThemePreferenceChange,
                themePreference,
              }}
            />
          </Suspense>
        </section>
        <BottomTabBar />
      </main>
    </NavigationProvider>
  );
}

/** 지연 로딩 중에도 현재 app shell과 보조 기술 안내를 유지한다. */
function RouteLoadingFallback() {
  return (
    <section className="phase-panel route-loading" aria-label="화면 불러오기">
      <p role="status">화면을 불러오는 중입니다.</p>
    </section>
  );
}
