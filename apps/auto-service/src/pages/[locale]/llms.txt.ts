import type { APIRoute } from 'astro';
import { generateLlmsTxt } from '@/utils/llmsTxt';
import { withLocales } from '@/utils/paths';
import { getLocale } from '@/i18n/config';

export const getStaticPaths = () => withLocales([{ params: {} }]);

export const GET: APIRoute = async ({ params }) => {
  const body = await generateLlmsTxt(getLocale(params.locale));
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
