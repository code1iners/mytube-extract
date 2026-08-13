import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AppHero } from '../../src/app/components/app-hero';
import { NavigationLockProvider } from '../../src/app/components/navigation-lock-context';

describe('app hero theme control', () => {
  it('renders the three theme choices as one native radio group', () => {
    /** 테마 변경을 받는 테스트용 콜백. */
    const onThemePreferenceChange = vi.fn();
    /** 실제 route context를 포함해 만든 header HTML. */
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/video']}>
        <NavigationLockProvider>
          <AppHero
            themePreference="system"
            onThemePreferenceChange={onThemePreferenceChange}
          />
        </NavigationLockProvider>
      </MemoryRouter>,
    );

    expect(markup).not.toContain('<select');
    expect(markup).toContain('type="radio"');
    expect(markup.match(/type="radio"/g)).toHaveLength(3);
    expect(markup).toContain('시스템');
    expect(markup).toContain('라이트');
    expect(markup).toContain('다크');
  });

  it('always exposes the request history link', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/history']}>
        <NavigationLockProvider>
          <AppHero themePreference="system" onThemePreferenceChange={() => undefined} />
        </NavigationLockProvider>
      </MemoryRouter>,
    );

    expect(markup).toContain('href="/history"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('요청 내역');
  });
});
