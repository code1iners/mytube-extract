import { useEffect, useRef } from 'react';
import { PrimaryNavigation } from './primary-navigation';

/** 화면 하단에 고정되는 route tab bar. */
export function BottomTabBar() {
  /** 글자 확대와 줄바꿈 이후의 탭 높이를 관찰한다. */
  const navigationRef = useRef<HTMLElement>(null);

  useEffect(function reserveBottomNavigationSpace() {
    /** 현재 모바일 탭 표면. */
    const navigation = navigationRef.current;
    if (!navigation) return;

    /** 안전 여백은 CSS에서 별도로 더하므로 탭 자체 높이만 반영한다. */
    const observer = new ResizeObserver(() => {
      /** display:none인 데스크톱 표면은 본문 여백에 반영하지 않는다. */
      const height = navigation.getBoundingClientRect().height -
        parseFloat(getComputedStyle(navigation).paddingBottom);
      if (height > 0) {
        document.documentElement.style.setProperty('--layout-bottom-nav-height', `${height}px`);
      }
    });
    observer.observe(navigation);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--layout-bottom-nav-height');
    };
  }, []);

  return (
    <PrimaryNavigation
      ref={navigationRef}
      className="primary-navigation--mobile bottom-tab-bar fixed bottom-0 left-1/2 z-20 hidden w-[calc(100%_-_var(--layout-content-gutter)_-_var(--layout-content-gutter))] max-w-[var(--layout-content-max-width)] min-h-[61px] -translate-x-1/2 grid-cols-3 border-t border-mytube-border bg-mytube-surface max-[821px]:grid"
      linkClassName="bottom-tab-link min-h-[60px] flex-col gap-mytube-4 py-mytube-8 border-b-0 [&.is-disabled]:opacity-60"
    />
  );
}
