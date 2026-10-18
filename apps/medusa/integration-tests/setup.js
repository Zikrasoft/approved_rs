const { MetadataStorage } = require('@medusajs/framework/mikro-orm/core');

MetadataStorage.clear();

process.env.DB_HOST ??= 'localhost';
process.env.DB_PORT ??= '55432';
process.env.DB_USERNAME ??= 'postgres';
process.env.DB_PASSWORD ??= 'postgres';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const networkFetch = globalThis.fetch;

globalThis.fetch = async (input, init) => {
  const { hostname } = new URL(input.url ?? String(input));
  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(`Tests do not go to the network: fetch to ${hostname}`);
  }
  return networkFetch(input, init);
};
