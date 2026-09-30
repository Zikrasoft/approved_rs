// @vitest-environment jsdom
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { CAR_EVENT, CAR_STORAGE_KEY, readCar, writeCar } from './car';
import { defineCarPicker } from './carPicker';

const INDEX = {
  makes: ['Alfa', 'Beta'],
  modelsByMake: { Alfa: ['One', 'Two'], Beta: ['Three'] },
  yearsByModel: {
    'Alfa|One': [2020, 2019],
    'Alfa|Two': [2018],
    'Beta|Three': [2010],
  },
};

const mount = () => {
  document.body.innerHTML = `
    <car-picker data-any="Любая">
      <script type="application/json" data-index>${JSON.stringify(INDEX)}</script>
      <select data-car="make"><option value="">Любая</option><option>Alfa</option><option>Beta</option></select>
      <select data-car="model"></select>
      <select data-car="year"></select>
      <button type="button" data-car-clear></button>
    </car-picker>`;
  const pick = (name: string) =>
    document.querySelector<HTMLSelectElement>(`[data-car="${name}"]`)!;
  const choose = (name: string, value: string) => {
    pick(name).value = value;
    pick(name).dispatchEvent(new Event('change'));
  };
  const options = (name: string) =>
    [...pick(name).options].map((option) => option.value);
  return { pick, choose, options };
};

beforeAll(() => defineCarPicker());

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('<car-picker>', () => {
  it('cascades make → model → year and saves the car', () => {
    const { choose, options } = mount();

    choose('make', 'Alfa');
    expect(options('model')).toEqual(['', 'One', 'Two']);
    choose('model', 'One');
    expect(options('year')).toEqual(['', '2020', '2019']);
    choose('year', '2019');

    expect(readCar()).toEqual({ make: 'Alfa', model: 'One', year: 2019 });
  });

  it('forgets the model and year when the make changes', () => {
    const { choose, pick } = mount();
    choose('make', 'Alfa');
    choose('model', 'Two');

    choose('make', 'Beta');

    expect(readCar()).toEqual({ make: 'Beta' });
    expect(pick('model').value).toBe('');
  });

  it('shows the saved car after a reload', () => {
    writeCar({ make: 'Alfa', model: 'One', year: 2020 });
    const { pick } = mount();

    expect([
      pick('make').value,
      pick('model').value,
      pick('year').value,
    ]).toEqual(['Alfa', 'One', '2020']);
  });

  it('drops a saved car whose make the dictionary no longer has', () => {
    writeCar({ make: 'Gamma' });
    mount();

    expect(readCar()).toBeNull();
  });

  it('drops a saved model the dictionary no longer has, keeping the make', () => {
    writeCar({ make: 'Alfa', model: 'Zeta', year: 2020 });
    const { pick } = mount();

    expect(readCar()).toEqual({ make: 'Alfa' });
    expect(pick('model').value).toBe('');
    expect(pick('year').value).toBe('');
  });

  it('drops a saved year the dictionary no longer has, keeping make and model', () => {
    writeCar({ make: 'Alfa', model: 'One', year: 1999 });
    const { pick } = mount();

    expect(readCar()).toEqual({ make: 'Alfa', model: 'One' });
    expect(pick('model').value).toBe('One');
    expect(pick('year').value).toBe('');
  });

  it('moving the element off and back on keeps exactly one live listener set', () => {
    const { pick } = mount();
    const picker = document.querySelector('car-picker')!;
    const parent = picker.parentElement!;
    parent.removeChild(picker);
    parent.appendChild(picker);

    const heard = vi.fn();
    window.addEventListener(CAR_EVENT, heard);
    pick('make').value = 'Alfa';
    pick('make').dispatchEvent(new Event('change'));

    expect(heard).toHaveBeenCalledTimes(1);
    window.removeEventListener(CAR_EVENT, heard);
  });

  it('clears the car and tells the page', () => {
    const heard = vi.fn();
    window.addEventListener(CAR_EVENT, heard);
    const { choose } = mount();
    choose('make', 'Beta');

    document.querySelector<HTMLButtonElement>('[data-car-clear]')!.click();

    expect(readCar()).toBeNull();
    expect(heard).toHaveBeenLastCalledWith(
      expect.objectContaining({ detail: null }),
    );
    window.removeEventListener(CAR_EVENT, heard);
  });

  it('defines itself once however many scripts ask', () => {
    expect(() => defineCarPicker()).not.toThrow();
  });
});

describe('readCar', () => {
  it.each(['{', '[]', '{"make":1}', '{"make":""}', 'null'])(
    'ignores a stored value it cannot trust: %s',
    (raw) => {
      localStorage.setItem(CAR_STORAGE_KEY, raw);
      expect(readCar()).toBeNull();
    },
  );

  it('keeps only the parts of a car that make sense', () => {
    localStorage.setItem(
      CAR_STORAGE_KEY,
      JSON.stringify({ make: 'Alfa', model: 7, year: '2019' }),
    );
    expect(readCar()).toEqual({ make: 'Alfa' });
  });

  it('survives storage that throws, and still announces the car', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const heard = vi.fn();
    window.addEventListener(CAR_EVENT, heard);

    expect(readCar()).toBeNull();
    expect(() => writeCar({ make: 'Alfa' })).not.toThrow();
    expect(heard).toHaveBeenCalledTimes(1);

    window.removeEventListener(CAR_EVENT, heard);
  });
});
