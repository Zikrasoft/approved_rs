// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

type Module = typeof import('./phoneKit.ts');

async function freshModule(): Promise<Module> {
  vi.resetModules();
  return import('./phoneKit.ts');
}

function form(): HTMLFormElement {
  const element = document.createElement('form');
  element.requestSubmit = vi.fn();
  document.body.append(element);
  return element;
}

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.useRealTimers();
  vi.doUnmock('libphonenumber-js/min');
});

describe('loadPhoneKit', () => {
  it('exposes nothing until it is asked to load', async () => {
    const { phoneKit } = await freshModule();
    expect(phoneKit()).toBeNull();
  });

  it('hands back the three things a lead form needs', async () => {
    const { loadPhoneKit, phoneKit } = await freshModule();
    await loadPhoneKit();
    const kit = phoneKit()!;
    expect(new kit.AsYouType('RS').input('601234567')).toBeTypeOf('string');
    expect(kit.parse('+381601234567')?.country).toBe('RS');
    expect(kit.isValidContact('+381601234567', 'phone')).toBe(true);
  });

  it('loads once however many callers ask', async () => {
    const { loadPhoneKit } = await freshModule();
    const [a, b] = [loadPhoneKit(), loadPhoneKit()];
    expect(a).toBe(b);
    await a;
  });

  it('gives up quietly when the module cannot be fetched', async () => {
    vi.doMock('libphonenumber-js/min', () => {
      throw new Error('offline');
    });
    const { loadPhoneKit, phoneKit, deferSubmitUntilKit } = await freshModule();
    await loadPhoneKit();
    expect(phoneKit()).toBeNull();
    expect(deferSubmitUntilKit(form())).toBe(false);
  });
});

describe('deferSubmitUntilKit', () => {
  it('holds the first submit and replays it once the kit lands', async () => {
    const { deferSubmitUntilKit, loadPhoneKit } = await freshModule();
    const element = form();

    expect(deferSubmitUntilKit(element)).toBe(true);
    await loadPhoneKit();
    await vi.runAllTimersAsync();

    expect(element.requestSubmit).toHaveBeenCalledTimes(1);
    expect(deferSubmitUntilKit(element)).toBe(false);
  });

  it('replays once when an impatient visitor taps send twice', async () => {
    const { deferSubmitUntilKit, loadPhoneKit } = await freshModule();
    const element = form();

    expect(deferSubmitUntilKit(element)).toBe(true);
    expect(deferSubmitUntilKit(element)).toBe(true);
    await loadPhoneKit();
    await vi.runAllTimersAsync();

    expect(element.requestSubmit).toHaveBeenCalledTimes(1);
  });

  it('stops waiting on a request that never settles and lets the submit through', async () => {
    vi.doMock('libphonenumber-js/min', () => new Promise(() => {}));
    const { deferSubmitUntilKit, phoneKit } = await freshModule();
    const element = form();

    expect(deferSubmitUntilKit(element)).toBe(true);
    expect(element.requestSubmit).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(4000);

    expect(element.requestSubmit).toHaveBeenCalledTimes(1);
    expect(phoneKit()).toBeNull();
    expect(deferSubmitUntilKit(element)).toBe(false);
  });
});
