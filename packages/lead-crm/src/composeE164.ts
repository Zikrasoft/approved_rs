export function composeE164(typed: string, dial: string): string {
  const digits = typed.replace(/\D/g, '').replace(/^0+/, '');
  return /^(\+|00)/.test(typed.trim()) ? `+${digits}` : `+${dial}${digits}`;
}
