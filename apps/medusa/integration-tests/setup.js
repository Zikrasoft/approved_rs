const { MetadataStorage } = require('@medusajs/framework/mikro-orm/core');

MetadataStorage.clear();

if (process.env.REDIS_URL && process.env.JEST_WORKER_ID) {
  const url = new URL(process.env.REDIS_URL);
  url.pathname = `/${process.env.JEST_WORKER_ID}`;
  process.env.REDIS_URL = url.toString();
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const networkFetch = globalThis.fetch;

globalThis.fetch = async (input, init) => {
  const { hostname } = new URL(input.url ?? String(input));
  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(`Tests do not go to the network: fetch to ${hostname}`);
  }
  return networkFetch(input, init);
};
