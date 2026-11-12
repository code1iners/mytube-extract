/** 로컬 저장 파일명에서 경로 구분자·제어 문자를 공백으로 바꾸고 남은 공백을 정리한다. */
export function sanitizeFilenameSegment(value: string): string {
  /** 경로 구분자·제어 문자를 공백으로 치환한 문자열. */
  const withoutUnsafeChars = Array.from(value)
    .map((character) => (isUnsafeFilenameChar(character) ? ' ' : character))
    .join('');

  return withoutUnsafeChars.replace(/\s+/g, ' ').trim();
}

/** 파일명에서 확장자 앞부분으로 쓸 안전한 값을 만든다. 정리 후 상대 경로 표기(`.`, `..`)만 남으면 쓸 수 없어 빈 문자열을 돌려준다. */
export function sanitizeFilenameStem(value: string): string {
  /** 경로 구분자·제어 문자를 정리한 값. */
  const sanitized = sanitizeFilenameSegment(value);

  return sanitized === '.' || sanitized === '..' ? '' : sanitized;
}

/** 경로 탐색이나 파일 시스템 오작동을 일으킬 수 있는 문자인지 확인한다. */
function isUnsafeFilenameChar(character: string): boolean {
  if (character === '\\' || character === '/') {
    return true;
  }

  /** 문자의 코드 포인트. */
  const codePoint = character.codePointAt(0) ?? 0;

  // C0 제어 문자(0x00-0x1F)와 DEL(0x7F).
  return codePoint <= 0x1f || codePoint === 0x7f;
}
