// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { markFieldValidity } from './fieldValidity.ts';

let input: HTMLInputElement;

beforeEach(() => {
  document.body.innerHTML = '<input name="phone" />';
  input = document.querySelector('input')!;
});

describe('markFieldValidity', () => {
  it('marks a field the visitor has to fix', () => {
    markFieldValidity(input, false);
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('takes the mark off once the field is good again', () => {
    markFieldValidity(input, false);
    markFieldValidity(input, true);
    expect(input.hasAttribute('aria-invalid')).toBe(false);
  });

  it('leaves a field that was never marked alone', () => {
    markFieldValidity(input, true);
    expect(input.hasAttribute('aria-invalid')).toBe(false);
  });
});
