import { writeFileSync } from 'node:fs';
import { SECURITY_HEADERS } from '../../packages/site-kit/src/securityHeaders.ts';

const fields = SECURITY_HEADERS.flatMap(({ source, headers }) => {
  if (source !== '/(.*)')
    throw new Error(`Only site-wide headers map onto Caddy, not ${source}`);
  return headers.map(({ key, value }) => `\t${key} ${JSON.stringify(value)}`);
});

writeFileSync(
  new URL('caddy/security-headers.caddy', import.meta.url),
  ['header {', '\tdefer', ...fields, '\t-Server', '}', ''].join('\n'),
);
