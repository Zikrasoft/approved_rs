import {
  GOOGLE_TAG_ORIGIN,
  META_PIXEL_ORIGIN,
  YANDEX_METRIKA_ORIGIN,
} from './analyticsHosts.ts';

const directives: Record<string, string[]> = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'",
    GOOGLE_TAG_ORIGIN,
    YANDEX_METRIKA_ORIGIN,
    'https://mc.yandex.com',
    'https://yastatic.net',
    META_PIXEL_ORIGIN,
    'https://www.googleadservices.com',
    'https://googleads.g.doubleclick.net',
  ],
  'connect-src': [
    "'self'",
    'https://*.google-analytics.com',
    'https://*.analytics.google.com',
    GOOGLE_TAG_ORIGIN,
    YANDEX_METRIKA_ORIGIN,
    'https://mc.yandex.com',
    'wss://mc.yandex.ru',
    'wss://mc.yandex.com',
    'https://www.facebook.com',
    META_PIXEL_ORIGIN,
    'https://*.doubleclick.net',
    'https://www.google.com',
    'https://www.googleadservices.com',
  ],
  'img-src': ["'self'", 'data:', 'blob:', 'https:'],
  'style-src': ["'self'", "'unsafe-inline'"],
  'font-src': ["'self'", 'data:'],
  'frame-src': [
    'https://www.google.com',
    YANDEX_METRIKA_ORIGIN,
    'https://mc.yandex.com',
    'https://td.doubleclick.net',
    GOOGLE_TAG_ORIGIN,
    'blob:',
  ],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
};

export const CONTENT_SECURITY_POLICY = Object.entries(directives)
  .map(([name, sources]) => [name, ...sources].join(' '))
  .join('; ');

export const SECURITY_HEADERS = [
  {
    source: '/(.*)',
    headers: [
      { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
      {
        key: 'Content-Security-Policy-Report-Only',
        value: CONTENT_SECURITY_POLICY,
      },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()',
      },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains',
      },
    ],
  },
];
