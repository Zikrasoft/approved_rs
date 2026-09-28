import type { Env } from '../../lib/env';
import type { BrevoOptions } from './service';

export function brevoOptions(
  env: Pick<Env, 'BREVO_API_KEY' | 'BREVO_FROM_EMAIL' | 'BREVO_FROM_NAME'>,
): BrevoOptions | undefined {
  if (!env.BREVO_API_KEY || !env.BREVO_FROM_EMAIL) {
    return undefined;
  }
  return {
    apiKey: env.BREVO_API_KEY,
    fromEmail: env.BREVO_FROM_EMAIL,
    fromName: env.BREVO_FROM_NAME,
  };
}
