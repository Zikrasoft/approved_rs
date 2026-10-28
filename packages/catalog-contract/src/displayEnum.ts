import { z } from 'zod';

export const displayEnum = <const T extends readonly [string, ...string[]]>(
  values: T,
) => z.enum(values).nullable().catch(null);
