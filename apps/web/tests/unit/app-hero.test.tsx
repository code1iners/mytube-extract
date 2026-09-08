import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AppHero } from '../../src/app/components/app-hero';
import { NavigationProvider } from '../../src/app/components/navigation-context';

describe('app hero theme control', () => {
  it('moves theme choices out of the header and links to secondary settings', () => {
    /** 실제 route context를 포함해 만든 header HTML. */
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/video']}>
        <NavigationProvider>
          <AppHero />
        </NavigationProvider>
      </MemoryRouter>,
    );

    expect(markup).not.toContain('type="radio"');
    expect(markup).toContain('href="/settings"');
    expect(markup).toContain('설정');
    expect(markup).toMatch(/class="usage-guide(?:\s|[\"])/);
    expect(markup).toContain('더보기');
    expect(markup).not.toContain('aria-haspopup="menu"');
    expect(markup).not.toContain('role="menu"');
    expect(markup).not.toContain('role="menuitem"');
    expect(markup).toContain('API 응답을 기준으로 표시합니다.');
    expect(markup).toContain('현재 브라우저에만 남습니다.');
    expect(markup).toContain('기본 7일 보관됩니다.');
    expect(markup).not.toContain('단축키');
    expect(markup).not.toContain('<kbd>');
  });

  it('always exposes the request history link', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/history']}>
        <NavigationProvider>
          <AppHero />
        </NavigationProvider>
      </MemoryRouter>,
    );

    expect(markup).toContain('href="/history"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('요청 내역');
  });
});
