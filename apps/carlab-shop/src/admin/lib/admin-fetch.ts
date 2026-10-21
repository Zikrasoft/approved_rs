import { toast } from '@medusajs/ui';
import { getI18n } from 'react-i18next';
import { z } from 'zod';

const errorBodySchema = z.object({
  code: z.string().optional(),
  type: z.string().optional(),
  entity: z.string().optional(),
  field: z.string().optional(),
  label: z.string().optional(),
});

type ErrorBody = z.infer<typeof errorBodySchema>;

const translate = (
  key: string,
  options: Record<string, string> = {},
): string | null => {
  const i18n = getI18n();
  return i18n?.exists(key, { ns: 'carlabAdmin' })
    ? i18n.t(key, { ns: 'carlabAdmin', ...options })
    : null;
};

const fieldName = (path: string) => {
  const key =
    path
      .split('.')
      .filter((part) => !/^\d+$/.test(part))
      .pop() ?? path;
  return translate(`errors.fields.${key}`) ?? key;
};

const detailedMessage = ({ code, entity, field, label }: ErrorBody) => {
  if (code === 'ALREADY_EXISTS' && entity) {
    return translate(`errors.alreadyExists.${entity}`);
  }
  if (code === 'INVALID_ATTRIBUTES' && label) {
    return translate('errors.attributeLabel', { label });
  }
  if (code !== 'INVALID_FIELD' && code !== 'FIELD_REQUIRED') {
    return null;
  }
  if (!field) {
    return translate('errors.types.invalid_data');
  }
  return (
    (code === 'INVALID_FIELD' && translate(`errors.invalidFields.${field}`)) ||
    translate(`errors.codes.${code}`, { field: fieldName(field) })
  );
};

const errorMessage = async (response: Response): Promise<string> => {
  const body = errorBodySchema.safeParse(
    await response.json().catch(() => null),
  );
  const details: ErrorBody = body.success ? body.data : {};
  const { code, type } = details;
  return (
    detailedMessage(details) ||
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
