import { readCatalogueSnapshot } from '@podbor/catalog-contract';

export const readSnapshot = async (response: Promise<{ data: string }>) =>
  readCatalogueSnapshot(new Blob([(await response).data]).stream());
