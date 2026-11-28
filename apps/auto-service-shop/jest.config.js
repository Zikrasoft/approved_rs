const slow = process.env.SHOP_SLOW === 'true';

module.exports = {
  transform: {
    '^.+\\.[jt]s$': [
      '@swc/jest',
      { jsc: { parser: { syntax: 'typescript', decorators: true } } },
    ],
  },
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'ts', 'json'],
  modulePathIgnorePatterns: ['dist/', '<rootDir>/.medusa/'],
  setupFiles: ['./integration-tests/setup.js'],
  globalSetup: './integration-tests/global-setup.js',
  globalTeardown: './integration-tests/global-teardown.js',
  moduleNameMapper: {
    '^@medusajs/test-utils$': '<rootDir>/integration-tests/test-utils.js',
  },
  testMatch: [
    slow
      ? '**/src/**/__tests__/**/*.slow.spec.[jt]s'
      : '**/src/**/__tests__/**/*.spec.[jt]s',
  ],
  testPathIgnorePatterns: slow ? [] : ['\\.slow\\.spec\\.[jt]s$'],
  testTimeout: 600_000,
};
