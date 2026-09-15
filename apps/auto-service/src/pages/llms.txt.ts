import type { APIRoute } from 'astro';
import { PRIMARY_LOCALE } from '@/i18n/config';
import { generateLlmsTxt } from '@/utils/llmsTxt';

export const GET: APIRoute = async () => {
  const body = await generateLlmsTxt(PRIMARY_LOCALE);
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
