import { z } from 'zod';

export const CATEGORY_FIELD_TYPES = [
  'number',
  'single-select',
  'multi-select',
  'boolean',
  'text',
] as const;

export type CategoryFieldType = (typeof CATEGORY_FIELD_TYPES)[number];

export type CategoryFieldDefinition = {
  key: string;
  type: CategoryFieldType;
  required: boolean;
  options: { key: string }[];
};

export const attributeValuesSchema = z.record(
  z.string(),
  z.union([z.number(), z.boolean(), z.string(), z.array(z.string())]),
);

export type AttributeValues = z.infer<typeof attributeValuesSchema>;
type AttributeValue = AttributeValues[string];

export type Requirement = {
  field_key: string;
  option_keys?: string[] | null;
  min?: number | null;
  max?: number | null;
};

const optionKey = (options: { key: string }[]) => {
  const keys = options.map(({ key }) => key);
  return z.string().refine((value) => keys.includes(value), {
    message: `Expected one of: ${keys.join(', ')}`,
  });
};

const valueSchema = ({ type, options }: CategoryFieldDefinition) => {
  switch (type) {
    case 'number':
      return z.number();
    case 'boolean':
      return z.boolean();
    case 'text':
      return z.string().trim().min(1);
    case 'single-select':
      return optionKey(options);
    case 'multi-select':
      return z
        .array(optionKey(options))
        .min(1)
        .refine((keys) => new Set(keys).size === keys.length, {
          message: 'Repeated option',
        });
  }
};

const attributesSchema = (fields: CategoryFieldDefinition[]) =>
  z.strictObject(
    Object.fromEntries(
      fields.map((field) => [
        field.key,
        field.required ? valueSchema(field) : valueSchema(field).optional(),
      ]),
    ),
  );

export function validateAttributes(
  fields: CategoryFieldDefinition[],
  values: unknown,
):
  | { success: true; values: AttributeValues }
  | { success: false; errors: string[] } {
  const result = attributesSchema(fields).safeParse(values);
  return result.success
    ? { success: true, values: result.data as AttributeValues }
    : {
        success: false,
        errors: result.error.issues.map(
          ({ path, message }) =>
            `${path.join('.') || 'attributes'}: ${message}`,
        ),
      };
}

const meets = (
  value: AttributeValue | undefined,
  { option_keys, min, max }: Requirement,
): boolean => {
  if (typeof value === 'number') {
    return (min ?? -Infinity) <= value && value <= (max ?? Infinity);
  }
  const allowed = option_keys ?? [];
  if (Array.isArray(value)) {
    return value.some((key) => allowed.includes(key));
  }
  return value !== undefined && allowed.includes(String(value));
};

export const matchesRequirements = (
  values: AttributeValues,
  requirements: Requirement[],
): boolean =>
  requirements.every((requirement) =>
    meets(values[requirement.field_key], requirement),
  );

export const guardDefinitionChange = (
  nextFields: CategoryFieldDefinition[],
  parts: { id: string; attributes: unknown }[],
): string[] =>
  parts
    .filter(
      ({ attributes }) => !validateAttributes(nextFields, attributes).success,
    )
    .map(({ id }) => id);
