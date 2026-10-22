// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { defineVinCheck } from './vinCheck';

const MESSAGE = 'VIN: 17 латинских букв и цифр';

const vinField = (value: string) => {
  defineVinCheck();
  const check = document.createElement('vin-check');
  check.dataset.message = MESSAGE;
  check.innerHTML =
    '<input name="vin" required pattern="[A-HJ-NPR-Za-hj-npr-z0-9]{17}" />';
  document.body.append(check);
  const input = check.querySelector('input')!;
  input.value = value;
  return input;
};

describe('the VIN field', () => {
  it('explains what a VIN looks like instead of the browser default', () => {
    const input = vinField('WBA35BG07');

    expect(input.checkValidity()).toBe(false);
    expect(input.validationMessage).toBe(MESSAGE);
  });

  it('accepts a corrected VIN once the visitor types again', () => {
    const input = vinField('WBA35BG07');
    input.checkValidity();

    input.value = 'WBA35BG070N074158';
    input.dispatchEvent(new Event('input'));

    expect(input.checkValidity()).toBe(true);
  });
});
