// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { defineCarFacts } from './carFacts';

const MY_GARAGE = 'my_garage_vin';

function land(search: string): void {
  history.replaceState(null, '', `/ru/parts/bmw/x1/m/x1-sdrive18d/${search}`);
  document.body.innerHTML =
    '<car-facts><p data-vin-matched hidden><span data-template="Подобрали по VIN {vin}"></span></p><p data-not-your-car>Не ваш автомобиль?</p></car-facts>';
}

const matched = () =>
  document.querySelector<HTMLElement>('[data-vin-matched]')!;
const notYourCar = () =>
  document.querySelector<HTMLElement>('[data-not-your-car]')!;

describe('car-facts and My garage', () => {
  beforeEach(() => {
    localStorage.clear();
    defineCarFacts();
  });

  it('remembers the VIN the shop resolved to this Vehicle', () => {
    land('?vin=WBA3B1C50GL123456');
    expect(localStorage.getItem(MY_GARAGE)).toBe('WBA3B1C50GL123456');
  });

  it('remembers which car the VIN resolved to', () => {
    land('?vin=WBA3B1C50GL123456');
    document.body.innerHTML =
      '<car-facts data-car="BMW X1 E84, sDrive18d"></car-facts>';

    expect(JSON.parse(localStorage.getItem('my_garage_car') ?? 'null')).toEqual(
      {
        vin: 'WBA3B1C50GL123456',
        car: 'BMW X1 E84, sDrive18d',
      },
    );
  });

  it('confirms the VIN the page was matched by', () => {
    land('?vin=WBA3B1C50GL123456');
    expect(matched().hidden).toBe(false);
    expect(matched().textContent).toBe('Подобрали по VIN WBA3B1C50GL123456');
  });

  it('drops the closing «not your car» line once the VIN line offers it', () => {
    land('?vin=WBA3B1C50GL123456');
    expect(notYourCar().hidden).toBe(true);
  });

  it('keeps the VIN confirmation hidden without a VIN', () => {
    land('');
    expect(matched().hidden).toBe(true);
    expect(notYourCar().hidden).toBe(false);
  });

  it('forgets the VIN when the visitor says it is not their car', () => {
    history.replaceState(
      null,
      '',
      '/ru/parts/bmw/x1/m/x1-sdrive18d/?vin=WBA3B1C50GL123456',
    );
    document.body.innerHTML =
      '<a data-forget-vin href="#">Не ваш автомобиль?</a><input data-vin-input value="WBA3B1C50GL123456"><car-facts></car-facts>';

    document.querySelector<HTMLElement>('[data-forget-vin]')!.click();

    expect(localStorage.getItem(MY_GARAGE) ?? '').toBe('');
    expect(document.querySelector('input')!.value).toBe('');
  });

  it('keeps the stored VIN when the Vehicle page carries none', () => {
    localStorage.setItem(MY_GARAGE, 'WBA3B1C50GL123456');
    land('?steering=left');
    expect(localStorage.getItem(MY_GARAGE)).toBe('WBA3B1C50GL123456');
  });
});
