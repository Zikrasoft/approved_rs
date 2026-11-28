const { configManager } = require('@medusajs/framework/config');
const { MetadataStorage } = require('@medusajs/framework/mikro-orm/core');

const { DATABASE_POOL } = require('../src/lib/database-pool');

require('./defaults');

MetadataStorage.clear();

const loadConfig = configManager.loadConfig.bind(configManager);
configManager.loadConfig = (options) => {
  delete process.env.PORT;
  const config = options.projectConfig.projectConfig;
  config.databaseDriverOptions = {
    ...config.databaseDriverOptions,
    pool: DATABASE_POOL,
  };
  return loadConfig(options);
};

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const networkFetch = globalThis.fetch;

globalThis.fetch = async (input, init) => {
  const { hostname } = new URL(input.url ?? String(input));
  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(`Tests do not go to the network: fetch to ${hostname}`);
  }
  return networkFetch(input, init);
};
