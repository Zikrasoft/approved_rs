export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function toCents(n: number): number {
  return Math.round(n * 100);
}
