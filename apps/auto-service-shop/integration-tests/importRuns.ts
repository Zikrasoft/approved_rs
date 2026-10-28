import type { ImportSummary } from '../src/lib/suppliers/import';

type ImportRun = {
  id: string;
  kind: string;
  supplier_id: string | null;
  status: 'running' | 'succeeded' | 'failed';
  error: string | null;
  report: ImportSummary;
};

type StartResponse = {
  status: number;
  data: { import_run?: ImportRun; code?: string };
};

type TestApi = {
  get: (
    path: string,
    config: unknown,
  ) => Promise<{ data: { import_runs: ImportRun[] } }>;
  post: (
    path: string,
    body: unknown,
    config: unknown,
  ) => Promise<StartResponse>;
};

export const importRuns = (api: TestApi, headers: unknown) => {
  const start = (supplierId: string): Promise<StartResponse> =>
    api
      .post(`/admin/suppliers/${supplierId}/import`, {}, headers)
      .catch((error) => error.response);

  const history = async (supplierId: string) =>
    (await api.get(`/admin/suppliers/${supplierId}/import-runs`, headers)).data
      .import_runs;

  const finished = async (supplierId: string) => {
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      const [latest] = await history(supplierId);
      if (latest && latest.status !== 'running') return latest;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('the import run did not finish');
  };

  const run = async (supplierId: string) => {
    const started = await start(supplierId);
    if (started.status !== 202) {
      throw new Error(`the import did not start: ${started.status}`);
    }
    return finished(supplierId);
  };

  return { start, history, finished, run };
};
