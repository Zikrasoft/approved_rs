import type PublishModuleService from '../../../modules/publish/service';
import {
  identifiersToPurge,
  identifiersToReindex,
  NO_CHANGES,
  type PublishChanges,
  unfinishedChanges,
  withChanges,
} from '../changes';

const CHANGES: PublishChanges = {
  fresh: ['id_1', 'id_2'],
  listedFlipped: ['id_2', 'id_3'],
  translatedParts: ['part_1'],
  sweptIdentifiers: ['id_3', 'id_4'],
};

const runsWith = (runs: { report: unknown }[]) => {
  const listCatalogueRuns = jest.fn(async () => runs);
  return {
    publish: { listCatalogueRuns } as unknown as Pick<
      PublishModuleService,
      'listCatalogueRuns'
    >,
    listCatalogueRuns,
  };
};

describe('withChanges', () => {
  it('merges every list without repeating an id', () => {
    expect(
      withChanges(CHANGES, {
        fresh: ['id_2', 'id_5'],
        listedFlipped: ['id_3'],
        translatedParts: ['part_1', 'part_2'],
        sweptIdentifiers: ['id_6'],
      }),
    ).toEqual({
      fresh: ['id_1', 'id_2', 'id_5'],
      listedFlipped: ['id_2', 'id_3'],
      translatedParts: ['part_1', 'part_2'],
      sweptIdentifiers: ['id_3', 'id_4', 'id_6'],
    });
  });

  it('keeps the lists a partial change set leaves out', () => {
    expect(withChanges(CHANGES, {})).toEqual(CHANGES);
  });
});

describe('unfinishedChanges', () => {
  it('resumes the change set the last Publish run left unfinished', async () => {
    const { publish, listCatalogueRuns } = runsWith([
      { report: { published: 3, unfinished: CHANGES } },
    ]);

    expect(await unfinishedChanges(publish)).toEqual(CHANGES);
    expect(listCatalogueRuns).toHaveBeenCalledWith(
      { kind: 'publish', report: { $ne: null } },
      { select: ['report'], order: { created_at: 'DESC' }, take: 1 },
    );
  });

  it('resumes nothing after a run that finished', async () => {
    const { publish } = runsWith([{ report: { published: 3 } }]);

    expect(await unfinishedChanges(publish)).toEqual(NO_CHANGES);
  });

  it('resumes nothing from a report of another shape', async () => {
    const { publish } = runsWith([
      { report: { unfinished: { fresh: 'id_1' } } },
    ]);

    expect(await unfinishedChanges(publish)).toEqual(NO_CHANGES);
  });

  it('resumes nothing before the first Publish run', async () => {
    const { publish } = runsWith([]);

    expect(await unfinishedChanges(publish)).toEqual(NO_CHANGES);
  });
});

describe('the identifiers a Publish touches', () => {
  it('reindexes the fresh and flipped numbers once each', () => {
    expect(identifiersToReindex(CHANGES)).toEqual(['id_1', 'id_2', 'id_3']);
  });

  it('purges the fresh, flipped and swept numbers once each', () => {
    expect(identifiersToPurge(CHANGES)).toEqual([
      'id_1',
      'id_2',
      'id_3',
      'id_4',
    ]);
  });
});
