export {};

import { createSectionTranslator, type Section } from '@podbor/i18n/translate';
import { TRANSLATABLE_LOCALES } from '../src/i18n/config.ts';
import {
  BUSINESS_DESCRIPTION,
  TARGET_LANGUAGE_NAME,
} from '../src/i18n/translateConfig.ts';
import { siteContentSchema } from '../src/i18n/content/siteContentSchema.ts';
import { homeContentSchema } from '../src/i18n/content/homeContentSchema.ts';
import { servicesContentSchema } from '../src/i18n/content/servicesContentSchema.ts';
import { pagesContentSchema } from '../src/i18n/content/pagesContentSchema.ts';

export const SECTIONS: readonly Section[] = [
  {
    path: 'src/content/i18n/site.yaml',
    fields: siteContentSchema.keyof().options,
    schema: siteContentSchema,
    promptSubject:
      'UI copy for a car detailing studio (navigation, header, footer, contact channels and the lead form)',
  },
  {
    path: 'src/content/i18n/home.yaml',
    fields: homeContentSchema.keyof().options,
    schema: homeContentSchema,
    promptSubject:
      'home page copy for a car detailing studio (hero, process steps, pricing tiers, FAQ, CTAs)',
  },
  {
    path: 'src/content/i18n/services.yaml',
    fields: servicesContentSchema.keyof().options,
    schema: servicesContentSchema,
    promptSubject:
      'detailing service page copy (paint protection film, colour-change wrap, machine polishing with ceramic coating, steering-wheel restoration) — keep industry terms a Serbian customer would recognise',
  },
  {
    path: 'src/content/i18n/pages.yaml',
    fields: pagesContentSchema.keyof().options,
    schema: pagesContentSchema,
    promptSubject:
      'copy for the work-gallery, contact, thank-you, privacy-policy and not-found pages',
  },
];

const { run } = createSectionTranslator({
  targetLocales: TRANSLATABLE_LOCALES,
  languageName: TARGET_LANGUAGE_NAME,
  businessDescription: BUSINESS_DESCRIPTION,
});

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(await run(SECTIONS));
}
