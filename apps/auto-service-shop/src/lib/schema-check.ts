import type { Knex } from '@medusajs/framework/mikro-orm/knex';
import { z } from 'zod';

import catalogSnapshot from '../modules/catalog/migrations/.snapshot-catalog.json';
import demandSnapshot from '../modules/demand/migrations/.snapshot-demand.json';
import publishSnapshot from '../modules/publish/migrations/.snapshot-publish.json';
import supplierSnapshot from '../modules/supplier/migrations/.snapshot-supplier.json';
import vinLookupSnapshot from '../modules/vin-lookup/migrations/.snapshot-vin-lookup.json';
import { FAILURE_REASONS, PAGE_STATUSES } from './crawler/store';

const tableSchema = z.object({
  name: z.string(),
  columns: z.record(
    z.string(),
    z.object({ name: z.string(), type: z.string(), nullable: z.boolean() }),
  ),
  indexes: z.array(z.object({ keyName: z.string() })),
  checks: z.array(z.object({ name: z.string() })),
  foreignKeys: z.record(z.string(), z.object({ constraintName: z.string() })),
});

export type SchemaTable = z.infer<typeof tableSchema>;

const snapshotSchema = z.object({ tables: z.array(tableSchema) });

export const SNAPSHOT_TABLES: SchemaTable[] = [
  catalogSnapshot,
  supplierSnapshot,
  publishSnapshot,
  vinLookupSnapshot,
  demandSnapshot,
].flatMap((snapshot) => snapshotSchema.parse(snapshot).tables);

const column = (name: string, type: string, nullable = false) => ({
  name,
  type,
  nullable,
});

const handWrittenTable = (
  name: string,
  columns: ReturnType<typeof column>[],
  indexes: string[],
): SchemaTable => ({
  name,
  columns: Object.fromEntries(columns.map((entry) => [entry.name, entry])),
  indexes: indexes.map((keyName) => ({ keyName })),
  checks: [],
  foreignKeys: {},
});

const CRAWL_TABLES: SchemaTable[] = [
  handWrittenTable(
    'crawl_run',
    [
      column('site', 'text'),
      column('status', 'text'),
      column('paused_reason', 'text', true),
      column('seeded', 'boolean'),
      column('pages_left', 'integer', true),
      column('queued_at', 'timestamptz', true),
      column('started_at', 'timestamptz'),
      column('heartbeat_at', 'timestamptz', true),
      column('finished_at', 'timestamptz', true),
    ],
    ['crawl_run_pkey'],
  ),
  handWrittenTable(
    'crawl_page',
    [
      column('site', 'text'),
      column('url', 'text'),
      column('category_hint', 'text', true),
      column('status', 'text'),
      column('attempts', 'integer'),
      column('next_attempt_at', 'timestamptz'),
      column('http_status', 'integer', true),
      column('error', 'text', true),
      column('etag', 'text', true),
      column('last_modified', 'text', true),
      column('fetched_at', 'timestamptz', true),
      column('body_key', 'text', true),
    ],
    ['crawl_page_pkey', 'IDX_crawl_page_due'],
  ),
];

export const SCHEMA_TABLES = [...SNAPSHOT_TABLES, ...CRAWL_TABLES];

const UDT_OF: Record<string, string> = {
  integer: 'int4',
  real: 'float4',
  boolean: 'bool',
  'text[]': '_text',
};

export const HAND_WRITTEN_TYPES: Record<string, string> = {
  'supplier.markup_percentage': 'numeric(5,2)',
  'fitment.production_from': 'date',
  'fitment.production_to': 'date',
  'requirement.min': 'numeric',
  'requirement.max': 'numeric',
};

const UNIQUE_ACROSS_NULLS =
  /^CREATE UNIQUE INDEX .* NULLS NOT DISTINCT WHERE \(deleted_at IS NULL\)$/;
