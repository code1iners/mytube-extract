import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { SettingsPage } from '../../src/app/pages/settings/page';

describe('settings page', () => {
  it('keeps the three theme preferences in the secondary settings area', () => {
    /** 설정 route에서 렌더링한 테마 설정 HTML. */
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route
            element={
              <Outlet
                context={{
                  onThemePreferenceChange: vi.fn(),
                  themePreference: 'dark',
                }}
              />
            }
          >
            <Route element={<SettingsPage />} path="/settings" />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(markup).toContain('설정');
    expect(markup).toContain('테마');
    expect(markup.match(/type="radio"/g)).toHaveLength(3);
    expect(markup).toContain('시스템');
    expect(markup).toContain('라이트');
    expect(markup).toContain('다크');
    expect(markup).toContain(
      'type="radio" name="theme-preference" checked="" value="dark"',
    );
  });
});
