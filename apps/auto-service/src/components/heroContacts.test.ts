import { beforeAll, describe, expect, it } from 'vitest';
import HeroContacts from './HeroContacts.astro';
import { render } from './renderAstro';

type Pointer = 'fine' | 'coarse';

let hero: Element;

beforeAll(async () => {
  hero = await render(HeroContacts, { path: '/ru/' });
});

const classes = (element: Element | null) =>
  element ? element.className.split(/\s+/) : [];
const controls = () => [...hero.querySelectorAll<HTMLAnchorElement>('a')];
const shownOn = (pointer: Pointer) =>
  controls().filter(
    (control) =>
      ![...classes(control), ...classes(control.closest('li'))].includes(
        `pointer-${pointer}:hidden!`,
      ),
  );
const isOrange = (control: Element, pointer: Pointer) =>
  classes(control).includes('btn-primary') ||
  classes(control).includes(`pointer-${pointer}:bg-signal-ink`);
const label = (control: Element) => control.textContent?.trim();
const channels = (tiles: HTMLElement[]) =>
  tiles.map((tile) => tile.dataset.contactChannel);

describe('the home hero contact block on a touchscreen', () => {
  it('leads with a full-width tracked call labelled «Позвонить»', () => {
    const [call] = shownOn('coarse');
    expect(call.getAttribute('href')).toBe('tel:+381677210533');
    expect(call.dataset.contactChannel).toBe('phone');
    expect(
      call
        .closest('[data-contact-placement]')
        ?.getAttribute('data-contact-placement'),
    ).toBe('hero');
    expect(label(call)).toBe('Позвонить');
    expect(classes(call)).toContain('w-full');
  });

  it('offers the booking below the call, then the three messengers', () => {
    const [, booking, ...tiles] = shownOn('coarse');
    expect(label(booking)).toBe('Записаться на ремонт');
    expect(booking.getAttribute('data-open-lead-modal')).toBe('');
    expect(channels(tiles)).toEqual(['whatsapp', 'viber', 'telegram']);
  });

  it('paints only the call orange', () => {
    expect(
      channels(
        shownOn('coarse').filter((control) => isOrange(control, 'coarse')),
      ),
    ).toEqual(['phone']);
  });
});

describe('the home hero contact block on a mouse', () => {
  it('offers no dialer and no number', () => {
    const shown = shownOn('fine');
    expect(shown.filter((control) => control.href.startsWith('tel:'))).toEqual(
      [],
    );
    expect(shown.map((control) => control.textContent).join()).not.toContain(
      '+381',
    );
  });

  it('offers the booking, a callback on the phone tab, then the messengers', () => {
    const [booking, callback, ...tiles] = shownOn('fine');
    expect(label(booking)).toBe('Записаться на ремонт');
    expect(label(callback)).toBe('Перезвоните мне');
    expect(callback.getAttribute('data-open-lead-modal')).toBe('phone');
    expect(channels(tiles)).toEqual(['whatsapp', 'viber', 'telegram']);
  });

  it('paints only the booking orange', () => {
    expect(
      shownOn('fine')
        .filter((control) => isOrange(control, 'fine'))
        .map(label),
    ).toEqual(['Записаться на ремонт']);
  });
});

describe('the hero contact block on a service page', () => {
  const booking = (root: Element, text: string) =>
    [...root.querySelectorAll('a')].find((control) => label(control) === text);

  it('books the service under its own label and opens the bot for it', async () => {
    const root = await render(HeroContacts, {
      path: '/ru/services/servicing/',
      props: { service: 'servicing', bookLabel: 'Записаться на ТО' },
    });

    expect(
      booking(root, 'Записаться на ТО')?.getAttribute('data-open-lead-modal'),
    ).toBe('');
    expect(
      root
        .querySelector('[data-contact-channel="telegram"]')
        ?.getAttribute('href'),
    ).toContain('start=servicing_ru');
  });

  it('scrolls to the page form instead of opening the modal when told to', async () => {
    const root = await render(HeroContacts, {
      path: '/ru/services/vin-parts-inquiry/',
      props: { bookLabel: 'Отправить запрос', bookModal: false },
    });
    const send = booking(root, 'Отправить запрос');

    expect(send?.getAttribute('href')).toBe('#lead');
    expect(send?.hasAttribute('data-open-lead-modal')).toBe(false);
  });
});

describe('the home hero contact block', () => {
  it('keeps every control inside the in-flow contact region', () => {
    expect(
      controls().filter((control) => !control.closest('[data-contact-cta]')),
    ).toEqual([]);
  });
});
