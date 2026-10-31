import type { AddonKind } from './cart-wire.ts';

export type FingerprintLine = {
  id: string;
  quantity: number;
  unit_price: number;
  addon?: AddedLine | null;
  installation?: AddedLine | null;
};

type AddedLine = { item_id: string | null; unit_price: number };

export type BilledRow = {
  id: string;
  quantity: number;
  unit_price: number;
  kind: 'part' | AddonKind;
};

export const CART_FINGERPRINT_FIELD = 'cart_fingerprint';

export const billedRows = (lines: FingerprintLine[]): BilledRow[] =>
  lines.flatMap(({ id, quantity, unit_price, addon, installation }) => [
    { id, quantity, unit_price, kind: 'part' as const },
    ...(
      [
        ['service', addon],
        ['installation', installation],
      ] as const
    ).flatMap(([kind, added]) =>
      added?.item_id
        ? [{ id: added.item_id, quantity, unit_price: added.unit_price, kind }]
        : [],
    ),
  ]);

export const cartTotals = (
  lines: (FingerprintLine & { available: boolean })[],
) => {
  const rows = billedRows(lines.filter(({ available }) => available));
  const sum = (kept: BilledRow[]) =>
    kept.reduce((total, row) => total + row.unit_price * row.quantity, 0);
  const parts = sum(rows.filter(({ kind }) => kind === 'part'));
  const addons = sum(rows.filter(({ kind }) => kind !== 'part'));
  return {
    count: rows
      .filter(({ kind }) => kind === 'part')
      .reduce((count, { quantity }) => count + quantity, 0),
    parts,
    addons,
    total: parts + addons,
  };
};

export const cartFingerprint = (lines: FingerprintLine[]): string =>
  billedRows(lines)
    .map(({ id, quantity, unit_price }) => `${id}:${quantity}:${unit_price}`)
    .sort()
    .join(',');
