import type { RemoteQueryFunction } from '@medusajs/framework/types';
import { z } from 'zod';

import { idRowSchema } from './row-schema';

export type Query = Omit<RemoteQueryFunction, symbol>;

export type FieldPrefix = Record<string, '*' | '+'>;

export type SelectOptions = { fieldPrefix?: FieldPrefix };

export type SelectAllOptions = SelectOptions & {
  skipUnfit?: (reason: string) => void;
};

export const QUERY_PAGE = 200;

const UNQUERYABLE = new Set(['fulfillment_status']);

function unwrap(schema: z.ZodType): z.ZodType {
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable) {
    return unwrap(schema.unwrap() as z.ZodType);
  }
  if (schema instanceof z.ZodArray) {
    return unwrap(schema.element as z.ZodType);
  }
  return schema;
}

function hidesObject(schema: z.ZodType): boolean {
  const inner = unwrap(schema);
  if (inner instanceof z.ZodObject || inner instanceof z.ZodLazy) {
    return true;
  }
  if (inner instanceof z.ZodUnion) {
    return (inner.options as z.ZodType[]).some(hidesObject);
  }
  if (inner instanceof z.ZodIntersection) {
    return [inner.def.left, inner.def.right].some((side) =>
      hidesObject(side as z.ZodType),
    );
  }
  if (inner instanceof z.ZodPipe) {
    return [inner.in, inner.out].some((side) => hidesObject(side as z.ZodType));
  }
  const { def } = inner as { def: { innerType?: z.ZodType } };
  return def.innerType ? hidesObject(def.innerType) : false;
}

function walk(
  schema: z.ZodType,
  prefix: FieldPrefix,
  path: string,
  used: Set<string>,
): string[] {
  const inner = unwrap(schema);
  if (!(inner instanceof z.ZodObject)) {
    if (!path) {
      throw new Error('A Medusa read needs an object schema');
    }
    if (hidesObject(inner)) {
      throw new Error(
        `${path} wraps an object fieldsOf cannot walk; spell it as a plain z.object`,
      );
    }
    return [path];
  }
  return Object.entries(inner.shape as Record<string, z.ZodType>).flatMap(
    ([key, child]) => {
      if (UNQUERYABLE.has(key)) {
        throw new Error(
          `${key} is not a queryable property; read what it is derived from instead`,
        );
      }
      const field = path ? `${path}.${key}` : key;
      const mark = prefix[field];
      if (mark) {
        used.add(field);
        return [`${mark}${field}`];
      }
      return walk(child, prefix, field, used);
    },
  );
}

export function fieldsOf(
  schema: z.ZodType,
  prefix: FieldPrefix = {},
): string[] {
  const used = new Set<string>();
  const fields = walk(schema, prefix, '', used);
  const stray = Object.keys(prefix).filter((field) => !used.has(field));
  if (stray.length) {
    throw new Error(`Field prefix names no schema path: ${stray.join(', ')}`);
  }
  return fields;
}

function misfit(entity: string, row: unknown, error: z.ZodError): string {
  const id = idRowSchema.safeParse(row);
  const where = error.issues
    .map((issue) => `${issue.path.join('.') || '(row)'}: ${issue.message}`)
    .join('; ');
  return `${entity} ${id.success ? id.data.id : '(no id)'} does not fit its read: ${where}`;
}

export async function selectOne<S extends z.ZodType>(
  query: Query,
  entity: string,
  schema: S,
  filters: Record<string, unknown>,
  opts: SelectOptions = {},
): Promise<z.output<S> | undefined> {
  const { data } = await query.graph({
    entity,
    fields: fieldsOf(schema, opts.fieldPrefix),
    filters,
  });
  if (!data.length) {
    return undefined;
  }
  const parsed = schema.safeParse(data[0]);
  if (!parsed.success) {
    throw new Error(misfit(entity, data[0], parsed.error));
  }
  return parsed.data;
}

export async function selectAll<S extends z.ZodType>(
  query: Query,
  entity: string,
  schema: S,
  filters?: Record<string, unknown>,
  opts: SelectAllOptions = {},
): Promise<z.output<S>[]> {
  const fields = fieldsOf(schema, opts.fieldPrefix);
  const found: z.output<S>[] = [];
  let skip = 0;
  let page: unknown[];
  do {
    ({ data: page } = await query.graph({
      entity,
      fields,
      ...(filters ? { filters } : {}),
      pagination: { take: QUERY_PAGE, skip, order: { id: 'ASC' } },
    }));
    skip += page.length;
    for (const row of page) {
      const parsed = schema.safeParse(row);
      if (parsed.success) {
        found.push(parsed.data);
      } else if (opts.skipUnfit) {
        opts.skipUnfit(misfit(entity, row, parsed.error));
      } else {
        throw new Error(misfit(entity, row, parsed.error));
      }
    }
  } while (page.length === QUERY_PAGE);
  return found;
}
