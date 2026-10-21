import { asValue } from '@medusajs/framework/awilix';
import { medusaIntegrationTestRunner } from '@medusajs/test-utils';

import { createAdminAuth } from '../../../../../integration-tests/adminAuth';
import { PUBLISH_REINDEX_REGISTRATION } from '../../../../lib/publish/chain';
import { CATALOG_MODULE } from '../../../../modules/catalog';
import type CatalogModuleService from '../../../../modules/catalog/service';

const SERBIAN = new Map([
  ['Масляный фильтр', 'Filter ulja'],
  ['Воздушный фильтр', 'Filter vazduha'],
  ['Салонный фильтр', 'Kabinski filter'],
]);
const ENGLISH = new Map([
  ['Масляный фильтр', 'Oil filter'],
  ['Воздушный фильтр', 'Air filter'],
  ['Салонный фильтр', 'Cabin filter'],
]);

type FakeNetwork = {
  openAiRequests: number;
  dispatches: { url: string; body: unknown; authorization: string | null }[];
  unsafeAnswer: boolean;
  githubStatus: number;
  githubGate: Promise<void> | null;
};

const network: FakeNetwork = {
  openAiRequests: 0,
  dispatches: [],
  unsafeAnswer: false,
  githubStatus: 204,
  githubGate: null,
};

const reindexCalls: number[] = [];

const openAiAnswer = (body: {
  messages: { content: string }[];
}): Record<string, string> => {
  const dictionary = body.messages[0].content.includes('Serbian')
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
      await network.githubGate;
      network.dispatches.push({
        url,
        body: JSON.parse(String(init?.body)),
        authorization: new Headers(init?.headers).get('authorization'),
      });
      return new Response(null, { status: network.githubStatus });
    }
    return realFetch(input, init);
  };

medusaIntegrationTestRunner({
  moduleName: 'catalog',
  dbName: 'medusa-publish-integration',
  hooks: {
    beforeServerStart: async (container) => {
      container.register(
        PUBLISH_REINDEX_REGISTRATION,
        asValue(async () => {
          reindexCalls.push(Date.now());
        }),
      );
    },
  },
  testSuite: ({ api, getContainer }) => {
    describe('publish chain', () => {
      let adminHeaders: { headers: { authorization: string } };
      let catalog: CatalogModuleService;
      let realFetch: typeof fetch;

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
        process.env.OPENAI_API_KEY = 'test-openai-key';
        process.env.PUBLISH_DISPATCH_TOKEN = 'test-dispatch-token';
        realFetch = globalThis.fetch;
        globalThis.fetch = fakeFetch(realFetch);
      });

      afterAll(() => {
        globalThis.fetch = realFetch;
        delete process.env.OPENAI_API_KEY;
        delete process.env.PUBLISH_DISPATCH_TOKEN;
      });

      beforeEach(() => {
        network.openAiRequests = 0;
        network.dispatches = [];
        network.unsafeAnswer = false;
        network.githubStatus = 204;
        network.githubGate = null;
        reindexCalls.length = 0;
      });

      it('shows no run before the first Publish', async () => {
        const latest = await get('/admin/publish-runs/latest');
        expect(latest.status).toBe(200);
        expect(latest.data.publish_run).toBeNull();
      });

      it('translates Russian names, dispatches the deploy, then reindexes', async () => {
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
        expect(network.dispatches).toEqual([
          {
            url: 'https://api.github.com/repos/Zikrasoft/approved_rs/actions/workflows/publish.yml/dispatches',
            body: { ref: 'main' },
            authorization: 'Bearer test-dispatch-token',
          },
        ]);
        expect(reindexCalls).toHaveLength(1);
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

      it('stops before the deploy when a translation fails the safety checks', async () => {
        const part = await catalog.createParts({ name: 'Салонный фильтр' });
        network.unsafeAnswer = true;

        const run = await publish();

        expect(run.status).toBe('failed');
        expect(run.failed_step).toBe('translate');
        expect(run.error).toContain('HTML');
        expect(network.dispatches).toEqual([]);
        expect(reindexCalls).toEqual([]);
        expect(await translationsOf(part.id)).toBeNull();
      });

      it('stops before the reindex when the deploy dispatch is refused', async () => {
        network.githubStatus = 500;

        const run = await publish();

        expect(run.status).toBe('failed');
        expect(run.failed_step).toBe('deploy');
        expect(run.error).toContain('500');
        expect(run.error).not.toContain('test-dispatch-token');
        expect(reindexCalls).toEqual([]);
      });

      it('refuses a second Publish while one is running', async () => {
        let release = () => {};
        network.githubGate = new Promise((resolve) => {
          release = resolve;
        });

        const first = await post('/admin/publish-runs');
        const second = await post('/admin/publish-runs');
        release();
        await finishedRun();

        expect(first.status).toBe(202);
        expect(first.data.publish_run.status).toBe('running');
        expect(second.status).toBe(409);
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
