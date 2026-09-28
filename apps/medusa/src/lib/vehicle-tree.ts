import type { FitmentEntry } from '@podbor/shop-catalog/browser';

export type Generation = {
  id?: string;
  name: string;
  yearFrom: number;
  yearTo: number;
};

export type Model = { id?: string; name: string; generations: Generation[] };

export type Make = { id?: string; name: string; models: Model[] };

export type VehicleTree = Make[];

const firstDuplicate = (names: string[]): string | undefined =>
  names.find((name, index) => names.indexOf(name) !== index);

const span = (generation: Generation): string =>
  `${generation.yearFrom}–${generation.yearTo}`;

function modelComplaint(make: Make, model: Model): string | undefined {
  const label = `${make.name} ${model.name}`;
  const twice = firstDuplicate(
    model.generations.map((generation) => generation.name),
  );
  if (twice !== undefined) {
    return `поколение «${label} ${twice}» записано дважды`;
  }
  const reversed = model.generations.find(
    (generation) => generation.yearFrom > generation.yearTo,
  );
  if (reversed) {
    return `у поколения «${label} ${reversed.name}» год начала позже года конца`;
  }
  return undefined;
}

export function treeComplaint(tree: VehicleTree): string | undefined {
  const make = firstDuplicate(tree.map((entry) => entry.name));
  if (make !== undefined) {
    return `марка «${make}» записана дважды`;
  }
  for (const entry of tree) {
    const model = firstDuplicate(
      entry.models.map((candidate) => candidate.name),
    );
    if (model !== undefined) {
      return `модель «${entry.name} ${model}» записана дважды`;
    }
    for (const candidate of entry.models) {
      const complaint = modelComplaint(entry, candidate);
      if (complaint) {
        return complaint;
      }
    }
  }
  return undefined;
}

export const describeEntry = (entry: FitmentEntry): string =>
  `${entry.make} ${entry.model} ${entry.yearFrom}–${entry.yearTo}`;

export const generationOf = (
  model: Model,
  entry: FitmentEntry,
): Generation | undefined =>
  model.generations.find(
    (generation) =>
      generation.yearFrom <= entry.yearFrom &&
      entry.yearTo <= generation.yearTo,
  );

export function fitmentComplaint(
  tree: VehicleTree,
  entries: readonly FitmentEntry[],
): string | undefined {
  for (const entry of entries) {
    const where = `«${describeEntry(entry)}»`;
    const make = tree.find((candidate) => candidate.name === entry.make);
    if (!make) {
      return `${where}: марки «${entry.make}» нет в справочнике`;
    }
    const model = make.models.find(
      (candidate) => candidate.name === entry.model,
    );
    if (!model) {
      return `${where}: у марки «${entry.make}» нет модели «${entry.model}»`;
    }
    if (!generationOf(model, entry)) {
      return `${where}: годы выходят за рамки поколений ${entry.make} ${entry.model} (${model.generations.map(span).join(', ')})`;
    }
  }
  return undefined;
}

export type Level = 'makes' | 'models' | 'generations';

export type Change = { name?: string; yearFrom?: number; yearTo?: number };

export type TreeEdit =
  | { kind: 'create'; level: Level; parentId?: string; change: Change }
  | { kind: 'update'; level: Level; id: string; change: Change }
  | { kind: 'delete'; level: Level; id: string };

export function applyEdit(
  tree: VehicleTree,
  edit: TreeEdit,
): VehicleTree | undefined {
  let found = false;
  const edited = <T extends { id?: string }>(
    nodes: T[],
    fresh: T,
    parentId?: string,
  ): T[] => {
    if (edit.kind === 'create') {
      if (parentId !== edit.parentId) {
        return nodes;
      }
      found = true;
      return [...nodes, fresh];
    }
    if (!nodes.some((node) => node.id === edit.id)) {
      return nodes;
    }
    found = true;
    if (edit.kind === 'delete') {
      return nodes.filter((node) => node.id !== edit.id);
    }
    return nodes.map((node) =>
      node.id === edit.id ? { ...node, ...edit.change } : node,
    );
  };
  const change = edit.kind === 'delete' ? {} : edit.change;

  const next =
    edit.level === 'makes'
      ? edited<Make>(tree, { name: '', models: [], ...change })
      : tree.map((make) => ({
          ...make,
          models:
            edit.level === 'models'
              ? edited<Model>(
                  make.models,
                  { name: '', generations: [], ...change },
                  make.id,
                )
              : make.models.map((model) => ({
                  ...model,
                  generations: edited<Generation>(
                    model.generations,
                    { name: '', yearFrom: 0, yearTo: 0, ...change },
                    model.id,
                  ),
                })),
        }));
  return found ? next : undefined;
}
