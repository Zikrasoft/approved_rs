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
