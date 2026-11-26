import type { Logger } from '@medusajs/framework/types';

import TypesenseSearchProviderService from '../service';

describe('the Typesense search provider client', () => {
  it('waits 60 seconds for a connection', () => {
    const provider = new TypesenseSearchProviderService(
      { logger: console as unknown as Logger },
      { host: 'localhost', port: 1, protocol: 'http', apiKey: 'xyz' },
    );

    const { configuration } = (
      provider as unknown as {
        client: { configuration: { connectionTimeoutSeconds: number } };
      }
    ).client;

    expect(configuration.connectionTimeoutSeconds).toBe(60);
  });
});
