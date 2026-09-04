import { describe, it, expect } from 'vitest';
import { withLocales, PathBuilder } from './paths';

describe('PathBuilder', () => {
  it('builds every fixed route for a given locale', () => {
    expect(PathBuilder.home('ru')).toBe('/ru/');
    expect(PathBuilder.vehicleSourcingHub('en')).toBe('/en/vehicle-sourcing/');
    expect(PathBuilder.vehicleImportHub('en')).toBe('/en/vehicle-import/');
    expect(PathBuilder.autoServiceBelgrade('sr')).toBe('/sr/auto-service-belgrade/');
    expect(PathBuilder.casesVehicleSourcing('ru')).toBe('/ru/cases/vehicle-sourcing/');
    expect(PathBuilder.casesAutoService('ru')).toBe('/ru/cases/auto-service/');
    expect(PathBuilder.contacts('en')).toBe('/en/contacts/');
    expect(PathBuilder.privacy('en')).toBe('/en/privacy/');
    expect(PathBuilder.thanks('sr')).toBe('/sr/thanks/');
  });

  it('builds country-scoped service routes', () => {
    expect(PathBuilder.service('ru', 'vehicle-sourcing', 'de')).toBe('/ru/vehicle-sourcing/de/');
    expect(PathBuilder.service('en', 'vehicle-buyback', 'rs')).toBe('/en/vehicle-buyback/rs/');
    expect(PathBuilder.service('sr', 'vehicle-inspection', 'de')).toBe('/sr/vehicle-inspection/de/');
  });

  it('builds the vehicle-sourcing city route', () => {
    expect(PathBuilder.vehicleSourcingCity('ru', 'de', 'berlin')).toBe('/ru/vehicle-sourcing/de/berlin/');
  });

  it('builds every vehicle-import spoke', () => {
    expect(PathBuilder.vehicleImportSpoke('ru', 'de')).toBe('/ru/vehicle-import/eu/de/');
    expect(PathBuilder.vehicleImportSpoke('ru', 'es')).toBe('/ru/vehicle-import/eu/es/');
    expect(PathBuilder.vehicleImportSpoke('ru', 'ch')).toBe('/ru/vehicle-import/eu/ch/');
    expect(PathBuilder.vehicleImportSpoke('en', 'eu')).toBe('/en/vehicle-import/eu/');
    expect(PathBuilder.vehicleImportSpoke('sr', 'china')).toBe('/sr/vehicle-import/china/');
  });

  it('builds case detail routes', () => {
    expect(PathBuilder.case('ru', 'bmw-x1')).toBe('/ru/cases/bmw-x1/');
    expect(PathBuilder.autoServiceCase('en', 'bmw-320')).toBe('/en/auto-service-belgrade/bmw-320/');
  });
});

describe('withLocales', () => {
  it('crosses each input path with every supported locale', () => {
    const result = withLocales([{ params: { country: 'de' } }, { params: { country: 'rs' } }]);
    expect(result).toEqual([
      { params: { locale: 'ru', country: 'de' } },
      { params: { locale: 'ru', country: 'rs' } },
      { params: { locale: 'en', country: 'de' } },
      { params: { locale: 'en', country: 'rs' } },
      { params: { locale: 'sr', country: 'de' } },
      { params: { locale: 'sr', country: 'rs' } },
      { params: { locale: 'es', country: 'de' } },
      { params: { locale: 'es', country: 'rs' } },
      { params: { locale: 'de', country: 'de' } },
      { params: { locale: 'de', country: 'rs' } },
    ]);
  });

  it('preserves props alongside params', () => {
    const result = withLocales([{ params: {}, props: { foo: 'bar' } }]);
    expect(result.every(p => p.props?.foo === 'bar')).toBe(true);
    expect(result).toHaveLength(5);
  });

  it('handles a single empty-params entry (page with no other dynamic segments)', () => {
    expect(withLocales([{ params: {} }])).toEqual([
      { params: { locale: 'ru' } },
      { params: { locale: 'en' } },
      { params: { locale: 'sr' } },
      { params: { locale: 'es' } },
      { params: { locale: 'de' } },
    ]);
  });
});
