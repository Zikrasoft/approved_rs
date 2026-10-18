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
  return { storage: () => storage, data };
}

const blocked = () => {
  throw new Error('SecurityError');
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

  it('remembers the typed VIN once the form submits', () => {
    const { root, input } = mount();
    input.value = ' wba3b1c50gl123456 ';
    root.closest('form')!.dispatchEvent(new Event('submit'));
    expect(storedVin()).toBe('WBA3B1C50GL123456');
  });

  it('does not remember an empty submission', () => {
    const { root } = mount();
    root.closest('form')!.dispatchEvent(new Event('submit'));
    expect(localStorage.getItem(MY_GARAGE_STORAGE_KEY)).toBeNull();
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
