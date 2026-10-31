// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { defineCarFacts } from './carFacts';

const MY_GARAGE = 'my_garage_vin';

function land(search: string): void {
  history.replaceState(null, '', `/ru/parts/bmw/x1/m/x1-sdrive18d/${search}`);
  document.body.innerHTML = '<car-facts></car-facts>';
}

describe('car-facts and My garage', () => {
  beforeEach(() => {
    localStorage.clear();
    defineCarFacts();
  });

  it('remembers the VIN the shop resolved to this Vehicle', () => {
    land('?vin=WBA3B1C50GL123456');
    expect(localStorage.getItem(MY_GARAGE)).toBe('WBA3B1C50GL123456');
  });

  it('keeps the stored VIN when the Vehicle page carries none', () => {
    localStorage.setItem(MY_GARAGE, 'WBA3B1C50GL123456');
    land('?steering=left');
    expect(localStorage.getItem(MY_GARAGE)).toBe('WBA3B1C50GL123456');
  });
});
