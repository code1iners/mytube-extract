import { type ChangeEvent } from 'react';
import {
  type ThemePreference,
} from '../utils/theme-preference.util';

/** 테마 선택지. */
const THEME_OPTIONS = [
  { label: '시스템', value: 'system' },
  { label: '라이트', value: 'light' },
  { label: '다크', value: 'dark' },
] as const satisfies ReadonlyArray<{
  /** 화면에 표시할 테마 이름. */
  label: string;
  /** 저장할 테마 preference 값. */
  value: ThemePreference;
}>;

/** 테마 선택 control 속성. */
type ThemePreferenceControlProps = {
  /** 현재 선택한 테마 preference. */
  value: ThemePreference;
  /** 테마 preference 변경 콜백. */
  onChange: (preference: ThemePreference) => void;
};

/** 시스템·라이트·다크 테마 preference를 native radio로 제공한다. */
export function ThemePreferenceControl({
  onChange,
  value,
}: ThemePreferenceControlProps) {
  // Handlers.

  /** native radio의 테마 값을 상위 state에 전달한다. */
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(event.currentTarget.value as ThemePreference);
  }

  return (
    <fieldset className="theme-control theme-control--settings">
      <legend>화면 표시</legend>
      <div className="theme-toggle">
        {THEME_OPTIONS.map((option) => (
          <label className="theme-toggle__option" key={option.value}>
            <input
              checked={value === option.value}
              name="theme-preference"
              type="radio"
              value={option.value}
              onChange={handleChange}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
