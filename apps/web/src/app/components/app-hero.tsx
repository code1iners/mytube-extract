import { useEffect, useRef, useState } from 'react';
import { AppMark } from './app-icon';
import { PrimaryNavigation } from './primary-navigation';
import { UsageGuideDisclosure } from './usage-guide-disclosure';

/** 타이틀과 아이콘 사이 여백(px). Tailwind `gap-mytube-12`와 값을 맞춘다. */
const BRAND_LOCKUP_GAP = 12;

/** 서비스 제목과 실제 폭 측정 사본이 공유하는 Tailwind typography className. */
const PAGE_TITLE_CLASS_NAME =
  'page-title m-0 text-[28px] font-semibold leading-[1.35] text-mytube-text-primary max-[821px]:text-[24px] max-[561px]:text-[19px]';

/** 모든 route에서 공유하는 앱 상단 브랜드 영역. */
export function AppHero() {
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

  /** 현재 폭에서 측정 결과를 반영한 서비스 제목 className. */
  const pageTitleClassName = [
    PAGE_TITLE_CLASS_NAME,
    isTitleCramped ? 'page-title--hidden sr-only' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <header
      className="app-header grid grid-rows-[auto_auto] grid-cols-[minmax(0,1fr)_auto] items-center gap-mytube-16 border-b border-mytube-border pb-mytube-16 max-[821px]:pb-[14px] max-[561px]:gap-mytube-8 max-[561px]:pb-[10px]"
    >
      <div
        className="brand-lockup relative flex min-w-0 items-center gap-mytube-12"
        ref={lockupRef}
      >
        <div
          className="brand-mark size-10 shrink-0 max-[821px]:size-8 max-[561px]:size-[26px]"
          ref={markRef}
          aria-hidden="true"
        >
          <AppMark />
        </div>
        <h1
          id="page-title"
          className={pageTitleClassName}
        >
          MyTube <span className="text-mytube-action-primary">Extract</span>
        </h1>
        {/* 줄바꿈 여부만 재는 항상-숨김 측정용 사본. 실제 폭 계산에 쓰인다. */}
        <p
          aria-hidden="true"
          className={`${PAGE_TITLE_CLASS_NAME} page-title--measure absolute -left-[9999px] -top-[9999px] pointer-events-none invisible whitespace-nowrap`}
          ref={measureRef}
        >
          MyTube Extract
        </p>
      </div>
      <div className="hero-utilities relative flex items-center justify-end gap-mytube-12 max-[821px]:gap-mytube-8">
        <UsageGuideDisclosure />
      </div>
      <PrimaryNavigation className="primary-navigation--desktop col-span-2 grid min-w-0 grid-cols-3 border-t border-mytube-border max-[821px]:hidden" />
    </header>
  );
}
