import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import { linkFitmentNotes } from '../modules/catalog/fitment-notes';

export default async function linkFitmentNotesOnce({
  container,
}: {
  container: MedusaContainer;
}): Promise<void> {
  await linkFitmentNotes(
    container.resolve(ContainerRegistrationKeys.PG_CONNECTION),
  );
}
