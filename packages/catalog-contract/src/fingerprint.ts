export type FingerprintLine = {
  id: string;
  quantity: number;
  unit_price: number;
  addon?: AddedLine | null;
  installation?: AddedLine | null;
};

type AddedLine = { item_id: string | null; unit_price: number };

export const CART_FINGERPRINT_FIELD = 'cart_fingerprint';

const withAddons = ({ addon, installation, ...line }: FingerprintLine) => [
  line,
  ...[addon, installation].flatMap((added) =>
    added?.item_id
      ? [
          {
            id: added.item_id,
            quantity: line.quantity,
            unit_price: added.unit_price,
          },
        ]
      : [],
  ),
];

export const cartFingerprint = (lines: FingerprintLine[]): string =>
  lines
    .flatMap(withAddons)
    .map(({ id, quantity, unit_price }) => `${id}:${quantity}:${unit_price}`)
    .sort()
    .join(',');
