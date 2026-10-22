import {
  matchesRequirements,
  type AttributeValues,
  type VehicleRequirement,
} from './attributes.ts';

export const ENRICHMENT_GAPS = [
  'no_category',
  'no_fitment_equivalent_or_requirement',
] as const;

export type EnrichmentGap = (typeof ENRICHMENT_GAPS)[number];

export type EnrichmentFacts = {
  category_id: string | null;
  attributes: AttributeValues;
  fitments: number;
  equivalents: number;
};

export function enrichmentRule(
  vehicles: { requirements: VehicleRequirement[] }[],
): (facts: EnrichmentFacts) => EnrichmentGap[] {
  const rowSets = new Map<string, VehicleRequirement[][]>();
  for (const { requirements } of vehicles) {
    for (const category_id of new Set(
      requirements.map((requirement) => requirement.category_id),
    )) {
      rowSets.set(category_id, [
        ...(rowSets.get(category_id) ?? []),
        requirements.filter(
          (requirement) => requirement.category_id === category_id,
        ),
      ]);
    }
  }
  const required = (category_id: string, attributes: AttributeValues) =>
    (rowSets.get(category_id) ?? []).some((rows) =>
      matchesRequirements(attributes, rows),
    );
  return ({ category_id, attributes, fitments, equivalents }) => [
    ...(category_id === null ? (['no_category'] as const) : []),
    ...(fitments > 0 ||
    equivalents > 0 ||
    (category_id !== null && required(category_id, attributes))
      ? []
      : (['no_fitment_equivalent_or_requirement'] as const)),
  ];
}
