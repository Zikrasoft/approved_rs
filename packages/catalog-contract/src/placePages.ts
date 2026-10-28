export const MIN_PARTS_FOR_PAGE = 3;

export const modelHasPage = (modelParts: number): boolean =>
  modelParts >= MIN_PARTS_FOR_PAGE;

export type VehiclePageFacts = {
  parts: number;
  modelParts: number;
  modelVehiclesWithEnoughParts: number;
};

export const vehicleHasPage = ({
  parts,
  modelParts,
  modelVehiclesWithEnoughParts,
}: VehiclePageFacts): boolean =>
  parts >= MIN_PARTS_FOR_PAGE &&
  modelHasPage(modelParts) &&
  modelVehiclesWithEnoughParts > 1;

export const makeHasPage = (modelPages: number): boolean => modelPages > 0;
