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
    contacts: z.object({ button: line, text: line, hours: line }).strict(),
    manager: z.object({ button: line, text: line }).strict(),
    partners: z.object({ button: line, text: line }).strict(),
    request: z.object({ button: line, car: line, service: line }).strict(),
  })
  .strict();

export type CaptureCopy = z.infer<typeof captureCopySchema>;
