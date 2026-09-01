import { type MouseEvent, useId } from 'react';
import { matchPath, NavLink, useLocation } from 'react-router';
import { ROUTE_PATHS } from '../constants/route-paths.constant';
import { useNavigationLock } from './navigation-lock-context';
import { AppIcon, type AppIconName } from './app-icon';

/** 앱의 주요 작업 목적지. */
const PRIMARY_NAVIGATION_ITEMS = [
  {
    icon: 'video',
    label: '영상 추출',
    path: ROUTE_PATHS.video,
  },
  {
    icon: 'subtitle',
    label: '자막 추출',
    path: ROUTE_PATHS.subtitles,
  },
  {
    icon: 'history',
    label: '요청 내역',
    path: ROUTE_PATHS.history,
  },
] as const satisfies ReadonlyArray<{
  /** 목적지 아이콘 이름. */
  icon: AppIconName;
  /** 목적지 표시 라벨. */
  label: string;
  /** 목적지 route path. */
  path: string;
}>;

/** 주요 navigation 속성. */
type PrimaryNavigationProps = {
  /** 반응형 표시 surface를 구분하는 추가 className. */
  className?: string;
  /** 기존 surface별 link selector와 호환되는 추가 className. */
  linkClassName?: string;
};

/** 영상·자막·요청 내역을 동일한 수준으로 노출하는 주요 navigation. */
export function PrimaryNavigation({
  className = '',
  linkClassName = '',
}: PrimaryNavigationProps) {
  // Hooks.

  /** 현재 브라우저 route 위치. */
  const location = useLocation();
  /** 추출 요청 중 route 이동 차단 상태. */
  const { navigationLocked } = useNavigationLock();

  // Identifiers.

  /** 잠금 사유를 각 비활성 목적지에 연결할 id. */
  const lockDescriptionId = useId();

  // Computed.

  /** navigation surface에 적용할 className. */
  const navigationClassName = [
    'primary-navigation',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <nav aria-label="주요 메뉴" className={navigationClassName}>
      {navigationLocked ? (
        <p className="visually-hidden" id={lockDescriptionId}>
          요청 접수 중에는 현재 작업을 마칠 때까지 다른 주요 메뉴로 이동할 수
          없습니다.
        </p>
      ) : null}
      {PRIMARY_NAVIGATION_ITEMS.map((item) => {
        /** 현재 route와 일치하는 목적지인지 여부. */
        const isActive =
          matchPath({ end: true, path: item.path }, location.pathname) !== null;
        /** 추출 진행 중 다른 목적지로 이동하려는지 여부. */
        const blocksNavigation = navigationLocked && !isActive;

        /** 추출 진행 중 다른 주요 목적지로 이동하지 않는다. */
        function handleClick(event: MouseEvent<HTMLAnchorElement>) {
          if (!blocksNavigation) {
            return;
          }

          event.preventDefault();
        }

        /** 목적지의 active·disabled 상태를 하나의 판정 결과로 공유한다. */
        const navigationLinkClassName = [
          'primary-navigation__link',
          linkClassName,
          isActive ? 'is-active' : '',
          blocksNavigation ? 'is-disabled' : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <NavLink
            aria-describedby={blocksNavigation ? lockDescriptionId : undefined}
            aria-disabled={blocksNavigation || undefined}
            className={navigationLinkClassName}
            end
            key={item.path}
            to={item.path}
            onClick={handleClick}
          >
            <AppIcon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
