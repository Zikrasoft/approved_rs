import type { Field, ProductTypeDef, Spec, SpecValue } from './registry.ts';

export interface FacetOption {
  value: string;
  count: number;
}

export type Facet =
  | { kind: 'options'; key: string; options: FacetOption[] }
  | { kind: 'range'; key: string; values: number[] };

export interface FacetSelection {
  values?: readonly string[];
  min?: number;
  max?: number;
}

export type FacetState = Readonly<Record<string, FacetSelection>>;

export type FacetField =
  | {
      key: string;
      kind: 'enum';
      facet?: boolean;
      values: readonly { value: string }[];
    }
  | { key: string; kind: Exclude<Field['kind'], 'enum'>; facet?: boolean };

export interface FacetType {
  fields: readonly FacetField[];
}

function optionValues(value: SpecValue | undefined): string[] {
  if (value === undefined) return [];
  if (Array.isArray(value)) return [...new Set<string>(value)];
  return [String(value)];
}

function toNumber(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

export function countValues(
  specs: readonly Spec[],
  key: string,
): Map<string | number | boolean, number> {
  const counts = new Map<string | number | boolean, number>();
  for (const spec of specs) {
    const value = spec[key];
    const values: (string | number | boolean)[] =
      value === undefined
        ? []
        : Array.isArray(value)
          ? [...new Set<string>(value)]
          : [value as string | number | boolean];
    for (const item of values) counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return counts;
}

export function facetIndex(
  type: ProductTypeDef,
  specs: readonly Spec[],
): Facet[] {
  return type.fields
    .filter((field) => field.facet)
    .flatMap((field): Facet[] => {
      if (field.kind === 'number') {
        const values = [
          ...new Set(
            specs
              .map((spec) => spec[field.key])
              .filter((value): value is number => typeof value === 'number'),
          ),
        ].sort((a, b) => a - b);
        return values.length > 0
          ? [{ kind: 'range', key: field.key, values }]
          : [];
      }
      const counts = new Map(
        [...countValues(specs, field.key)].map(([value, count]) => [
          String(value),
          count,
        ]),
      );
      const order =
        field.kind === 'enum'
          ? field.values.map((option) => option.value)
          : [...counts.keys()].sort((a, b) => a.localeCompare(b, 'en'));
      const options = order.flatMap((value) => {
        const count = counts.get(value);
        return count ? [{ value, count }] : [];
      });
      return options.length > 0
        ? [{ kind: 'options', key: field.key, options }]
        : [];
    });
}

export function matchesFacets(
  type: FacetType,
  spec: Spec,
  state: FacetState,
): boolean {
  return Object.entries(state).every(([key, selection]) => {
    const field = type.fields.find(
      (candidate) => candidate.key === key && candidate.facet,
    );
    if (!field) return true;
    const value = spec[key];
    if (field.kind === 'number') {
      const { min, max } = selection;
      if (min === undefined && max === undefined) return true;
      if (typeof value !== 'number') return false;
      return (
        (min === undefined || value >= min) &&
        (max === undefined || value <= max)
      );
    }
    if (!selection.values?.length) return true;
    const own = optionValues(value);
    return selection.values.some((wanted) => own.includes(wanted));
  });
}

export function readFacetState(
  type: FacetType,
  params: URLSearchParams,
): FacetState {
  const state: Record<string, FacetSelection> = {};
  for (const field of type.fields) {
    if (!field.facet) continue;
    if (field.kind === 'number') {
      const min = toNumber(params.get(`${field.key}.min`));
      const max = toNumber(params.get(`${field.key}.max`));
      if (min === undefined && max === undefined) continue;
      state[field.key] = {
        ...(min !== undefined && { min }),
        ...(max !== undefined && { max }),
      };
      continue;
    }
    const allowed =
      field.kind === 'enum'
        ? new Set(field.values.map((option) => option.value))
        : undefined;
    const values = [...new Set(params.getAll(field.key))].filter(
      (value) => value.trim() !== '' && (!allowed || allowed.has(value)),
    );
    if (values.length > 0) state[field.key] = { values };
  }
  return state;
}

export function writeFacetState(
  type: FacetType,
  state: FacetState,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const field of type.fields) {
    const selection = state[field.key];
    if (!field.facet || !selection) continue;
    if (field.kind === 'number') {
      if (selection.min !== undefined)
        params.set(`${field.key}.min`, String(selection.min));
      if (selection.max !== undefined)
        params.set(`${field.key}.max`, String(selection.max));
      continue;
    }
    for (const value of selection.values ?? []) params.append(field.key, value);
  }
  return params;
}
