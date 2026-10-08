// @vitest-environment jsdom
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import type { LeadFormDeps } from './leadForm.ts';

const { submitLeadForm } = vi.hoisted(() => ({
  submitLeadForm: vi.fn<(form: HTMLFormElement) => Promise<boolean>>(),
}));
vi.mock('./submitLeadForm.ts', () => ({ submitLeadForm }));

type Module = typeof import('./leadForm.ts');

let defineLeadForm: Module['defineLeadForm'];
let tags = 0;

const CHANNELS = ['whatsapp', 'viber', 'telegram', 'phone'] as const;

function markup(tag: string, selected = 'whatsapp'): string {
  const tabs = CHANNELS.map(
    (channel) =>
      `<button type="button" data-tab="${channel}" data-panel="${channel === 'telegram' ? 'telegram' : 'phone'}" aria-selected="${channel === selected}">${channel}</button>`,
  ).join('');
  return `
<${tag}>
  <form action="/api/leads" data-submitting-label="Sending">
    <input type="hidden" name="source_url" data-source-url>
    <input type="hidden" name="visitor_id" data-visitor-id>
    <input type="hidden" name="contact">
    <input type="hidden" name="contact_channel" value="${selected}">
    <div role="tablist">${tabs}</div>
    <div data-panel="telegram"><input data-telegram><p data-error-telegram hidden></p></div>
    <div data-panel="phone">
      <select data-country data-display-locale="en">
        <option value="RS" data-dial="381" selected>RS</option>
        <option value="DE" data-dial="49">DE</option>
      </select>
      <input data-phone><p data-error-phone hidden></p>
    </div>
    <input type="checkbox" data-consent><p data-error-consent hidden></p>
    <p data-error-submit hidden></p>
    <button type="submit"><span data-submit-label>Send</span></button>
  </form>
</${tag}>`;
}

function deps(overrides: Partial<LeadFormDeps> = {}): LeadFormDeps {
  return {
    visitorId: () => 'visitor-1',
    markFieldValidity: (control, valid) => {
      if (valid) control.removeAttribute('aria-invalid');
      else control.setAttribute('aria-invalid', 'true');
    },
    ...overrides,
  };
}

function mount(options: { deps?: LeadFormDeps; selected?: string } = {}) {
  const tag = `lead-form-${++tags}`;
  defineLeadForm(options.deps ?? deps(), tag);
  document.body.innerHTML = markup(tag, options.selected);
  const form = document.querySelector('form')!;
  const q = <T extends Element = HTMLElement>(selector: string) =>
    form.querySelector<T>(selector)!;
  return {
    tag,
    form,
    tab: (channel: string) => q(`[data-tab="${channel}"]`),
    panel: (name: string) => q(`[data-panel="${name}"]:not([data-tab])`),
    telegram: q<HTMLInputElement>('[data-telegram]'),
    phone: q<HTMLInputElement>('[data-phone]'),
    country: q<HTMLSelectElement>('[data-country]'),
    consent: q<HTMLInputElement>('[data-consent]'),
    contact: q<HTMLInputElement>('[name="contact"]'),
    channel: q<HTMLInputElement>('[name="contact_channel"]'),
    visitor: q<HTMLInputElement>('[data-visitor-id]'),
    source: q<HTMLInputElement>('[data-source-url]'),
    error: (field: string) => q(`[data-error-${field}]`),
    button: q<HTMLButtonElement>('button[type="submit"]'),
    label: q('[data-submit-label]'),
  };
}

const submit = (form: HTMLFormElement) =>
  form.dispatchEvent(new Event('submit', { cancelable: true }));

