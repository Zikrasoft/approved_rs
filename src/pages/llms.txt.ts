import type { APIRoute } from 'astro';
import { DEFAULT_LOCALE } from '@/i18n/config';
import { generateLlmsTxt } from '@/utils/llmsTxt';

// Crawlers look for the well-known /llms.txt at the root. Serving the
// default-locale content directly here (not redirecting to
// /{locale}/llms.txt) — some AI crawlers don't follow redirects, and this
// is the one well-known URI where that risk isn't worth taking. The
// per-locale copies still exist at their own paths for locale-aware agents.
export const GET: APIRoute = async () => {
  const body = await generateLlmsTxt(DEFAULT_LOCALE);
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
