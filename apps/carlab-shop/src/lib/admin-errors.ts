import {
  errorHandler,
  type MedusaErrorHandlerFunction,
} from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';

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
] as const;

export type AdminErrorCode = (typeof ADMIN_ERROR_CODES)[number];

export const adminError = (
  type: (typeof MedusaError.Types)[keyof typeof MedusaError.Types],
  code: AdminErrorCode,
  message: string,
): MedusaError => new MedusaError(type, message, code);

const isAdminErrorCode = (code: unknown): code is AdminErrorCode =>
  ADMIN_ERROR_CODES.some((known) => known === code);

const medusaErrorHandler = errorHandler();

export const keepConflictCodes: MedusaErrorHandlerFunction = (
  error,
  req,
  res,
  next,
) => {
  if (
    MedusaError.isMedusaError(error) &&
    error.type === MedusaError.Types.CONFLICT &&
    isAdminErrorCode(error.code)
  ) {
    res.status(409).json({
      code: error.code,
      type: error.type,
      message: error.message,
    });
    return;
  }
  return medusaErrorHandler(error, req, res, next);
};
