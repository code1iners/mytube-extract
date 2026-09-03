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
    <section className="phase-panel settings-panel" aria-labelledby="settings-title">
      <div className="panel-title-row">
        <h2 id="settings-title">
          <AppIcon name="settings" />
          설정
        </h2>
      </div>
      <p className="settings-description">
        이 설정의 화면 표시 선택만 이 브라우저에 저장하며, 요청 URL과 파일 정보는
        저장하지 않습니다.
      </p>
      <p className="settings-context">
        <AppIcon name="download" />
        <span>
          영상·오디오·영어 SRT 요청을 접수하고 결과를 확인하는 개인 추출 콘솔입니다.
        </span>
      </p>
      <ThemePreferenceControl
        value={themePreference}
        onChange={onThemePreferenceChange}
      />
    </section>
  );
}
