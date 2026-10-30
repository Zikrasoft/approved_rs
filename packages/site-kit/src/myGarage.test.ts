// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  MY_GARAGE_STORAGE_KEY,
  defineMyGarage,
  rememberVin,
  storedVin,
} from './myGarage.ts';

let tagSeq = 0;

function mount(inputValue = ''): {
  root: HTMLElement;
  input: HTMLInputElement;
} {
  const tagName = `my-garage-${(tagSeq += 1)}`;
  defineMyGarage(tagName);
  document.body.innerHTML = `
    <form>
      <${tagName}><input data-vin-input value="${inputValue}" /></${tagName}>
      <button type="submit">Go</button>
    </form>
  `;
  const root = document.body.querySelector(tagName) as HTMLElement;
  const input = root.querySelector('input') as HTMLInputElement;
  return { root, input };
}

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
  return { storage, data };
}

const blocked = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('SecurityError');
  },
};

describe('storedVin / rememberVin', () => {
  it('remembers a VIN and hands it back', () => {
    const { storage } = memoryStorage();
    rememberVin('WBA3B1C50GL123456', storage);
    expect(storedVin(storage)).toBe('WBA3B1C50GL123456');
  });

  it('returns empty when nothing is stored', () => {
    const { storage } = memoryStorage();
    expect(storedVin(storage)).toBe('');
  });

  it('survives blocked storage', () => {
    expect(() => rememberVin('x', blocked)).not.toThrow();
    expect(storedVin(blocked)).toBe('');
  });

  it('reads and writes localStorage by default', () => {
    localStorage.clear();
    rememberVin('WBA3B1C50GL123456');
    expect(storedVin()).toBe('WBA3B1C50GL123456');
  });
});

describe('defineMyGarage', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('registers under a custom tag name and is idempotent', () => {
    defineMyGarage('my-garage-once');
    const first = customElements.get('my-garage-once');
    defineMyGarage('my-garage-once');
    expect(customElements.get('my-garage-once')).toBe(first);
  });

  it('pre-fills an empty input from the last stored VIN', () => {
    localStorage.setItem(MY_GARAGE_STORAGE_KEY, 'WBA3B1C50GL123456');
    const { input } = mount();
    expect(input.value).toBe('WBA3B1C50GL123456');
  });

  it('leaves a server-filled input alone', () => {
    localStorage.setItem(MY_GARAGE_STORAGE_KEY, 'WBA3B1C50GL123456');
    const { input } = mount('WBA3B1C50GL654321');
    expect(input.value).toBe('WBA3B1C50GL654321');
  });

  it('does nothing without a stored VIN', () => {
    const { input } = mount();
    expect(input.value).toBe('');
  });

  it('leaves the stored VIN alone when a form submits one the shop never resolved', () => {
    localStorage.setItem(MY_GARAGE_STORAGE_KEY, 'WBA3B1C50GL123456');
    const { root, input } = mount();
    input.value = 'WBA3B1C50GL654321';
    root.closest('form')!.dispatchEvent(new Event('submit'));
    expect(storedVin()).toBe('WBA3B1C50GL123456');
  });

  it('drops the spaces, dots and dashes of a pasted VIN as it lands', () => {
    const { input } = mount();
    input.value = 'wba 35bg0-70n.074158';
    input.dispatchEvent(new Event('input'));
    expect(input.value).toBe('WBA35BG070N074158');
  });

  it('leaves a VIN being typed without separators untouched', () => {
    const { input } = mount();
    input.value = 'wba35';
    input.dispatchEvent(new Event('input'));
    expect(input.value).toBe('wba35');
  });

  it('does nothing when the markup carries no VIN input', () => {
    const tagName = `my-garage-${(tagSeq += 1)}`;
    defineMyGarage(tagName);
    document.body.innerHTML = `<${tagName}></${tagName}>`;
    expect(() =>
      document.body.querySelector(tagName)!.dispatchEvent(new Event('x')),
    ).not.toThrow();
  });
});
