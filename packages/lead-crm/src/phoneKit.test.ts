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

function fields(typed: string): [HTMLSelectElement, HTMLInputElement] {
  document.body.innerHTML = `
    <select data-country><option value="RS" data-dial="381" selected>RS</option></select>
    <input data-phone value="${typed}">`;
  return [
    document.querySelector<HTMLSelectElement>('[data-country]')!,
    document.querySelector<HTMLInputElement>('[data-phone]')!,
  ];
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

describe('phoneValue', () => {
  it('composes E.164 from the dial code before the kit loads', async () => {
    const { phoneValue } = await freshModule();
    expect(phoneValue(...fields('060 123 4567'))).toBe('+381601234567');
  });

  it('lets a typed foreign number win over the selected country once the kit loads', async () => {
    const { phoneValue, loadPhoneKit } = await freshModule();
    await loadPhoneKit();
    expect(phoneValue(...fields('+7 999 123-45-67'))).toBe('+79991234567');
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

  it('flags the held form so other scripts can tell a wait from a rejection', async () => {
    const { deferSubmitUntilKit, loadPhoneKit, AWAITING_KIT_ATTRIBUTE } =
      await freshModule();
    const element = form();

    deferSubmitUntilKit(element);
    expect(element.hasAttribute(AWAITING_KIT_ATTRIBUTE)).toBe(true);

    await loadPhoneKit();
    await vi.runAllTimersAsync();
    expect(element.hasAttribute(AWAITING_KIT_ATTRIBUTE)).toBe(false);
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

describe('contactValue', () => {
  function telegramField(typed: string): [HTMLSelectElement, HTMLInputElement] {
    const [country] = fields('');
    const input = document.createElement('input');
    input.value = typed;
    document.body.append(input);
    return [country, input];
  }

  it('turns a handle into @handle', async () => {
    const { contactValue } = await freshModule();
    expect(contactValue('telegram', ...telegramField('ivan'))).toBe('@ivan');
  });

  it('turns a number typed into the telegram field into E.164', async () => {
    const { contactValue, loadPhoneKit } = await freshModule();
    await loadPhoneKit();
    expect(contactValue('telegram', ...telegramField('064 123 4567'))).toBe(
      '+381641234567',
    );
  });

  it('reads the phone panel the same way whatever the channel', async () => {
    const { contactValue } = await freshModule();
    expect(contactValue('whatsapp', ...fields('060 123 4567'))).toBe(
      '+381601234567',
    );
  });
});

describe('showContactValue', () => {
  function telegramField(typed: string): [HTMLSelectElement, HTMLInputElement] {
    const [country] = fields('');
    const input = document.createElement('input');
    input.value = typed;
    document.body.append(input);
    return [country, input];
  }

  it('shows the country it guessed for a number it accepts', async () => {
    const { showContactValue, loadPhoneKit } = await freshModule();
    await loadPhoneKit();
    const field = telegramField('064 123 4567');
    expect(showContactValue('telegram', ...field)).toBe('+381641234567');
    expect(field[1].value).toBe('+381641234567');
  });

  it('leaves a half-typed number alone', async () => {
    const { showContactValue, loadPhoneKit } = await freshModule();
    await loadPhoneKit();
    const field = telegramField('064');
    expect(showContactValue('telegram', ...field)).toBe('+381064');
    expect(field[1].value).toBe('064');
  });

  it('leaves every number alone until the kit can judge it', async () => {
    const { showContactValue } = await freshModule();
    const field = telegramField('064 123 4567');
    expect(showContactValue('telegram', ...field)).toBe('+381641234567');
    expect(field[1].value).toBe('064 123 4567');
  });

  it('still fills in the @ a handle is missing', async () => {
    const { showContactValue, loadPhoneKit } = await freshModule();
    await loadPhoneKit();
    const field = telegramField('ivan');
    expect(showContactValue('telegram', ...field)).toBe('@ivan');
    expect(field[1].value).toBe('@ivan');
  });

  it('never posts a bare @ for an empty field', async () => {
    const { showContactValue } = await freshModule();
    const field = telegramField('   ');
    expect(showContactValue('telegram', ...field)).toBe('');
    expect(field[1].value).toBe('   ');
  });

  it('leaves the phone panel to format itself', async () => {
    const { showContactValue, loadPhoneKit } = await freshModule();
    await loadPhoneKit();
    const [country, input] = fields('060 123 4567');
    expect(showContactValue('whatsapp', country, input)).toBe('+381601234567');
    expect(input.value).toBe('060 123 4567');
  });
});
