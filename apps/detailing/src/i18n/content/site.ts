import siteYaml from '@/content/i18n/site.yaml?raw';
import { loadI18nSection } from '@/i18n/loadI18nSection';
import { siteContentSchema } from './siteContentSchema';

export type { SiteContent } from './siteContentSchema';

export const getSiteContent = loadI18nSection(siteContentSchema, siteYaml);
