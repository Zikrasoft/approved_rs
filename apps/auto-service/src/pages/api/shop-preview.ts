export const prerender = false;

import type { APIRoute } from 'astro';
import { PRIMARY_LOCALE } from '@/i18n/config';
import { previewTokenMatches } from '@/utils/catalogueEnv';
import { PathBuilder } from '@/utils/paths';
import { PREVIEW_COOKIE, PREVIEW_FLAG_COOKIE } from '@/utils/shopPreview';

const YEAR_SECONDS = 365 * 24 * 60 * 60;

export const GET: APIRoute = ({ url, cookies, redirect }) => {
  const token = url.searchParams.get('token') ?? '';
  if (!token) {
    cookies.delete(PREVIEW_COOKIE, { path: '/' });
    cookies.delete(PREVIEW_FLAG_COOKIE, { path: '/' });
  } else if (previewTokenMatches(token)) {
    const remembered = {
      path: '/',
      maxAge: YEAR_SECONDS,
      sameSite: 'lax',
      secure: url.protocol === 'https:',
    } as const;
    cookies.set(PREVIEW_COOKIE, token, { ...remembered, httpOnly: true });
    cookies.set(PREVIEW_FLAG_COOKIE, '1', remembered);
  } else {
    return new Response(null, { status: 403 });
  }
  return redirect(PathBuilder.parts(PRIMARY_LOCALE), 302);
};
