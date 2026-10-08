import type { RemoteQueryFunction } from '@medusajs/framework/types';
import { z } from 'zod';

export type Query = Omit<RemoteQueryFunction, symbol>;

export type FieldPrefix = Record<string, '*' | '+'>;

export type SelectOptions = { fieldPrefix?: FieldPrefix };

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

const idSchema = z.object({ id: z.string() });

function parseRow<S extends z.ZodType>(
  entity: string,
  schema: S,
  row: unknown,
): z.output<S> {
  const parsed = schema.safeParse(row);
  if (parsed.success) {
    return parsed.data;
  }
  const id = idSchema.safeParse(row);
  const where = parsed.error.issues
    .map((issue) => `${issue.path.join('.') || '(row)'}: ${issue.message}`)
    .join('; ');
  throw new Error(
    `${entity} ${id.success ? id.data.id : '(no id)'} does not fit its read: ${where}`,
  );
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
  return data.length ? parseRow(entity, schema, data[0]) : undefined;
}

export async function selectAll<S extends z.ZodType>(
  query: Query,
  entity: string,
  schema: S,
  filters?: Record<string, unknown>,
  opts: SelectOptions = {},
): Promise<z.output<S>[]> {
  const fields = fieldsOf(schema, opts.fieldPrefix);
  const found: z.output<S>[] = [];
  let page: unknown[];
  do {
    ({ data: page } = await query.graph({
      entity,
      fields,
      ...(filters ? { filters } : {}),
      pagination: {
        take: QUERY_PAGE,
        skip: found.length,
        order: { id: 'ASC' },
      },
    }));
    found.push(...page.map((row) => parseRow(entity, schema, row)));
  } while (page.length === QUERY_PAGE);
  return found;
}
