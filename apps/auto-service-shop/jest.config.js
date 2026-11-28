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
  testMatch: ['**/src/**/__tests__/**/*.spec.[jt]s'],
  testTimeout: 600_000,
};
