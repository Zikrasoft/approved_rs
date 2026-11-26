import { z } from 'zod';

import type PublishModuleService from '../../modules/publish/service';

const publishChangesSchema = z.object({
  fresh: z.array(z.string()),
  listedFlipped: z.array(z.string()),
  translatedParts: z.array(z.string()),
  sweptIdentifiers: z.array(z.string()),
});

export type PublishChanges = z.infer<typeof publishChangesSchema>;

const unfinishedReportSchema = z.object({ unfinished: publishChangesSchema });

export const NO_CHANGES: PublishChanges = {
  fresh: [],
  listedFlipped: [],
  translatedParts: [],
  sweptIdentifiers: [],
};

const distinct = (...lists: string[][]) => [...new Set(lists.flat())];

export const withChanges = (
  changes: PublishChanges,
  more: Partial<PublishChanges>,
): PublishChanges => ({
  fresh: distinct(changes.fresh, more.fresh ?? []),
  listedFlipped: distinct(changes.listedFlipped, more.listedFlipped ?? []),
  translatedParts: distinct(
    changes.translatedParts,
    more.translatedParts ?? [],
  ),
  sweptIdentifiers: distinct(
    changes.sweptIdentifiers,
    more.sweptIdentifiers ?? [],
  ),
});

export async function unfinishedChanges(
  publish: Pick<PublishModuleService, 'listCatalogueRuns'>,
): Promise<PublishChanges> {
  const [last] = await publish.listCatalogueRuns(
    { kind: 'publish', report: { $ne: null } },
    { select: ['report'], order: { created_at: 'DESC' }, take: 1 },
  );
  return (
    unfinishedReportSchema.safeParse(last?.report).data?.unfinished ??
    NO_CHANGES
  );
}

export const identifiersToReindex = (changes: PublishChanges) =>
  distinct(changes.fresh, changes.listedFlipped);

export const identifiersToPurge = (changes: PublishChanges) =>
  distinct(changes.fresh, changes.listedFlipped, changes.sweptIdentifiers);
