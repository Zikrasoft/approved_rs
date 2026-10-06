import { z } from 'zod';

type MessengerEnv = {
  PUBLIC_PHONE_NUMBER: string;
  PUBLIC_WHATSAPP_NUMBER?: string | undefined;
  PUBLIC_VIBER_NUMBER?: string | undefined;
};

export const withMessengerFallback = <T extends MessengerEnv>(env: T) => ({
  ...env,
  PUBLIC_WHATSAPP_NUMBER: env.PUBLIC_WHATSAPP_NUMBER ?? env.PUBLIC_PHONE_NUMBER,
  PUBLIC_VIBER_NUMBER: env.PUBLIC_VIBER_NUMBER ?? env.PUBLIC_PHONE_NUMBER,
});

export function createPublicEnvSchema({
  siteDefault,
}: {
  siteDefault: string;
}) {
  return z.object({
    SITE: z.string().min(1).default(siteDefault),
    PUBLIC_PHONE_NUMBER: z.string().min(1),
    PUBLIC_WHATSAPP_NUMBER: z.string().min(1).optional(),
    PUBLIC_VIBER_NUMBER: z.string().min(1).optional(),
  });
}
