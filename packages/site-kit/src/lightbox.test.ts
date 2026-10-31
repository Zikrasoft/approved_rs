// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { defineLightbox } from './lightbox.ts';

beforeAll(() => {
  window.HTMLDialogElement.prototype.showModal = function showModal(
    this: HTMLDialogElement,
  ) {
    this.open = true;
  };
});

let counter = 0;

const ITEMS = `
  <button data-lightbox-item data-src="/a.jpg" data-alt="A"></button>
  <button data-lightbox-item data-src="/b.jpg" data-alt="B"></button>
  <button data-lightbox-item data-src="/c.jpg" data-alt="C"></button>
`;
const DIALOG = `
  <dialog>
    <button data-prev><span>prev</span></button>
    <img data-lightbox-image alt="" />
    <button data-next>next</button>
  </dialog>
`;

function mount(html = ITEMS + DIALOG) {
  const tagName = `gallery-lightbox-${(counter += 1)}`;
  defineLightbox(tagName);
  document.body.innerHTML = `<${tagName}>${html}</${tagName}>`;
  const host = document.body.firstElementChild as HTMLElement;
  const items = [
    ...host.querySelectorAll<HTMLButtonElement>('[data-lightbox-item]'),
  ];
  const dialog = host.querySelector('dialog');
  const view = host.querySelector<HTMLImageElement>('[data-lightbox-image]');
  return { host, items, dialog, view };
}

const key = (dialog: HTMLDialogElement, name: string) =>
  dialog.dispatchEvent(new KeyboardEvent('keydown', { key: name }));

describe('defineLightbox', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('opens the dialog on the tapped item', () => {
    const { items, dialog, view } = mount();
    items[1].click();
    expect(dialog!.open).toBe(true);
    expect(view!.getAttribute('src')).toBe('/b.jpg');
    expect(view!.alt).toBe('B');
  });

  it('steps with the prev and next buttons, wrapping round both ends', () => {
    const { items, dialog, view } = mount();
    items[0].click();
    dialog!.querySelector<HTMLElement>('[data-prev] span')!.click();
    expect(view!.getAttribute('src')).toBe('/c.jpg');
    dialog!.querySelector<HTMLElement>('[data-next]')!.click();
    expect(view!.getAttribute('src')).toBe('/a.jpg');
  });

  it('ignores a click elsewhere in the dialog', () => {
    const { items, dialog, view } = mount();
    items[2].click();
    view!.click();
    dialog!.click();
    expect(view!.getAttribute('src')).toBe('/c.jpg');
  });

  it('steps with the arrow keys and ignores other keys', () => {
    const { items, dialog, view } = mount();
    items[0].click();
    key(dialog!, 'ArrowRight');
    expect(view!.getAttribute('src')).toBe('/b.jpg');
    key(dialog!, 'ArrowLeft');
    key(dialog!, 'ArrowLeft');
    expect(view!.getAttribute('src')).toBe('/c.jpg');
    key(dialog!, 'Enter');
    expect(view!.getAttribute('src')).toBe('/c.jpg');
  });

  it('shows an empty image for an item missing its source', () => {
    const { items, view } = mount(
      `<button data-lightbox-item></button>${DIALOG}`,
    );
    items[0].click();
    expect(view!.getAttribute('src')).toBe('');
    expect(view!.alt).toBe('');
  });

  it.each([
    ['no dialog', ITEMS],
    ['no image', `${ITEMS}<dialog></dialog>`],
    ['no items', DIALOG],
  ])('stays inert with %s', (_, html) => {
    const { items, dialog } = mount(html);
    items[0]?.click();
    expect(dialog?.open ?? false).toBe(false);
  });

  it('wires once and lets go on disconnect', () => {
    const { host, items, dialog, view } = mount();
    (host as unknown as { connectedCallback(): void }).connectedCallback();
    items[0].click();
    key(dialog!, 'ArrowRight');
    expect(view!.getAttribute('src')).toBe('/b.jpg');
    host.remove();
    key(dialog!, 'ArrowRight');
    expect(view!.getAttribute('src')).toBe('/b.jpg');
  });

  it('defines the element only once per tag name', () => {
    defineLightbox('gallery-lightbox-shared');
    const first = customElements.get('gallery-lightbox-shared');
    defineLightbox('gallery-lightbox-shared');
    expect(customElements.get('gallery-lightbox-shared')).toBe(first);
  });
});
