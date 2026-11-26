import type { APIRoute } from 'astro';
import { isLocale } from '@/i18n/config';
import { answerLlmsTxt } from '@/utils/llmsTxt';

export const prerender = false;

export const GET: APIRoute = ({ params, request, url }) =>
  answerLlmsTxt(
    { request, url },
    params.locale && isLocale(params.locale) ? params.locale : null,
  );
