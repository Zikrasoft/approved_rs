// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { rememberVin } from '@podbor/site-kit/browser';
import { rememberCar } from './garageCar';
import { defineCarPicker } from './carPicker';

const markup = `
  <car-picker data-href="/ru/parts/{make}/{model}/batteries/">
    <form method="GET" action="/ru/parts/search/">
      <input type="hidden" name="category" value="batteries" />
      <select name="make">
        <option value="">Марка</option>
        <option value="bmw">BMW</option>
        <option value="mercedes-benz">Mercedes-Benz</option>
      </select>
      <select name="model" required>
        <option value="">Модель</option>
        <optgroup label="BMW" data-make="bmw">
          <option value="f30-320d">3 серия F30 320d</option>
          <option value="f30-320i">3 серия F30 320i</option>
        </optgroup>
        <optgroup label="Mercedes-Benz" data-make="mercedes-benz">
          <option value="w213-e220d">E-Класс W213 E 220 d</option>
        </optgroup>
      </select>
      <button type="submit">Показать</button>
    </form>
  </car-picker>`;

const make = () => document.querySelector<HTMLSelectElement>('[name=make]')!;
const model = () => document.querySelector<HTMLSelectElement>('[name=model]')!;
const form = () => document.querySelector('form')!;
const models = () => [...model().options].map(({ value }) => value);
const choose = (select: HTMLSelectElement, value: string) => {
  select.value = value;
  select.dispatchEvent(new Event('change'));
};
const submit = () => {
  const event = new Event('submit', { cancelable: true });
  form().dispatchEvent(event);
  return event;
};

const assign = vi.fn();

beforeAll(() => {
  defineCarPicker();
  vi.stubGlobal('location', { ...window.location, assign });
});

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
  assign.mockReset();
});

describe('<car-picker>', () => {
  it('is defined once however often it is asked', () => {
    expect(() => defineCarPicker()).not.toThrow();
  });

  it('offers every model while no make is chosen', () => {
    document.body.innerHTML = markup;
    expect(models()).toEqual(['', 'f30-320d', 'f30-320i', 'w213-e220d']);
  });

  it('offers only the models of the chosen make', () => {
    document.body.innerHTML = markup;
    choose(make(), 'mercedes-benz');
    expect(models()).toEqual(['', 'w213-e220d']);
  });

  it('drops a model of another make when the make changes', () => {
    document.body.innerHTML = markup;
    choose(make(), 'bmw');
    choose(model(), 'f30-320i');
    choose(make(), 'mercedes-benz');
    expect(model().value).toBe('');
  });

  it('keeps the model when the make it belongs to is chosen again', () => {
    document.body.innerHTML = markup;
    choose(model(), 'f30-320i');
    choose(make(), 'bmw');
    expect(model().value).toBe('f30-320i');
  });

  it('picks the make of a model chosen from the full list', () => {
    document.body.innerHTML = markup;
    choose(model(), 'w213-e220d');
    expect(make().value).toBe('mercedes-benz');
    expect(models()).toEqual(['', 'w213-e220d']);
  });

  it('opens the model-category page of the chosen car', () => {
    document.body.innerHTML = markup;
    choose(make(), 'bmw');
    choose(model(), 'f30-320d');
    expect(submit().defaultPrevented).toBe(true);
    expect(assign).toHaveBeenCalledWith('/ru/parts/bmw/f30-320d/batteries/');
  });

  it('leaves a submit without a model to the form', () => {
    document.body.innerHTML = markup;
    expect(submit().defaultPrevented).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });

  it('starts from the car in My garage', () => {
    rememberVin('WBA8E9C50GK123456');
    rememberCar({
      vin: 'WBA8E9C50GK123456',
      car: 'BMW 3 серия F30 320i',
      make: 'bmw',
      model: 'f30-320i',
    });
    document.body.innerHTML = markup;
    expect([make().value, model().value]).toEqual(['bmw', 'f30-320i']);
    expect(models()).toEqual(['', 'f30-320d', 'f30-320i']);
  });

  it('ignores a garage car this category lists no page for', () => {
    rememberVin('WDD2130041A123456');
    rememberCar({
      vin: 'WDD2130041A123456',
      car: 'Mercedes-Benz C-Класс W205',
      make: 'mercedes-benz',
      model: 'w205-c200',
    });
    document.body.innerHTML = markup;
    expect([make().value, model().value]).toEqual(['', '']);
  });

  it('ignores a garage car remembered without its make and model', () => {
    rememberVin('WBA8E9C50GK123456');
    rememberCar({ vin: 'WBA8E9C50GK123456', car: 'BMW 3 серия F30 320i' });
    document.body.innerHTML = markup;
    expect([make().value, model().value]).toEqual(['', '']);
  });

  it('keeps the make when the visitor goes back to no model', () => {
    document.body.innerHTML = markup;
    choose(model(), 'f30-320d');
    choose(model(), '');
    expect(make().value).toBe('bmw');
  });

  it.each([
    [
      'its selects',
      '<car-picker data-href="/ru/parts/{make}/{model}/batteries/"><form></form></car-picker>',
    ],
    [
      'the page it opens',
      markup.replace(' data-href="/ru/parts/{make}/{model}/batteries/"', ''),
    ],
  ])('stays inert without %s', (_missing, html) => {
    document.body.innerHTML = html;
    const select = document.querySelector<HTMLSelectElement>('[name=model]');
    if (select) choose(select, 'f30-320d');
    expect(submit().defaultPrevented).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });
});
