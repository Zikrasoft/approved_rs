import { z } from 'zod';

export const spellingSchema = z.object({
  id: z.string(),
  supplier_id: z.string().nullable(),
  value: z.string(),
});

export const spellingSupplier = (
  supplierId: string | null,
  suppliers: readonly { id: string; name: string }[],
  everySupplier: string,
): string =>
  supplierId == null
    ? everySupplier
    : (suppliers.find((supplier) => supplier.id === supplierId)?.name ??
      supplierId);
