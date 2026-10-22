import { facetFilter, type SearchFacet } from '@podbor/catalog-contract';

export const PARTS_QUERY_MAX_LENGTH = 100;

type FacetCopy = { booleanTrue: string; booleanFalse: string };

export const facetValueLabel = (
  facet: Pick<SearchFacet, 'unit'>,
  { value, label }: { value: string; label: string },
  copy: FacetCopy,
): string => {
  if (label !== value) return label;
  if (value === 'true') return copy.booleanTrue;
  if (value === 'false') return copy.booleanFalse;
  return facet.unit ? `${value} ${facet.unit}` : value;
};

export const chosenFilters = (
  facets: SearchFacet[],
  chosen: string[],
  copy: FacetCopy,
): { filter: string; label: string }[] =>
  chosen.map((filter) => {
    for (const facet of facets) {
      const value = facet.values.find(
        (candidate) => facetFilter(facet.key, candidate.value) === filter,
      );
      if (value) {
        return {
          filter,
          label: `${facet.label}: ${facetValueLabel(facet, value, copy)}`,
        };
      }
    }
    return { filter, label: filter.slice(filter.indexOf(':') + 1) };
  });
