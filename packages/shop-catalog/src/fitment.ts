export interface FitmentEntry {
  make: string;
  model: string;
  yearFrom: number;
  yearTo: number;
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
