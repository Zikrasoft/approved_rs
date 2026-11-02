export const MIN_PARTS_FOR_PAGE = 3;

export const MIN_REQUIREMENT_MATCHES_FOR_PAGE = 2;

export type PlaceParts = {
  parts: number;
  required: number;
};

export const requirementMatchesCount = (matches: number): boolean =>
  matches >= MIN_REQUIREMENT_MATCHES_FOR_PAGE;

const placeHasParts = ({ parts, required }: PlaceParts): boolean =>
  parts >= MIN_PARTS_FOR_PAGE || requirementMatchesCount(required);

export const modelHasPage = (model: PlaceParts): boolean =>
  placeHasParts(model);

export type VehiclePageFacts = {
  vehicle: PlaceParts;
  model: PlaceParts;
};

export const vehicleHasPage = ({ vehicle, model }: VehiclePageFacts): boolean =>
  placeHasParts(vehicle) && placeHasParts(model);

export const modelCategoryHasPage = ({
  fitted,
  required,
}: {
  fitted: number;
  required: number;
}): boolean => fitted > 0 || requirementMatchesCount(required);

export const makeHasPage = (modelPages: number): boolean => modelPages > 0;
