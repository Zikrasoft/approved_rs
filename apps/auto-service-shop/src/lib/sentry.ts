import type { ErrorEvent, NodeOptions } from '@sentry/node';
import { z } from 'zod';

const sentryEnvSchema = z.object({
  SENTRY_DSN: z
    .string()
    .optional()
    .transform((value) => value || undefined)
    .pipe(z.url().optional()),
  NODE_ENV: z.string().optional(),
});

const NO_PERSONAL_DATA = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
} satisfies NodeOptions['dataCollection'];

const withoutPersonalData = ({
  request: _request,
  user: _user,
  breadcrumbs: _breadcrumbs,
  ...event
}: ErrorEvent): ErrorEvent => event;

export const sentryOptions = (
  raw: Record<string, string | undefined>,
): NodeOptions | null => {
  const { SENTRY_DSN, NODE_ENV } = sentryEnvSchema.parse(raw);
  if (!SENTRY_DSN) return null;
  return {
    dsn: SENTRY_DSN,
    environment: NODE_ENV,
    dataCollection: NO_PERSONAL_DATA,
    beforeSend: withoutPersonalData,
  };
};
