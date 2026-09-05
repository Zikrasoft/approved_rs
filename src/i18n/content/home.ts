import homeYaml from '../../content/i18n/home.yaml?raw';
import { loadI18nSection } from '@/i18n/loadI18nSection';
import { homeContentSchema } from './homeContentSchema';

export type { HomeContent } from './homeContentSchema';

// Admin hand-edits ru fields directly in home.yaml; en/sr/es/de filled in
// by scripts/translate-i18n.ts (.github/workflows/translate.yml) — same
// pattern as src/i18n/getI18n.ts/src/i18n/content/faq.ts.
export const getHomeContent = loadI18nSection(homeContentSchema, homeYaml);
