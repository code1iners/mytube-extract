import { AppBrand } from './app-brand';
import { UsageGuideDisclosure } from './usage-guide-disclosure';

/** 모바일 브랜드와 모든 화면의 보조 메뉴를 제공하는 헤더. */
export function AppHero() {
  return (
    <header className="app-header flex min-w-0 items-center justify-between gap-mytube-16 border-b border-mytube-border pb-mytube-16 max-[821px]:pb-[14px] max-[561px]:gap-mytube-8 max-[561px]:pb-[10px] min-[821px]:justify-end min-[821px]:border-0 min-[821px]:pb-0">
      <div className="min-w-0 min-[821px]:hidden">
        <AppBrand />
      </div>
      <div className="hero-utilities relative flex shrink-0 items-center justify-end">
        <UsageGuideDisclosure />
      </div>
    </header>
  );
}
