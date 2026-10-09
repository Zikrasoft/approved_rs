import type { RegistryEntry } from '@podbor/i18n';
import { siteContentSchema } from './content/siteContentSchema.ts';
import { captureCopySchema } from '@podbor/lead-capture/copy';
import { homeContentSchema } from './content/homeContentSchema.ts';
import { servicesContentSchema } from './content/servicesContentSchema.ts';
import { pagesContentSchema } from './content/pagesContentSchema.ts';

export const SECTIONS = [
  {
    key: 'site',
    path: 'src/content/i18n/site.yaml',
    schema: siteContentSchema,
    promptSubject:
      'UI copy for a car detailing studio (navigation, header, footer, contact channels and the lead form)',
  },
  {
    key: 'home',
    path: 'src/content/i18n/home.yaml',
    schema: homeContentSchema,
    promptSubject:
      'home page copy for a car detailing studio (hero, process steps, pricing tiers, FAQ, CTAs)',
  },
  {
    key: 'services',
    path: 'src/content/i18n/services.yaml',
    schema: servicesContentSchema,
    promptSubject:
      'detailing service page copy (paint protection film, colour-change wrap, machine polishing with ceramic coating, steering-wheel restoration) — keep industry terms a Serbian customer would recognise',
  },
  {
    key: 'captureBot',
    path: 'src/content/i18n/captureBot.yaml',
    schema: captureCopySchema,
    promptSubject:
      'what the Telegram capture bot of a car detailing studio says to a visitor who opened it from the site (a greeting and short questions, written as one person messaging another)',
  },
  {
    key: 'pages',
    path: 'src/content/i18n/pages.yaml',
    schema: pagesContentSchema,
    promptSubject:
      'copy for the work-gallery, contact, thank-you, privacy-policy and not-found pages',
  },
] as const satisfies readonly RegistryEntry[];
