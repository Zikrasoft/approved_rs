import { describe, expect, it } from 'vitest';
import CallAction from './CallAction.astro';
import { render } from './renderAstro';

const callAction = (props: Record<string, unknown>, slots = {}) =>
  render(CallAction, { path: '/ru/', props, slots });

const links = (root: Element) => [...root.querySelectorAll('a')];

describe('CallAction', () => {
  it('dials the formatted number on a touchscreen and offers a callback on a mouse', async () => {
    const [call, callback] = links(await callAction({ class: 'btn' }));

    expect(call.getAttribute('href')).toBe('tel:+381677210533');
    expect(call.dataset.contactChannel).toBe('phone');
    expect(call.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Позвонить +381 67 7210533',
    );
    expect(call.classList.contains('pointer-fine:hidden!')).toBe(true);
    expect(callback.getAttribute('data-open-lead-modal')).toBe('phone');
    expect(callback.textContent?.trim()).toBe('Перезвоните мне');
    expect(callback.classList.contains('pointer-coarse:hidden!')).toBe(true);
  });

  it('drops the number where the cell is too tight for it', async () => {
    const [call] = links(await callAction({ class: 'btn', number: false }));

    expect(call.textContent?.trim()).toBe('Позвонить');
  });

  it('styles both sides alike unless the callback asks for its own look', async () => {
    const [call, callback] = links(
      await callAction({ class: 'btn-primary', callbackClass: 'btn-on-panel' }),
    );
    const [plainCall, plainCallback] = links(
      await callAction({ class: 'btn-secondary' }),
    );

    expect(call.classList.contains('btn-primary')).toBe(true);
    expect(callback.classList.contains('btn-on-panel')).toBe(true);
    expect(callback.classList.contains('btn-primary')).toBe(false);
    expect(plainCall.classList.contains('btn-secondary')).toBe(true);
    expect(plainCallback.classList.contains('btn-secondary')).toBe(true);
  });

  it('places its slot between the call and the callback', async () => {
    const root = await callAction(
      { class: 'btn' },
      { default: '<a href="#lead" id="book">Записаться</a>' },
    );

    expect(
      links(root).map(
        (link) => link.id || (link.dataset.openLeadModal ?? 'call'),
      ),
    ).toEqual(['call', 'book', 'phone']);
  });
});
