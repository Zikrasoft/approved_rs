import { z } from 'zod';

export const MAX_BODY_BYTES = 64 * 1024;

const contentLengthSchema = z.coerce.number().catch(0);

export const bodyTooLarge = (request: Request): boolean =>
  contentLengthSchema.parse(request.headers.get('content-length')) >
  MAX_BODY_BYTES;

export const PAYLOAD_TOO_LARGE = (): Response =>
  new Response(null, { status: 413 });
