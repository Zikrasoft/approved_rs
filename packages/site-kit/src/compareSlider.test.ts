// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { defineCompareSlider } from './compareSlider.ts';

defineCompareSlider();

const mount = (
  inner = '<input type="range" min="0" max="100" value="30" />',
) => {
  document.body.innerHTML = `<compare-slider>${inner}</compare-slider>`;
  return document.querySelector<HTMLElement>('compare-slider')!;
};

const drag = (input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event('input'));
};

describe('<compare-slider>', () => {
  it('splits the images where the range starts and follows the drag', () => {
    const host = mount();
    expect(host.style.getPropertyValue('--split')).toBe('30%');
    drag(host.querySelector('input')!, '72');
    expect(host.style.getPropertyValue('--split')).toBe('72%');
  });

  it('binds the range once however often it is connected', () => {
    const host = mount();
    host.remove();
    document.body.append(host);
    const input = host.querySelector('input')!;
    let applied = 0;
    const setProperty = host.style.setProperty.bind(host.style);
    host.style.setProperty = (...args) => {
      applied += 1;
      setProperty(...args);
    };
    drag(input, '10');
    expect(applied).toBe(1);
  });

  it('leaves the markup alone without a range', () => {
    const host = mount('<span></span>');
    expect(host.getAttribute('style')).toBeNull();
  });

  it('defines its tag once', () => {
    expect(() => defineCompareSlider()).not.toThrow();
  });
});
