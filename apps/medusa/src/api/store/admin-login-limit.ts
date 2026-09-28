import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { z } from 'zod';

import { type Bucket, clientKey, limit } from './rate-limit';

const PASSWORD_PROVIDER = 'emailpass';
const MAX_ATTEMPTS_PER_IP = 10;
const MAX_ATTEMPTS_PER_ACCOUNT = 10;
const MAX_REGISTRATIONS_PER_IP = 3;
const MAX_RESETS_PER_IP = 3;

const loginBodySchema = z.object({ email: z.string().trim().min(1) });

type Middleware = ReturnType<typeof limit>;

const onlyPasswordProvider =
  (limiter: Middleware): Middleware =>
  (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) =>
    String(req.params.auth_provider).toLowerCase() === PASSWORD_PROVIDER
      ? limiter(req, res, next)
      : next();

export const limitPasswordLogins = onlyPasswordProvider(
  limit((req) => {
    const buckets: Bucket[] = [[clientKey(req, 'login'), MAX_ATTEMPTS_PER_IP]];
    const body = loginBodySchema.safeParse(req.body);
    if (body.success) {
      buckets.push([
        `login:email:${body.data.email.toLowerCase().slice(0, 254)}`,
        MAX_ATTEMPTS_PER_ACCOUNT,
      ]);
    }
    return buckets;
  }, 'Слишком много попыток входа. Попробуйте через минуту.'),
);

export const limitIdentityRegistrations = onlyPasswordProvider(
  limit(
    (req) => [[clientKey(req, 'auth-register'), MAX_REGISTRATIONS_PER_IP]],
    'Слишком много обращений. Попробуйте через минуту.',
  ),
);

export const limitPasswordResets = onlyPasswordProvider(
  limit(
    (req) => [[clientKey(req, 'auth-reset'), MAX_RESETS_PER_IP]],
    'Слишком много обращений. Попробуйте через минуту.',
  ),
);