const type = (input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

beforeAll(async () => {
  ({ defineLeadForm } = await import('./leadForm.ts'));
  await (await import('./phoneKit.ts')).loadPhoneKit();
});

beforeEach(() => {
  submitLeadForm.mockReset();
  document.body.innerHTML = '';
});

describe('defineLeadForm', () => {
  it('registers nothing on import and defines once per tag', () => {
    expect(customElements.get('lead-form')).toBeUndefined();
    defineLeadForm(deps(), 'lead-form-once');
    expect(() => defineLeadForm(deps(), 'lead-form-once')).not.toThrow();
    expect(customElements.get('lead-form-once')).toBeDefined();
  });

  it('arms a form once even when its element is moved', () => {
    submitLeadForm.mockReturnValue(new Promise(() => {}));
    const f = mount();
    document.body.append(document.querySelector(f.tag)!);
    f.phone.value = '601234567';
    f.consent.checked = true;
    submit(f.form);
    expect(submitLeadForm).toHaveBeenCalledTimes(1);
  });

  it('leaves an element without a form alone', () => {
    defineLeadForm(deps(), 'lead-form-empty');
    document.body.innerHTML = '<lead-form-empty></lead-form-empty>';
    expect(document.querySelector('lead-form-empty')!.children).toHaveLength(0);
  });
});

describe('channel tabs', () => {
  it('starts on the rendered tab and shows its panel', () => {
    const f = mount();
    expect(f.channel.value).toBe('whatsapp');
    expect(f.panel('phone').hidden).toBe(false);
    expect(f.panel('telegram').hidden).toBe(true);
  });

  it('switches the channel, selection and panel on click', () => {
    const f = mount();
    f.tab('telegram').click();
    expect(f.channel.value).toBe('telegram');
    expect(f.tab('telegram').getAttribute('aria-selected')).toBe('true');
    expect(f.tab('whatsapp').getAttribute('aria-selected')).toBe('false');
    expect(f.panel('telegram').hidden).toBe(false);
    expect(f.panel('phone').hidden).toBe(true);
    expect(document.activeElement).not.toBe(f.telegram);
  });

  it('moves focus into the field on a trusted click', () => {
    const f = mount();
    const tab = f.tab('telegram');
    const activator = document.createElement('label');
    tab.before(activator);
    activator.append(tab);
    activator.click();
    expect(f.channel.value).toBe('telegram');
    expect(document.activeElement).toBe(f.telegram);
  });

  it('preselects the preferred channel', () => {
    const f = mount({ deps: deps({ preferredChannel: () => 'telegram' }) });
    expect(f.channel.value).toBe('telegram');
    expect(f.panel('telegram').hidden).toBe(false);
  });

  it('keeps the rendered tab when the preference has no tab', () => {
    const f = mount({ deps: deps({ preferredChannel: () => undefined }) });
    expect(f.channel.value).toBe('whatsapp');
  });

  it('clears contact errors when the channel changes', () => {
    const f = mount();
    submit(f.form);
    expect(f.error('phone').hidden).toBe(false);
    f.tab('telegram').click();
    expect(f.error('phone').hidden).toBe(true);
    expect(f.phone.hasAttribute('aria-invalid')).toBe(false);
  });
});

describe('fields', () => {
  it("preselects the visitor's country", () => {
    const f = mount({ deps: deps({ visitorCountry: () => 'de' }) });
    expect(f.country.value).toBe('DE');
  });

  it('masks the phone as it is typed', () => {
    const f = mount();
    type(f.phone, '0601234567');
    expect(f.phone.value).toBe('060 1234567');
  });

  it('masks an international number on its own country', () => {
    const f = mount();
    type(f.phone, '+4915112345678');
    expect(f.country.value).toBe('DE');
    expect(f.phone.value).toMatch(/^151/);
  });

  it('keeps a typed plus sign under the international mask', () => {
    const f = mount();
    f.country.innerHTML = '<option value="RS" selected>RS</option>';
    type(f.phone, '+381601234567');
    expect(f.phone.value).toBe('+381 60 1234567');
  });

  it('re-masks when the country changes', () => {
    const f = mount();
    f.phone.value = '015112345678';
    f.country.value = 'DE';
    f.country.dispatchEvent(new Event('change'));
    expect(f.phone.value).toBe('01511 2345678');
  });

  it('clears an international number and focuses the phone when the country changes', () => {
    const f = mount();
    f.phone.value = '+381601234567';
    f.country.value = 'DE';
    f.country.dispatchEvent(new Event('change'));
    expect(f.phone.value).toBe('');
    expect(document.activeElement).toBe(f.phone);
  });

  it('normalises a Telegram handle on blur', () => {
    const f = mount({ selected: 'telegram' });
    f.telegram.value = 'driver_ok';
    f.telegram.dispatchEvent(new Event('blur'));
    expect(f.telegram.value).toBe('@driver_ok');
  });

  it('expands the country list on first interaction', async () => {
    const f = mount();
    f.form.dispatchEvent(new Event('pointerenter'));
    f.form.dispatchEvent(new FocusEvent('focusin'));
    await vi.waitFor(() => expect(f.country.options.length).toBeGreaterThan(2));
    expect(f.country.value).toBe('RS');
  });
});

describe('submit', () => {
  it('flags an empty contact before consent and focuses it', () => {
    const f = mount();
    submit(f.form);
    expect(f.error('phone').hidden).toBe(false);
    expect(f.error('consent').hidden).toBe(false);
    expect(f.phone.getAttribute('aria-invalid')).toBe('true');
    expect(f.consent.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(f.phone);
    expect(submitLeadForm).not.toHaveBeenCalled();
  });

  it('focuses consent when only consent is missing', () => {
    const f = mount();
    f.phone.value = '601234567';
    submit(f.form);
    expect(f.error('phone').hidden).toBe(true);
    expect(document.activeElement).toBe(f.consent);
  });

  it('rejects a number the kit cannot validate', () => {
    const f = mount();
    f.phone.value = '12';
    f.consent.checked = true;
    submit(f.form);
    expect(f.error('phone').hidden).toBe(false);
  });

  it("clears only the typed field's error", () => {
    const f = mount();
    submit(f.form);
    type(f.phone, '6');
    expect(f.error('phone').hidden).toBe(true);
    expect(f.phone.hasAttribute('aria-invalid')).toBe(false);
    expect(f.error('consent').hidden).toBe(false);
    expect(f.consent.getAttribute('aria-invalid')).toBe('true');
  });

  it('hides the submit error on any input', async () => {
    submitLeadForm.mockResolvedValue(false);
    const f = mount();
    f.phone.value = '601234567';
    f.consent.checked = true;
    submit(f.form);
    await vi.waitFor(() => expect(f.error('submit').hidden).toBe(false));
    f.form.dispatchEvent(new Event('input'));
    expect(f.error('submit').hidden).toBe(true);
  });

  it('ignores a second submit while sending', () => {
    submitLeadForm.mockReturnValue(new Promise(() => {}));
    const f = mount();
    f.phone.value = '601234567';
    f.consent.checked = true;
    submit(f.form);
    f.phone.value = '';
    submit(f.form);
    expect(submitLeadForm).toHaveBeenCalledTimes(1);
    expect(f.error('phone').hidden).toBe(true);
  });

  it.each([
    ['whatsapp', '601234567', '+381601234567'],
    ['viber', '601234567', '+381601234567'],
    ['phone', '601234567', '+381601234567'],
    ['telegram', 'driver_ok', '@driver_ok'],
    ['telegram', '+381601234567', '+381601234567'],
  ])('posts %s as contact %s → %s', async (channel, typed, contact) => {
    submitLeadForm.mockResolvedValue(true);
    const f = mount({ selected: channel });
    (channel === 'telegram' ? f.telegram : f.phone).value = typed;
    f.consent.checked = true;
    submit(f.form);
    expect(f.contact.value).toBe(contact);
    expect(f.channel.value).toBe(channel);
    expect(f.visitor.value).toBe('visitor-1');
    expect(f.source.value).toBe(location.href);
    expect(submitLeadForm).toHaveBeenCalledWith(f.form);
    await Promise.resolve();
    expect(f.button.disabled).toBe(true);
    expect(f.button.getAttribute('aria-busy')).toBe('true');
    expect(f.label.textContent).toBe('Sending');
  });

  it('flags a Telegram handle that is not one', () => {
    const f = mount({ selected: 'telegram' });
    f.telegram.value = 'x';
    f.consent.checked = true;
    submit(f.form);
    expect(f.error('telegram').hidden).toBe(false);
    expect(document.activeElement).toBe(f.telegram);
  });

  it('restores the button and shows the submit error when sending fails', async () => {
    let settle!: (sent: boolean) => void;
    submitLeadForm.mockReturnValue(new Promise((r) => (settle = r)));
    const f = mount();
    f.phone.value = '601234567';
    f.consent.checked = true;
    submit(f.form);
    expect(f.label.textContent).toBe('Sending');
    settle(false);
    await vi.waitFor(() => expect(f.error('submit').hidden).toBe(false));
    expect(f.button.disabled).toBe(false);
    expect(f.button.hasAttribute('aria-busy')).toBe(false);
    expect(f.label.textContent).toBe('Send');

    submitLeadForm.mockResolvedValue(true);
    submit(f.form);
    expect(f.error('submit').hidden).toBe(true);
    expect(submitLeadForm).toHaveBeenCalledTimes(2);
  });

  it('keeps the label when no submitting label is given', () => {
    submitLeadForm.mockReturnValue(new Promise(() => {}));
    const f = mount();
    delete f.form.dataset.submittingLabel;
    f.phone.value = '601234567';
    f.consent.checked = true;
    submit(f.form);
    expect(f.button.disabled).toBe(true);
    expect(f.label.textContent).toBe('Send');
  });
});

describe('before the phone kit loads', () => {
  it('defers the submit, then validates once the kit arrives', async () => {
    vi.resetModules();
    const fresh = await import('./leadForm.ts');
    const tag = 'lead-form-cold';
    fresh.defineLeadForm(deps(), tag);
    document.body.innerHTML = markup(tag);
    const form = document.querySelector('form')!;
    form.requestSubmit = vi.fn(() => submit(form));
    form.querySelector<HTMLInputElement>('[data-phone]')!.value = '60';
    form.querySelector<HTMLInputElement>('[data-consent]')!.checked = true;
    submit(form);
    expect(form.hasAttribute('data-awaiting-kit')).toBe(true);
    expect(form.querySelector<HTMLElement>('[data-error-phone]')!.hidden).toBe(
      true,
    );
    await vi.waitFor(() => expect(form.requestSubmit).toHaveBeenCalled());
    expect(form.querySelector<HTMLElement>('[data-error-phone]')!.hidden).toBe(
      false,
    );
  });

  it('leaves the phone unmasked and the countries short until then', async () => {
    vi.resetModules();
    vi.doMock('libphonenumber-js/min', () => {
      throw new Error('offline');
    });
    const fresh = await import('./leadForm.ts');
    const kit = await import('./phoneKit.ts');
    const tag = 'lead-form-offline';
    fresh.defineLeadForm(deps(), tag);
    document.body.innerHTML = markup(tag);
    const form = document.querySelector('form')!;
    const phone = form.querySelector<HTMLInputElement>('[data-phone]')!;
    type(phone, '601234567');
    expect(phone.value).toBe('601234567');
    form.dispatchEvent(new FocusEvent('focusin'));
    await kit.loadPhoneKit();
    expect(form.querySelector('select')!.options).toHaveLength(2);
    vi.doUnmock('libphonenumber-js/min');
  });
});
