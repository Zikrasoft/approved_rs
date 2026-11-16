import { vi } from 'vitest';
import { createBrandStore } from '../brandStore.ts';
import { createBrandBot } from '../brandBot.ts';
import { createContactClickRoute } from '../routes/contactClick.ts';
import { createLeadsRoute } from '../routes/leads.ts';
import { testContactClickRoute, testLeadsRoute } from './routes.ts';

vi.stubEnv('TELEGRAM_BOT_TOKEN', '4001:route-token');
vi.stubEnv('TELEGRAM_BOT_USERNAME', 'route_bot');
vi.stubEnv('TELEGRAM_GROUP_ID', '-1004001');
vi.stubEnv('TELEGRAM_OWNER_ID', '1');
vi.stubEnv('TELEGRAM_ADMIN_ID', '2');

const { leadStore, notifyLead } = createBrandStore({
  brand: 'Details',
  getNotifier: async () =>
    createBrandBot({ store: leadStore, serviceLabel: (slug) => slug }),
});

const isLocale = (value: string): value is 'sr' | 'en' =>
  ['sr', 'en'].includes(value);

testContactClickRoute({
  brand: 'Details',
  POST: createContactClickRoute({ notifyLead, isLocale, defaultLocale: 'sr' }),
  readLeads: leadStore.readLeads,
});

testLeadsRoute({
  brand: 'Details',
  POST: createLeadsRoute({
    notifyLead,
    isLocale,
    defaultLocale: 'sr',
    localeCookie: 'lang',
    thanksPath: (locale) => `/${locale}/thanks/`,
    refusalCopy: () => ({
      brand: {
        name: 'Details',
        home: '/sr/',
        background: '#000',
        text: '#fff',
        accent: '#fff',
        onAccent: '#000',
      },
      reasons: {
        'missing-contact': 'contact',
        'invalid-phone': 'phone',
        'invalid-telegram': 'telegram',
      },
      privacy: { note: 'privacy', label: 'policy', href: '/sr/privacy/' },
      submit: 'send',
      links: [],
    }),
  }),
  readLeads: leadStore.readLeads,
  fields: { service: 'polishing-ceramic' },
  stored: { service: 'polishing-ceramic' },
});
