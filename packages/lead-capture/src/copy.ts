import { z } from 'zod';

const line = z.string();

export const captureCopySchema = z
  .object({
    greeting: line,
    lookingFor: line,
    budget: line,
    phoneAsk: line,
    phoneOffer: line,
    phoneButton: line,
    phoneSkip: line,
    thanks: line,
    received: line,
    menu: z.object({ text: line, back: line }).strict(),
    services: z.object({ button: line, text: line }).strict(),
    card: z.object({ request: line, site: line }).strict(),
    request: z.object({ button: line, car: line, service: line }).strict(),
  })
  .strict();

export type CaptureCopy = z.infer<typeof captureCopySchema>;
