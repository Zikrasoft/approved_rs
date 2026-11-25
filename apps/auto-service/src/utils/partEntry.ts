import type {
  PartPage,
  RelatedPartPage,
  SiteFitment,
  Vehicle,
} from '@podbor/catalog-contract';

export type Fit = SiteFitment & { vehicle: Vehicle };

export type PartCard = RelatedPartPage & { priceOnRequest: boolean };

export type PartPageView = PartCard & {
  indexable: boolean;
  fits: Fit[];
  requirementCars: Vehicle[];
  kitCars: Vehicle[];
};

type Series = Vehicle['model']['chassis']['series'];

export type SeriesHub = Series & { slug: string };

export type SeriesModel = { model: Vehicle['model']; vehicles: Vehicle[] };

export type ModelPart = {
  part: PartPage['part'];
  pages: PartCard[];
  fits: Fit[];
};
