export type FingerprintLine = {
  id: string;
  quantity: number;
  unit_price: number;
};

export const CART_FINGERPRINT_FIELD = 'cart_fingerprint';

export const cartFingerprint = (lines: FingerprintLine[]): string =>
  lines
    .map(({ id, quantity, unit_price }) => `${id}:${quantity}:${unit_price}`)
    .sort()
    .join(',');
