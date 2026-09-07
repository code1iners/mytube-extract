import { PrimaryNavigation } from './primary-navigation';

/** 화면 하단에 고정되는 route tab bar. */
export function BottomTabBar() {
  return (
    <PrimaryNavigation
      className="primary-navigation--mobile bottom-tab-bar fixed bottom-0 left-1/2 z-20 hidden w-[calc(100%_-_var(--layout-content-gutter)_-_var(--layout-content-gutter))] max-w-[var(--layout-content-max-width)] min-h-[var(--layout-bottom-nav-height)] -translate-x-1/2 grid-cols-3 border-t border-mytube-border bg-mytube-surface max-[821px]:grid"
      linkClassName="bottom-tab-link min-h-[60px] border-b-0 [&.is-disabled]:opacity-60"
    />
  );
}
