export const MIN_PARTS_FOR_PAGE = 3;

export const MIN_REQUIREMENT_MATCHES_FOR_PAGE = 2;

export type PlaceParts = {
  parts: number;
  required: number;
};

export const requirementMatchesCount = (matches: number): boolean =>
  matches >= MIN_REQUIREMENT_MATCHES_FOR_PAGE;

export const seriesHasPage = ({ parts, required }: PlaceParts): boolean =>
  parts >= MIN_PARTS_FOR_PAGE || requirementMatchesCount(required);

export const seriesCategoryHasPage = (parts: number): boolean =>
  parts >= MIN_PARTS_FOR_PAGE;

export const makeHasPage = (seriesPages: number): boolean => seriesPages > 0;
