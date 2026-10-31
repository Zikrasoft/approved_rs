import type { MedusaRequest } from '@medusajs/framework/http';

export const uploadType = (req: MedusaRequest): string =>
  req.headers['content-type']?.split(';')[0].trim() ?? '';

export async function readCapped(
  stream: AsyncIterable<Buffer>,
  maxBytes: number,
  tooLarge: () => Error,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > maxBytes) throw tooLarge();
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
