export interface FitmentEntry {
  make: string;
  model: string;
  yearFrom: number;
  yearTo: number;
}

export interface FitmentIndex {
  makes: string[];
  modelsByMake: Record<string, string[]>;
  yearsByModel: Record<string, number[]>;
}

export function fitmentMatches(
  fitment: FitmentEntry[],
  filter: { make?: string; model?: string; year?: number },
): boolean {
  if (!filter.make && !filter.model && !filter.year) return true;
  return fitment.some((entry) => {
    if (filter.make && entry.make !== filter.make) return false;
    if (filter.model && entry.model !== filter.model) return false;
    if (
      filter.year &&
      (filter.year < entry.yearFrom || filter.year > entry.yearTo)
    )
      return false;
    return true;
  });
}

export function buildFitmentIndex(
  fitments: FitmentEntry[][],
  collator = new Intl.Collator('sr'),
): FitmentIndex {
  const modelsByMake = new Map<string, Set<string>>();
  const yearsByModel = new Map<string, Set<number>>();

  fitments.forEach((fitment) => {
    fitment.forEach((entry) => {
      const models = modelsByMake.get(entry.make) ?? new Set<string>();
      models.add(entry.model);
      modelsByMake.set(entry.make, models);

      const key = `${entry.make}|${entry.model}`;
      const years = yearsByModel.get(key) ?? new Set<number>();
      for (let year = entry.yearFrom; year <= entry.yearTo; year++) {
        years.add(year);
      }
      yearsByModel.set(key, years);
    });
  });

  const sortedStrings = (values: Iterable<string>) =>
    [...values].sort((a, b) => collator.compare(a, b));

  return {
    makes: sortedStrings(modelsByMake.keys()),
    modelsByMake: Object.fromEntries(
      [...modelsByMake].map(([make, models]) => [make, sortedStrings(models)]),
    ),
    yearsByModel: Object.fromEntries(
      [...yearsByModel].map(([key, years]) => [
        key,
        [...years].sort((a, b) => b - a),
      ]),
    ),
  };
}
