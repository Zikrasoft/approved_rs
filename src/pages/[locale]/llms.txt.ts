import type { APIRoute } from 'astro';
import { generateLlmsTxt } from '@/utils/llmsTxt';
import { withLocales } from '@/utils/paths';
import type { Locale } from '@/i18n/config';

export const getStaticPaths = () => withLocales([{ params: {} }]);

export const GET: APIRoute = async ({ params }) => {
  const body = await generateLlmsTxt(params.locale as Locale);
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
