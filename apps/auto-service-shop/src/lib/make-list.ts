import { sortedMakes, type Make } from '@podbor/catalog-contract';

export const makeListJson = (makes: Make[]): string =>
  `${JSON.stringify(sortedMakes(makes), null, 2)}\n`;
