export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & {
  other: string;
};

export function pluralLabel(
  forms: PluralForms,
  bcp47: string,
  count: number,
): string {
  const category = new Intl.PluralRules(bcp47).select(count);
  return (forms[category] ?? forms.other).replace('{count}', String(count));
}
