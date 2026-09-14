import homeYaml from '@/content/i18n/home.yaml?raw';
import { loadI18nSection } from '@/i18n/loadI18nSection';
import { homeContentSchema } from './homeContentSchema';

export type { HomeContent } from './homeContentSchema';

export const getHomeContent = loadI18nSection(homeContentSchema, homeYaml);
