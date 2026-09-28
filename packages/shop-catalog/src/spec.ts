import { z } from 'zod';
import type { FitmentEntry } from './fitment.ts';
import {
  productType,
  type Field,
  type ProductTypeDef,
  type Spec,
} from './registry.ts';

const code = z.string().trim().min(1).max(80);

function fieldSchema(field: Field): z.ZodType {
  switch (field.kind) {
    case 'enum':
      return z.enum(
        field.values.map((option) => option.value) as [string, ...string[]],
      );
    case 'number': {
      let schema = z.number();
      if (field.integer) schema = schema.int();
      if (field.min !== undefined) schema = schema.min(field.min);
      if (field.max !== undefined) schema = schema.max(field.max);
      return schema;
    }
    case 'boolean':
      return z.boolean();
    case 'codes':
      return field.multiple ? z.array(code).min(1).max(50) : code;
  }
}

export function specSchema(type: ProductTypeDef) {
  return z
    .object(
      Object.fromEntries(
        type.fields.map((field) => [
          field.key,
          field.required ? fieldSchema(field) : fieldSchema(field).optional(),
        ]),
      ),
    )
    .strict();
}

const year = z.number().int().min(1950).max(2100);

export const fitmentEntrySchema = z
  .object({
    make: z.string().trim().min(1).max(60),
    model: z.string().trim().min(1).max(60),
    yearFrom: year,
    yearTo: year,
  })
  .strict()
  .refine((entry) => entry.yearTo >= entry.yearFrom, {
    message: 'yearTo must not be earlier than yearFrom',
    path: ['yearTo'],
  });

export const fitmentSchema = z.array(fitmentEntrySchema).max(500);

const metadataSchema = z.looseObject({
  spec: z.unknown().optional(),
  fitment: z.unknown().optional(),
});

export type AttributesResult =
  | { ok: true; type: ProductTypeDef; spec: Spec; fitment: FitmentEntry[] }
  | { ok: false; error: string };

export function parseAttributes(
  typeKey: string | null | undefined,
  metadata: unknown,
): AttributesResult {
  const type = typeKey ? productType(typeKey) : undefined;
  if (!type) {
    return { ok: false, error: `unknown product type: ${typeKey || '(none)'}` };
  }
  const meta = metadataSchema.safeParse(metadata ?? {});
  if (!meta.success) return { ok: false, error: z.prettifyError(meta.error) };
  const spec = specSchema(type).safeParse(meta.data.spec ?? {});
  if (!spec.success) return { ok: false, error: z.prettifyError(spec.error) };
  const fitment = fitmentSchema.safeParse(meta.data.fitment ?? []);
  if (!fitment.success)
    return { ok: false, error: z.prettifyError(fitment.error) };
  if (type.fitment === 'required' && fitment.data.length === 0) {
    return { ok: false, error: `${type.key} requires fitment` };
  }
  if (type.fitment === 'none' && fitment.data.length > 0) {
    return { ok: false, error: `${type.key} takes no fitment` };
  }
  return { ok: true, type, spec: spec.data as Spec, fitment: fitment.data };
}
