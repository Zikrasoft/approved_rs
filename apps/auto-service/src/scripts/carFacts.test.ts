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

  it('leaves a confirmation line with no template hidden', () => {
    history.replaceState(null, '', '/ru/parts/bmw/x1/?vin=WBA3B1C50GL123456');
    document.body.innerHTML =
      '<p data-vin-matched hidden></p><car-facts></car-facts>';

    expect(localStorage.getItem(MY_GARAGE)).toBe('WBA3B1C50GL123456');
    expect(matched().hidden).toBe(true);
  });

  it('remembers a matched VIN on a page with no confirmation line at all', () => {
    history.replaceState(null, '', '/ru/parts/bmw/x1/?vin=WBA3B1C50GL123456');
    document.body.innerHTML = '<car-facts></car-facts>';

    expect(localStorage.getItem(MY_GARAGE)).toBe('WBA3B1C50GL123456');
  });

  it('keeps the stored VIN when the Vehicle page carries none', () => {
    localStorage.setItem(MY_GARAGE, 'WBA3B1C50GL123456');
    land('?steering=left');
    expect(localStorage.getItem(MY_GARAGE)).toBe('WBA3B1C50GL123456');
  });
});

describe('car-facts and the steering side', () => {
  const visit = (search: string) => {
    history.replaceState(null, '', `/ru/parts/bmw/x1/m/x1-sdrive18d/${search}`);
    document.body.innerHTML = `
      <car-facts>
        <div data-position-group id="both">
          <p data-fitment id="left" data-part-id="p_left" data-steering="left"></p>
          <p data-fitment id="right" data-part-id="p_right" data-steering="right"></p>
        </div>
        <div data-position-group id="right-only">
          <p data-fitment data-part-id="p_right_only" data-steering="right"></p>
        </div>
        <div data-position-group id="noted">
          <p data-fitment data-part-id="p_a" data-note="с датчиком"></p>
        </div>
        <ul>
          <li data-kit-part="p_right_only" id="kit-right"></li>
          <li data-kit-part="p_left" id="kit-left"></li>
          <li data-kit-part="p_unlisted" id="kit-unlisted"></li>
        </ul>
        <p data-vin-steering hidden data-template="Руль: {side}" data-left="слева" data-right="справа"></p>
      </car-facts>`;
  };
  const hidden = (id: string) => document.getElementById(id)!.hidden;
  const note = () =>
    document.querySelector<HTMLElement>('[data-vin-steering]')!;

  beforeEach(() => {
    defineCarFacts();
  });

  it('keeps only the fitments, groups and kit parts for the steering side the VIN told', () => {
    visit('?steering=left');

    expect(hidden('left')).toBe(false);
    expect(hidden('right')).toBe(true);
    expect(hidden('both')).toBe(false);
    expect(hidden('right-only')).toBe(true);
    expect(hidden('kit-right')).toBe(true);
    expect(hidden('kit-left')).toBe(false);
    expect(hidden('kit-unlisted')).toBe(false);
  });

  it('marks a group still ambiguous when a fitment carries a note', () => {
    visit('?steering=left');

    expect(
      document.getElementById('noted')!.hasAttribute('data-ambiguous'),
    ).toBe(true);
    expect(
      document.getElementById('both')!.hasAttribute('data-ambiguous'),
    ).toBe(false);
  });

  it('names the steering side it filtered by', () => {
    visit('?steering=right');

    expect(note().hidden).toBe(false);
    expect(note().textContent).toBe('Руль: справа');
  });

  it('filters nothing for an unknown or missing steering side', () => {
    visit('?steering=middle');

    expect(hidden('right')).toBe(false);
    expect(hidden('right-only')).toBe(false);
    expect(note().hidden).toBe(true);
  });

  it('fills the note with an empty side when the page names none', () => {
    history.replaceState(null, '', '/ru/parts/bmw/?steering=left');
    document.body.innerHTML =
      '<car-facts><p data-vin-steering hidden></p><p data-fitment></p></car-facts>';

    expect(note().textContent).toBe('');
    expect(note().hidden).toBe(false);
  });
});
