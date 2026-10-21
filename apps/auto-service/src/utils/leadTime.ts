export function formatLeadTime(
  days: number,
  copy: { inStock: string; daysTemplate: string },
): string {
  return days === 0
    ? copy.inStock
    : copy.daysTemplate.replace('{days}', String(days));
}
