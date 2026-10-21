export const sellPrice = (
  costPrice: number,
  markupPercentage: number,
): number => Math.round(costPrice * (1 + markupPercentage / 100));
