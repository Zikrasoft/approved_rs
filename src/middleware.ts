import { defineMiddleware } from 'astro:middleware';

const COUNTRY_MAP: Record<string, string> = {
  DE: 'de',
  RS: 'rs',
  ES: 'es',
  ME: 'de', // Черногория → пока на de
  KZ: 'de',
  KG: 'de',
};

export const onRequest = defineMiddleware(async (context, next) => {
  if (context.url.pathname !== '/') return next();

  const countryCode = context.request.headers.get('x-vercel-ip-country') ?? '';
  const mapped = COUNTRY_MAP[countryCode.toUpperCase()];

  if (mapped) {
    return context.redirect(`/${mapped}/autopodbor/`, 302);
  }

  return next();
});