const ON_NAME_KEY =
  /^CREATE UNIQUE INDEX .*upper\(regexp_replace\(btrim\(NORMALIZE\(name, NFKC\)\)/;
const OVER_TOMBSTONES_TOO = /^CREATE INDEX .* USING btree \([^)]*\)$/;
const TRIGRAM = /USING gin .*gin_trgm_ops/;

export const HAND_WRITTEN_INDEXES: Record<string, RegExp> = {
  IDX_fitment_identity_unique: UNIQUE_ACROSS_NULLS,
  IDX_requirement_owner_field_unique: UNIQUE_ACROSS_NULLS,
  IDX_brand_name_key_unique: ON_NAME_KEY,
  IDX_make_name_key_unique: ON_NAME_KEY,
  IDX_category_name_key_unique: ON_NAME_KEY,
  IDX_series_make_id_name_key_unique: ON_NAME_KEY,
  IDX_fitment_part_vehicle_all: OVER_TOMBSTONES_TOO,
  IDX_fitment_vehicle_all: OVER_TOMBSTONES_TOO,
  IDX_vehicle_model_name_trigram: TRIGRAM,
  IDX_part_name_trigram: TRIGRAM,
  IDX_part_identifier_normalized_value_trigram: TRIGRAM,
  IDX_part_description_hash: /USING hash \(description\)$/,
  IDX_order_created_at: /\(created_at\) WHERE \(deleted_at IS NULL\)$/,
  IDX_order_updated_at: /\(updated_at\) WHERE \(deleted_at IS NULL\)$/,
  IDX_crawl_page_due:
    /\(site, next_attempt_at\) WHERE \(status = 'queued'::text\)$/,
};

const oneOf = (column: string, values: readonly string[]) =>
  new RegExp(
    `^CHECK \\(\\(${column} = ANY \\(ARRAY\\[${values.map((value) => `'${value}'::text`).join(', ')}\\]\\)\\)\\)$`,
  );

export const HAND_WRITTEN_CONSTRAINTS: Record<string, RegExp> = {
  crawl_page_status: oneOf('status', PAGE_STATUSES),
  crawl_page_error: oneOf('error', FAILURE_REASONS),
  supplier_markup_percentage:
    /^CHECK \(\(markup_percentage >= \(0\)::numeric\)\)$/,
  part_category_id_foreign: / ON DELETE RESTRICT$/,
};

const signature = (type: string, nullable: boolean) =>
  `${type} ${nullable ? 'null' : 'not null'}`;

const expectedUdt = (table: string, name: string, type: string) =>
  HAND_WRITTEN_TYPES[`${table}.${name}`]?.replace(/\(.*\)$/, '') ??
  UDT_OF[type] ??
  type;

const missing = (expected: string[], actual: string[]) =>
  expected.filter((name) => !actual.includes(name));

async function tableProblems(pg: Knex, table: SchemaTable): Promise<string[]> {
  const { rows: columns } = await pg.raw(
    `select column_name, udt_name, is_nullable from information_schema.columns
     where table_schema = 'public' and table_name = ?`,
    [table.name],
  );
  if (!columns.length) return [`${table.name}: table is missing`];
  const { rows: indexes } = await pg.raw(
    `select indexname from pg_indexes where schemaname = 'public' and tablename = ?`,
    [table.name],
  );
  const { rows: constraints } = await pg.raw(
    'select conname from pg_constraint where conrelid = ?::regclass',
    [table.name],
  );
  const actual = new Map<string, string>(
    columns.map((row: Record<string, string>) => [
      row.column_name,
      signature(row.udt_name, row.is_nullable === 'YES'),
    ]),
  );
  const expected = new Map(
    Object.values(table.columns).map(({ name, type, nullable }) => [
      name,
      signature(expectedUdt(table.name, name, type), nullable),
    ]),
  );
  return [
    ...[...expected]
      .filter(([name, want]) => actual.get(name) !== want)
      .map(
        ([name, want]) =>
          `${table.name}.${name}: expected ${want}, found ${actual.get(name) ?? 'nothing'}`,
      ),
    ...[...actual.keys()]
      .filter((name) => !expected.has(name))
      .map((name) => `${table.name}.${name}: column not in the migrations`),
    ...missing(
      table.indexes.map(({ keyName }) => keyName),
      indexes.map((row: { indexname: string }) => row.indexname),
    ).map((name) => `${table.name}: index ${name} is missing`),
    ...missing(
      [
        ...table.checks.map(({ name }) => name),
        ...Object.values(table.foreignKeys).map(
          ({ constraintName }) => constraintName,
        ),
      ],
      constraints.map((row: { conname: string }) => row.conname),
    ).map((name) => `${table.name}: constraint ${name} is missing`),
  ];
}

async function definitionProblems(
  pg: Knex,
  sql: string,
  expected: Record<string, RegExp>,
): Promise<string[]> {
  const { rows } = await pg.raw(sql, [Object.keys(expected)]);
  const found = new Map<string, string>(
    rows.map((row: { name: string; definition: string }) => [
      row.name,
      row.definition,
    ]),
  );
  return Object.entries(expected).flatMap(([name, shape]) => {
    const definition = found.get(name);
    if (definition === undefined) return [`${name} is missing`];
    return shape.test(definition)
      ? []
      : [`${name} is defined as ${definition}, expected ${shape}`];
  });
}

async function typeProblems(pg: Knex): Promise<string[]> {
  const { rows } = await pg.raw(
    `select c.relname || '.' || a.attname as name, format_type(a.atttypid, a.atttypmod) as type
     from pg_attribute a join pg_class c on c.oid = a.attrelid
     join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
     where c.relname || '.' || a.attname = any(?::text[]) and not a.attisdropped`,
    [Object.keys(HAND_WRITTEN_TYPES)],
  );
  const found = new Map<string, string>(
    rows.map((row: { name: string; type: string }) => [row.name, row.type]),
  );
  return Object.entries(HAND_WRITTEN_TYPES).flatMap(([name, type]) =>
    found.get(name) === type
      ? []
      : [`${name}: expected ${type}, found ${found.get(name) ?? 'nothing'}`],
  );
}

export async function schemaProblems(pg: Knex): Promise<string[]> {
  const tables = await Promise.all(
    SCHEMA_TABLES.map((table) => tableProblems(pg, table)),
  );
  return [
    ...tables.flat(),
    ...(await typeProblems(pg)),
    ...(await definitionProblems(
      pg,
      `select indexname as name, indexdef as definition from pg_indexes
       where schemaname = 'public' and indexname = any(?::text[])`,
      HAND_WRITTEN_INDEXES,
    )),
    ...(await definitionProblems(
      pg,
      `select c.conname as name, pg_get_constraintdef(c.oid) as definition
       from pg_constraint c join pg_namespace n on n.oid = c.connamespace and n.nspname = 'public'
       where c.conname = any(?::text[])`,
      HAND_WRITTEN_CONSTRAINTS,
    )),
  ];
}
