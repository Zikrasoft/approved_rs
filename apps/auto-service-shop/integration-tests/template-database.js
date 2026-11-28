const { randomUUID } = require('node:crypto');
const { Client } = require('@medusajs/framework/pg');

const quote = (name) => `"${name.replace(/"/g, '""')}"`;

const databaseUrl = (name) =>
  `postgres://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${name}`;

const onMaintenanceDatabase = async (...statements) => {
  const client = new Client({ connectionString: databaseUrl('postgres') });
  await client.connect();
  try {
    for (const statement of statements) {
      await client.query(statement);
    }
  } finally {
    await client.end();
  }
};

const templateName = () => {
  const name = process.env.MEDUSA_TEST_TEMPLATE_DB;
  if (!name) {
    throw new Error(
      'MEDUSA_TEST_TEMPLATE_DB is not set: jest globalSetup did not run',
    );
  }
  return name;
};

const dropDatabase = (name) =>
  onMaintenanceDatabase(`drop database if exists ${quote(name)} with (force)`);

const createDatabase = (name) =>
  onMaintenanceDatabase(
    `drop database if exists ${quote(name)} with (force)`,
    `create database ${quote(name)}`,
  );

const cloneTemplate = (name) =>
  onMaintenanceDatabase(
    `drop database if exists ${quote(name)} with (force)`,
    `create database ${quote(name)} template ${quote(templateName())} strategy file_copy`,
  );

const suiteDatabaseName = (
  { dbName, moduleName },
  workerId = process.env.JEST_WORKER_ID ?? '1',
) =>
  dbName ??
  `medusa-${(moduleName ?? randomUUID()).toLowerCase()}-integration-${workerId}`;

module.exports = {
  cloneTemplate,
  createDatabase,
  databaseUrl,
  dropDatabase,
  suiteDatabaseName,
};
