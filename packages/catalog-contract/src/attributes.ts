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
      return z.number().nonnegative();
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
  | { success: false; errors: string[]; fields: string[] } {
  const result = attributesSchema(fields).safeParse(values);
  return result.success
    ? { success: true, values: result.data as AttributeValues }
    : {
        success: false,
        errors: result.error.issues.map(
          ({ path, message }) =>
            `${path.join('.') || 'attributes'}: ${message}`,
        ),
        fields: result.error.issues.flatMap((issue) =>
          issue.code === 'unrecognized_keys'
            ? issue.keys
            : issue.path.slice(0, 1).map(String),
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

export const requirementSchema = z.object({
  id: z.string(),
  category_id: z.string(),
  field_key: z.string(),
  option_keys: z.array(z.string()).nullable(),
  min: z.number().nullable(),
  max: z.number().nullable(),
  quantity: z.number().int().positive(),
});

export type VehicleRequirement = z.infer<typeof requirementSchema>;

export function requirementErrors(
  { type, options }: CategoryFieldDefinition,
  { option_keys, min, max }: Omit<Requirement, 'field_key'>,
): string[] {
  const keys = option_keys ?? [];
  const bounded = (min ?? null) !== null || (max ?? null) !== null;
  if (type === 'number') {
    return [
      ...(keys.length ? ['option_keys: Not allowed'] : []),
      ...(bounded ? [] : ['min, max: Required']),
      ...((min ?? -Infinity) > (max ?? Infinity)
        ? ['min, max: min exceeds max']
        : []),
    ];
  }
  const known = options.map(({ key }) => key);
  return [
    ...(keys.length ? [] : ['option_keys: Required']),
    ...(type.endsWith('select')
      ? keys
          .filter((key) => !known.includes(key))
          .map((key) => `option_keys: Unknown option ${key}`)
      : []),
    ...(bounded ? ['min, max: Not allowed'] : []),
  ];
}

export type RequirementMatch<Part> = {
  category_id: string;
  quantity: number;
  parts: Part[];
};

export function requirementMatches<
  Part extends { category_id: string | null; attributes: AttributeValues },
>(parts: Part[], requirements: VehicleRequirement[]): RequirementMatch<Part>[] {
  const categoryIds = [
    ...new Set(requirements.map(({ category_id }) => category_id)),
  ];
  return categoryIds.flatMap((category_id) => {
    const rows = requirements.filter(
      (requirement) => requirement.category_id === category_id,
    );
    const matching = parts.filter(
      (part) =>
        part.category_id === category_id &&
        matchesRequirements(part.attributes, rows),
    );
    return matching.length
      ? [
          {
            category_id,
            quantity: Math.max(...rows.map(({ quantity }) => quantity)),
            parts: matching,
          },
        ]
      : [];
  });
}

export type KitCategory = {
  id: string;
  maintenance_kit: boolean;
  kit_rank: number;
};

export type KitItem = {
  category_id: string;
  part_id: string;
  quantity: number;
};

export const maintenanceKit = (
  categories: KitCategory[],
  groups: {
    category_id: string | null;
    ambiguous: boolean;
    fitments: { part_id: string; quantity: number }[];
  }[],
  matches: RequirementMatch<{ id: string }>[],
): KitItem[] =>
  categories
    .filter(({ maintenance_kit }) => maintenance_kit)
    .sort((a, b) => a.kit_rank - b.kit_rank)
    .flatMap(({ id }): KitItem[] => {
      const fitted = groups.find(
        (group) => group.category_id === id && !group.ambiguous,
      )?.fitments[0];
      if (fitted) {
        return [
          {
            category_id: id,
            part_id: fitted.part_id,
            quantity: fitted.quantity,
          },
        ];
      }
      const matched = matches.find(({ category_id }) => category_id === id);
      return matched
        ? [
            {
              category_id: id,
              part_id: matched.parts[0].id,
              quantity: matched.quantity,
            },
          ]
        : [];
    });
