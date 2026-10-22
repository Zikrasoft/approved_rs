export type FingerprintLine = {
  id: string;
  quantity: number;
  unit_price: number;
  addon?: { item_id: string | null; unit_price: number } | null;
};

export const CART_FINGERPRINT_FIELD = 'cart_fingerprint';

const withAddon = ({ addon, ...line }: FingerprintLine) =>
  addon?.item_id
    ? [line, { id: addon.item_id, quantity: 1, unit_price: addon.unit_price }]
    : [line];

export const cartFingerprint = (lines: FingerprintLine[]): string =>
  lines
    .flatMap(withAddon)
    .map(({ id, quantity, unit_price }) => `${id}:${quantity}:${unit_price}`)
    .sort()
    .join(',');
