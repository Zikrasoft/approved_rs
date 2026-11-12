import { normalizePartNumber } from '@podbor/catalog-contract';

import type CatalogModuleService from '../modules/catalog/service';
import type { CategoryChoice, QuoteReadingLine } from './ai';

export const CONFIDENT_BRAND = 0.8;
const PREFIX_CONFIDENCE = 0.9;

const SOFTWARE_PREFIXES: { code: RegExp; brand: string; kept?: true }[] = [
  { code: /^FE(?=\d)/, brand: 'Febi' },
  { code: /^EL(?=\d)/, brand: 'Elring' },
  { code: /^HEP(?=P?\d)/, brand: 'HEPU' },
  { code: /^SW(?=\d)/, brand: 'SWAG' },
  { code: /^KYB(?=\d)/, brand: 'KYB' },
  { code: /^NGK(?=\d)/, brand: 'NGK' },
  { code: /^BOS(?=\d)/, brand: 'Bosal' },
  { code: /^LMI(?=\d)/, brand: 'Lemförder' },
  { code: /^DRM(?=\d)/, brand: 'Dr.Motor', kept: true },
];

export const prefixedNumber = (
  printed: string,
): { brand: string; number: string } | null => {
  const number = printed.trim();
  const prefix = SOFTWARE_PREFIXES.find(({ code }) => code.test(number));
  if (!prefix) return null;
  return {
    brand: prefix.brand,
    number: prefix.kept ? number : number.replace(prefix.code, ''),
  };
};

export type QuotePartCandidate = {
  part_id: string;
  name: string;
  brand: string;
  number: string;
};

export type QuoteDraftLine = {
  readable: boolean;
  catalogue_part: boolean;
  original_name: string;
  name: string;
  printed_number: string;
  number: string;
  quantity: number | null;
  brand: string | null;
  brand_confidence: number;
  brand_uncertain: boolean;
  category: CategoryChoice | null;
  part: { id: string; name: string } | null;
  candidates: QuotePartCandidate[];
};

const unreadableLine = (name: string, number: string): QuoteDraftLine => ({
  readable: false,
  catalogue_part: true,
  original_name: name,
  name,
  printed_number: number,
  number,
  quantity: null,
  brand: null,
  brand_confidence: 0,
  brand_uncertain: true,
  category: null,
  part: null,
  candidates: [],
});

export function quoteLineResolver(
  catalog: CatalogModuleService,
  categories: CategoryChoice[],
): (line: QuoteReadingLine) => Promise<QuoteDraftLine> {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const brandNames = new Map<string, Promise<string | null>>();
  const catalogueBrand = (name: string) => {
    if (!brandNames.has(name)) {
      brandNames.set(
        name,
        catalog.brandByAnyName(name).then((brand) => brand?.name ?? null),
      );
    }
    return brandNames.get(name)!;
  };

  const partsNumbered = async (number: string) => {
    const normalized = normalizePartNumber(number);
    if (!normalized) return [];
    const identifiers = await catalog.listPartIdentifiers(
      { normalized_value: normalized },
      { relations: ['brand', 'part'], take: null },
    );
    const parts = new Map<string, QuotePartCandidate>();
    for (const { part, brand, value } of identifiers) {
      parts.set(part.id, {
        part_id: part.id,
        name: part.name,
        brand: brand.name,
        number: value,
      });
    }
    return [...parts.values()];
  };

  return async (line) => {
    if ('unreadable' in line) return unreadableLine(line.name, line.number);
    const prefixed = prefixedNumber(line.number);
    const numbers = [...new Set([line.number, prefixed?.number ?? ''])];
    const base = {
      readable: true,
      catalogue_part: line.catalogue_part,
      original_name: line.name,
      printed_number: line.number,
      quantity: line.quantity,
      category: (line.category_id && byId.get(line.category_id)) || null,
    };

    let candidates: QuotePartCandidate[] = [];
    for (const number of numbers) {
      candidates = await partsNumbered(number);
      const [hit] = candidates;
      if (hit && candidates.length === 1) {
        return {
          ...base,
          name: hit.name,
          number: hit.number,
          brand: hit.brand,
          brand_confidence: 1,
          brand_uncertain: false,
          part: { id: hit.part_id, name: hit.name },
          candidates: [],
        };
      }
      if (candidates.length) break;
    }

    const known = prefixed
      ? await catalogueBrand(prefixed.brand)
      : line.brand && (await catalogueBrand(line.brand));
    const brand = known || prefixed?.brand || line.brand;
    const confidence = prefixed ? PREFIX_CONFIDENCE : line.brand_confidence;
    return {
      ...base,
      name: line.name_ru,
      number: prefixed?.number ?? line.number,
      brand,
      brand_confidence: brand ? confidence : 0,
      brand_uncertain:
        !brand ||
        confidence < CONFIDENT_BRAND ||
        (!prefixed && !known) ||
        candidates.length > 0,
      part: null,
      candidates,
    };
  };
}
