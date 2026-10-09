import { describe, it, expect } from 'vitest';
import { servicesView } from './services';
import { SUPPORTED_LOCALES } from '@/i18n/config';
import { SLUG } from '@/utils/labels';

describe('servicesView', () => {
  it('every locale produces all top-level sections', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const s = servicesView(locale);
      expect(s['vehicle-sourcing'].stepsFor('X').length).toBe(5);
      expect(s['vehicle-sourcing'].deliveryDestinations.length).toBe(6);
      expect(s['vehicle-inspection'].steps.length).toBe(5);
      expect(Object.keys(s.caseChrome.serviceBadges).length).toBe(4);
      expect(s['vehicle-import'].de.steps.length).toBe(5);
      expect(s['vehicle-import'].eu.steps.length).toBe(5);
      expect(s['vehicle-import'].china.steps.length).toBe(5);
    }
  });

  it('caseChrome.serviceBadges reads each keyed YAML entry onto the right service slug', () => {
    const badges = servicesView('ru').caseChrome.serviceBadges;
    expect(badges[SLUG.SOURCING]).toBe('Автоподбор');
    expect(badges[SLUG.BUYBACK]).toBe('Выкуп');
    expect(badges[SLUG.INSPECTION]).toBe('Проверка');
    expect(badges[SLUG.IMPORT]).toBe('Привоз');
  });

  it('vehicle-import spokes each have real, distinct destination/source copy (not left blank or copy-pasted)', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const { de, eu, china } = servicesView(locale)['vehicle-import'];
      expect(de.destinationsNote).toBeTruthy();
      expect(eu.destinationsNote).toBeTruthy();
      expect(china.destinationsNote).toBeTruthy();
      expect(eu.destinationsNote).not.toBe(china.destinationsNote);
    }
  });

  it('template functions interpolate their argument', () => {
    expect(
      servicesView('en')['vehicle-sourcing'].descriptionFor('__LOC__'),
    ).toContain('__LOC__');
    expect(
      servicesView('sr').cityVehicleSourcing.whyCityHeadingFor('__CITY__'),
    ).toContain('__CITY__');
  });
});
