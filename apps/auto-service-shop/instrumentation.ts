import { init } from '@sentry/node';

import { sentryOptions } from './src/lib/sentry';

export function register() {
  const options = sentryOptions(process.env);
  if (options) init(options);
}
