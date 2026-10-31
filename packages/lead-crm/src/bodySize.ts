import { z } from 'zod';

export const MAX_BODY_BYTES = 64 * 1024;

const contentLengthSchema = z.coerce.number().catch(0);

const PAYLOAD_TOO_LARGE = (): Response => new Response(null, { status: 413 });

async function readCapped(
  request: Request,
  maxBytes: number,
): Promise<Blob | Response | null> {
  if (
    contentLengthSchema.parse(request.headers.get('content-length')) > maxBytes
  )
    return PAYLOAD_TOO_LARGE();
  if (!request.body) return new Blob();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  const reader = request.body.getReader();
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) return new Blob(chunks);
      size += chunk.value.byteLength;
      if (size > maxBytes) return PAYLOAD_TOO_LARGE();
      chunks.push(chunk.value);
    }
  } catch {
    return null;
  }
}

export async function readForm(
  request: Request,
  maxBytes = MAX_BODY_BYTES,
): Promise<FormData | Response | null> {
  const body = await readCapped(request, maxBytes);
  if (!(body instanceof Blob)) return body;
  return new Response(body, {
    headers: { 'content-type': request.headers.get('content-type') ?? '' },
  })
    .formData()
    .catch(() => null);
}

export async function readJson(
  request: Request,
  maxBytes = MAX_BODY_BYTES,
): Promise<unknown> {
  const body = await readCapped(request, maxBytes);
  if (!(body instanceof Blob)) return body;
  try {
    return JSON.parse(await body.text());
  } catch {
    return null;
  }
}
