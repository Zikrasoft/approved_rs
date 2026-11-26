import { asValue } from '@medusajs/framework/awilix';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { createFakeShopAi } from '../../../../../integration-tests/fakeShopAi';
import { createVehicleFixture } from '../../../../../integration-tests/vehicleFixture';
import { createFakeSupplier } from '../../../../../integration-tests/fakeSupplierAdapter';
import { importRuns } from '../../../../../integration-tests/importRuns';
import { loggedEvents } from '../../../../../integration-tests/loggedEvents';
import { SHOP_AI_REGISTRATION } from '../../../../lib/ai';
import { memoized } from '../../../../lib/catalogue-memo';
import {
  PUBLISH_PURGE_REGISTRATION,
  PUBLISH_SEARCH_REGISTRATION,
  type PublishSearch,
} from '../../../../lib/publish/chain';
import {
  PUBLISH_PREWARM_REGISTRATION,
  type PublishPrewarm,
} from '../../../../lib/publish/prewarm-run';
import type { PublishPurge } from '../../../../lib/publish/purge';
import type { IndexChanges } from '../../../../lib/index-changes';
import { SUPPLIER_ADAPTERS_REGISTRATION } from '../../../../lib/suppliers/adapter';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import { PUBLISH_MODULE } from '../../../../modules/publish';
import type PublishModuleService from '../../../../modules/publish/service';
import type CatalogModuleService from '../../../../modules/catalog/service';
import { SUPPLIER_MODULE } from '../../../../modules/supplier';
import type SupplierModuleService from '../../../../modules/supplier/service';

const supplier = createFakeSupplier('mann-filter');
const shopAi = createFakeShopAi();

const SERBIAN = new Map([
  ['Масляный фильтр', 'Filter ulja'],
  ['Масляный фильтр MANN HU 6004 x', 'Filter ulja MANN HU 6004 x'],
  ['Воздушный фильтр', 'Filter vazduha'],
  ['Салонный фильтр', 'Kabinski filter'],
  ['Моторное масло', 'Motorno ulje'],
  ['Масло для двигателя.', 'Ulje za motor.'],
  ['Вязкость', 'Viskozitet'],
  ['Синтетика', 'Sintetika'],
  ['Только с M-пакетом', 'Samo sa M paketom'],
  ['Фильтр с обратным клапаном.', 'Filter sa nepovratnim ventilom.'],
]);
const ENGLISH = new Map([
  ['Масляный фильтр', 'Oil filter'],
  ['Масляный фильтр MANN HU 6004 x', 'Oil filter MANN HU 6004 x'],
  ['Воздушный фильтр', 'Air filter'],
  ['Салонный фильтр', 'Cabin filter'],
  ['3 серия', '3 Series'],
  ['Моторное масло', 'Engine oil'],
  ['Масло для двигателя.', 'Oil for the engine.'],
  ['Вязкость', 'Viscosity'],
  ['Синтетика', 'Synthetic'],
  ['Только с M-пакетом', 'M Sport package only'],
  ['Фильтр с обратным клапаном.', 'Filter with a check valve.'],
]);

type FakeNetwork = {
  openAiRequests: number;
  githubRequests: number;
  unsafeAnswer: boolean;
};

const network: FakeNetwork = {
  openAiRequests: 0,
  githubRequests: 0,
  unsafeAnswer: false,
};

const searchIndex = {
  changes: [] as IndexChanges[],
  swaps: [] as string[],
  sawAtSwap: [] as { memo: string; snapshotRows: number }[],
  active: true,
  indexed: null as number | null,
  refusal: null as Error | null,
};

const warmUp = {
  calls: [] as string[],
  refusal: null as Error | null,
};

const pageCache = {
  purged: [] as string[],
  refusal: null as Error | null,
  gate: null as Promise<void> | null,
};

const HUB_PATTERNS = [
  '-/[a-z][a-z]/cars/',
  '-/[a-z][a-z]/parts/$',
  '-/[a-z][a-z]/parts/[0-9a-oq-z]',
  '-/[a-z][a-z]/parts/p[0-9a-z-]',
  'llms[.]txt',
  'sitemap',
  'catalogue-build[.]json',
];

const openAiAnswer = (body: {
  messages: { content: string }[];
}): Record<string, string> => {
  const dictionary = body.messages[0].content.includes('into Serbian')
    ? SERBIAN
    : ENGLISH;
  const russian = JSON.parse(body.messages[1].content) as Record<
    string,
    string
  >;
  return Object.fromEntries(
    Object.entries(russian).map(([key, text]) => [
      key,
      network.unsafeAnswer
        ? `<script>x</script>${text}`
        : (dictionary.get(text) ?? `untranslated ${key}`),
    ]),
  );
};

