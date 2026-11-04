import type { MedusaContainer } from '@medusajs/framework/types';
import { Modules } from '@medusajs/framework/utils';

import { emitIndexChanges } from '../index-changes';

const scopeWith = (status: string) => {
  const emit = jest.fn();
  const scope = {
    resolve: (name: string) =>
      name === Modules.EVENT_BUS
        ? { emit }
        : {
            listIndexes: async () => [{ name: 'part_identifier', status }],
          },
  } as unknown as MedusaContainer;
  return { scope, emit };
};

describe('emitIndexChanges', () => {
  it('emits nothing while the search index has no active version yet', async () => {
    const { scope, emit } = scopeWith('pending');

    await emitIndexChanges(scope, { partIds: ['part_1'] });

    expect(emit).not.toHaveBeenCalled();
  });

  it('emits each changed Part once the index is live', async () => {
    const { scope, emit } = scopeWith('ready');

    await emitIndexChanges(scope, { partIds: ['part_1', 'part_1'] });

    expect(emit).toHaveBeenCalledWith([
      { name: 'parts.part.changed', data: { part_id: 'part_1' } },
    ]);
  });
});
