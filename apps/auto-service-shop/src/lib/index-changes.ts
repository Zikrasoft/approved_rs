import type {
  ISearchModuleService,
  MedusaContainer,
} from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';

import {
  PART_CHANGED_EVENT,
  PART_IDENTIFIER_INDEX,
  PART_IDENTIFIERS_DELETED_EVENT,
} from '../search/part-changed-event';

const hasNoActiveVersion = async (scope: MedusaContainer) =>
  (
    await scope.resolve<ISearchModuleService>(Modules.SEARCH).listIndexes()
  ).some(
    ({ name, status }) =>
      name === PART_IDENTIFIER_INDEX && status === 'pending',
  );

export async function emitIndexChanges(
  scope: MedusaContainer,
  {
    partIds = [],
    deletedIdentifierIds = [],
  }: { partIds?: Iterable<string>; deletedIdentifierIds?: string[] },
): Promise<void> {
  const messages = [
    ...(deletedIdentifierIds.length
      ? [
          {
            name: PART_IDENTIFIERS_DELETED_EVENT,
            data: { ids: deletedIdentifierIds },
          },
        ]
      : []),
    ...[...new Set(partIds)].map((part_id) => ({
      name: PART_CHANGED_EVENT,
      data: { part_id },
    })),
  ];
  if (messages.length && !(await hasNoActiveVersion(scope))) {
    await scope
      .resolve(Modules.EVENT_BUS)
      .emit<{ part_id?: string; ids?: string[] }>(messages);
  }
}
