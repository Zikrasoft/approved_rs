import { nameKey } from '../../modules/_shared/keys';

export type CategoryMapping = { code: string; category_id: string | null };

export type CategoryDecision =
  { categoryId: string } | { skipped: 'unmapped' | 'excluded' };

const baseOf = (code: string) => code.split(' | ')[0];

export const scopedCodeOf = (codes: string[]) => {
  const listed = new Map(codes.map((code) => [nameKey(code), code]));
  return (code: string): string | null =>
    listed.get(nameKey(code)) ?? listed.get(nameKey(baseOf(code))) ?? null;
};

export const categoryScope = (mappings: CategoryMapping[]) => {
  const codeOf = scopedCodeOf(mappings.map(({ code }) => code));
  const mapped = new Map(
    mappings.map(({ code, category_id }) => [code, category_id]),
  );
  return (category: string): CategoryDecision => {
    const code = codeOf(category);
    if (code === null) return { skipped: 'unmapped' };
    const categoryId = mapped.get(code);
    return categoryId ? { categoryId } : { skipped: 'excluded' };
  };
};
