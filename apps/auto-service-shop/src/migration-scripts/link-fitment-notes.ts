import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

import {
  buildFitmentIndexes,
  linkFitmentNotes,
  rawOf,
} from '../modules/catalog/fitment-notes';

export default async function linkFitmentNotesOnce({
  container,
}: {
  container: MedusaContainer;
}): Promise<void> {
  const raw = rawOf(container.resolve(ContainerRegistrationKeys.PG_CONNECTION));
  await buildFitmentIndexes(raw);
  await linkFitmentNotes(raw);
}
