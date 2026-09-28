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
  const sorted = [...model.generations].sort((a, b) => a.yearFrom - b.yearFrom);
  for (let index = 0; index < sorted.length; index += 1) {
    const generation = sorted[index];
    if (generation.yearFrom > generation.yearTo) {
      return `у поколения «${label} ${generation.name}» год начала позже года конца`;
    }
    const previous = sorted[index - 1];
    if (previous && generation.yearFrom < previous.yearTo) {
      return `поколения «${label} ${previous.name}» (${span(previous)}) и «${generation.name}» (${span(generation)}) пересекаются больше чем на год`;
    }
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
