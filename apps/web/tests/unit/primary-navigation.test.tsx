import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { PrimaryNavigation } from '../../src/app/components/primary-navigation';
import { NavigationProvider } from '../../src/app/components/navigation-context';

describe('primary navigation', () => {
  it('exposes video, subtitles, and history as one navigation level', () => {
    /** 요청 내역 route에서 렌더링한 주요 navigation HTML. */
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/history']}>
        <NavigationProvider>
          <PrimaryNavigation />
        </NavigationProvider>
      </MemoryRouter>,
    );

    expect(markup).toContain('aria-label="주요 메뉴"');
    expect(markup).toContain('href="/video"');
    expect(markup).toContain('href="/subtitles"');
    expect(markup).toContain('href="/history"');
    expect(markup).toContain('영상 추출');
    expect(markup).toContain('자막 추출');
    expect(markup).toContain('요청 내역');
    expect(markup).toContain('aria-current="page"');
  });
});
