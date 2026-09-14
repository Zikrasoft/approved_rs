import pagesYaml from '@/content/i18n/pages.yaml?raw';
import { loadI18nSection } from '@/i18n/loadI18nSection';
import { pagesContentSchema } from './pagesContentSchema';

export type { PagesContent } from './pagesContentSchema';

export const getPagesContent = loadI18nSection(pagesContentSchema, pagesYaml);
