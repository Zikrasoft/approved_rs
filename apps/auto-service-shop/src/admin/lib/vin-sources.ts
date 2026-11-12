import { type SourceCounts, VIN_LOOKUP_SOURCES } from '../../lib/vin/sources';
import type { TFunction } from './vehicle-label';

export const sourceLine = (t: TFunction, sources: SourceCounts) =>
  VIN_LOOKUP_SOURCES.filter((source) => sources[source] > 0)
    .map((source) =>
      t(`vinLookups.sources.${source}`, { count: sources[source] }),
    )
    .join(' · ');
