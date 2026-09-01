import { PrimaryNavigation } from './primary-navigation';

/** 화면 하단에 고정되는 route tab bar. */
export function BottomTabBar() {
  return (
    <PrimaryNavigation
      className="primary-navigation--mobile bottom-tab-bar"
      linkClassName="bottom-tab-link"
    />
  );
}
