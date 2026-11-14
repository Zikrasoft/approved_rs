export type PageSlot = number | 'gap';

export function pageWindow(current: number, count: number): PageSlot[] {
  const shown = Array.from({ length: count }, (_, index) => index + 1).filter(
    (number) =>
      number === 1 || number === count || Math.abs(number - current) <= 1,
  );
  return shown.flatMap((number, index) =>
    index > 0 && number - shown[index - 1] > 1 ? ['gap', number] : [number],
  );
}

export type Page<T> = { number: number; count: number; items: T[] };

export function paginate<T>(items: readonly T[], size: number): Page<T>[] {
  const count = Math.max(1, Math.ceil(items.length / size));
  return Array.from({ length: count }, (_, index) => ({
    number: index + 1,
    count,
    items: items.slice(index * size, (index + 1) * size),
  }));
}
