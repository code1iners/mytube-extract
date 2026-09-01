import { useOutletContext } from 'react-router';
import { AppIcon } from '../../components/app-icon';
import { ThemePreferenceControl } from '../../components/theme-preference-control';
import { type ThemePreference } from '../../utils/theme-preference.util';

/** 설정 route가 layout으로부터 받는 context. */
type SettingsOutletContext = {
  /** 테마 변경 콜백. */
  onThemePreferenceChange: (preference: ThemePreference) => void;
  /** 현재 테마 preference. */
  themePreference: ThemePreference;
};

/** Web 앱의 보조 설정 route. */
export function SettingsPage() {
  // Hooks.

  /** layout이 공유하는 테마 preference와 변경 콜백. */
  const { onThemePreferenceChange, themePreference } =
    useOutletContext<SettingsOutletContext>();

  return (
    <section className="console-panel phase-panel settings-panel" aria-labelledby="settings-title">
      <div className="panel-title-row">
        <h2 id="settings-title">
          <AppIcon name="settings" />
          설정
        </h2>
        <span className="title-dots" aria-hidden="true" />
      </div>
      <p className="settings-description">
        화면 표시 방식만 관리합니다. 요청과 파일 정보는 이곳에 저장하지 않습니다.
      </p>
      <ThemePreferenceControl
        value={themePreference}
        onChange={onThemePreferenceChange}
      />
    </section>
  );
}
