import { toast } from '@medusajs/ui';
import { getI18n } from 'react-i18next';
import { z } from 'zod';

const errorBodySchema = z.object({
  code: z.string().optional(),
  type: z.string().optional(),
});

const translate = (key: string): string | null => {
  const i18n = getI18n();
  return i18n?.exists(key, { ns: 'carlabAdmin' })
    ? i18n.t(key, { ns: 'carlabAdmin' })
    : null;
};

const errorMessage = async (response: Response): Promise<string> => {
  const body = errorBodySchema.safeParse(
    await response.json().catch(() => null),
  );
  const { code, type } = body.success ? body.data : {};
  return (
    (code && translate(`errors.codes.${code}`)) ||
    (type && translate(`errors.types.${type}`)) ||
    translate('errors.unknown') ||
    `${response.status} ${response.statusText}`
  );
};

export const acknowledged = z.unknown().transform(() => true as const);

export const editedBySchema = z.object({
  updated_at: z.string(),
  updated_by_user: z
    .object({ email: z.string(), name: z.string().nullable() })
    .nullable(),
});

export type EditedBy = z.infer<typeof editedBySchema>;

export const adminFetch = async <T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T | null> => {
  try {
    const response = await fetch(path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
    if (!response.ok) {
      toast.error(await errorMessage(response));
      return null;
    }
    const body = schema.safeParse(await response.json());
    if (!body.success) {
      toast.error(translate('errors.unexpectedAnswer') ?? body.error.message);
      return null;
    }
    return body.data;
  } catch {
    toast.error(translate('errors.unreachable') ?? 'errors.unreachable');
    return null;
  }
};
