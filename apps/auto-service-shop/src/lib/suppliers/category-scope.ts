import { nameKey } from '../../modules/_shared/keys';

export type CategoryMapping = { code: string; category_id: string | null };

export type CategoryDecision =
  { categoryId: string } | { skipped: 'unmapped' | 'excluded' };

export const categoryScope = (mappings: CategoryMapping[]) => {
  const mapped = new Map(
    mappings.map(({ code, category_id }) => [nameKey(code), category_id]),
  );
  return (category: string): CategoryDecision => {
    const key = nameKey(category);
    if (!mapped.has(key)) return { skipped: 'unmapped' };
    const categoryId = mapped.get(key);
    return categoryId ? { categoryId } : { skipped: 'excluded' };
  };
};
