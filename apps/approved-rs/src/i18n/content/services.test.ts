import { describe, it, expect } from 'vitest';
import { getServicesContent } from './services';
import { SUPPORTED_LOCALES } from '@/i18n/config';
import { SLUG } from '@/utils/labels';

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

  it('caseChrome.serviceBadges reads each keyed YAML entry onto the right service slug', () => {
    // whatWeDo/serviceBadges carry their key/slug in the YAML itself (see
    // servicesContentSchema.ts) — reordering can no longer mislabel content,
    // the schema's z.enum + .length() already reject that. These are
    // content/regression checks instead: they'd catch e.g. two entries'
    // labels getting swapped by a bad manual edit that keeps every key valid.
    const badges = getServicesContent('ru').caseChrome.serviceBadges;
    expect(badges[SLUG.SOURCING]).toBe('Автоподбор');
    expect(badges[SLUG.BUYBACK]).toBe('Выкуп');
    expect(badges[SLUG.INSPECTION]).toBe('Проверка');
    expect(badges[SLUG.IMPORT]).toBe('Привоз');
    expect(badges[SLUG.AUTO_SERVICE]).toBe('Автосервис');
    expect(badges[SLUG.DETAILING]).toBe('Детейлинг');
  });

  it('autoServiceBelgrade/detailingBelgrade.whatWeDo reads each keyed YAML entry onto the right service key', () => {
    const s = getServicesContent('ru');
    const byKey = Object.fromEntries(
      s.autoServiceBelgrade.whatWeDo.map((item) => [item.key, item.label]),
    );
    expect(byKey.diagnostics).toBe('Компьютерная диагностика');
    expect(byKey.maintenance).toBe('Техническое обслуживание');
    expect(byKey.suspension).toBe('Подвеска и тормоза');
    expect(byKey.engine).toBe('Двигатель и трансмиссия');
    expect(byKey.prepurchase).toBe('Проверка перед покупкой');
    expect(s.detailingBelgrade.whatWeDo[0].key).toBe('wrap');
    expect(s.detailingBelgrade.whatWeDo[0].label).toBe('Оклейка плёнкой');
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
    expect(
      getServicesContent('en')['vehicle-sourcing'].descriptionFor('__LOC__'),
    ).toContain('__LOC__');
    expect(
      getServicesContent('sr').cityVehicleSourcing.whyCityHeadingFor(
        '__CITY__',
      ),
    ).toContain('__CITY__');
  });

  it('en, sr, es and de differ from ru', () => {
    expect(getServicesContent('en')['vehicle-sourcing'].title).not.toBe(
      getServicesContent('ru')['vehicle-sourcing'].title,
    );
    expect(getServicesContent('sr')['vehicle-buyback'].title).not.toBe(
      getServicesContent('ru')['vehicle-buyback'].title,
    );
    expect(getServicesContent('es')['vehicle-sourcing'].title).not.toBe(
      getServicesContent('ru')['vehicle-sourcing'].title,
    );
    expect(getServicesContent('de')['vehicle-buyback'].title).not.toBe(
      getServicesContent('ru')['vehicle-buyback'].title,
    );
    expect(getServicesContent('en')['vehicle-import'].de.title).not.toBe(
      getServicesContent('ru')['vehicle-import'].de.title,
    );
    expect(getServicesContent('sr')['vehicle-import'].de.title).not.toBe(
      getServicesContent('ru')['vehicle-import'].de.title,
    );
    expect(getServicesContent('es')['vehicle-import'].de.title).not.toBe(
      getServicesContent('ru')['vehicle-import'].de.title,
    );
    expect(getServicesContent('de')['vehicle-import'].de.title).not.toBe(
      getServicesContent('ru')['vehicle-import'].de.title,
    );
  });
});
