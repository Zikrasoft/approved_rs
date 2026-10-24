import type { RegistryEntry } from '@podbor/i18n';
import { siteContentSchema } from './content/siteContentSchema.ts';
import { captureCopySchema } from '@podbor/lead-capture/copy';
import { homeContentSchema } from './content/homeContentSchema.ts';
import { servicesContentSchema } from './content/servicesContentSchema.ts';
import { pagesContentSchema } from './content/pagesContentSchema.ts';
import { promoBannersContentSchema } from './content/promoBannersContentSchema.ts';
import { shopPartContentSchema } from './content/shopPartContentSchema.ts';
import { shopCartContentSchema } from './content/shopCartContentSchema.ts';
import { partsCarContentSchema } from './content/partsCarContentSchema.ts';
import { partsSearchContentSchema } from './content/partsSearchContentSchema.ts';

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
  {
    key: 'promoBanners',
    path: 'src/content/i18n/promoBanners.yaml',
    schema: promoBannersContentSchema,
    promptSubject:
      'short promo banners shown on a car service work write-up, inviting the reader to book the same kind of job at our shop in the Zvezdara district of Belgrade, keep {placeholders} if any and markdown bold spans intact',
  },
  {
    key: 'shopPart',
    path: 'src/content/i18n/shopPart.yaml',
    schema: shopPartContentSchema,
    promptSubject:
      'part-detail page copy for a car parts shop (offers with stock and lead-time wording, an add-to-cart button and its confirmation, a fallback that adds the part to a parts inquiry, equivalents, supersession notices); keep {placeholders} intact',
  },
  {
    key: 'shopCart',
    path: 'src/content/i18n/shopCart.yaml',
    schema: shopCartContentSchema,
    promptSubject:
      'cart page copy for a car parts shop, cash-at-pickup only (cart lines, an empty state, the total, a checkout form that asks only for a contact, notices for a changed price, missing stock or a failed order, an order-placed confirmation, a fallback to a parts inquiry); keep {placeholders} intact',
  },
  {
    key: 'partsCar',
    path: 'src/content/i18n/partsCar.yaml',
    schema: partsCarContentSchema,
    promptSubject:
      'a car parts shop: the VIN lookup form, its fallback notice when a VIN cannot be identified, and the car page listing what the shop knows about one vehicle configuration (engine, fuel, drive, body, steering, model code) and its parts with quantity and fitting position (axle, side), and the make and model hub pages listing part categories; keep {placeholders} intact',
  },
  {
    key: 'partsSearch',
    path: 'src/content/i18n/partsSearch.yaml',
    schema: partsSearchContentSchema,
    promptSubject:
      'a car parts shop search: the search box for a part number or name, the results list with its characteristic filters, empty and unavailable states that point to a parts inquiry, and pagination; keep {placeholders} intact',
  },
] as const satisfies readonly RegistryEntry[];
