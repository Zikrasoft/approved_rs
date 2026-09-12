import { createSectionTranslator, type Section } from '@podbor/i18n/translate';
import { TRANSLATABLE_LOCALES } from '../src/i18n/config.ts';
import {
  BUSINESS_DESCRIPTION,
  TARGET_LANGUAGE_NAME,
} from '../src/i18n/translateConfig.ts';
import { dictionaryContentSchema } from '../src/i18n/dictionaryContentSchema.ts';
import { faqContentSchema } from '../src/i18n/content/faqContentSchema.ts';
import { leadFormContentSchema } from '../src/i18n/content/leadFormContentSchema.ts';
import { homeContentSchema } from '../src/i18n/content/homeContentSchema.ts';
import { pagesContentSchema } from '../src/i18n/content/pagesContentSchema.ts';
import { promoBannersContentSchema } from '../src/i18n/content/promoBannersContentSchema.ts';
import { metaContentSchema } from '../src/i18n/content/metaContentSchema.ts';
import { servicesContentSchema } from '../src/i18n/content/servicesContentSchema.ts';

export const SECTIONS: readonly Section[] = [
  {
    path: 'src/content/i18n/dictionary.yaml',
    fields: ['nav', 'header', 'footer', 'common'],
    schema: dictionaryContentSchema,
    promptSubject: 'UI copy (navigation, header, footer, and shared labels)',
  },
  {
    path: 'src/content/i18n/faq.yaml',
    fields: [
      'vehicle-sourcing',
      'vehicle-import',
      'vehicle-buyback',
      'vehicle-inspection',
      'general',
      'cityExpert',
    ],
    schema: faqContentSchema,
    promptSubject: 'frequently-asked-question entries (question + answer)',
  },
  {
    path: 'src/content/i18n/leadForm.yaml',
    fields: leadFormContentSchema.keyof().options,
    schema: leadFormContentSchema,
    promptSubject:
      'lead-capture form UI copy (labels, placeholders, error messages)',
  },
  {
    path: 'src/content/i18n/home.yaml',
    fields: homeContentSchema.keyof().options,
    schema: homeContentSchema,
    promptSubject: 'home page copy (hero, journey steps, testimonials, CTAs)',
  },
  {
    path: 'src/content/i18n/pages.yaml',
    fields: pagesContentSchema.keyof().options,
    schema: pagesContentSchema,
    promptSubject:
      'copy for the contacts/privacy-policy/thank-you/case-listing pages',
  },
  {
    path: 'src/content/i18n/promoBanners.yaml',
    fields: promoBannersContentSchema.keyof().options,
    schema: promoBannersContentSchema,
    promptSubject:
      'SEO-keyword-dense promotional banner copy shown on case-detail pages (markdown **bold** spans mark the keyword phrases — keep them)',
  },
  {
    path: 'src/content/i18n/meta.yaml',
    fields: metaContentSchema.keyof().options,
    schema: metaContentSchema,
    promptSubject:
      'SEO <title>/<meta description> templates for service pages (contain the literal token {location})',
  },
  {
    path: 'src/content/i18n/services.yaml',
    fields: servicesContentSchema.keyof().options,
    schema: servicesContentSchema,
    promptSubject:
      'service page copy (sourcing/buyback/import/inspection) — many strings contain literal placeholder tokens like {location}, {cityLocation}, {countryName}, {destinations}, {name}, {countryLocation}, {countryGenitiveOrName}',
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
