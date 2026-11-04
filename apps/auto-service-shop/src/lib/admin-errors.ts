import {
  errorHandler,
  getHttpResponseFromError,
  type MedusaErrorHandlerFunction,
  type MedusaNextFunction,
  type MedusaRequest,
  type MedusaResponse,
} from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import type { z } from '@medusajs/framework/zod';
import { captureException } from '@sentry/node';

import {
  ADMIN_ERROR_CODES,
  adminError,
  alreadyExists,
  type AdminErrorCode,
  type Details,
  type ErrorType,
} from '../modules/_shared/admin-error';
import { causeOf, logEvent } from './log-event';
import { noteFailure, routeOf } from './request-log';

type DetailedError = MedusaError & { details?: Details };

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

const MAX_ERROR_MESSAGE_LENGTH = 300;

const clipMessage = (error: unknown) => {
  if (
    MedusaError.isMedusaError(error) &&
    error.message.length > MAX_ERROR_MESSAGE_LENGTH
  ) {
    error.message = `${error.message.slice(0, MAX_ERROR_MESSAGE_LENGTH)}…`;
  }
  return error;
};

export const keepAdminCodes: MedusaErrorHandlerFunction = (
  error,
  req,
  res,
  next,
) => {
  const known = coded(error);
  const reason =
    known?.code ??
    (MedusaError.isMedusaError(error) ? error.type : 'unexpected');
  noteFailure(req, reason);
  if (!known) {
    const status = getHttpResponseFromError(error).statusCode;
    if (status >= 500) {
      captureException(error);
      logEvent(
        'store.error',
        {
          outcome: 'failed',
          reason,
          route: routeOf(req),
          status,
          cause: causeOf(error),
        },
        req.requestId ?? null,
      );
    }
    return medusaErrorHandler(clipMessage(error), req, res, next);
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
  const required =
    field && issue.code !== 'custom' && isBlank(valueAt(body, issue.path));
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
