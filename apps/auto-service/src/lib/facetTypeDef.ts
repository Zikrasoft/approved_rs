import type {
  Field,
  FitmentRule,
  ProductTypeDef,
} from '@podbor/shop-catalog/browser';

export interface FacetField {
  key: string;
  kind: Field['kind'];
  facet: true;
  values?: readonly { value: string }[];
}

export interface FacetTypeDef {
  fitment: FitmentRule;
  fields: readonly FacetField[];
}

export function facetTypeDef(type: ProductTypeDef): FacetTypeDef {
  return {
    fitment: type.fitment,
    fields: type.fields
      .filter((field) => field.facet)
      .map((field): FacetField =>
        field.kind === 'enum'
          ? {
              key: field.key,
              kind: field.kind,
              facet: true,
              values: field.values.map(({ value }) => ({ value })),
            }
          : { key: field.key, kind: field.kind, facet: true },
      ),
  };
}
