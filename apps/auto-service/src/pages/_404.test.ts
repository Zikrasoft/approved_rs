import { describe, expect, it } from 'vitest';
import { content } from '@/i18n/content';
import { render } from '@/components/renderAstro';
import NotFound from './404.astro';

const { pages, site } = content('ru');

describe('the 404 page', () => {
  it('asks the lost visitor to get in touch and offers a callback on a mouse', async () => {
    const body = (
      await render(NotFound, { path: '/ru/missing/' })
    ).querySelector('[data-site-body]')!;
    const callback = body.querySelector('[data-open-lead-modal="phone"]')!;

    expect(body.textContent).toContain(pages.notFound.writeUs);
    expect(callback.textContent?.trim()).toBe(site.header.callback);
    expect(callback.classList.contains('pointer-coarse:hidden!')).toBe(true);
    expect(callback.closest('[data-contact-placement]')).not.toBeNull();
  });

  it('keeps the dialer to the tiles, never a second call button', async () => {
    const calls = [
      ...(await render(NotFound, { path: '/ru/missing/' }))
        .querySelector('[data-site-body]')!
        .querySelectorAll('a[href^="tel:"]'),
    ];

    expect(
      calls.filter(
        (call) =>
          !call.classList.contains('pointer-coarse:hidden!') &&
          !call.closest('li'),
      ),
    ).toEqual([]);
  });
});
