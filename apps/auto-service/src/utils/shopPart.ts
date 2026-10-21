import { partOfferSchema } from '@podbor/catalog-contract';
import { z } from 'zod';

const identifierSchema = z.object({
  id: z.string(),
  type: z.enum(['oem', 'manufacturer-number', 'ean']),
  brand: z.string(),
  value: z.string(),
  offers: z.array(partOfferSchema),
});

const partSchema = z.object({
  id: z.string(),
  name: z.string(),
  identifiers: z.array(identifierSchema),
});

export type ShopPartIdentifier = z.infer<typeof identifierSchema>;
export type ShopPart = z.infer<typeof partSchema>;

export async function fetchShopPart(
  id: string,
  {
    backendUrl,
    publishableKey,
  }: { backendUrl: string; publishableKey: string },
): Promise<ShopPart | null> {
  const response = await fetch(`${backendUrl}/store/parts/${id}`, {
    headers: { 'x-publishable-api-key': publishableKey },
  });

  if (!response.ok) {
    return null;
  }

  const body = await response.json();
  return partSchema.parse(body.part);
}

export function formatLeadTime(
  days: number,
  copy: { inStock: string; daysTemplate: string },
): string {
  return days === 0
    ? copy.inStock
    : copy.daysTemplate.replace('{days}', String(days));
}
