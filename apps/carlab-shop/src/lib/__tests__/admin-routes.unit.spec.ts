import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const folders = (path: string) =>
  readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map(({ name }) => name);

const coreRoutes = [
  ...folders(
    join(
      dirname(require.resolve('@medusajs/dashboard/package.json')),
      'src/routes',
    ),
  ),
  'draft-orders',
  'app',
];

const ownRoutes = folders(join(__dirname, '../../admin/routes'));

describe('admin routes', () => {
  it('reads the core dashboard routes', () => {
    expect(coreRoutes).toEqual(
      expect.arrayContaining(['categories', 'products', 'orders', 'settings']),
    );
  });

  it('never shadows a core dashboard route', () => {
    expect(ownRoutes.filter((route) => coreRoutes.includes(route))).toEqual([]);
  });
});
