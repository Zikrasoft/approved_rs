import { MedusaService } from '@medusajs/framework/utils';

import CatalogueRun from './models/catalogue-run';
import PublishedNumber from './models/published-number';

export const INTERRUPTED_BY_RESTART = 'Interrupted by a restart';

const startedByCliCommand = () => process.env.MEDUSA_WORKER_MODE === 'server';

class PublishModuleService extends MedusaService({
  CatalogueRun,
  PublishedNumber,
}) {
  __hooks = {
    onApplicationStart: async () => {
      if (!startedByCliCommand()) await this.failRunsLeftRunning();
    },
  };

  async failRunsLeftRunning(): Promise<void> {
    const running = await this.listCatalogueRuns(
      { status: 'running' },
      { select: ['id'] },
    );
    if (running.length) {
      await this.updateCatalogueRuns(
        running.map(({ id }) => ({
          id,
          status: 'failed' as const,
          error: INTERRUPTED_BY_RESTART,
          finished_at: new Date(),
        })),
      );
    }
  }
}

export default PublishModuleService;
