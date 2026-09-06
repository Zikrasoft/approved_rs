import faqYaml from '../../content/i18n/faq.yaml?raw';
import { loadI18nSection } from '@/i18n/loadI18nSection';
import { faqContentSchema } from './faqContentSchema';

export type { FaqItem } from './faqContentSchema';

// Admin hand-edits ru fields directly in faq.yaml; en/sr/es/de filled in by
// scripts/translate-i18n.ts (.github/workflows/translate.yml) — same
// "`?raw`-inlined so it survives Vercel's serverless bundling, stay
// synchronous" pattern as src/i18n/getI18n.ts. See that file's comment for
// why this isn't astro:content (getFaq() is called from 10+ .astro
// components without awaiting, and faq.test.ts runs under plain vitest
// with no astro:content runtime available).
export const getFaq = loadI18nSection(faqContentSchema, faqYaml);
