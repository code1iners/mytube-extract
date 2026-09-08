import { useOutletContext } from 'react-router';
import { AppIcon } from '../../components/app-icon';
import { PanelTitle } from '../../components/panel-title';
import { ThemePreferenceControl } from '../../components/theme-preference-control';
import { type ThemePreference } from '../../utils/theme-preference.util';

/** 설정 화면의 flat layout·surface className. */
const SETTINGS_PANEL_CLASS_NAME =
  'phase-panel settings-panel grid min-w-0 w-full max-w-none m-0 gap-mytube-24 border-0 rounded-none bg-transparent p-0 [box-shadow:none] min-[821px]:self-start';
/** 설정 화면 설명의 Tailwind typography className. */
const SETTINGS_DESCRIPTION_CLASS_NAME =
  'settings-description m-0 text-mytube-text-secondary text-[16px] leading-[1.6]';
/** 설정 화면의 제품 맥락 안내 className. */
const SETTINGS_CONTEXT_CLASS_NAME =
  'settings-context flex items-start gap-mytube-8 m-0 text-mytube-text-primary text-[14px] leading-[1.5]';
/** 설정 화면의 제품 맥락 아이콘 className. */
const SETTINGS_CONTEXT_ICON_CLASS_NAME =
  '!size-5 shrink-0 text-mytube-action-primary';

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
    <section className={SETTINGS_PANEL_CLASS_NAME} aria-labelledby="settings-title">
      <PanelTitle icon="settings" id="settings-title">
        설정
      </PanelTitle>
      <p className={SETTINGS_DESCRIPTION_CLASS_NAME}>
        이 설정의 화면 표시 선택만 이 브라우저에 저장하며, 요청 URL과 파일 정보는
        저장하지 않습니다.
      </p>
      <p className={SETTINGS_CONTEXT_CLASS_NAME}>
        <AppIcon className={SETTINGS_CONTEXT_ICON_CLASS_NAME} name="download" />
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
