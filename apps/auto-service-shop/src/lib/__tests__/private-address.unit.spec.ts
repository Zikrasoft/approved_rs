import { publicLookup } from '../private-address';

const resolve = (address: string) =>
  new Promise<string>((done, fail) =>
    publicLookup(address, {}, (error, resolved) =>
      error ? fail(error) : done(String(resolved)),
    ),
  );

describe('publicLookup', () => {
  it.each(['8.8.8.8', '1.1.1.1', '2001:4860:4860::8888'])(
    'passes the public address %s',
    async (address) => {
      await expect(resolve(address)).resolves.toBe(address);
    },
  );

  it.each([
    '0.0.0.0',
    '10.1.2.3',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.1.1',
    '224.0.0.1',
    '::1',
    '::',
    'fc00::1',
    'fe80::1',
    'ff02::1',
    '::ffff:10.0.0.1',
    '::ffff:127.0.0.1',
    '64:ff9b::a00:1',
  ])('refuses the private address %s', async (address) => {
    await expect(resolve(address)).rejects.toThrow('is a private address');
  });
});
