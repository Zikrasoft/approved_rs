import { describe, expect, it } from 'vitest';
import PageHero from './PageHero.astro';
import { render } from './renderAstro';

type Pointer = 'fine' | 'coarse';

const hero = (props: Record<string, unknown> = {}) =>
  render(PageHero, {
    path: '/ru/works/',
    props: { eyebrow: 'Работы', heading: 'Наши работы', ...props },
  });

const classes = (element: Element | null) =>
  element ? element.className.split(/\s+/) : [];
const shownOn = (root: Element, pointer: Pointer) =>
  [...root.querySelectorAll<HTMLAnchorElement>('a[href]')].filter(
    (control) =>
      !control.closest('nav') &&
      ![...classes(control), ...classes(control.closest('li'))].includes(
        `pointer-${pointer}:hidden!`,
      ),
  );
const orangeOn = (root: Element, pointer: Pointer) =>
  shownOn(root, pointer)
    .filter(
      (control) =>
        classes(control).includes('btn-primary') ||
        classes(control).includes(`pointer-${pointer}:bg-signal-ink`),
    )
    .map((control) => control.textContent?.replace(/\s+/g, ' ').trim());

describe('PageHero actions', () => {
  it('leads with the orange call on a touchscreen', async () => {
    const root = await hero({ service: 'servicing' });

    expect(orangeOn(root, 'coarse')).toEqual(['Позвонить +381 67 7210533']);
    expect(
      root
        .querySelector('[data-contact-channel="telegram"]')
        ?.getAttribute('href'),
    ).toContain('start=servicing_ru');
  });

  it('paints the booking orange beside a callback on a mouse, with no dialer', async () => {
    const root = await hero();
    const shown = shownOn(root, 'fine');

    expect(orangeOn(root, 'fine')).toEqual(['Записаться на ремонт']);
    expect(
      shown.find((control) => control.dataset.openLeadModal === 'phone')
        ?.textContent,
    ).toContain('Перезвоните мне');
    expect(shown.some((control) => control.href.startsWith('tel:'))).toBe(
      false,
    );
  });

  it('sets the quiet buttons for the light card, not the dark panel', async () => {
    const root = await hero();

    expect(root.querySelector('.btn-on-panel')).toBeNull();
    expect(
      root.querySelector('[data-contact-placement="hero"]'),
    ).not.toBeNull();
  });

  it('renders no contact block when the page asks for none', async () => {
    const root = await hero({ actions: false });

    expect(root.querySelector('[data-contact-placement]')).toBeNull();
  });
});
