import {
  errorHandler,
  type MedusaErrorHandlerFunction,
  type MedusaNextFunction,
  type MedusaRequest,
  type MedusaResponse,
} from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import type { z } from '@medusajs/framework/zod';

export const ADMIN_ERROR_CODES = [
  'IN_USE',
  'REQUIREMENT_IN_USE',
  'SOURCE_IN_USE',
  'UNKNOWN_BRAND',
  'DUPLICATE_FITMENT',
  'REPLACEMENT_CYCLE',
  'INVALID_ATTRIBUTES',
  'INVALID_REQUIREMENT',
  'DEFINITION_BREAKS_PARTS',
  'PUBLISH_RUNNING',
  'ALREADY_EXISTS',
  'FIELD_REQUIRED',
  'INVALID_FIELD',
  'LAST_IDENTIFIER',
  'MANUAL_SOURCE',
  'INVALID_IMAGE',
  'IMAGE_TOO_LARGE',
] as const;

export type AdminErrorCode = (typeof ADMIN_ERROR_CODES)[number];

type ErrorType = (typeof MedusaError.Types)[keyof typeof MedusaError.Types];

type Details = Record<string, unknown>;

type DetailedError = MedusaError & { details?: Details };

export const adminError = (
  type: ErrorType,
  code: AdminErrorCode,
  message: string,
  details: Details = {},
): MedusaError =>
  Object.assign(new MedusaError(type, message, code), { details });

const isAdminErrorCode = (code: unknown): code is AdminErrorCode =>
  ADMIN_ERROR_CODES.some((known) => known === code);

const STATUS: Partial<Record<ErrorType, number>> = {
  [MedusaError.Types.CONFLICT]: 409,
  [MedusaError.Types.NOT_FOUND]: 404,
};

const DUPLICATE_ROW = /^(.+) with .+, already exists\.$/;

const duplicateEntity = (error: MedusaError): string | null => {
  const match =
    error.type === MedusaError.Types.INVALID_DATA &&
    DUPLICATE_ROW.exec(error.message);
  return match ? match[1].toLowerCase().replaceAll(' ', '_') : null;
};

export const alreadyExists = (entity: string, message: string) =>
  adminError(MedusaError.Types.CONFLICT, 'ALREADY_EXISTS', message, {
    entity,
  });

const coded = (error: unknown): DetailedError | null => {
  if (!MedusaError.isMedusaError(error)) {
    return null;
  }
  if (isAdminErrorCode(error.code)) {
    return error;
  }
  const entity = duplicateEntity(error);
  return entity
    ? alreadyExists(
        entity,
        `This ${entity.replaceAll('_', ' ')} already exists.`,
      )
    : null;
};

const medusaErrorHandler = errorHandler();

export const keepAdminCodes: MedusaErrorHandlerFunction = (
  error,
  req,
  res,
  next,
) => {
  const known = coded(error);
  if (!known) {
    return medusaErrorHandler(error, req, res, next);
  }
  res.status(STATUS[known.type as ErrorType] ?? 400).json({
    ...known.details,
    code: known.code,
    type: known.type,
    message: known.message,
  });
};

const valueAt = (body: unknown, path: PropertyKey[]): unknown =>
  path.reduce<unknown>(
    (value, key) =>
      value && typeof value === 'object'
        ? (value as Record<PropertyKey, unknown>)[key]
        : undefined,
    body,
  );

const isBlank = (value: unknown) =>
  value === undefined ||
  value === null ||
  (typeof value === 'string' && !value.trim());

export async function parseAdminBody<Schema extends z.ZodType>(
  schema: Schema,
  body: unknown,
): Promise<z.output<Schema>> {
  const result = await schema.safeParseAsync(body ?? {});
  if (result.success) {
    return result.data;
  }
  const { issues } = result.error;
  const issue =
    issues.find(({ code }) => code === 'unrecognized_keys') ?? issues[0];
  const field = issue.path.join('.');
  const required = field && isBlank(valueAt(body, issue.path));
  throw adminError(
    MedusaError.Types.INVALID_DATA,
    required ? 'FIELD_REQUIRED' : 'INVALID_FIELD',
    `${field || 'body'}: ${issue.message}`,
    field ? { field } : {},
  );
}

export const validateAdminBody =
  (schema: z.ZodType) =>
  async (
    req: MedusaRequest,
    _res: MedusaResponse,
    next: MedusaNextFunction,
  ): Promise<void> => {
    try {
      req.validatedBody = await parseAdminBody(schema, req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
