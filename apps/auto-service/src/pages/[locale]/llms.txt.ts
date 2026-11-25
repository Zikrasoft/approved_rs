import type { APIRoute } from 'astro';
import { isLocale } from '@/i18n/config';
import { answerCatalogueFile } from '@/utils/cataloguePage';
import {
  generateLlmsTxt,
  llmsCatalogueOf,
  NO_LLMS_CATALOGUE,
} from '@/utils/llmsTxt';

export const prerender = false;

export const GET: APIRoute = (context) => {
  const { locale } = context.params;
  const served = locale && isLocale(locale) ? locale : null;
  return answerCatalogueFile(
    context,
    'text/plain; charset=utf-8',
    async (catalogue) =>
      served && generateLlmsTxt(served, await llmsCatalogueOf(catalogue)),
    async () => served && generateLlmsTxt(served, NO_LLMS_CATALOGUE),
  );
};
