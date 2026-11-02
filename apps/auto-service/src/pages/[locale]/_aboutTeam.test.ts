import { describe, expect, it, vi } from 'vitest';
import { render } from '@/components/renderAstro';
import AboutPage from './about.astro';

vi.mock('astro:content', () => ({
  getCollection: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/i18n/content', async (actual) => {
  const real = await actual<typeof import('@/i18n/content')>();
  return {
    content: (locale: Parameters<typeof real.content>[0]) => {
      const section = real.content(locale);
      return {
        ...section,
        pages: {
          ...section.pages,
          about: { ...section.pages.about, team: ['Работаем с 2015 года.'] },
        },
      };
    },
  };
});

describe('the about page once the owner writes the team block', () => {
  it('shows who works here and drops the makes block without any Work', async () => {
    const root = await render(AboutPage as never, {
      path: '/ru/about/',
      params: { locale: 'ru' },
    });
    const main = root.querySelector('main')!;

    expect(main.textContent).toContain('Кто мы');
    expect(main.textContent).toContain('Работаем с 2015 года.');
    expect(main.textContent).not.toContain('С какими машинами работаем');
  });
});
