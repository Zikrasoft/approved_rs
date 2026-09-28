import type {
  FitmentEntry,
  ProductTypeDef,
  Spec,
  SpecValue,
} from '@podbor/shop-catalog/browser';

export type FormValues = Record<string, string>;

export type FitmentDraft = FitmentEntry;

const SEPARATOR = ' | ';

export function specToForm(
  type: ProductTypeDef,
  spec: Spec | null | undefined,
): FormValues {
  return Object.fromEntries(
    type.fields.map((field) => {
      const value = spec?.[field.key];
      if (value === undefined) {
        return [field.key, ''];
      }
      return [
        field.key,
        Array.isArray(value) ? value.join(', ') : String(value),
      ];
    }),
  );
}

export function formToSpec(
  type: ProductTypeDef,
  values: FormValues,
): Record<string, SpecValue> {
  const spec: Record<string, SpecValue> = {};
  for (const field of type.fields) {
    const raw = (values[field.key] ?? '').trim();
    if (!raw) {
      continue;
    }
    if (field.kind === 'number') {
      spec[field.key] = Number(raw.replace(',', '.'));
    } else if (field.kind === 'boolean') {
      spec[field.key] = raw === 'true';
    } else if (field.kind === 'codes' && field.multiple) {
      spec[field.key] = raw
        .split(',')
        .map((code) => code.trim())
        .filter(Boolean);
    } else {
      spec[field.key] = raw;
    }
  }
  return spec;
}

export function fitmentToText(
  entries: readonly FitmentDraft[] | null | undefined,
): string {
  return (entries ?? [])
    .map((entry) =>
      [entry.make, entry.model, `${entry.yearFrom}-${entry.yearTo}`].join(
        SEPARATOR,
      ),
    )
    .join('\n');
}

export function textToFitment(text: string): FitmentDraft[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [make = '', model = '', years = ''] = line
        .split('|')
        .map((part) => part.trim());
      const [from = '', to = from] = years
        .split('-')
        .map((year) => year.trim());
      return { make, model, yearFrom: Number(from), yearTo: Number(to) };
    });
}
