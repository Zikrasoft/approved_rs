import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import type { TestProject } from 'vitest/node';
import { createCrmClient } from '../database.ts';

declare module 'vitest' {
  export interface ProvidedContext {
    crmAdminUrl: string;
  }
}

export const TEMPLATE_DATABASE = 'crm_template';

const packageRoot = fileURLToPath(new URL('../..', import.meta.url));
const composeFile = fileURLToPath(
  new URL('../../docker-compose.test.yml', import.meta.url),
);

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() =>
        typeof address === 'object' && address
          ? resolve(address.port)
          : reject(new Error('no port')),
      );
    });
  });
}

const run = (command: string, args: string[], env: NodeJS.ProcessEnv) =>
  execFileSync(command, args, {
    cwd: packageRoot,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'ignore', 'inherit'],
  });

async function startServer(): Promise<{ url: string; stop: () => void }> {
  const port = await freePort();
  const project = `crm-test-${process.pid}-${randomBytes(3).toString('hex')}`;
  const env = { CRM_TEST_DB_PORT: String(port) };
  const compose = ['compose', '-p', project, '-f', composeFile];
  const stop = () => run('docker', [...compose, 'down', '-v'], env);
  try {
    run('docker', [...compose, 'up', '-d', '--wait'], env);
  } catch (error) {
    stop();
    throw error;
  }
  return { url: `postgres://postgres:postgres@127.0.0.1:${port}`, stop };
}

export default async function setup(project: TestProject) {
  const external = process.env.CRM_TEST_SERVER_URL;
  const server = external
    ? { url: external, stop: () => undefined }
    : await startServer();
  const template = `${TEMPLATE_DATABASE}_${randomBytes(4).toString('hex')}`;
  const admin = createCrmClient(`${server.url}/postgres`);
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${template}"`);
    run('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
      CRM_DATABASE_URL: `${server.url}/${template}`,
    });
  } catch (error) {
    await admin.$disconnect();
    server.stop();
    throw error;
  }
  project.provide('crmAdminUrl', `${server.url}/${template}`);
  return async () => {
    await admin.$executeRawUnsafe(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname LIKE '${template}%' AND pid <> pg_backend_pid()`,
    );
    if (external) {
      const databases = await admin.$queryRawUnsafe<{ datname: string }[]>(
        `SELECT datname FROM pg_database WHERE datname LIKE '${template}%'`,
      );
      for (const { datname } of databases)
        await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${datname}"`);
    }
    await admin.$disconnect();
    server.stop();
  };
}
