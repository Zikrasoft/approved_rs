import type { RegistryEntry } from '@podbor/i18n';
import { siteContentSchema } from './content/siteContentSchema.ts';
import { captureCopySchema } from '@podbor/lead-capture/copy';
import { homeContentSchema } from './content/homeContentSchema.ts';
import { servicesContentSchema } from './content/servicesContentSchema.ts';
import { pagesContentSchema } from './content/pagesContentSchema.ts';
import { shopContentSchema } from './content/shopContentSchema.ts';

export const SECTIONS = [
  {
    key: 'site',
    path: 'src/content/i18n/site.yaml',
    schema: siteContentSchema,
    promptSubject:
      'UI copy for an independent car service (navigation, header, footer, contact channels and the booking form)',
  },
  {
    key: 'home',
    path: 'src/content/i18n/home.yaml',
    schema: homeContentSchema,
    promptSubject:
      'home page copy for a car service (hero, trust figures, process steps, accident repair, FAQ, CTAs)',
  },
  {
    key: 'services',
    path: 'src/content/i18n/services.yaml',
    schema: servicesContentSchema,
    promptSubject:
      'car service page copy (diagnostics, scheduled servicing, brakes and suspension, engine and gearbox, accident repair and respraying, pre-purchase inspection) — keep the trade terms a Serbian driver would recognise',
  },
  {
    key: 'shop',
    path: 'src/content/i18n/shop.yaml',
    schema: shopContentSchema,
    promptSubject:
      'car parts shop copy (product types, spec labels and units, filters, car picker, basket, pickup checkout and order confirmation) — keep brand names, codes such as 5W-30 or AGM, and the {placeholders} exactly as they are',
  },
  {
    key: 'captureBot',
    path: 'src/content/i18n/captureBot.yaml',
    schema: captureCopySchema,
    promptSubject:
      'what the Telegram capture bot says to a visitor who opened it from a car service and parts shop site (a greeting and short questions about their car and the repair, written as one person messaging another)',
  },
  {
    key: 'pages',
    path: 'src/content/i18n/pages.yaml',
    schema: pagesContentSchema,
    promptSubject:
      'copy for the recent-jobs, contact, thank-you, privacy-policy and not-found pages',
  },
] as const satisfies readonly RegistryEntry[];
