import type { SearchTypes } from '@medusajs/framework/types';
import type { CollectionFieldSchema } from 'typesense/lib/Typesense/Collection';

const TYPESENSE_SCALAR_TYPE: Partial<
  Record<SearchTypes.SearchFieldKind, string>
> = {
  keyword: 'string',
  text: 'string',
  integer: 'int32',
  float: 'float',
  boolean: 'bool',
};

export const compactValue = (value: string): string =>
  value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

const mapField = (
  path: string,
  field: SearchTypes.SearchFieldDefinition,
  ancestorArray: boolean,
): CollectionFieldSchema[] => {
  const isArray = Boolean(field.array) || ancestorArray;

  if (field.type === 'object') {
    const children = Object.entries(field.fields ?? {}).flatMap(
      ([childName, childField]) =>
        mapField(`${path}.${childName}`, childField, isArray),
    );

    return [
      { name: path, type: isArray ? 'object[]' : 'object', optional: true },
      ...children,
    ];
  }

  const scalarType = TYPESENSE_SCALAR_TYPE[field.type];
  if (!scalarType) {
    throw new Error(
      `search-typesense: field "${path}" has unsupported type "${field.type}"`,
    );
  }

  return [
    {
      name: path,
      type: isArray ? `${scalarType}[]` : scalarType,
      optional: path !== 'id',
      facet: Boolean(field.facetable),
      sort: Boolean(field.sortable),
    } as CollectionFieldSchema,
  ];
};

export const toTypesenseFields = (
  fields: Record<string, SearchTypes.SearchFieldDefinition>,
): CollectionFieldSchema[] =>
  Object.entries(fields).flatMap(([name, field]) =>
    mapField(name, field, false),
  );

export const hasNestedFields = (
  fields: Record<string, SearchTypes.SearchFieldDefinition>,
): boolean => Object.values(fields).some((field) => field.type === 'object');

export const collectSearchableFields = (
  fields: Record<string, SearchTypes.SearchFieldDefinition>,
  prefix = '',
): string[] =>
  Object.entries(fields).flatMap(([name, field]) => {
    const path = prefix ? `${prefix}.${name}` : name;
    if (field.type === 'object') {
      return collectSearchableFields(field.fields ?? {}, path);
    }
    return field.searchable ? [path] : [];
  });

const quote = (value: unknown): string => {
  if (typeof value === 'string') {
    return `\`${value.replace(/`/g, "'")}\``;
  }
  if (value instanceof Date) {
    return `${value.getTime()}`;
  }
  return `${value}`;
};

const compileFieldFilter = (field: string, value: unknown): string => {
  if (value === null || typeof value !== 'object' || value instanceof Date) {
    return `${field}:=${quote(value)}`;
  }

  const operators = value as Record<string, unknown>;
  const keys = Object.keys(operators);

  if (keys.length === 1 && keys[0] === '$eq') {
    return `${field}:=${quote(operators.$eq)}`;
  }
  if (keys.length === 1 && keys[0] === '$in' && Array.isArray(operators.$in)) {
    return `${field}:=[${operators.$in.map(quote).join(',')}]`;
  }

  throw new Error(
    `search-typesense: unsupported filter on "${field}": ${keys.join(', ')}`,
  );
};

export const compileFilters = (
  filters: SearchTypes.SearchFilters | undefined,
): string | undefined => {
  if (!filters) {
    return undefined;
  }

  const clauses: string[] = [];

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || key === 'q') {
      continue;
    }

    if (key === '$and') {
      const sub = (value as SearchTypes.SearchFilters[])
        .map((entry) => compileFilters(entry))
        .filter((clause): clause is string => Boolean(clause));
      if (sub.length) {
        clauses.push(sub.join(' && '));
      }
      continue;
    }

    if (key === '$or' || key === '$not') {
      throw new Error(`search-typesense: unsupported filter operator "${key}"`);
    }

    clauses.push(compileFieldFilter(key, value));
  }

  return clauses.length ? clauses.join(' && ') : undefined;
};
