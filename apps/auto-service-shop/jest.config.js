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
  testMatch: ['**/src/**/__tests__/**/*.spec.[jt]s'],
  testTimeout: 180_000,
};
