// @vitest-environment jsdom
// TODO: jsdom reports zero layout, so fitToSelection's measuring arm is
// unreachable here — the width it sets is only ever exercised in a browser.
import { describe, it, expect, beforeEach } from 'vitest';
import { bindPhoneCountry, fillCountrySelect } from './phoneInput.ts';

function mount(
  options = `
  <option value="RS" data-dial="381" data-dial-primary selected>RS +381</option>
  <option value="DE" data-dial="49" data-dial-primary>DE +49</option>
  <option value="KZ" data-dial="7">KZ +7</option>
  <option value="RU" data-dial="7" data-dial-primary>RU +7</option>
  <option value="KG" data-dial="996" data-dial-primary>KG +996</option>
`,
) {
  document.body.innerHTML = `
    <select data-country>${options}</select>
    <input data-phone />
  `;
  const select = document.querySelector<HTMLSelectElement>('[data-country]')!;
  const input = document.querySelector<HTMLInputElement>('[data-phone]')!;
  bindPhoneCountry(select, input);
  return { select, input };
}

function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('bindPhoneCountry', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('moves a typed dial code into the select and keeps the rest in the field', () => {
    const { select, input } = mount();

    type(input, '+996555123456');

    expect(select.value).toBe('KG');
    expect(input.value).toBe('555123456');
  });

  it('picks the country that owns a shared dial code', () => {
    const { select, input } = mount();

    type(input, '+79161234567');

    expect(select.value).toBe('RU');
  });

  it('leaves a national number untouched', () => {
    const { select, input } = mount();

    type(input, '0611234567');

    expect(select.value).toBe('RS');
    expect(input.value).toBe('0611234567');
  });

  it('leaves an unknown dial code in the field rather than guessing', () => {
    const { select, input } = mount();

    type(input, '+299551234');

    expect(select.value).toBe('RS');
    expect(input.value).toBe('+299551234');
  });

  it('announces the change so anything listening on the select reacts', () => {
    const { select, input } = mount();
    let changes = 0;
    select.addEventListener('change', () => (changes += 1));

    type(input, '+4917012345');

    expect(select.value).toBe('DE');
    expect(changes).toBe(1);
  });

  it('stays quiet when the split lands on the country already picked', () => {
    const { select, input } = mount();
    let changes = 0;
    select.addEventListener('change', () => (changes += 1));

    type(input, '+381111234');

    expect(select.value).toBe('RS');
    expect(input.value).toBe('111234');
    expect(changes).toBe(0);
  });

  it('never lets a placeholder option swallow an unknown code', () => {
    const { select, input } = mount(`
      <option value="" selected>—</option>
      <option value="DE" data-dial="49" data-dial-primary>DE +49</option>
    `);

    type(input, '+2995551234');

    expect(select.value).toBe('');
    expect(input.value).toBe('+2995551234');
  });

  it('keeps working as the visitor keeps typing after the split', () => {
    const { select, input } = mount();

    type(input, '+49');
    expect(select.value).toBe('DE');
    expect(input.value).toBe('');

    type(input, '17012345');
    expect(select.value).toBe('DE');
    expect(input.value).toBe('17012345');
  });

  it('does not size an empty select, and leaves no stray probe behind', () => {
    const { select } = mount('');

    expect(select.style.width).toBe('');
    expect(document.querySelectorAll('select')).toHaveLength(1);
  });

  it('re-measures once the webfonts have settled', async () => {
    let settled: (() => void) | undefined;
    Object.defineProperty(document, 'fonts', {
      value: { ready: new Promise<void>((resolve) => (settled = resolve)) },
      configurable: true,
    });
    const { select } = mount();
    select.selectedOptions[0].text = 'RS +381 a much longer label';

    settled!();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.querySelectorAll('select')).toHaveLength(1);
  });

  it('survives a browser that exposes no document.fonts at all', () => {
    Object.defineProperty(document, 'fonts', {
      value: undefined,
      configurable: true,
    });

    expect(() => mount()).not.toThrow();
  });

  it('cleans up the measuring probe it appends to the page', () => {
    const { select, input } = mount();
    type(input, '+49');

    expect(document.querySelectorAll('select')).toHaveLength(1);
    expect(select.isConnected).toBe(true);
  });
});

describe('fillCountrySelect', () => {
  const full = [
    { iso: 'DE', dial: '49', primary: true, flag: '🇩🇪', name: 'Nemačka' },
    { iso: 'RS', dial: '381', primary: true, flag: '🇷🇸', name: 'Srbija' },
    { iso: 'TH', dial: '66', primary: true, flag: '🇹🇭', name: 'Tajland' },
  ];

  it('replaces the shortlist with the full list', () => {
    const { select } = mount();
    fillCountrySelect(select, full);

    expect(Array.from(select.options, (o) => o.value)).toEqual([
      'DE',
      'RS',
      'TH',
    ]);
  });

  it('keeps the country the visitor already had selected', () => {
    const { select } = mount();
    select.value = 'DE';
    fillCountrySelect(select, full);

    expect(select.value).toBe('DE');
  });

  it('carries the dial code and primary flag onto each option', () => {
    const { select } = mount();
    fillCountrySelect(select, full);
    const rs = select.options[1]!;

    expect(rs.dataset.dial).toBe('381');
    expect('dialPrimary' in rs.dataset).toBe(true);
    expect(rs.text).toBe('🇷🇸 +381 Srbija');
  });

  it('marks only the countries that own their dial code', () => {
    const { select } = mount();
    fillCountrySelect(select, [{ ...full[0]!, primary: false }]);

    expect('dialPrimary' in select.options[0]!.dataset).toBe(false);
  });

  it('expands once, so a second call cannot undo a later choice', () => {
    const { select } = mount();
    fillCountrySelect(select, full);
    select.value = 'TH';
    fillCountrySelect(select, full);

    expect(select.value).toBe('TH');
    expect(select.options).toHaveLength(3);
  });

  it('still splits a typed dial code once the list has grown', () => {
    const { select, input } = mount('');
    fillCountrySelect(select, full);
    type(input, '+66123456');

    expect(select.value).toBe('TH');
    expect(input.value).toBe('123456');
  });
});
