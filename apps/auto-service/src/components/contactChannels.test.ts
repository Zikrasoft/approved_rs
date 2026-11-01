import { describe, expect, it } from 'vitest';
import ContactChannels from './ContactChannels.astro';
import { render } from './renderAstro';

const channels = (props: Record<string, unknown>) =>
  render(ContactChannels, { path: '/ru/', props });
const tiles = (root: Element) => [
  ...root.querySelectorAll<HTMLAnchorElement>('a[data-contact-channel]'),
];

describe('ContactChannels as quiet links', () => {
  it('lists the three messengers as underlined text, without a phone or an icon', async () => {
    const root = await channels({ look: 'links' });
    const links = tiles(root);

    expect(links.map((link) => link.dataset.contactChannel)).toEqual([
      'telegram',
      'whatsapp',
      'viber',
    ]);
    expect(links.map((link) => link.textContent?.trim())).toEqual([
      'Telegram',
      'WhatsApp',
      'Viber',
    ]);
    expect(
      links.every((link) => link.classList.contains('link-underlined')),
    ).toBe(true);
    expect(links.some((link) => link.classList.contains('border'))).toBe(false);
    expect(root.querySelector('svg')).toBeNull();
  });

  it('keeps tracking them as an in-flow contact region', async () => {
    const list = (await channels({ look: 'links' })).querySelector('ul')!;

    expect(list.getAttribute('data-contact-placement')).toBe('bar');
    expect(list.hasAttribute('data-contact-order')).toBe(true);
  });
});

describe('ContactChannels in the footer', () => {
  it('offers the three messengers as tiles that turn into plain links on a wide screen', async () => {
    const root = await channels({ placement: 'footer' });
    const list = root.querySelector('ul')!;

    expect(tiles(root).map((link) => link.dataset.contactChannel)).toEqual([
      'whatsapp',
      'viber',
      'telegram',
    ]);
    expect(list.getAttribute('data-contact-placement')).toBe('footer');
    expect(list.hasAttribute('data-contact-cta')).toBe(false);
    expect(list.classList.contains('grid-cols-3')).toBe(true);
    expect(tiles(root)[0].classList.contains('md:border-0')).toBe(true);
    expect(root.querySelectorAll('svg')).toHaveLength(3);
  });
});
