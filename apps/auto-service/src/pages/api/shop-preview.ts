export const prerender = false;

import type { APIRoute } from 'astro';
import { PRIMARY_LOCALE } from '@/i18n/config';
import { previewTokenMatches } from '@/utils/catalogueEnv';
import { PathBuilder } from '@/utils/paths';
import { PREVIEW_COOKIE } from '@/utils/shopPreview';

const YEAR_SECONDS = 365 * 24 * 60 * 60;

export const GET: APIRoute = ({ url, cookies, redirect }) => {
  const token = url.searchParams.get('token') ?? '';
  if (!token) {
    cookies.delete(PREVIEW_COOKIE, { path: '/' });
  } else if (previewTokenMatches(token)) {
    cookies.set(PREVIEW_COOKIE, token, {
      path: '/',
      maxAge: YEAR_SECONDS,
      sameSite: 'lax',
      secure: url.protocol === 'https:',
    });
  } else {
    return new Response(null, { status: 403 });
  }
  return redirect(PathBuilder.parts(PRIMARY_LOCALE), 302);
};
