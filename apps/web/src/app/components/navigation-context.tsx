import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from 'react';
import { ROUTE_PATHS } from '../constants/route-paths.constant';

/** 앱 navigation context 값. */
type NavigationContextValue = {
  /** 최근 접수 job을 보존하는 요청 내역 목적지. */
  historyDestination: string;
  /** route 이동 차단 여부. */
  navigationLocked: boolean;
  /** 요청 내역 목적지를 최근 접수 job deep link로 갱신한다. */
  setHistoryDestination: (destination: string) => void;
  /** route 이동 차단 상태를 갱신한다. */
  setNavigationLocked: (locked: boolean) => void;
};

/** 앱 navigation 상태 context. */
const NavigationContext = createContext<NavigationContextValue | null>(null);

/** 앱 navigation 상태 provider props. */
type NavigationProviderProps = {
  /** 하위 route tree. */
  children: ReactNode;
};

/** route 잠금과 최근 요청 내역 목적지를 layout 하위 tree에 제공한다. */
export function NavigationProvider({ children }: NavigationProviderProps) {
  // States.

  /** route 이동 차단 여부. */
  const [navigationLocked, setNavigationLocked] = useState(false);
  /** 최근 접수 job을 가리키는 요청 내역 목적지. */
  const [historyDestination, setHistoryDestination] = useState<string>(
    ROUTE_PATHS.history,
  );

  // Computed.

  /** context 구독자에게 제공할 앱 navigation 상태. */
  const value = useMemo(
    () => ({
      historyDestination,
      navigationLocked,
      setHistoryDestination,
      setNavigationLocked,
    }),
    [historyDestination, navigationLocked],
  );

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

/** 앱 navigation 상태를 반환한다. */
export function useNavigation() {
  /** 앱 navigation context. */
  const context = useContext(NavigationContext);

  if (!context) {
    throw new Error('NavigationProvider is missing.');
  }

  return context;
}
