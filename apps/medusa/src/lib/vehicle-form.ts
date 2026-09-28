import type { FitmentEntry } from '@podbor/shop-catalog/browser';

import type { Generation, Level, Model, VehicleTree } from './vehicle-tree';

export type FitmentRow = FitmentEntry & { generation: string };

export const EMPTY_ROW: FitmentRow = {
  make: '',
  model: '',
  generation: '',
  yearFrom: 0,
  yearTo: 0,
};

export const modelsOf = (tree: VehicleTree, make: string): Model[] =>
  tree.find((entry) => entry.name === make)?.models ?? [];

export const generationsOf = (
  tree: VehicleTree,
  make: string,
  model: string,
): Generation[] =>
  modelsOf(tree, make).find((entry) => entry.name === model)?.generations ?? [];

export const generationLabel = (generation: Generation): string =>
  `${generation.name} (${generation.yearFrom}–${generation.yearTo})`;

export function fitmentToRows(
  tree: VehicleTree,
  entries: readonly FitmentEntry[] | null | undefined,
): FitmentRow[] {
  return (entries ?? []).map((entry) => {
    const holding = generationsOf(tree, entry.make, entry.model).filter(
      (generation) =>
        generation.yearFrom <= entry.yearFrom &&
        entry.yearTo <= generation.yearTo,
    );
    return {
      ...entry,
      generation: holding.length === 1 ? holding[0].name : '',
    };
  });
}

export const rowsToFitment = (rows: readonly FitmentRow[]): FitmentEntry[] =>
  rows.map(({ make, model, yearFrom, yearTo }) => ({
    make,
    model,
    yearFrom,
    yearTo,
  }));

export const unfinishedRow = (rows: readonly FitmentRow[]): number =>
  rows.findIndex((row) => !row.yearFrom);

export const pickMake = (make: string): FitmentRow => ({ ...EMPTY_ROW, make });

export const pickModel = (row: FitmentRow, model: string): FitmentRow => ({
  ...EMPTY_ROW,
  make: row.make,
  model,
});

export function pickGeneration(
  tree: VehicleTree,
  row: FitmentRow,
  name: string,
): FitmentRow {
  const generation = generationsOf(tree, row.make, row.model).find(
    (entry) => entry.name === name,
  );
  return generation
    ? {
        ...row,
        generation: generation.name,
        yearFrom: generation.yearFrom,
        yearTo: generation.yearTo,
      }
    : { ...row, generation: '', yearFrom: 0, yearTo: 0 };
}

export function yearsOf(tree: VehicleTree, row: FitmentRow): number[] {
  const generation = generationsOf(tree, row.make, row.model).find(
    (entry) => entry.name === row.generation,
  );
  return generation
    ? Array.from(
        { length: generation.yearTo - generation.yearFrom + 1 },
        (_, index) => generation.yearFrom + index,
      )
    : [];
}

export const withYearFrom = (row: FitmentRow, year: number): FitmentRow => ({
  ...row,
  yearFrom: year,
  yearTo: Math.max(year, row.yearTo),
});

export const withYearTo = (row: FitmentRow, year: number): FitmentRow => ({
  ...row,
  yearTo: year,
  yearFrom: Math.min(year, row.yearFrom),
});

export type Draft = { name: string; yearFrom: string; yearTo: string };

export const EMPTY_DRAFT: Draft = { name: '', yearFrom: '', yearTo: '' };

export const draftOf = (entry: {
  name: string;
  yearFrom?: number;
  yearTo?: number;
}): Draft => ({
  name: entry.name,
  yearFrom: entry.yearFrom === undefined ? '' : String(entry.yearFrom),
  yearTo: entry.yearTo === undefined ? '' : String(entry.yearTo),
});

export function editRequest(
  level: Level,
  draft: Draft,
  target: { id?: string; parentId?: string },
): { path: string; body: Record<string, unknown> } {
  const body: Record<string, unknown> = { name: draft.name.trim() };
  if (level === 'generations') {
    body.yearFrom = Number(draft.yearFrom);
    body.yearTo = Number(draft.yearTo);
  }
  if (!target.id && level === 'models') {
    body.make_id = target.parentId;
  }
  if (!target.id && level === 'generations') {
    body.vehicle_model_id = target.parentId;
  }
  return {
    path: target.id
      ? `/admin/vehicles/${level}/${target.id}`
      : `/admin/vehicles/${level}`,
    body,
  };
}
