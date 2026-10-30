import { z } from 'zod';

const envValue = z.string().min(1);

export function requireEnv(name: string): string {
  const value = envValue.safeParse(process.env[name]);
  if (!value.success) throw new Error(`${name} is not set`);
  return value.data;
}
