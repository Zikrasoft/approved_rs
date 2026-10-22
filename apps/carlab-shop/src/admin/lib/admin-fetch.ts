import { toast } from '@medusajs/ui';
import { useSyncExternalStore } from 'react';
import { getI18n } from 'react-i18next';
import { z } from 'zod';

const errorBodySchema = z.object({
  code: z.string().optional(),
  type: z.string().optional(),
  entity: z.string().optional(),
  field: z.string().optional(),
  label: z.string().optional(),
  blocked: z.string().optional(),
  part: z.string().optional(),
  holders: z
    .array(
      z.union([
        z.object({ entity: z.string(), count: z.number() }),
        z.object({ source: z.string(), rows: z.number() }),
      ]),
    )
    .optional(),
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

const lastKey = (path: string) =>
  path
    .split('.')
    .filter((part) => !/^\d+$/.test(part))
    .pop() ?? path;

const fieldName = (path: string) =>
  translate(`errors.fields.${lastKey(path)}`) ?? lastKey(path);

const holderName = (holder: NonNullable<ErrorBody['holders']>[number]) =>
  'entity' in holder
    ? `${translate(`errors.entities.${holder.entity}`) ?? holder.entity}: ${holder.count}`
    : `${translate(`sources.names.${holder.source}`) ?? holder.source}: ${holder.rows}`;

const detailedMessage = ({
  code,
  entity,
  field,
  label,
  blocked,
  holders,
  part,
}: ErrorBody) => {
  if (holders?.length) {
    return translate(
      code === 'IN_USE' ? 'errors.inUseBy' : 'errors.sourceUsedBy',
      {
        holders: holders.map(holderName).join(', '),
      },
    );
  }
  if (blocked) {
    return translate('errors.sourceBlocked', {
      entity: translate(`errors.entities.${blocked}`) ?? blocked,
    });
  }
  if (code === 'ALREADY_EXISTS' && entity) {
    return part
      ? translate(`errors.alreadyExists.${entity}_held`, { part })
      : translate(`errors.alreadyExists.${entity}`);
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
    (code === 'INVALID_FIELD' &&
      translate(`errors.invalidFields.${lastKey(field)}`)) ||
    translate(`errors.codes.${code}`, { field: fieldName(field) })
  );
};

const readError = async (
  response: Response,
): Promise<{ field?: string; message: string }> => {
  const body = errorBodySchema.safeParse(
    await response.json().catch(() => null),
  );
  const details: ErrorBody = body.success ? body.data : {};
  const { code, type, field } = details;
  return {
    field,
    message:
      detailedMessage(details) ||
      (code && translate(`errors.codes.${code}`)) ||
      (type && translate(`errors.types.${type}`)) ||
      translate('errors.unknown') ||
      `${response.status} ${response.statusText}`,
  };
};

export type FieldErrorHandler = (field: string, message: string) => void;

export const acknowledged = z.unknown().transform(() => true as const);

export const editedBySchema = z.object({
  updated_at: z.string(),
  updated_by_user: z
    .object({ email: z.string(), name: z.string().nullable() })
    .nullable(),
});

export type EditedBy = z.infer<typeof editedBySchema>;

const pendingWrites = new Set<string>();
const listeners = new Set<() => void>();

const setPending = (key: string, pending: boolean) => {
  if (pending) {
    pendingWrites.add(key);
  } else {
    pendingWrites.delete(key);
  }
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useWriting = () =>
  useSyncExternalStore(subscribe, () => pendingWrites.size > 0);

export const adminFetch = async <T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
  onFieldError?: FieldErrorHandler,
): Promise<T | null> => {
  const method = init?.method ?? 'GET';
  if (method === 'GET') {
    return request(path, schema, init, onFieldError);
  }
  const key = `${method} ${path} ${String(init?.body ?? '')}`;
  if (pendingWrites.has(key)) {
    return null;
  }
  setPending(key, true);
  try {
    return await request(path, schema, init, onFieldError);
  } finally {
    setPending(key, false);
  }
};

const request = async <T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
  onFieldError?: FieldErrorHandler,
): Promise<T | null> => {
  try {
    const response = await fetch(path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
    if (response.status === 401) {
      toast.error(translate('errors.types.unauthorized') ?? 'unauthorized');
      window.location.assign('/app/login');
      return null;
    }
    if (!response.ok) {
      const { field, message } = await readError(response);
      toast.error(message);
      if (field) onFieldError?.(field, message);
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
