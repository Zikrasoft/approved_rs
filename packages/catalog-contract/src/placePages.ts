export const MIN_PARTS_FOR_PAGE = 3;

export const modelHasPage = (modelParts: number): boolean =>
  modelParts >= MIN_PARTS_FOR_PAGE;

export type VehiclePageFacts = {
  parts: number;
  modelParts: number;
};

export const vehicleHasPage = ({
  parts,
  modelParts,
}: VehiclePageFacts): boolean =>
  parts >= MIN_PARTS_FOR_PAGE && modelHasPage(modelParts);

export const makeHasPage = (modelPages: number): boolean => modelPages > 0;
