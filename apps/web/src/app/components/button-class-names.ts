/** Primary button의 일반 Tailwind utility className. legacy selector는 소비자에서 보존한다. */
export const PRIMARY_BUTTON_UTILITY_CLASS_NAME =
  'inline-flex min-h-[48px] items-center justify-center gap-mytube-8 border border-mytube-action-primary rounded-mytube-md bg-mytube-action-primary text-mytube-on-primary cursor-pointer text-[18px] font-semibold shadow-mytube-soft focus-visible:outline-2 focus-visible:outline-mytube-focus focus-visible:outline-offset-2 [@media(hover:hover)]:hover:brightness-[0.92] active:brightness-[0.84] disabled:border-mytube-border disabled:bg-mytube-surface-alt disabled:text-mytube-text-disabled disabled:cursor-not-allowed disabled:shadow-none';

/** Secondary button의 일반 Tailwind utility className. legacy selector는 소비자에서 보존한다. */
export const SECONDARY_BUTTON_UTILITY_CLASS_NAME =
  'inline-flex min-h-[44px] items-center justify-center border border-mytube-border rounded-mytube-md bg-mytube-surface text-mytube-text-primary cursor-pointer text-[16px] font-semibold focus-visible:outline-2 focus-visible:outline-mytube-focus focus-visible:outline-offset-2 [@media(hover:hover)]:hover:bg-mytube-surface-alt [@media(hover:hover)]:hover:text-mytube-text-primary disabled:text-mytube-text-disabled disabled:cursor-not-allowed';

/** 오류 상세 안에서 쓰는 compact secondary button의 Tailwind utility className. */
export const SECONDARY_COMPACT_BUTTON_UTILITY_CLASS_NAME =
  'justify-self-start px-mytube-12 text-[14px]';
