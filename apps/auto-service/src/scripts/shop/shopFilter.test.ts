// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { writeCar } from './car';
import { defineShopFilter } from './shopFilter';

const FORMS = JSON.stringify({
  one: '{count} товар',
  few: '{count} товара',
  many: '{count} товаров',
  other: '{count} товара',
});

const item = (handle: string, spec: object, fitment: object[] = []) =>
  `<li data-product data-handle="${handle}" data-spec='${JSON.stringify(spec)}' data-fitment='${JSON.stringify(fitment)}'></li>`;

const COROLLA = {
  make: 'Toyota',
  model: 'Corolla',
  yearFrom: 2013,
  yearTo: 2019,
};

const mount = (search = '', type = 'batteries') => {
  history.replaceState(null, '', `/sr/shop/${type}/${search}`);
  document.body.innerHTML = `
    <shop-filter data-type="${type}" data-bcp47="ru-RS" data-count-forms='${FORMS}'>
      <form data-facets>
        <input type="checkbox" name="brand" value="Bosch">
        <input type="checkbox" name="brand" value="Varta">
        <input type="number" name="capacityAh.min">
        <input type="number" name="capacityAh.max">
      </form>
      <p data-filter-count></p>
      <button type="button" data-filter-reset></button>
      <ul>
        ${item('a', { brand: 'Bosch', capacityAh: 60 }, [COROLLA])}
        ${item('b', { brand: 'Varta', capacityAh: 74 }, [{ ...COROLLA, model: 'Auris' }])}
        ${item('c', { brand: 'Bosch', capacityAh: 95 })}
      </ul>
      <div data-filter-empty hidden></div>
    </shop-filter>`;
};

const shown = () =>
  [...document.querySelectorAll<HTMLElement>('[data-product]')]
    .filter((node) => !node.hidden)
    .map((node) => node.dataset.handle);

const control = (selector: string) =>
  document.querySelector<HTMLInputElement>(`[data-facets] ${selector}`)!;

const change = (input: HTMLInputElement) =>
  input.form!.dispatchEvent(new Event('change'));

beforeAll(() => defineShopFilter());

beforeEach(() => {
  localStorage.clear();
});

describe('<shop-filter>', () => {
  it('shows everything and counts it before anything is chosen', () => {
    mount();

    expect(shown()).toEqual(['a', 'b', 'c']);
    expect(document.querySelector('[data-filter-count]')!.textContent).toBe(
      '3 товара',
    );
  });

  it('filters by a brand and writes it into the address', () => {
    mount();
    const bosch = control('[value="Bosch"]');
    bosch.checked = true;
    change(bosch);

    expect(shown()).toEqual(['a', 'c']);
    expect(location.search).toBe('?brand=Bosch');
  });

  it('filters a number range', () => {
    mount();
    const min = control('[name="capacityAh.min"]');
    min.value = '70';
    control('[name="capacityAh.max"]').value = '80';
    change(min);

    expect(shown()).toEqual(['b']);
  });

  it('restores a shared filter link', () => {
    mount('?brand=Varta&capacityAh.min=70');

    expect(shown()).toEqual(['b']);
    expect(control('[value="Varta"]').checked).toBe(true);
    expect(control('[name="capacityAh.min"]').value).toBe('70');
  });

  it('keeps only what fits the saved car, and follows it when it changes', () => {
    writeCar({ make: 'Toyota', model: 'Corolla', year: 2015 });
    mount();
    expect(shown()).toEqual(['a']);

    writeCar(null);
    expect(shown()).toEqual(['a', 'b', 'c']);
  });

  it('ignores the car for a type sold without fitment', () => {
    writeCar({ make: 'Toyota', model: 'Corolla' });
    mount('', 'motor-oils');

    expect(shown()).toEqual(['a', 'b', 'c']);
  });

  it('says so when nothing is left, and resets', () => {
    mount('?capacityAh.min=500');
    expect(shown()).toEqual([]);
    expect(
      document.querySelector('[data-filter-empty]')!.hasAttribute('hidden'),
    ).toBe(false);

    document.querySelector<HTMLButtonElement>('[data-filter-reset]')!.click();

    expect(shown()).toEqual(['a', 'b', 'c']);
    expect(location.search).toBe('');
  });

  it('defines itself once', () => {
    expect(() => defineShopFilter()).not.toThrow();
  });
});
