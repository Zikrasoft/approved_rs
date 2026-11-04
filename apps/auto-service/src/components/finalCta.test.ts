import { describe, expect, it } from 'vitest';
import { content } from '@/i18n/content';
import FinalCta from './FinalCta.astro';
import { render } from './renderAstro';

const site = content('ru').site;

describe('FinalCta', () => {
  it('offers the messengers as one quiet line under the copy, not a second row of tiles', async () => {
    const root = await render(FinalCta, {
      path: '/ru/',
      props: {
        eyebrow: 'Записаться',
        heading: 'Расскажите',
        body: 'Перезвоним.',
      },
      slots: { form: '<form id="form"></form>' },
    });
    const line = root.querySelector(
      'ul[data-contact-placement]',
    )!.parentElement!;

    expect(line.firstElementChild?.textContent).toBe(site.common.writeInstead);
    expect(
      [
        ...line.querySelectorAll<HTMLAnchorElement>('a[data-contact-channel]'),
      ].map((link) => link.dataset.contactChannel),
    ).toEqual(['telegram', 'whatsapp', 'viber']);
    expect(root.querySelector('a[href^="tel:"]')).toBeNull();
    expect(root.querySelector('#form')).not.toBeNull();
  });
});
