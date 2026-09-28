const PACKAGES = '<rootDir>/../../packages';

const TEST_STACK = {
  DB_HOST: 'localhost',
  DB_PORT: '55432',
  DB_USERNAME: 'postgres',
  DB_PASSWORD: 'postgres',
  REDIS_URL: 'redis://localhost:56379',
  MEDUSA_BACKEND_URL: 'http://localhost:9009',
};

if (process.env.TEST_TYPE === 'integration:http') {
  for (const [key, value] of Object.entries(TEST_STACK)) {
    process.env[key] ??= value;
  }
}

module.exports = {
  transform: {
    '^.+\\.[jt]s$': [
      '@swc/jest',
      { jsc: { parser: { syntax: 'typescript', decorators: true } } },
    ],
  },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@podbor/shop-catalog$': `${PACKAGES}/shop-catalog/src/index.ts`,
    '^@podbor/shop-catalog/browser$': `${PACKAGES}/shop-catalog/src/browser.ts`,
    '^@podbor/shop-catalog/order-hook$': `${PACKAGES}/shop-catalog/src/orderHook.ts`,
    '^@podbor/i18n/translate/core$': `${PACKAGES}/i18n/src/translate/core.ts`,
    '^@podbor/i18n/section$': `${PACKAGES}/i18n/src/section.ts`,
    '^@podbor/brands$': `${PACKAGES}/brands/src/index.ts`,
  },
  moduleFileExtensions: ['js', 'ts', 'json'],
  modulePathIgnorePatterns: ['dist/', '<rootDir>/.medusa/'],
  setupFiles: ['./integration-tests/setup.js'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/__tests__/**',
    '!src/admin/**',
    '!src/modules/*/index.ts',
    '!src/modules/*/models/**',
    '!src/modules/*/migrations/**',
    '!src/modules/vehicle/service.ts',
    '!src/scripts/seed-*.ts',
    '!src/api/middlewares.ts',
  ],
  coverageThreshold: {
    'src/api/store/*.ts': { statements: 95, branches: 88 },
    'src/workflows/hooks/*.ts': { statements: 95, branches: 88 },
    'src/lib/*.ts': { statements: 95, branches: 90 },
    global: { statements: 70, branches: 75 },
  },
};

if (process.env.TEST_TYPE === 'integration:http') {
  module.exports.testMatch = ['**/integration-tests/http/*.spec.[jt]s'];
} else if (process.env.TEST_TYPE === 'unit') {
  module.exports.testMatch = ['**/src/**/__tests__/**/*.unit.spec.[jt]s'];
}
