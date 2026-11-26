import { AsyncLocalStorage } from 'node:async_hooks';

import type { Knex } from '@medusajs/framework/mikro-orm/knex';
import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

export const STORE_READ_TIMEOUT = '20s';

type Connection = { query: (sql: string) => Promise<unknown> };
type Client = {
  acquireConnection: () => Promise<Connection>;
  releaseConnection: (connection: Connection) => Promise<unknown>;
};

const reading = new AsyncLocalStorage<true>();
const guarded = new WeakSet<Client>();
const limited = new WeakSet<Connection>();

const guard = (client: Client) => {
  if (guarded.has(client)) return;
  guarded.add(client);
  const acquire = client.acquireConnection.bind(client);
  client.acquireConnection = async () => {
    const wanted = reading.getStore() === true;
    const connection = await acquire();
    if (wanted === limited.has(connection)) return connection;
    try {
      await connection.query(
        wanted
          ? `set statement_timeout = '${STORE_READ_TIMEOUT}'`
          : 'reset statement_timeout',
      );
    } catch (error) {
      await client.releaseConnection(connection);
      throw error;
    }
    if (wanted) limited.add(connection);
    else limited.delete(connection);
    return connection;
  };
};

export const storeRead = <T>(
  scope: MedusaContainer,
  read: () => Promise<T>,
): Promise<T> => {
  guard(
    scope.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
      .client as Client,
  );
  return reading.run(true, read);
};
