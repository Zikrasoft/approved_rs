import { z } from 'zod';

const offerSchema = z.object({
  id: z.string(),
  supplier: z.string(),
  supplier_article_id: z.string(),
  price: z.number(),
  stock_quantity: z.number(),
  lead_time: z.string(),
});

const identifierSchema = z.object({
  id: z.string(),
  type: z.enum(['oem', 'manufacturer-number', 'ean']),
  brand: z.string(),
  value: z.string(),
  offers: z.array(offerSchema),
});

const partSchema = z.object({
  id: z.string(),
  name: z.string(),
  identifiers: z.array(identifierSchema),
});

export type ShopPartOffer = z.infer<typeof offerSchema>;
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

export async function fetchShopSearch(
  q: string,
  {
    backendUrl,
    publishableKey,
  }: { backendUrl: string; publishableKey: string },
): Promise<ShopPart | null> {
  const response = await fetch(
    `${backendUrl}/store/search?q=${encodeURIComponent(q)}`,
    { headers: { 'x-publishable-api-key': publishableKey } },
  );

  if (!response.ok) {
    return null;
  }

  const body = await response.json();
  return partSchema.parse(body.part);
}

const DAYS_PATTERN = /^(\d+)_days$/;

export function formatLeadTime(
  leadTime: string,
  copy: { inStock: string; daysTemplate: string },
): string {
  if (leadTime === 'in_stock') {
    return copy.inStock;
  }

  const match = DAYS_PATTERN.exec(leadTime);
  if (match) {
    return copy.daysTemplate.replace('{days}', match[1]);
  }

  return leadTime;
}
