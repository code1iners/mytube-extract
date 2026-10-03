import { AppBrand } from './app-brand';
import { PrimaryNavigation } from './primary-navigation';

/** 데스크톱에서 브랜드 아래 세 주요 목적지를 세로로 제공한다. */
export function AppSidebar() {
  return (
    <aside className="app-sidebar hidden min-w-0 self-stretch border-r border-mytube-border pr-mytube-16 min-[821px]:block" aria-label="서비스 탐색">
      <AppBrand />
      <PrimaryNavigation
        className="primary-navigation--desktop mt-mytube-32 grid gap-mytube-8"
        linkClassName="rounded-mytube-md px-mytube-12 py-mytube-12 min-[821px]:justify-start"
      />
    </aside>
  );
}
