import { z } from 'zod';

export const MAX_BODY_BYTES = 64 * 1024;

export type BodyRead<T> = { value: T } | { response: Response };

const contentLengthSchema = z.coerce.number().catch(0);

const tooLarge = (): BodyRead<never> => ({
  response: new Response(null, { status: 413 }),
});

async function readCapped(
  request: Request,
  maxBytes: number,
): Promise<BodyRead<Blob | null>> {
  if (
    contentLengthSchema.parse(request.headers.get('content-length')) > maxBytes
  )
    return tooLarge();
  if (!request.body) return { value: new Blob() };
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  const reader = request.body.getReader();
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) return { value: new Blob(chunks) };
      size += chunk.value.byteLength;
      if (size > maxBytes) return tooLarge();
      chunks.push(chunk.value);
    }
  } catch {
    return { value: null };
  }
}

export async function readForm(
  request: Request,
  maxBytes = MAX_BODY_BYTES,
): Promise<BodyRead<FormData | null>> {
  const read = await readCapped(request, maxBytes);
  if ('response' in read) return read;
  if (!read.value) return { value: null };
  return {
    value: await new Response(read.value, {
      headers: { 'content-type': request.headers.get('content-type') ?? '' },
    })
      .formData()
      .catch(() => null),
  };
}

export async function readJson(
  request: Request,
  maxBytes = MAX_BODY_BYTES,
): Promise<BodyRead<unknown>> {
  const read = await readCapped(request, maxBytes);
  if ('response' in read) return read;
  if (!read.value) return { value: null };
  try {
    return { value: JSON.parse(await read.value.text()) };
  } catch {
    return { value: null };
  }
}
