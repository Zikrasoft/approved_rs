import { productType, type ProductTypeDef } from '@podbor/shop-catalog/browser';

import {
  fitmentToText,
  formToSpec,
  specToForm,
  textToFitment,
} from '../spec-form';

const batteries = productType('batteries') as ProductTypeDef;
const oils = productType('motor-oils') as ProductTypeDef;

const WITH_FLAG: ProductTypeDef = {
  key: 'test',
  label: 'Тест',
  fitment: 'none',
  fields: [{ kind: 'boolean', key: 'forStartStop', label: 'Для старт-стоп' }],
};

describe('specToForm', () => {
  it('turns a stored spec into one string per registry field', () => {
    const values = specToForm(batteries, {
      brand: 'Bosch',
      capacityAh: 60,
      polarity: 'left',
    });

    expect(values).toMatchObject({
      brand: 'Bosch',
      capacityAh: '60',
      polarity: 'left',
    });
    expect(values.technology).toBe('');
    expect(Object.keys(values)).toEqual(
      batteries.fields.map((field) => field.key),
    );
  });

  it('joins a code list with commas', () => {
    expect(
      specToForm(oils, { approvals: ['VW 504.00', 'MB 229.51'] }).approvals,
    ).toBe('VW 504.00, MB 229.51');
  });

  it('starts empty when the product has no spec yet', () => {
    expect(
      Object.values(specToForm(batteries, undefined)).every(
        (value) => value === '',
      ),
    ).toBe(true);
  });
});

describe('formToSpec', () => {
  it('types each value the way the registry declares it and drops the blanks', () => {
    expect(
      formToSpec(batteries, {
        brand: ' Bosch ',
        capacityAh: '60',
        polarity: 'left',
        technology: '',
      }),
    ).toEqual({ brand: 'Bosch', capacityAh: 60, polarity: 'left' });
  });

  it('reads a decimal comma', () => {
    expect(formToSpec(oils, { volumeL: '0,8' }).volumeL).toBe(0.8);
  });

  it('splits a code list and drops empty codes', () => {
    expect(
      formToSpec(oils, { approvals: 'VW 504.00, , MB 229.51' }).approvals,
    ).toEqual(['VW 504.00', 'MB 229.51']);
  });

  it('passes a number it cannot read on to the server, which refuses it', () => {
    expect(formToSpec(batteries, { capacityAh: 'sixty' }).capacityAh).toBeNaN();
  });

  it('reads a checkbox', () => {
    expect(formToSpec(WITH_FLAG, { forStartStop: 'true' })).toEqual({
      forStartStop: true,
    });
    expect(formToSpec(WITH_FLAG, { forStartStop: 'false' })).toEqual({
      forStartStop: false,
    });
  });

  it('shows a stored flag as a ticked checkbox', () => {
    expect(specToForm(WITH_FLAG, { forStartStop: true })).toEqual({
      forStartStop: 'true',
    });
  });
});

describe('fitment text', () => {
  const FITMENT = [
    { make: 'Toyota', model: 'Corolla', yearFrom: 2013, yearTo: 2019 },
    { make: 'Mazda', model: '3', yearFrom: 2014, yearTo: 2014 },
  ];

  it('writes one car per line and reads it back', () => {
    const text = fitmentToText(FITMENT);

    expect(text).toBe('Toyota | Corolla | 2013-2019\nMazda | 3 | 2014-2014');
    expect(textToFitment(text)).toEqual(FITMENT);
  });

  it('reads a single year as both ends of the range and ignores blank lines', () => {
    expect(textToFitment('\n  Mazda | 3 | 2014  \n\n')).toEqual([
      { make: 'Mazda', model: '3', yearFrom: 2014, yearTo: 2014 },
    ]);
  });

  it('starts empty when the product has no fitment', () => {
    expect(fitmentToText(undefined)).toBe('');
    expect(fitmentToText(null)).toBe('');
  });
});