const fakeFetch =
  (realFetch: typeof fetch): typeof fetch =>
  async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    const { hostname } = new URL(url);
    if (hostname === 'api.openai.com') {
      network.openAiRequests += 1;
      const answer = openAiAnswer(JSON.parse(String(init?.body)));
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(answer) } }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (hostname === 'api.github.com') {
      network.githubRequests += 1;
      return new Response(null, { status: 500 });
    }
    return realFetch(input, init);
  };

medusaIntegrationTestRunner({
  moduleName: 'catalog',
  dbName: 'medusa-publish-integration',
  hooks: {
    beforeServerStart: async (container) => {
      container.register(
        PUBLISH_SEARCH_REGISTRATION,
        asValue({
          changed: async (changes) => {
            if (searchIndex.refusal) throw searchIndex.refusal;
            searchIndex.changes.push(changes);
          },
          swap: async (index) => {
            searchIndex.swaps.push(index);
            searchIndex.sawAtSwap.push({
              memo: await memoized('swap-probe', async () => 'fresh'),
              snapshotRows: (
                await container
                  .resolve<PublishModuleService>(PUBLISH_MODULE)
                  .listedSeriesCategoryCounts()
              ).length,
            });
          },
          partsIndexActive: async () => searchIndex.active,
          settledPublishedDocuments: async (published) =>
            searchIndex.indexed ?? published,
        } satisfies PublishSearch),
      );
      container.register(
        PUBLISH_PURGE_REGISTRATION,
        asValue((async (pattern) => {
          await pageCache.gate;
          if (pageCache.refusal) throw pageCache.refusal;
          pageCache.purged.push(pattern);
        }) satisfies PublishPurge),
      );
      container.register(
        PUBLISH_PREWARM_REGISTRATION,
        asValue((async () => {
          warmUp.calls.push(`after ${pageCache.purged.length} purges`);
          if (warmUp.refusal) throw warmUp.refusal;
        }) satisfies PublishPrewarm),
      );
      container.register(
        SUPPLIER_ADAPTERS_REGISTRATION,
        asValue([supplier.adapter]),
      );
      container.register(SHOP_AI_REGISTRATION, asValue(shopAi.ai));
    },
  },
  testSuite: ({ api, getContainer }) => {
    describe('publish chain', () => {
      let adminHeaders: { headers: { authorization: string } };
      let catalog: CatalogModuleService;
      let realFetch: typeof fetch;
      let nightlyId: string;

      const post = (path: string, body?: unknown) =>
        api.post(path, body, adminHeaders).catch((error) => error.response);
      const get = (path: string) =>
        api.get(path, adminHeaders).catch((error) => error.response);

      const finishedRun = async () => {
        const deadline = Date.now() + 50_000;
        while (Date.now() < deadline) {
          const latest = await get('/admin/publish-runs/latest');
          if (latest.data.publish_run?.status !== 'running') {
            return latest.data.publish_run;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        throw new Error('the publish run did not finish');
      };

      const publish = async () => {
        const started = await post('/admin/publish-runs');
        expect(started.status).toBe(202);
        return finishedRun();
      };

      const translationsOf = async (partId: string) =>
        (await get(`/admin/translations/part/${partId}`)).data.translations;

      beforeAll(async () => {
        catalog = getContainer().resolve(CATALOG_MODULE);
        adminHeaders = await createAdminAuth(
          getContainer(),
          api,
          'admin@publish-tests.local',
          'supersecret',
        );
        const suppliers: SupplierModuleService =
          getContainer().resolve(SUPPLIER_MODULE);
        const nightly = await suppliers.createSuppliers({
          key: 'mann-filter',
          name: 'Nightly supplier',
          markup_percentage: 20,
        });
        nightlyId = nightly.id;
        const mann = await catalog.createBrands({
          name: 'Mann-Filter',
          slug: 'mann-filter',
        });
        await catalog.createBrandSpellings({
          brand_id: mann.id,
          supplier_id: nightly.id,
          value: 'MANN',
        });
        const oilFilters = await catalog.createCategories({
          slug: 'oil-filters',
          name: 'Масляные фильтры',
        });
        await suppliers.createSupplierCategories({
          supplier_id: nightly.id,
          code: 'OIL',
          category_id: oilFilters.id,
        });
        process.env.OPENAI_API_KEY = 'test-openai-key';
        realFetch = globalThis.fetch;
        globalThis.fetch = fakeFetch(realFetch);
      });

      afterAll(() => {
        globalThis.fetch = realFetch;
        delete process.env.OPENAI_API_KEY;
      });

      beforeEach(() => {
        network.openAiRequests = 0;
        network.githubRequests = 0;
        network.unsafeAnswer = false;
        searchIndex.changes = [];
        searchIndex.swaps = [];
        searchIndex.sawAtSwap = [];
        searchIndex.active = true;
        searchIndex.indexed = null;
        searchIndex.refusal = null;
        pageCache.purged = [];
        pageCache.refusal = null;
        pageCache.gate = null;
        warmUp.calls = [];
        warmUp.refusal = null;
        delete process.env.CATALOGUE_SHRINK_ALLOWED;
        supplier.articles.length = 0;
      });

      it('shows no run before the first Publish', async () => {
        const latest = await get('/admin/publish-runs/latest');
        expect(latest.status).toBe(200);
        expect(latest.data.publish_run).toBeNull();
      });

      it('translates Russian names, reindexes and purges the page cache without asking GitHub anything', async () => {
        const part = await catalog.createParts({ name: 'Масляный фильтр' });

        const run = await publish();

        expect(run).toEqual(
          expect.objectContaining({
            status: 'succeeded',
            failed_step: null,
            error: null,
          }),
        );
        expect(await translationsOf(part.id)).toEqual({
          sr: { name: 'Filter ulja' },
          en: { name: 'Oil filter' },
        });
        expect(network.githubRequests).toBe(0);
        expect(searchIndex.swaps).toEqual(['catalogue_car']);
        expect(pageCache.purged).toEqual(HUB_PATTERNS);
      });

      it('warms the pages after the purge, and a failing warm-up does not fail the run', async () => {
        const warmed = await publish();
        expect(warmed.status).toBe('succeeded');
        expect(warmUp.calls).toEqual([`after ${HUB_PATTERNS.length} purges`]);

        warmUp.refusal = new Error('site down');
        const refused = await publish();
        expect(refused).toEqual(
          expect.objectContaining({ status: 'succeeded', failed_step: null }),
        );
      });

      it('does not warm anything when the purge fails', async () => {
        pageCache.refusal = new Error('The page cache refused the purge');
        const failed = await publish();
        expect(failed.failed_step).toBe('purge');
        expect(warmUp.calls).toEqual([]);
      });

      it('imports no Supplier catalogue; its own Import brings the articles Publish then translates', async () => {
        shopAi.name = 'Масляный фильтр MANN HU 6004 x';
        supplier.articles.push({
          article_id: 'N-1',
          brand: 'MANN',
          number: 'HU 6004 x',
          name: 'Uljni filter',
          category: 'OIL',
        });

        await publish();
        const beforeImport = await catalog.listPartIdentifiers({
          normalized_value: 'HU6004X',
        });
        await importRuns(api, adminHeaders).run(nightlyId);
        const run = await publish();

        expect(beforeImport).toEqual([]);
        expect(run.status).toBe('succeeded');
        const [identifier] = await catalog.listPartIdentifiers({
          normalized_value: 'HU6004X',
        });
        expect(await translationsOf(identifier.part_id)).toEqual({
          sr: { name: 'Filter ulja MANN HU 6004 x' },
          en: { name: 'Oil filter MANN HU 6004 x' },
        });
      });

      it('asks the model nothing when no Russian changed', async () => {
        await publish();
        network.openAiRequests = 0;

        const run = await publish();

        expect(run.status).toBe('succeeded');
        expect(network.openAiRequests).toBe(0);
      });

      it('keeps a human-edited translation while its Russian is unchanged', async () => {
        const part = await catalog.createParts({ name: 'Воздушный фильтр' });
        await publish();

        const edited = await post(`/admin/translations/part/${part.id}`, {
          locale: 'sr',
          fields: { name: 'Vazdušni filter' },
        });
        expect(edited.status).toBe(200);
        await publish();

        expect(await translationsOf(part.id)).toEqual({
          sr: { name: 'Vazdušni filter' },
          en: { name: 'Air filter' },
        });

        await catalog.updateParts({ id: part.id, name: 'Салонный фильтр' });
        await publish();

        expect(await translationsOf(part.id)).toEqual({
          sr: { name: 'Kabinski filter' },
          en: { name: 'Cabin filter' },
        });
      });

      it('keeps a translation a person wrote before the first Publish', async () => {
        const part = await catalog.createParts({ name: 'Воздушный фильтр' });
        await post(`/admin/translations/part/${part.id}`, {
          locale: 'en',
          fields: { name: 'Engine air filter' },
        });

        await publish();

        expect(await translationsOf(part.id)).toEqual({
          sr: { name: 'Filter vazduha' },
          en: { name: 'Engine air filter' },
        });
      });

      it('translates a Part description with its name', async () => {
        const part = await catalog.createParts({
          name: 'Масляный фильтр',
          description: 'Фильтр с обратным клапаном.',
        });

        await publish();

        expect(await translationsOf(part.id)).toEqual({
          sr: {
            name: 'Filter ulja',
            description: 'Filter sa nepovratnim ventilom.',
          },
          en: { name: 'Oil filter', description: 'Filter with a check valve.' },
        });
      });

      it('translates a Series name and keeps the Serbian typed when it was created', async () => {
        const make = await catalog.createMakes({ slug: 'bmw', name: 'BMW' });
        const series = await catalog.createSeries({
          make_id: make.id,
          name: '3 серия',
          translations: { sr: { name: 'Serija 3' } },
        });

        await publish();

        expect(
          (await get(`/admin/translations/series/${series.id}`)).data
            .translations,
        ).toEqual({ sr: { name: 'Serija 3' }, en: { name: '3 Series' } });
        const [stored] = await catalog.listSeries({ id: series.id });
        expect(stored.translations).toEqual({
          sr: { name: 'Serija 3' },
          en: { name: '3 Series' },
        });
      });

      it('translates a Category with its field and option labels', async () => {
        const category = await catalog.createCategories({
          slug: 'engine-oil',
          name: 'Моторное масло',
          text: 'Масло для двигателя.',
        });
        const field = await catalog.createCategoryFields({
          category_id: category.id,
          key: 'viscosity',
          type: 'single-select',
          label: 'Вязкость',
        });
        const option = await catalog.createCategoryFieldOptions({
          field_id: field.id,
          key: '5w-30',
          label: 'Синтетика',
        });

        await publish();

        const translationsAt = async (entity: string, id: string) =>
          (await get(`/admin/translations/${entity}/${id}`)).data.translations;
        expect(await translationsAt('category', category.id)).toEqual({
          sr: { name: 'Motorno ulje', text: 'Ulje za motor.' },
          en: { name: 'Engine oil', text: 'Oil for the engine.' },
        });
        expect(await translationsAt('category_field', field.id)).toEqual({
          sr: { label: 'Viskozitet' },
          en: { label: 'Viscosity' },
        });
        expect(
          await translationsAt('category_field_option', option.id),
        ).toEqual({ sr: { label: 'Sintetika' }, en: { label: 'Synthetic' } });
      });

      it('translates a Fitment note and leaves Fitments without one alone', async () => {
        const vehicle = (
          await createVehicleFixture(catalog, { typeCode: 'PUBLISH-NOTE' })
        ).vehicle;
        const part = await catalog.createParts({ name: 'Масляный фильтр' });
        const [noted, plain] = await catalog.createFitments([
          {
            part_id: part.id,
            vehicle_id: vehicle.id,
            axle: 'front',
            note: 'Только с M-пакетом',
          },
          { part_id: part.id, vehicle_id: vehicle.id, axle: 'rear' },
        ]);

        await publish();

        expect(
          (await get(`/admin/translations/fitment/${noted.id}`)).data
            .translations,
        ).toEqual({
          sr: { note: 'Samo sa M paketom' },
          en: { note: 'M Sport package only' },
        });
        const [untouched] = await catalog.listFitments({ id: plain.id });
        expect(untouched.translated_from).toBeNull();
      });

      it('stops before publishing when a translation fails the safety checks', async () => {
        const part = await catalog.createParts({ name: 'Салонный фильтр' });
        network.unsafeAnswer = true;

        const run = await publish();

        expect(run.status).toBe('failed');
        expect(run.failed_step).toBe('translate');
        expect(run.error).toContain('HTML');
        expect(pageCache.purged).toEqual([]);
        expect(searchIndex.changes).toEqual([]);
        expect(searchIndex.swaps).toEqual([]);
        expect(await translationsOf(part.id)).toEqual({});
      });

      it('logs every finished run as catalogue.run, with the failed step as its reason', async () => {
        jest.spyOn(console, 'log').mockImplementation(() => undefined);
        const runs = () => loggedEvents('catalogue.run');
        const logged = async (count: number) => {
          const deadline = Date.now() + 10_000;
          while (runs().length < count && Date.now() < deadline) {
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          return runs();
        };

        const succeeded = await publish();
        pageCache.refusal = new Error('The page cache refused the purge: 500');
        const failed = await publish();

        expect(await logged(2)).toEqual([
          expect.objectContaining({
            outcome: 'succeeded',
            reason: null,
            kind: 'publish',
            run: succeeded.id,
            supplier: null,
            cause: null,
            counts: { published: expect.any(Number) },
          }),
          expect.objectContaining({
            outcome: 'failed',
            reason: 'purge',
            kind: 'publish',
            run: failed.id,
            cause: expect.stringContaining('500'),
          }),
        ]);
        expect(runs()[0].duration_ms).toBeGreaterThanOrEqual(0);
        jest.restoreAllMocks();
      });

      it('drops the catalogue memo so the pages reflect the new Publish', async () => {
        await memoized('publish-probe', async () => 'before');

        await publish();

        expect(await memoized('publish-probe', async () => 'after')).toBe(
          'after',
        );
      });

      it('builds the catalogue snapshot after publishing, so reindex and purge read the new Publish', async () => {
        const { vehicle } = await createVehicleFixture(catalog, {
          typeCode: 'PUBLISH-SNAP',
        });
        const [mann] = await catalog.listBrands({ slug: 'mann-filter' });
        const partId = await catalog.createPartWithIdentifiers({
          name: 'Масляный фильтр',
          identifiers: [
            { type: 'manufacturer-number', brand_id: mann.id, value: 'SN 1' },
          ],
        });
        await catalog.createFitments({
          part_id: partId,
          vehicle_id: vehicle.id,
        });
        await memoized('swap-probe', async () => 'before');
        const publishModule: PublishModuleService =
          getContainer().resolve(PUBLISH_MODULE);

        const run = await publish();
        const [stored] = await publishModule.listCatalogueRuns({ id: run.id });

        expect(run.status).toBe('succeeded');
        expect(Object.keys(stored.report?.step_ms ?? {}).sort()).toEqual(
          [
            'shrink',
            'sweep',
            'translate',
            'publish',
            'snapshot',
            'reindex',
            'purge',
            'prewarm',
          ].sort(),
        );
        expect(searchIndex.sawAtSwap).toEqual([
          { memo: 'fresh', snapshotRows: 1 },
        ]);
      });

      it('publishes the brand-numbers before the page cache is purged', async () => {
        const [mann] = await catalog.listBrands({ slug: 'mann-filter' });
        const partId = await catalog.createPartWithIdentifiers({
          name: 'Масляный фильтр',
          identifiers: [
            { type: 'manufacturer-number', brand_id: mann.id, value: 'W 719' },
          ],
        });
        const [identifier] = await catalog.listPartIdentifiers({
          part_id: partId,
        });
        const publishModule: PublishModuleService =
          getContainer().resolve(PUBLISH_MODULE);
        const published = async () =>
          (await publishModule.listPublishedNumbers({ id: identifier.id }))
            .length;
        let release = () => {};
        pageCache.gate = new Promise((resolve) => {
          release = resolve;
        });

        await post('/admin/publish-runs');
        const deadline = Date.now() + 20_000;
        while ((await published()) === 0 && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        const beforePurge = await published();
        release();
        const run = await finishedRun();

        expect(beforePurge).toBe(1);
        expect(run.status).toBe('succeeded');
      });

      it('refuses a second Publish while one is running', async () => {
        let release = () => {};
        pageCache.gate = new Promise((resolve) => {
          release = resolve;
        });

        const first = await post('/admin/publish-runs');
        const second = await post('/admin/publish-runs');
        release();
        await finishedRun();

        expect(first.status).toBe(202);
        expect(first.data.publish_run.status).toBe('running');
        expect(second.status).toBe(409);
        expect(second.data.code).toBe('CATALOGUE_BUSY');
      });

      it('starts one run for two Publish clicks at the same moment', async () => {
        let release = () => {};
        pageCache.gate = new Promise((resolve) => {
          release = resolve;
        });

        const answers = await Promise.all([
          post('/admin/publish-runs'),
          post('/admin/publish-runs'),
        ]);
        release();
        await finishedRun();

        expect(answers.map(({ status }) => status).sort()).toEqual([202, 409]);
      });

      it('says who started the latest run', async () => {
        await publish();

        const latest = await get('/admin/publish-runs/latest');

        expect(latest.data.publish_run.created_by_user).toMatchObject({
          email: expect.any(String),
        });
      });

      describe('the change set search receives', () => {
        const mannId = async () =>
          (await catalog.listBrands({ slug: 'mann-filter' }))[0].id;

        const numberedPart = async (value: string) => {
          const partId = await catalog.createPartWithIdentifiers({
            name: 'Масляный фильтр',
            identifiers: [
              {
                type: 'manufacturer-number',
                brand_id: await mannId(),
                value,
              },
            ],
          });
          const [identifier] = await catalog.listPartIdentifiers({
            part_id: partId,
          });
          return { partId, identifierId: identifier.id };
        };

        const settled = async () => {
          await publish();
          searchIndex.changes = [];
          searchIndex.swaps = [];
        };

        it('is the Part of a freshly published number', async () => {
          const { partId } = await numberedPart('CS 1');
          await settled();
          await catalog.addPartIdentifier(
            partId,
            {
              type: 'manufacturer-number',
              brand_id: await mannId(),
              value: 'CS 1 B',
            },
            {},
          );

          const run = await publish();

          expect(run.status).toBe('succeeded');
          expect(searchIndex.changes).toEqual([
            { partIds: [partId], deletedIdentifierIds: [] },
          ]);
          expect(searchIndex.swaps).toEqual(['catalogue_car']);
        });

        it('is the Part whose number stopped being listed', async () => {
          const replaced = await numberedPart('CS 2');
          const successor = await numberedPart('CS 3');
          await settled();
          await catalog.updateParts({
            id: replaced.partId,
            replaced_by_id: successor.partId,
          });

          await publish();

          expect(searchIndex.changes).toEqual([
            { partIds: [replaced.partId], deletedIdentifierIds: [] },
          ]);
        });

        it('is the Part whose translation was written', async () => {
          const { partId } = await numberedPart('CS 4');
          await settled();
          await catalog.updateParts({ id: partId, name: 'Воздушный фильтр' });

          await publish();

          expect(searchIndex.changes).toEqual([
            { partIds: [partId], deletedIdentifierIds: [] },
          ]);
        });

        it('names the swept numbers as deleted', async () => {
          const { partId } = await numberedPart('CS 5');
          await catalog.addPartIdentifier(
            partId,
            {
              type: 'manufacturer-number',
              brand_id: await mannId(),
              value: 'CS 5 B',
            },
            {},
          );
          await settled();
          const [gone] = await catalog.listPartIdentifiers({
            normalized_value: 'CS5B',
          });
          await catalog.softDeletePartIdentifiers([gone.id]);

          await publish();

          expect(searchIndex.changes).toEqual([
            { partIds: [], deletedIdentifierIds: [gone.id] },
          ]);
        });

        it('rebuilds the whole number index instead while it has no active version', async () => {
          await numberedPart('CS 6');
          searchIndex.active = false;

          const run = await publish();

          expect(run.status).toBe('succeeded');
          expect(searchIndex.changes).toEqual([]);
          expect(searchIndex.swaps).toEqual([
            'part_identifier',
            'catalogue_car',
          ]);
        });
      });

      describe('the pages the cache purges', () => {
        const mannId = async () =>
          (await catalog.listBrands({ slug: 'mann-filter' }))[0].id;

        const settled = async () => {
          await publish();
          pageCache.purged = [];
        };

        it('are the hubs alone when no number changed', async () => {
          await settled();

          const run = await publish();

          expect(run.status).toBe('succeeded');
          expect(pageCache.purged).toEqual(HUB_PATTERNS);
        });

        it('add the Part page of a freshly published number, in every locale', async () => {
          await settled();
          await catalog.createPartWithIdentifiers({
            name: 'Масляный фильтр',
            identifiers: [
              {
                type: 'manufacturer-number',
                brand_id: await mannId(),
                value: 'PG 1',
              },
            ],
          });

          await publish();

          expect(pageCache.purged).toEqual([
            ...HUB_PATTERNS,
            '-/[a-z][a-z]/parts/p/mann-filter-pg1/',
          ]);
        });

        it('add the Part page whose number stopped being listed', async () => {
          const brand_id = await mannId();
          const replaced = await catalog.createPartWithIdentifiers({
            name: 'Масляный фильтр',
            identifiers: [
              { type: 'manufacturer-number', brand_id, value: 'PG 2' },
            ],
          });
          const successor = await catalog.createPartWithIdentifiers({
            name: 'Масляный фильтр',
            identifiers: [
              { type: 'manufacturer-number', brand_id, value: 'PG 3' },
            ],
          });
          await settled();
          await catalog.updateParts({
            id: replaced,
            replaced_by_id: successor,
          });

          await publish();

          expect(pageCache.purged).toEqual([
            ...HUB_PATTERNS,
            '-/[a-z][a-z]/parts/p/mann-filter-pg2/',
          ]);
        });

        it('add the Part page of a swept number', async () => {
          const brand_id = await mannId();
          await catalog.createPartWithIdentifiers({
            name: 'Масляный фильтр',
            identifiers: ['PG 4', 'PG 4 B'].map((value) => ({
              type: 'manufacturer-number' as const,
              brand_id,
              value,
            })),
          });
          await settled();
          const [gone] = await catalog.listPartIdentifiers({
            normalized_value: 'PG4B',
          });
          await catalog.softDeletePartIdentifiers([gone.id]);

          await publish();

          expect(pageCache.purged).toEqual([
            ...HUB_PATTERNS,
            '-/[a-z][a-z]/parts/p/mann-filter-pg4b/',
          ]);
        });

        it('fail the run at purge and keep the numbers published when the cache refuses', async () => {
          await catalog.createPartWithIdentifiers({
            name: 'Масляный фильтр',
            identifiers: [
              {
                type: 'manufacturer-number',
                brand_id: await mannId(),
                value: 'PG 5',
              },
            ],
          });
          pageCache.refusal = new Error('The page cache refused the purge');
          const publishModule: PublishModuleService =
            getContainer().resolve(PUBLISH_MODULE);

          const failed = await publish();
          const [identifier] = await catalog.listPartIdentifiers({
            normalized_value: 'PG5',
          });
          const kept = await publishModule.listPublishedNumbers({
            id: identifier.id,
          });
          pageCache.refusal = null;
          const retried = await publish();
          const retriedPurge = pageCache.purged;
          pageCache.purged = [];
          await publish();

          expect(failed).toEqual(
            expect.objectContaining({
              status: 'failed',
              failed_step: 'purge',
              error: 'The page cache refused the purge',
            }),
          );
          expect(kept).toHaveLength(1);
          expect(retried.status).toBe('succeeded');
          expect(retriedPurge).toEqual([
            ...HUB_PATTERNS,
            '-/[a-z][a-z]/parts/p/mann-filter-pg5/',
          ]);
          expect(pageCache.purged).toEqual(HUB_PATTERNS);
        });

        it('carry the Part pages of a run that failed before its purge into the next Publish', async () => {
          await settled();
          const partId = await catalog.createPartWithIdentifiers({
            name: 'Масляный фильтр',
            identifiers: [
              {
                type: 'manufacturer-number',
                brand_id: await mannId(),
                value: 'PG 6',
              },
            ],
          });
          searchIndex.changes = [];
          searchIndex.refusal = new Error('Typesense is down');

          const failed = await publish();
          searchIndex.refusal = null;
          const retried = await publish();

          expect(failed).toEqual(
            expect.objectContaining({
              status: 'failed',
              failed_step: 'reindex',
            }),
          );
          expect(retried.status).toBe('succeeded');
          expect(searchIndex.changes).toEqual([
            { partIds: [partId], deletedIdentifierIds: [] },
          ]);
          expect(pageCache.purged).toEqual([
            ...HUB_PATTERNS,
            '-/[a-z][a-z]/parts/p/mann-filter-pg6/',
          ]);
        });

        it('carry the Part pages of a run whose snapshot failed into the next Publish', async () => {
          await settled();
          await catalog.createPartWithIdentifiers({
            name: 'Масляный фильтр',
            identifiers: [
              {
                type: 'manufacturer-number',
                brand_id: await mannId(),
                value: 'PG 7',
              },
            ],
          });
          const publishModule: PublishModuleService =
            getContainer().resolve(PUBLISH_MODULE);
          jest
            .spyOn(publishModule, 'buildCatalogueSnapshot')
            .mockRejectedValueOnce(new Error('The snapshot ran out of disk'));

          const failed = await publish();
          const purgedOnFailure = [...pageCache.purged];
          const retried = await publish();
          jest.restoreAllMocks();

          expect(failed).toEqual(
            expect.objectContaining({
              status: 'failed',
              failed_step: 'snapshot',
              error: 'The snapshot ran out of disk',
            }),
          );
          expect(purgedOnFailure).toEqual([]);
          expect(retried.status).toBe('succeeded');
          expect(pageCache.purged).toEqual([
            ...HUB_PATTERNS,
            '-/[a-z][a-z]/parts/p/mann-filter-pg7/',
          ]);
        });
      });

      it('logs search.drift when search disagrees with the published numbers, and still succeeds', async () => {
        jest.spyOn(console, 'log').mockImplementation(() => undefined);
        const [mann] = await catalog.listBrands({ slug: 'mann-filter' });
        await catalog.createPartWithIdentifiers({
          name: 'Масляный фильтр',
          identifiers: [
            { type: 'manufacturer-number', brand_id: mann.id, value: 'DR 1' },
          ],
        });
        searchIndex.indexed = 0;

        const run = await publish();
        expect(run.status).toBe('succeeded');
        expect(loggedEvents('search.drift')).toEqual([
          expect.objectContaining({
            outcome: 'mismatch',
            index: 'part_identifier',
            indexed: 0,
            published: 1,
          }),
        ]);
        jest.restoreAllMocks();
      });

      it('logs no drift when search agrees', async () => {
        jest.spyOn(console, 'log').mockImplementation(() => undefined);

        await publish();

        expect(loggedEvents('search.drift')).toEqual([]);
        jest.restoreAllMocks();
      });

      it('refuses, before writing anything, a Publish that would leave fewer than half the Part pages, unless the shrink is allowed', async () => {
        const [mann] = await catalog.listBrands({ slug: 'mann-filter' });
        await catalog.createPartWithIdentifiers({
          name: 'Масляный фильтр',
          identifiers: ['SH 2', 'SH 3', 'SH 4'].map((value) => ({
            type: 'manufacturer-number' as const,
            brand_id: mann.id,
            value,
          })),
        });
        await publish();
        const live = await catalog.listPartIdentifiers({}, { take: null });
        await catalog.softDeletePartIdentifiers(live.map(({ id }) => id));
        const freshPart = await catalog.createPartWithIdentifiers({
          name: 'Масляный фильтр',
          identifiers: [
            { type: 'manufacturer-number', brand_id: mann.id, value: 'SH 1' },
          ],
        });
        const [fresh] = await catalog.listPartIdentifiers({
          part_id: freshPart,
        });
        const publishModule: PublishModuleService =
          getContainer().resolve(PUBLISH_MODULE);
        searchIndex.changes = [];
        searchIndex.swaps = [];
        pageCache.purged = [];

        const refused = await publish();
        const publishedAfterRefusal = await publishModule.listPublishedNumbers({
          id: [fresh.id, ...live.map(({ id }) => id)],
        });
        const refusedAgain = await publish();
        const touchedByRefusals = [
          ...searchIndex.changes,
          ...searchIndex.swaps,
          ...pageCache.purged,
        ];
        process.env.CATALOGUE_SHRINK_ALLOWED = 'true';
        const allowed = await publish();

        expect(refused).toEqual(
          expect.objectContaining({
            status: 'failed',
            failed_step: 'shrink',
            error: expect.stringContaining('CATALOGUE_SHRINK_ALLOWED'),
          }),
        );
        expect(refused.error).toContain('1 Part pages');
        expect(publishedAfterRefusal.map(({ id }) => id).sort()).toEqual(
          live.map(({ id }) => id).sort(),
        );
        expect(refusedAgain.failed_step).toBe('shrink');
        expect(touchedByRefusals).toEqual([]);
        expect(allowed.status).toBe('succeeded');
        expect(
          await publishModule.listPublishedNumbers({ id: fresh.id }),
        ).toHaveLength(1);
        expect(pageCache.purged).toEqual(
          expect.arrayContaining([
            '-/[a-z][a-z]/parts/p/mann-filter-sh1/',
            '-/[a-z][a-z]/parts/p/mann-filter-sh2/',
          ]),
        );
      });

      it('rejects a translation edit for an unknown locale, field or entity', async () => {
        const part = await catalog.createParts({ name: 'Масляный фильтр' });

        const badLocale = await post(`/admin/translations/part/${part.id}`, {
          locale: 'de',
          fields: { name: 'Ölfilter' },
        });
        const badField = await post(`/admin/translations/part/${part.id}`, {
          locale: 'en',
          fields: { slug: 'oil-filter' },
        });
        const badEntity = await post(`/admin/translations/brand/${part.id}`, {
          locale: 'en',
          fields: { name: 'Oil filter' },
        });

        expect(badLocale.status).toBe(400);
        expect(badField.status).toBe(400);
        expect(badEntity.status).toBe(404);
      });
    });
  },
});
