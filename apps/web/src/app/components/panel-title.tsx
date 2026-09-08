import { AppIcon, type AppIconName } from './app-icon';

/** 공통 panel 제목 row의 Tailwind layout className. legacy selector는 테스트 훅으로 보존한다. */
const PANEL_TITLE_ROW_CLASS_NAME =
  'panel-title-row flex items-center mb-mytube-16';

/** 공통 panel 제목의 Tailwind typography className. */
const PANEL_TITLE_CLASS_NAME =
  'm-0 inline-flex items-center gap-mytube-8 text-mytube-text-primary text-[21px] font-semibold leading-[1.4]';

/** 상태 갱신 표시의 Tailwind layout·color className. legacy selector는 브라우저 검증 훅으로 보존한다. */
const PANEL_TITLE_REFRESH_CLASS_NAME =
  'panel-title__refresh inline-grid size-5 place-items-center text-mytube-status-processing';

/** 공통 panel 제목 속성. */
type PanelTitleProps = {
  /** 제목에 표시할 아이콘. */
  icon: AppIconName;
  /** 제목 heading id. */
  id: string;
  /** 제목 row에 추가할 className. */
  className?: string;
  /** 제목 heading에 추가할 className. */
  titleClassName?: string;
  /** 기존 ready form을 유지한 채 health를 갱신하는지 여부. */
  isRefreshing?: boolean;
  /** 제목의 programmatic focus 대상 여부. */
  tabIndex?: number;
  /** 제목. */
  children: string;
};

/** 화면별 요청·상태 제목이 동일한 의미 구조와 스타일을 공유하도록 렌더링한다. */
export function PanelTitle({
  children,
  className,
  icon,
  id,
  isRefreshing = false,
  tabIndex,
  titleClassName,
}: PanelTitleProps) {
  /** 제목 row와 화면별 추가 className을 합친 결과. */
  const rowClassName = [PANEL_TITLE_ROW_CLASS_NAME, className]
    .filter(Boolean)
    .join(' ');
  /** 제목 기본 utility와 화면별 heading className을 합친 결과. */
  const headingClassName = [PANEL_TITLE_CLASS_NAME, titleClassName]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rowClassName}>
      <h2 className={headingClassName} id={id} tabIndex={tabIndex}>
        <AppIcon name={icon} />
        {children}
        {isRefreshing ? (
          <span
            aria-hidden="true"
            className={PANEL_TITLE_REFRESH_CLASS_NAME}
            title="서비스 상태 새로 확인 중"
          >
            <AppIcon className="size-4" name="processing" />
          </span>
        ) : null}
      </h2>
    </div>
  );
}
