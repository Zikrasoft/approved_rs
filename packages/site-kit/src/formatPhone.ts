export function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (d.length < 9) return `+${d}`;
  return `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
}
