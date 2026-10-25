import type { AttributeValues } from './attributes.ts';

export const ENRICHMENT_GAPS = ['bare_number'] as const;

export type EnrichmentGap = (typeof ENRICHMENT_GAPS)[number];

export type EnrichmentFacts = {
  description: string | null;
  attributes: AttributeValues;
  fitments: number;
  equivalents: number;
};

const filled = (value: AttributeValues[string]) =>
  typeof value === 'string' || Array.isArray(value) ? value.length > 0 : true;

export const enrichmentGaps = ({
  description,
  attributes,
  fitments,
  equivalents,
}: EnrichmentFacts): EnrichmentGap[] =>
  description?.trim() ||
  Object.values(attributes).some(filled) ||
  fitments > 0 ||
  equivalents > 0
    ? []
    : ['bare_number'];
