import leadFormYaml from '../../content/i18n/leadForm.yaml?raw';
import { loadI18nSection } from '@/i18n/loadI18nSection';
import { leadFormContentSchema } from './leadFormContentSchema';

export type { LeadFormContent } from './leadFormContentSchema';

// Admin hand-edits ru fields directly in leadForm.yaml; en/sr/es/de filled
// in by scripts/translate-i18n.ts (.github/workflows/translate.yml) — same
// pattern as src/i18n/getI18n.ts and src/i18n/content/faq.ts (see
// getI18n.ts's comment for why this isn't astro:content).
export const getLeadFormContent = loadI18nSection(
  leadFormContentSchema,
  leadFormYaml,
);
