import { type ChangeEvent } from 'react';
import {
  type ThemePreference,
} from '../utils/theme-preference.util';

/** 테마 preference fieldset의 Tailwind layout·typography className. */
const THEME_CONTROL_CLASS_NAME =
  'theme-control theme-control--settings grid min-w-0 gap-mytube-12 m-0 border-0 p-0 text-mytube-text-secondary text-[14px]';
/** 테마 선택지 묶음의 Tailwind layout className. */
const THEME_TOGGLE_CLASS_NAME = 'theme-toggle inline-flex w-full';
/** 테마 선택지 label의 Tailwind layout className. */
const THEME_OPTION_CLASS_NAME =
  'theme-toggle__option relative flex min-w-0 flex-1 cursor-pointer';
/** 화면에서 숨기되 키보드 조작을 유지하는 native radio className. */
const THEME_OPTION_INPUT_CLASS_NAME = 'peer sr-only';
/** 테마 선택지 표면과 상태의 Tailwind className. */
const THEME_OPTION_LABEL_CLASS_NAME =
  'inline-flex min-h-[44px] w-full items-center justify-center px-[10px] border border-mytube-border bg-mytube-surface text-mytube-text-primary whitespace-nowrap leading-[1.2] peer-checked:relative peer-checked:z-[1] peer-checked:border-mytube-action-primary peer-checked:bg-mytube-surface peer-checked:text-mytube-text-primary peer-checked:underline peer-checked:decoration-mytube-text-primary peer-checked:decoration-2 peer-checked:underline-offset-4 peer-focus-visible:relative peer-focus-visible:z-[2] peer-focus-visible:outline-2 peer-focus-visible:outline-mytube-focus peer-focus-visible:outline-offset-2 [@media(hover:hover)]:hover:bg-mytube-surface-alt [@media(hover:hover)]:hover:text-mytube-text-primary';

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

/** segmented control의 첫·중간·마지막 경계를 연결한다. */
function getThemeOptionLabelClassName(index: number) {
  /** 선택지 위치에 따라 적용할 border와 겹침 className. */
  const positionClassNames = [
    index === 0 ? 'rounded-l-mytube-sm rounded-r-none' : '',
    index > 0 ? '-ml-px' : '',
    index === THEME_OPTIONS.length - 1
      ? 'rounded-r-mytube-sm rounded-l-none'
      : '',
  ].filter(Boolean);

  return [THEME_OPTION_LABEL_CLASS_NAME, ...positionClassNames].join(' ');
}

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
    <fieldset className={THEME_CONTROL_CLASS_NAME}>
      <legend className="text-mytube-text-primary text-[16px] font-semibold leading-[1.4]">
        화면 표시
      </legend>
      <div className={THEME_TOGGLE_CLASS_NAME}>
        {THEME_OPTIONS.map((option, index) => (
          <label className={THEME_OPTION_CLASS_NAME} key={option.value}>
            <input
              checked={value === option.value}
              name="theme-preference"
              className={THEME_OPTION_INPUT_CLASS_NAME}
              type="radio"
              value={option.value}
              onChange={handleChange}
            />
            <span className={getThemeOptionLabelClassName(index)}>
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
