import { AppMark } from './app-icon';

/** 모바일 헤더와 데스크톱 사이드바에서 공유하는 서비스 이름. */
export function AppBrand() {
  return (
    <div className="brand-lockup flex min-w-0 items-center gap-mytube-12">
      <div className="brand-mark size-8 shrink-0 max-[561px]:size-[26px]" aria-hidden="true">
        <AppMark />
      </div>
      <h1 className="page-title m-0 min-w-0 text-[19px] font-semibold leading-[1.35] text-mytube-text-primary [overflow-wrap:anywhere]">
        MyTube Extract
      </h1>
    </div>
  );
}
