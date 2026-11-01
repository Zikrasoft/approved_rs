import { splitDialCode } from './splitDialCode.ts';

export interface CountrySelectOption {
  iso: string;
  dial: string;
  primary: boolean;
  flag: string;
  name: string;
}

// TODO: DOM probe because a select with width:auto sizes to its widest
// option, not the picked one. Replace with `field-sizing: content` once
// Firefox ships it.
function textWidth(select: HTMLSelectElement, text: string): number {
  const probe = select.cloneNode(false) as HTMLSelectElement;
  const option = document.createElement('option');
  option.text = text;
  probe.append(option);
  probe.style.cssText =
    'position:absolute;visibility:hidden;pointer-events:none;width:auto;max-width:none;left:-9999px';
  document.body.append(probe);
  const { offsetWidth } = probe;
  probe.remove();
  return offsetWidth;
}

function fitToSelection(select: HTMLSelectElement): void {
  const picked = select.selectedOptions[0];
  if (!picked) return;

  const whole = textWidth(select, picked.text);
  if (whole === 0) return;
  select.style.width = `${whole}px`;
  if (select.offsetWidth >= whole) return;
  const flagAndCode = picked.text.split(' ', 2).join(' ');
  select.style.width = `${textWidth(select, flagAndCode)}px`;
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

export function selectCountry(
  select: HTMLSelectElement,
  iso: string | undefined,
): void {
  const wanted = iso?.toUpperCase();
  if (!wanted) return;
  if (!Array.from(select.options).some((option) => option.value === wanted))
    return;
  select.value = wanted;
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

  let chosenBeforePaste: string | null = null;
  const switchTo = (iso: string): void => {
    select.value = iso;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  };

  select.addEventListener('change', () => {
    chosenBeforePaste = null;
    fitToSelection(select);
  });
  input.addEventListener('input', () => {
    if (chosenBeforePaste && input.value.trim() === '') {
      switchTo(chosenBeforePaste);
      return;
    }
    const split = splitDialCode(input.value, countriesOf(select));
    if (!split) return;
    const chosen = chosenBeforePaste ?? select.value;
    input.value = split.rest;
    if (select.value === split.iso) {
      fitToSelection(select);
      return;
    }
    switchTo(split.iso);
    chosenBeforePaste = chosen;
  });

  fitWhenSettled();
}
