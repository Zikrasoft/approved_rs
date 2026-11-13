// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { defineCarFacts } from './carFacts';

const MY_GARAGE = 'my_garage_vin';
const GARAGE_CAR = 'my_garage_car';

function land(search: string, attributes = ''): void {
  history.replaceState(null, '', `/ru/parts/search/${search}`);
  document.body.innerHTML = `<car-facts ${attributes}></car-facts>`;
}

const garageCar = () => JSON.parse(localStorage.getItem(GARAGE_CAR) ?? 'null');

describe('car-facts and My garage', () => {
  beforeEach(() => {
    localStorage.clear();
    defineCarFacts();
  });

  it('is defined once however often it is asked', () => {
    expect(() => defineCarFacts()).not.toThrow();
  });

  it('remembers the VIN the search was opened with', () => {
    land('?make=bmw&model=e84-x1&vin=WBA3B1C50GL123456');
    expect(localStorage.getItem(MY_GARAGE)).toBe('WBA3B1C50GL123456');
  });

  it('remembers the make, series and model of the car the VIN resolved to', () => {
    land(
      '?vin=WBA3B1C50GL123456',
      'data-car="BMW X1 E84 sDrive18d" data-make="bmw" data-series="x1" data-model="e84-x1"',
    );

    expect(garageCar()).toEqual({
      vin: 'WBA3B1C50GL123456',
      car: 'BMW X1 E84 sDrive18d',
      make: 'bmw',
      series: 'x1',
      model: 'e84-x1',
    });
  });

  it('remembers no car without its name', () => {
    land('?vin=WBA3B1C50GL123456', 'data-make="bmw"');
    expect(garageCar()).toBeNull();
  });

  it('keeps the stored VIN when the page carries none', () => {
    localStorage.setItem(MY_GARAGE, 'WBA3B1C50GL123456');
    land('?make=bmw&model=e84-x1', 'data-car="BMW X1"');

    expect(localStorage.getItem(MY_GARAGE)).toBe('WBA3B1C50GL123456');
    expect(garageCar()).toBeNull();
  });
});
