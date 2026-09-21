import { splitDialCode } from './splitDialCode.ts';

export interface CountrySelectOption {
  iso: string;
  dial: string;
  primary: boolean;
  flag: string;
  name: string;
}

// ponytail: DOM probe because a select with width:auto sizes to its widest
// option, not the picked one. Replace with `field-sizing: content` once
// Firefox ships it.
function fitToSelection(select: HTMLSelectElement): void {
  const picked = select.selectedOptions[0];
  if (!picked) return;

  const probe = select.cloneNode(false) as HTMLSelectElement;
  const option = document.createElement('option');
  option.text = picked.text;
  probe.append(option);
  probe.style.cssText =
    'position:absolute;visibility:hidden;pointer-events:none;width:auto;max-width:none;left:-9999px';
  document.body.append(probe);
  const { offsetWidth } = probe;
  probe.remove();

  if (offsetWidth > 0) select.style.width = `${offsetWidth}px`;
}

function countriesOf(select: HTMLSelectElement) {
  return Array.from(select.options).map((option) => ({
    iso: option.value,
    dial: option.dataset.dial ?? '',
    primary: 'dialPrimary' in option.dataset,
  }));
}

export function fillCountrySelect(
  select: HTMLSelectElement,
  options: readonly CountrySelectOption[],
): void {
  if (select.dataset.countriesExpanded) return;
  select.dataset.countriesExpanded = '1';
  const picked = select.value;
  select.replaceChildren(
    ...options.map((country) => {
      const option = document.createElement('option');
      option.value = country.iso;
      option.dataset.dial = country.dial;
      if (country.primary) option.dataset.dialPrimary = '';
      option.text = `${country.flag} +${country.dial} ${country.name}`;
      return option;
    }),
  );
  select.value = picked;
  fitToSelection(select);
}

export function bindPhoneCountry(
  select: HTMLSelectElement,
  input: HTMLInputElement,
): void {
  const fitWhenSettled = (): void => {
    const fonts = document.fonts?.ready;
    if (fonts) void fonts.then(() => fitToSelection(select));
    else requestAnimationFrame(() => fitToSelection(select));
  };

  select.addEventListener('change', () => fitToSelection(select));
  input.addEventListener('input', () => {
    const split = splitDialCode(input.value, countriesOf(select));
    if (!split) return;
    const picked = select.value !== split.iso;
    select.value = split.iso;
    input.value = split.rest;
    if (picked) select.dispatchEvent(new Event('change', { bubbles: true }));
    else fitToSelection(select);
  });

  fitWhenSettled();
}
