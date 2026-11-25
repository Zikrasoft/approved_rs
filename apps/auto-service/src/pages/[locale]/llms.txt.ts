import type { APIRoute } from 'astro';
import { isLocale } from '@/i18n/config';
import { answerCatalogueFile } from '@/utils/cataloguePage';
import { generateLlmsTxt, llmsCatalogueOf } from '@/utils/llmsTxt';

export const prerender = false;

export const GET: APIRoute = (context) =>
  answerCatalogueFile(
    context,
    'text/plain; charset=utf-8',
    async (catalogue) => {
      const { locale } = context.params;
      return locale && isLocale(locale)
        ? generateLlmsTxt(locale, await llmsCatalogueOf(catalogue))
        : null;
    },
  );
