import { Pool } from 'pg';
import { loadConfig } from './config.ts';

export const pool = new Pool({ connectionString: loadConfig().databaseUrl });
