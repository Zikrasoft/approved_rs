// Vercel Edge Middleware — runs before any static file is served.
// Redirects homepage visitors to their country's service page.
// All other routes pass through unchanged.

export const config = {
  matcher: '/',
};

// ISO 3166-1 alpha-2 → site country code
const GEO_MAP: Record<string, string> = {
  DE: 'de',
  RS: 'rs',
  ES: 'es',
};

export default function middleware(req: Request): Response | undefined {
  const country = req.headers.get('x-vercel-ip-country') ?? '';
  const siteCountry = GEO_MAP[country.toUpperCase()];

  if (siteCountry) {
    const origin = new URL(req.url).origin;
    // 307 = temporary redirect (browsers don't cache it, so geo can change)
    return Response.redirect(new URL(`/${siteCountry}/autopodbor/`, origin), 307);
  }
}
