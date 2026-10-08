import { z } from 'zod';

export const nullableText = z.string().nullish();

export const metadataField = z.record(z.string(), z.unknown()).nullish();

export const typeValueField = z.object({ value: nullableText }).nullish();

export const idRowSchema = z.object({ id: z.string() });
