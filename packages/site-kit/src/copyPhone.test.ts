// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COPY_PHONE_DIGITS_ATTRIBUTE,
  COPY_PHONE_NUMBER_ATTRIBUTE,
  COPY_PHONE_SHOWN_MS,
  COPY_PHONE_STATUS_ATTRIBUTE,
  defineCopyPhone,
} from './copyPhone.ts';

const NUMBER = '+381601234567';
const COPIED = 'Скопировано';

let counter = 0;

function mount(tagName = `copy-phone-${(counter += 1)}`) {
  defineCopyPhone(tagName);
  document.body.innerHTML = `
    <${tagName} ${COPY_PHONE_NUMBER_ATTRIBUTE}="${NUMBER}">
      <button type="button"><span ${COPY_PHONE_DIGITS_ATTRIBUTE}>+381 60 123 4567</span></button>
      <span aria-live="polite" ${COPY_PHONE_STATUS_ATTRIBUTE}="${COPIED}"></span>
    </${tagName}>
  `;
  const host = document.querySelector<HTMLElement>(tagName)!;
  return {
    host,
    button: host.querySelector('button')!,
    status: host.querySelector(`[${COPY_PHONE_STATUS_ATTRIBUTE}]`)!,
  };
}

const stubClipboard = (writeText: (text: string) => Promise<void>) =>
  vi.stubGlobal('navigator', { clipboard: { writeText } });

const copied = (host: HTMLElement) =>
  host.querySelector(`[${COPY_PHONE_STATUS_ATTRIBUTE}]`)!.textContent ===
  COPIED;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  document.body.innerHTML = '';
  getSelection()!.removeAllRanges();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('defineCopyPhone', () => {
  it('copies the canonical number and announces it until the sign hides', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);
    const { host, button, status } = mount();

    button.click();
    await vi.advanceTimersByTimeAsync(0);

    expect(writeText).toHaveBeenCalledWith(NUMBER);
    expect(copied(host)).toBe(true);
    expect(status.textContent).toBe(COPIED);

    await vi.advanceTimersByTimeAsync(COPY_PHONE_SHOWN_MS);

    expect(copied(host)).toBe(false);
    expect(status.textContent).toBe('');
  });

  it('restarts the timer on a repeated click', async () => {
    stubClipboard(() => Promise.resolve());
    const { host, button } = mount();

    button.click();
    await vi.advanceTimersByTimeAsync(COPY_PHONE_SHOWN_MS - 500);
    button.click();
    await vi.advanceTimersByTimeAsync(COPY_PHONE_SHOWN_MS - 500);

    expect(copied(host)).toBe(true);

    await vi.advanceTimersByTimeAsync(500);

    expect(copied(host)).toBe(false);
  });

  it('selects the digits and shows no sign when there is no clipboard', async () => {
    vi.stubGlobal('navigator', {});
    const { host, button } = mount();

    button.click();
    await vi.advanceTimersByTimeAsync(0);

    expect(getSelection()!.toString()).toBe('+381 60 123 4567');
    expect(copied(host)).toBe(false);
  });

  it('selects the digits and shows no sign when the clipboard refuses', async () => {
    stubClipboard(() => Promise.reject(new Error('denied')));
    const { host, button, status } = mount();

    button.click();
    await vi.advanceTimersByTimeAsync(0);

    expect(getSelection()!.toString()).toBe('+381 60 123 4567');
    expect(copied(host)).toBe(false);
    expect(status.textContent).toBe('');
  });

  it('copies once per click after being moved in the document', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);
    const { host, button } = mount();

    document.body.append(host);
    button.click();

    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it('defines a tag only once', () => {
    const define = vi.spyOn(customElements, 'define');

    defineCopyPhone('copy-phone-twice');
    defineCopyPhone('copy-phone-twice');

    expect(define).toHaveBeenCalledTimes(1);
    define.mockRestore();
  });
});
