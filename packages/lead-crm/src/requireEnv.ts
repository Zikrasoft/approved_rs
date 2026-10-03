export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[telegram] ${name} is not set`);
  return value;
}
