import type { APIRoute } from 'astro';
import { PRIMARY_LOCALE } from '@/i18n/config';
import { answerLlmsTxt } from '@/utils/llmsTxt';

export const prerender = false;

export const GET: APIRoute = (context) =>
  answerLlmsTxt(context, PRIMARY_LOCALE);
