import { describe, expect, it } from 'vitest';
import Faq from './Faq.astro';
import { render } from './renderAstro';

const items = [{ q: 'Сколько стоит?', a: 'Бесплатно.' }];
const list = async (props: Record<string, unknown> = {}) =>
  (await render(Faq, { path: '/ru/', props: { items, ...props } }))
    .firstElementChild!;

describe('Faq', () => {
  it('sits under a stacked heading by default', async () => {
    expect((await list()).classList.contains('mt-8')).toBe(true);
  });

  it('drops the top gap beside a side heading', async () => {
    expect((await list({ class: '' })).classList.contains('mt-8')).toBe(false);
    expect((await list()).textContent).toContain('Сколько стоит?');
  });
});
