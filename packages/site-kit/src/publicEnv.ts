import { z } from 'zod';

type MessengerEnv = {
  PUBLIC_PHONE_NUMBER: string;
  PUBLIC_WHATSAPP_NUMBER?: string | undefined;
  PUBLIC_VIBER_NUMBER?: string | undefined;
};

const withMessengerFallback = <T extends MessengerEnv>(env: T) => ({
  ...env,
  PUBLIC_WHATSAPP_NUMBER: env.PUBLIC_WHATSAPP_NUMBER ?? env.PUBLIC_PHONE_NUMBER,
  PUBLIC_VIBER_NUMBER: env.PUBLIC_VIBER_NUMBER ?? env.PUBLIC_PHONE_NUMBER,
});

export function createPublicEnvSchema<
  Extra extends z.ZodRawShape = Record<never, never>,
>({ siteDefault, extra }: { siteDefault: string; extra?: Extra }) {
  return z
    .object({
      SITE: z.string().min(1).default(siteDefault),
      PUBLIC_PHONE_NUMBER: z.string().min(1),
      PUBLIC_WHATSAPP_NUMBER: z.string().min(1).optional(),
      PUBLIC_VIBER_NUMBER: z.string().min(1).optional(),
      ...(extra as Extra),
    })
    .transform((env) =>
      withMessengerFallback(env as typeof env & MessengerEnv),
    );
}
