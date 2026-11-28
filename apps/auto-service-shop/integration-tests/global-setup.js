const { execFileSync } = require('node:child_process');
const path = require('node:path');

require('./defaults');
const { createDatabase, databaseUrl } = require('./template-database');

module.exports = async () => {
  const name = `medusa-template-${process.pid}`;
  await createDatabase(name);
  try {
    execFileSync(
      path.join(__dirname, '../node_modules/.bin/medusa'),
      ['db:migrate', '--skip-scripts', '--skip-search', '--execute-safe-links'],
      {
        cwd: path.join(__dirname, '..'),
        env: { ...process.env, DATABASE_URL: databaseUrl(name) },
        stdio: 'pipe',
      },
    );
  } catch (error) {
    throw new Error(
      `Migrating the template database failed:\n${error.stdout}\n${error.stderr}`,
      { cause: error },
    );
  }
  process.env.MEDUSA_TEST_TEMPLATE_DB = name;
};
