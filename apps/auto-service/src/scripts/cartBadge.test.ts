// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PREVIEW_FLAG_COOKIE } from '@/utils/shopPreview';
import {
  CART_CHANGED_EVENT,
  CART_STORAGE_KEY,
  PARTS_LIST_CHANGED_EVENT,
  PARTS_LIST_STORAGE_KEY,
  defineCartBadge,
} from './cartBadge';

const mount = (attributes = '') => {
  document.body.innerHTML = `<cart-badge ${attributes}><a><span data-count hidden></span></a></cart-badge>`;
  return {
    badge: document.querySelector<HTMLElement>('cart-badge')!,
    count: document.querySelector<HTMLElement>('[data-count]')!,
  };
};

const listParts = (count: number) =>
  localStorage.setItem(
    PARTS_LIST_STORAGE_KEY,
    JSON.stringify(Array.from({ length: count }, (_, index) => ({ index }))),
  );

beforeEach(() => {
  defineCartBadge();
});

afterEach(() => {
  localStorage.clear();
  document.cookie = `${PREVIEW_FLAG_COOKIE}=; max-age=0`;
  document.body.replaceChildren();
});

describe('the header badge', () => {
  it('counts the parts in the inquiry while the shop is closed', () => {
    listParts(2);
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ count: 5 }));
    const { count } = mount('data-parts-list');

    expect(count.textContent).toBe('2');
    expect(count.hidden).toBe(false);
  });

  it('counts the cart lines once the shop is open', () => {
    listParts(2);
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ count: 5 }));
    const { count } = mount();

    expect(count.textContent).toBe('5');
  });

  it('hides an empty count, and a badge that only shows when filled', () => {
    const { badge, count } = mount('data-parts-list data-reveal-when-filled');

    expect(count.hidden).toBe(true);
    expect(badge.hidden).toBe(true);
  });

  it('follows the inquiry as parts are added', () => {
    const { badge, count } = mount('data-parts-list data-reveal-when-filled');

    listParts(1);
    window.dispatchEvent(new Event(PARTS_LIST_CHANGED_EVENT));

    expect(count.textContent).toBe('1');
    expect(badge.hidden).toBe(false);
  });

  it('follows the cart as it changes, even in another tab', () => {
    const { count } = mount();

    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ count: 3 }));
    window.dispatchEvent(new Event(CART_CHANGED_EVENT));
    expect(count.textContent).toBe('3');

    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ count: 4 }));
    window.dispatchEvent(new Event('storage'));
    expect(count.textContent).toBe('4');
  });

  it('stays hidden for a preview-only link without the preview', () => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ count: 3 }));
    const badge = mount('hidden data-preview-only').badge;

    expect(badge.hidden).toBe(true);
    expect(badge.querySelector('[data-count]')!.textContent).toBe('');
  });

  it('shows a preview-only link in the shop preview', () => {
    document.cookie = `${PREVIEW_FLAG_COOKIE}=1`;
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ count: 3 }));
    const { badge, count } = mount('hidden data-preview-only');

    expect(badge.hidden).toBe(false);
    expect(count.textContent).toBe('3');
  });

  it('reads a broken stored cart as empty', () => {
    localStorage.setItem(CART_STORAGE_KEY, '{oops');
    const { count } = mount();

    expect(count.textContent).toBe('0');
  });
});
