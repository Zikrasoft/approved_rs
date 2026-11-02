import { describe, expect, it } from 'vitest';
import { content } from '@/i18n/content';
import { render } from '@/components/renderAstro';
import HomePage from './index.astro';

const { home } = content('ru');

describe('the home page', () => {
  it('leads the hero trust row with the Google rating', async () => {
    const root = await render(HomePage as never, {
      path: '/ru/',
      params: { locale: 'ru' },
    });
    const trust = [...root.querySelectorAll('ul')].find((list) =>
      list.textContent?.includes(home.hero.badges[0]!),
    )!;

    expect(trust.querySelector('li')?.textContent?.trim()).toBe(
      '5.0 в Google · 14 отзывов',
    );
  });
});
