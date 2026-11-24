import type {
  Category,
  PartPage,
  SnapshotFitment,
  Vehicle,
} from '@podbor/catalog-contract';

export type Fit = SnapshotFitment & { vehicle: Vehicle };

export type PartPageEntry = PartPage & {
  slug: string;
  indexable: boolean;
  priceOnRequest: boolean;
  category: Category | null;
  fits: Fit[];
  requirementCars: Vehicle[];
  kitCars: Vehicle[];
};

type Series = Vehicle['model']['chassis']['series'];

export type SeriesHub = Series & { slug: string };

export type SeriesModel = { model: Vehicle['model']; vehicles: Vehicle[] };

export type ModelPart = {
  part: PartPage['part'];
  pages: PartPageEntry[];
  fits: Fit[];
};
