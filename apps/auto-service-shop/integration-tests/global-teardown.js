const { dropDatabase } = require('./template-database');

module.exports = async () => {
  if (process.env.MEDUSA_TEST_TEMPLATE_DB) {
    await dropDatabase(process.env.MEDUSA_TEST_TEMPLATE_DB);
  }
};
