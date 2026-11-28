const { MedusaAppLoader } = require('@medusajs/framework');
const testUtils = require('@medusajs/test-utils/dist/index.js');

const { cloneTemplate, suiteDatabaseName } = require('./template-database');

MedusaAppLoader.prototype.runModulesMigrations = async () => {};
MedusaAppLoader.prototype.getLinksExecutionPlanner = async () => ({
  createPlan: async () => [],
  executePlan: async () => {},
});

const medusaIntegrationTestRunner = (options) => {
  const dbName = suiteDatabaseName(options);
  return testUtils.medusaIntegrationTestRunner({
    ...options,
    dbName,
    hooks: {
      ...options.hooks,
      beforeServerStart: async (container) => {
        await cloneTemplate(dbName);
        await options.hooks?.beforeServerStart?.(container);
      },
    },
  });
};

module.exports = { ...testUtils, medusaIntegrationTestRunner };
