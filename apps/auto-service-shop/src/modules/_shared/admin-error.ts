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
  'CATALOGUE_BUSY',
  'ALREADY_EXISTS',
  'FIELD_REQUIRED',
  'INVALID_FIELD',
  'LAST_IDENTIFIER',
  'MANUAL_SOURCE',
  'INVALID_IMAGE',
  'IMAGE_TOO_LARGE',
  'REQUIREMENT_CONFLICT',
  'INVALID_QUOTE',
  'QUOTE_TOO_LARGE',
  'QUOTE_UNREADABLE',
  'ARTICLE_UNREADABLE',
  'AI_NOT_CONFIGURED',
  'INVALID_BRAND',
  'SLUG_TAKEN',
  'SLUG_RESERVED',
  'NO_SLUG',
  'MERGE_INTO_SELF',
] as const;

export type AdminErrorCode = (typeof ADMIN_ERROR_CODES)[number];

export type ErrorType =
  (typeof MedusaError.Types)[keyof typeof MedusaError.Types];

export type Details = Record<string, unknown>;

export const adminError = (
  type: ErrorType,
  code: AdminErrorCode,
  message: string,
  details: Details = {},
): MedusaError =>
  Object.assign(new MedusaError(type, message, code), { details });

export const alreadyExists = (
  entity: string,
  message: string,
  details: Details = {},
) =>
  adminError(MedusaError.Types.CONFLICT, 'ALREADY_EXISTS', message, {
    ...details,
    entity,
  });
