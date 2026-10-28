import { referenceLabel } from '../vehicle-label';

const rows = {
  makes: [
    { id: 'make_bmw', name: 'BMW' },
    { id: 'make_skoda', name: 'Skoda' },
  ],
  series: [
    { id: 'series_3', make_id: 'make_bmw', name: '3 Series' },
    { id: 'series_octavia', make_id: 'make_skoda', name: 'Octavia' },
  ],
  chassis: [
    { id: 'chassis_f30', series_id: 'series_3', code: 'F30' },
    { id: 'chassis_5e', series_id: 'series_octavia', code: '5E' },
  ],
  vehicle_models: [
    { id: 'model_bmw', chassis_id: 'chassis_f30', name: '2.0 TDI' },
    { id: 'model_skoda', chassis_id: 'chassis_5e', name: '2.0 TDI' },
  ],
  engines: [{ id: 'engine_b47', code: 'B47D20' }],
};

describe('referenceLabel', () => {
  it.each([
    ['makes', rows.makes[0], 'BMW'],
    ['series', rows.series[1], 'Skoda Octavia'],
    ['chassis', rows.chassis[0], 'BMW 3 Series F30'],
    ['vehicle_models', rows.vehicle_models[0], 'BMW 3 Series F30 2.0 TDI'],
    ['vehicle_models', rows.vehicle_models[1], 'Skoda Octavia 5E 2.0 TDI'],
    ['engines', rows.engines[0], 'B47D20'],
  ])(
    'labels a %s row with its make, series and chassis',
    (collection, row, label) => {
      expect(referenceLabel(rows, collection, row)).toBe(label);
    },
  );

  it('falls back to the row itself when its parent is not loaded', () => {
    expect(referenceLabel({}, 'chassis', rows.chassis[0])).toBe('F30');
  });
});
