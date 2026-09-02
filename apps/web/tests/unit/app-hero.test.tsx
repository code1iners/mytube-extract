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
