const { MetadataStorage } = require('@medusajs/framework/mikro-orm/core');

MetadataStorage.clear();

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const networkFetch = globalThis.fetch;

globalThis.fetch = async (input, init) => {
  const { hostname } = new URL(input.url ?? String(input));
  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(`Tests do not go to the network: fetch to ${hostname}`);
  }
  return networkFetch(input, init);
};
