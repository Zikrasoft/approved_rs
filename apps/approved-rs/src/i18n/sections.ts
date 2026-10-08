import type { RegistryEntry } from '@podbor/i18n';
import { dictionaryContentSchema } from './dictionaryContentSchema.ts';
import { captureCopySchema } from '@podbor/lead-capture/copy';
import { faqContentSchema } from './content/faqContentSchema.ts';
import { leadFormContentSchema } from './content/leadFormContentSchema.ts';
import { homeContentSchema } from './content/homeContentSchema.ts';
import { pagesContentSchema } from './content/pagesContentSchema.ts';
import { promoBannersContentSchema } from './content/promoBannersContentSchema.ts';
import { metaContentSchema } from './content/metaContentSchema.ts';
import { servicesContentSchema } from './content/servicesContentSchema.ts';

export const SECTIONS = [
  {
    key: 'dictionary',
    path: 'src/content/i18n/dictionary.yaml',
    schema: dictionaryContentSchema,
    promptSubject: 'UI copy (navigation, header, footer, and shared labels)',
  },
  {
    key: 'faq',
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
    key: 'leadForm',
    path: 'src/content/i18n/leadForm.yaml',
    schema: leadFormContentSchema,
    promptSubject:
      'lead-capture form UI copy (labels, placeholders, error messages)',
  },
  {
    key: 'home',
    path: 'src/content/i18n/home.yaml',
    schema: homeContentSchema,
    promptSubject: 'home page copy (hero, journey steps, testimonials, CTAs)',
  },
  {
    key: 'pages',
    path: 'src/content/i18n/pages.yaml',
    schema: pagesContentSchema,
    promptSubject:
      'copy for the contacts/privacy-policy/thank-you/case-listing pages and for the recommended-partner-brands block',
  },
  {
    key: 'promoBanners',
    path: 'src/content/i18n/promoBanners.yaml',
    schema: promoBannersContentSchema,
    promptSubject:
      'SEO-keyword-dense promotional banner copy shown on case-detail pages (markdown **bold** spans mark the keyword phrases — keep them)',
  },
  {
    key: 'captureBot',
    path: 'src/content/i18n/captureBot.yaml',
    schema: captureCopySchema,
    promptSubject:
      'what the Telegram capture bot says to a visitor who opened it from the site (a greeting and short questions, written as one person messaging another)',
  },
  {
    key: 'meta',
    path: 'src/content/i18n/meta.yaml',
    schema: metaContentSchema,
    promptSubject:
      'SEO <title>/<meta description> templates for service pages (contain the literal token {location})',
  },
  {
    key: 'services',
    path: 'src/content/i18n/services.yaml',
    schema: servicesContentSchema,
    promptSubject:
      'service page copy (sourcing/buyback/import/inspection) — many strings contain literal placeholder tokens like {location}, {cityLocation}, {countryName}, {destinations}, {name}, {countryLocation}, {countryGenitiveOrName}',
  },
] as const satisfies readonly RegistryEntry[];
