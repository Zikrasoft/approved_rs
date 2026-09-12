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
import { shopContentSchema } from '../src/i18n/content/shopContentSchema.ts';

export const SECTIONS: readonly Section[] = [
  {
    path: 'src/content/i18n/site.yaml',
    fields: siteContentSchema.keyof().options,
    schema: siteContentSchema,
    promptSubject:
      'UI copy for an independent car service (navigation, header, footer, contact channels and the booking form)',
  },
  {
    path: 'src/content/i18n/home.yaml',
    fields: homeContentSchema.keyof().options,
    schema: homeContentSchema,
    promptSubject:
      'home page copy for a car service (hero, trust figures, process steps, accident repair, FAQ, CTAs)',
  },
  {
    path: 'src/content/i18n/services.yaml',
    fields: servicesContentSchema.keyof().options,
    schema: servicesContentSchema,
    promptSubject:
      'car service page copy (diagnostics, scheduled servicing, brakes and suspension, engine and gearbox, accident repair and respraying, pre-purchase inspection) — keep the trade terms a Serbian driver would recognise',
  },
  {
    path: 'src/content/i18n/shop.yaml',
    fields: shopContentSchema.keyof().options,
    schema: shopContentSchema,
    promptSubject:
      'car battery shop copy (fitment filter labels, product specs, basket and order flow)',
  },
  {
    path: 'src/content/i18n/pages.yaml',
    fields: pagesContentSchema.keyof().options,
    schema: pagesContentSchema,
    promptSubject:
      'copy for the recent-jobs, contact, thank-you, privacy-policy and not-found pages',
  },
];

const { run, recordHashes } = createSectionTranslator({
  targetLocales: TRANSLATABLE_LOCALES,
  languageName: TARGET_LANGUAGE_NAME,
  businessDescription: BUSINESS_DESCRIPTION,
});

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--record-hashes')) {
    console.log(`rehashed ${recordHashes(SECTIONS)} section(s)`);
    process.exit(0);
  }
  process.exit(await run(SECTIONS));
}
