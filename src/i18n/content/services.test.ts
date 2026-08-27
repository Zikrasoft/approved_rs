import { describe, it, expect } from 'vitest';
import { getServicesContent } from './services';
import { SUPPORTED_LOCALES } from '@/i18n/config';

describe('getServicesContent', () => {
  it('every locale produces all top-level sections', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const s = getServicesContent(locale);
      expect(s['vehicle-sourcing'].stepsFor('X').length).toBe(5);
      expect(s['vehicle-sourcing'].deliveryDestinations.length).toBe(9);
      expect(s['vehicle-inspection'].steps.length).toBe(5);
      expect(s.autoServiceBelgrade.whatWeDo.length).toBe(5);
      expect(s.detailingBelgrade.whatWeDo.length).toBe(1);
      expect(Object.keys(s.caseChrome.serviceBadges).length).toBe(6);
      expect(s['vehicle-import'].de.steps.length).toBe(5);
      expect(s['vehicle-import'].eu.steps.length).toBe(5);
      expect(s['vehicle-import'].china.steps.length).toBe(5);
    }
  });

  it('vehicle-import spokes each have real, distinct destination/source copy (not left blank or copy-pasted)', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const { de, eu, china } = getServicesContent(locale)['vehicle-import'];
      expect(de.destinationsNote).toBeTruthy();
      expect(eu.destinationsNote).toBeTruthy();
      expect(china.destinationsNote).toBeTruthy();
      expect(eu.destinationsNote).not.toBe(china.destinationsNote);
    }
  });

  it('template functions interpolate their argument', () => {
    expect(getServicesContent('en')['vehicle-sourcing'].descriptionFor('__LOC__')).toContain('__LOC__');
    expect(getServicesContent('sr').cityVehicleSourcing.whyCityHeadingFor('__CITY__')).toContain('__CITY__');
  });

  it('en and sr differ from ru', () => {
    expect(getServicesContent('en')['vehicle-sourcing'].title).not.toBe(getServicesContent('ru')['vehicle-sourcing'].title);
    expect(getServicesContent('sr')['vehicle-buyback'].title).not.toBe(getServicesContent('ru')['vehicle-buyback'].title);
    expect(getServicesContent('en')['vehicle-import'].de.title).not.toBe(getServicesContent('ru')['vehicle-import'].de.title);
    expect(getServicesContent('sr')['vehicle-import'].de.title).not.toBe(getServicesContent('ru')['vehicle-import'].de.title);
  });
});
