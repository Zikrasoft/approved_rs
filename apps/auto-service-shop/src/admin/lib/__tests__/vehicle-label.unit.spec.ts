import { referenceLabel } from '../vehicle-label';

const bmw = { id: 'make_bmw', name: 'BMW' };
const series3 = { id: 'series_3', name: '3 Series', make: bmw };
const octavia = {
  id: 'series_octavia',
  name: 'Octavia',
  make: { id: 'make_skoda', name: 'Skoda' },
};
const f30 = { id: 'chassis_f30', code: 'F30', series: series3 };
const fiveE = { id: 'chassis_5e', code: '5E', series: octavia };

describe('referenceLabel', () => {
  it.each([
    ['makes', bmw, 'BMW'],
    ['series', octavia, 'Skoda Octavia'],
    ['chassis', f30, 'BMW 3 Series F30'],
    [
      'vehicle_models',
      { id: 'model_bmw', name: '2.0 TDI', chassis: f30 },
      'BMW 3 Series F30 2.0 TDI',
    ],
    [
      'vehicle_models',
      { id: 'model_skoda', name: '2.0 TDI', chassis: fiveE },
      'Skoda Octavia 5E 2.0 TDI',
    ],
    ['engines', { id: 'engine_b47', code: 'B47D20' }, 'B47D20'],
  ])(
    'labels a %s row with its make, series and chassis',
    (collection, row, label) => {
      expect(referenceLabel(collection, row)).toBe(label);
    },
  );

  it('falls back to the row itself when its parent is not loaded', () => {
    expect(referenceLabel('chassis', { id: 'chassis_f30', code: 'F30' })).toBe(
      'F30',
    );
  });
});
