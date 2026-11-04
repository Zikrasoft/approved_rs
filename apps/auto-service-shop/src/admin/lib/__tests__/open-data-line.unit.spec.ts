import {
  labelledVehicleSchema,
  openDataLine,
  openDataReferenceSchema,
  type TFunction,
  vehicleSpecLabel,
} from '../vehicle-label';

const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key}${JSON.stringify(options)}` : key) as unknown as TFunction;

describe('openDataLine', () => {
  it('sums up a BMW type key with every fact it states', () => {
    const reference = openDataReferenceSchema.parse({
      code: '3K11',
      chassis: 'F31',
      model: '318d',
      body: 'Touring',
      engine: 'N47D20U1',
      power_kw: 105,
      drivetrain: 'rwd',
      steering: 'left',
      from: '2012-07',
      to: null,
    });

    expect(openDataLine(t, reference)).toBe(
      [
        'F31 318d Touring',
        'N47D20U1',
        'vehicleLabel.kw{"kw":105}',
        'vehicles.values.drive.rwd',
        'vehicleLabel.steering.left',
        'vehicleLabel.since{"from":"2012-07"}',
      ].join(', '),
    );
  });

  it('sums up a VAG model code, which names only the generation and its years', () => {
    const reference = openDataReferenceSchema.parse({
      code: 'AU',
      chassis: '5G/BA',
      model: 'Golf VII',
      from: '2012',
      to: '2020',
    });

    expect(openDataLine(t, reference)).toBe(
      '5G/BA Golf VII, vehicleLabel.between{"from":"2012","to":"2020"}',
    );
  });

  it('says until when only the last year is known', () => {
    expect(
      openDataLine(
        t,
        openDataReferenceSchema.parse({
          chassis: '1K',
          model: 'Golf V',
          from: null,
          to: '2009',
        }),
      ),
    ).toBe('1K Golf V, vehicleLabel.until{"to":"2009"}');
  });

  it('leaves the years out when the open data states none', () => {
    expect(
      openDataLine(
        t,
        openDataReferenceSchema.parse({
          chassis: 'TV',
          model: 'T7',
          from: null,
          to: null,
        }),
      ),
    ).toBe('TV T7');
  });
});

describe('vehicleSpecLabel', () => {
  it('spells out a Vehicle with its engine, power, years and steering', () => {
    const vehicle = labelledVehicleSchema.parse({
      id: 'veh_1',
      power_kw: 110,
      year_from: 2012,
      year_to: 2020,
      steering: 'left',
      model: {
        name: '2.0 TDI',
        chassis: {
          code: '5G1',
          series: { name: 'Golf', make: { name: 'Volkswagen' } },
        },
      },
      engine: { code: 'CRBC' },
    });

    expect(vehicleSpecLabel(t, vehicle)).toBe(
      [
        'Volkswagen Golf 5G1 2.0 TDI',
        'CRBC',
        'vehicleLabel.kw{"kw":110}',
        'vehicleLabel.between{"from":2012,"to":2020}',
        'vehicleLabel.steering.left',
      ].join(', '),
    );
  });
});
