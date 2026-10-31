// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { wakeOnInteraction } from './wakeOnInteraction';

const mount = () => {
  document.body.innerHTML = `
    <catalogue-search><input /></catalogue-search>
    <catalogue-search><input /></catalogue-search>
    <p><input /></p>`;
  const load = vi.fn().mockResolvedValue(undefined);
  wakeOnInteraction('catalogue-search', load);
  return { load, inputs: [...document.querySelectorAll('input')] };
};

describe('wakeOnInteraction', () => {
  it('loads nothing until a box is focused or pressed', () => {
    const { load, inputs } = mount();
    expect(load).not.toHaveBeenCalled();
    inputs[2].dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(load).not.toHaveBeenCalled();
  });

  it('loads on the first focus or press of each box, once per kind', () => {
    const { load, inputs } = mount();
    inputs[0].dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    inputs[0].dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(load).toHaveBeenCalledTimes(1);
    inputs[1].dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(load).toHaveBeenCalledTimes(2);
  });
});
