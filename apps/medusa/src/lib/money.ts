export function money(value: unknown): number {
  const coercesToAFalseNumber =
    value === null ||
    typeof value === 'boolean' ||
    (typeof value === 'string' && value.trim() === '');
  const parsed = coercesToAFalseNumber ? NaN : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`unreadable amount of type ${typeof value}`);
  }
  return parsed;
}
