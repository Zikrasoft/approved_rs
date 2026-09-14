// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import {
  defineModalDialog,
  MODAL_OPEN_EVENT,
  type ModalOpenDetail,
} from './modalDialog.ts';
import { lockScroll, unlockScroll } from './scrollLock.ts';

// TODO: drop once jsdom implements HTMLDialogElement.showModal/close — until
// then the top-layer transitions these tests drive are stood up by hand, with
// the spec's asynchronous toggle/close timing preserved.
beforeAll(() => {
  const proto = window.HTMLDialogElement.prototype;
  proto.showModal = function showModal(this: HTMLDialogElement) {
    if (this.open) return;
    this.open = true;
    queueMicrotask(() => this.dispatchEvent(new Event('toggle')));
  };
  proto.close = function close(this: HTMLDialogElement) {
    if (!this.open) return;
    this.open = false;
    queueMicrotask(() => {
      this.dispatchEvent(new Event('toggle'));
      this.dispatchEvent(new Event('close'));
    });
  };
});

const tick = () => Promise.resolve();
const overflow = () => document.documentElement.style.overflow;

let counter = 0;

function mount(html: string): {
  host: HTMLElement;
  dialog: HTMLDialogElement | null;
} {
  const tagName = `modal-dialog-${(counter += 1)}`;
  defineModalDialog(tagName);
  document.body.innerHTML = `
    <button data-open-lead><span>Book</span></button>
    <${tagName} trigger="[data-open-lead]">${html}</${tagName}>
  `;
  const host = document.body.querySelector<HTMLElement>(tagName)!;
  return { host, dialog: host.querySelector('dialog') };
}

const openIt = () =>
  document.querySelector<HTMLElement>('[data-open-lead]')!.click();

describe('defineModalDialog', () => {
  afterEach(async () => {
    document.querySelectorAll('dialog').forEach((dialog) => dialog.close());
    await tick();
    document.body.innerHTML = '';
    expect(overflow()).toBe('');
  });

  it('registers under a custom tag name and is idempotent', () => {
    defineModalDialog('brand-modal');
    const first = customElements.get('brand-modal');
    defineModalDialog('brand-modal');
    expect(customElements.get('brand-modal')).toBe(first);
  });

  it('opens the dialog from a trigger anywhere on the page and freezes the scroll', () => {
    const { dialog } = mount('<dialog><p>Form</p></dialog>');
    expect(dialog!.open).toBe(false);

    document.querySelector<HTMLElement>('[data-open-lead] span')!.click();

    expect(dialog!.open).toBe(true);
    expect(overflow()).toBe('hidden');
  });

  it('announces which trigger opened it', () => {
    const { host } = mount('<dialog><p>Form</p></dialog>');
    let seen: HTMLElement | undefined;
    host.addEventListener(MODAL_OPEN_EVENT, (event) => {
      seen = (event as CustomEvent<ModalOpenDetail>).detail.trigger;
    });

    openIt();

    expect(seen).toBe(document.querySelector('[data-open-lead]'));
  });

  it('closes on the close control and thaws the scroll', async () => {
    const { dialog } = mount(
      '<dialog><button data-modal-close><span>x</span></button></dialog>',
    );
    openIt();

    dialog!.querySelector<HTMLElement>('[data-modal-close] span')!.click();
    expect(dialog!.open).toBe(false);

    await tick();
    expect(overflow()).toBe('');
  });

  it('closes when the backdrop itself is clicked', () => {
    const { dialog } = mount('<dialog><p>Form</p></dialog>');
    openIt();

    dialog!.click();

    expect(dialog!.open).toBe(false);
  });

  it('stays open when a click lands inside the dialog body', () => {
    const { dialog } = mount('<dialog><p>Form</p></dialog>');
    openIt();

    dialog!.querySelector('p')!.click();

    expect(dialog!.open).toBe(true);
    expect(overflow()).toBe('hidden');
  });

  it('thaws the scroll however the dialog was dismissed, including Escape', async () => {
    const { dialog } = mount('<dialog><p>Form</p></dialog>');
    openIt();

    dialog!.close();
    await tick();

    expect(overflow()).toBe('');
  });

  it('holds the lock exactly once, so closing cannot thaw someone else’s', async () => {
    lockScroll();
    const { dialog } = mount('<dialog><p>Form</p></dialog>');
    openIt();

    dialog!.close();
    await tick();
    dialog!.dispatchEvent(new Event('close'));
    dialog!.dispatchEvent(new Event('toggle'));

    expect(overflow()).toBe('hidden');
    unlockScroll();
    expect(overflow()).toBe('');
  });

  it('unlocks from the close event alone, for browsers that never fire toggle', () => {
    const { dialog } = mount('<dialog><p>Form</p></dialog>');
    openIt();
    expect(overflow()).toBe('hidden');

    dialog!.open = false;
    dialog!.dispatchEvent(new Event('close'));

    expect(overflow()).toBe('');
  });

  it('ignores a trigger click while the dialog is already open', async () => {
    const { dialog } = mount('<dialog><p>Form</p></dialog>');
    openIt();
    openIt();

    expect(overflow()).toBe('hidden');

    dialog!.close();
    await tick();
    expect(overflow()).toBe('');
  });

  it('survives a click whose target is not an element', () => {
    mount('<dialog><p>Form</p></dialog>');

    expect(() =>
      document.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    ).not.toThrow();
  });

  it('locks even when the dialog is opened by something other than the trigger', async () => {
    const { dialog } = mount('<dialog><p>Form</p></dialog>');

    dialog!.showModal();
    await tick();

    expect(overflow()).toBe('hidden');
  });

  it('thaws the scroll when an open dialog is torn out of the page', () => {
    mount('<dialog><p>Form</p></dialog>');
    openIt();
    expect(overflow()).toBe('hidden');

    document.body.innerHTML = '';

    expect(overflow()).toBe('');
  });

  it('wires itself once per connection, so a re-inserted host does not double-lock', async () => {
    const { host, dialog } = mount('<dialog><p>Form</p></dialog>');
    const parent = host.parentNode!;
    parent.removeChild(host);
    parent.appendChild(host);

    openIt();
    expect(overflow()).toBe('hidden');

    dialog!.close();
    await tick();
    expect(overflow()).toBe('');
  });

  it('leaves the dialog trigger-less when no selector is given', () => {
    defineModalDialog('silent-modal');
    document.body.innerHTML = `
      <button data-open-lead>Book</button>
      <silent-modal><dialog><p>Form</p></dialog></silent-modal>
    `;
    const dialog = document.querySelector('dialog')!;

    openIt();

    expect(dialog.open).toBe(false);
  });

  it('does nothing at all when the host holds no dialog', () => {
    const { host } = mount('<p>nothing here</p>');

    expect(() => openIt()).not.toThrow();
    expect(host.querySelector('dialog')).toBeNull();
    expect(overflow()).toBe('');
  });
});
