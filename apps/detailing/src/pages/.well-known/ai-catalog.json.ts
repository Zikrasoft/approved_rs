import type { APIRoute } from 'astro';
import { renderAiCatalog } from '@podbor/i18n';
import { SITE_NAME, SITE_URL } from '@/utils/constants';
import { SUPPORTED_LOCALES } from '@/i18n/config';
import { content } from '@/i18n/content';

export const GET: APIRoute = () =>
  Response.json(
    renderAiCatalog({
      site: { name: SITE_NAME, url: SITE_URL },
      locales: SUPPORTED_LOCALES,
      summary: (locale) => content(locale).home.meta.description,
    }),
  );
