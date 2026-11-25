import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import type { Database } from './types.gen.js';

export interface DbPools {
  defaultPool: Pool;
  emergencyPool: Pool;
  defaultDb: Kysely<Database>;
  emergencyDb: Kysely<Database>;
  close: () => Promise<void>;
}

export function createDbPools(connectionString: string): DbPools {
  const defaultPool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  const emergencyPool = new Pool({
    connectionString,
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 3_000,
  });

  const defaultDb = new Kysely<Database>({
    dialect: new PostgresDialect({ pool: defaultPool }),
  });

  const emergencyDb = new Kysely<Database>({
    dialect: new PostgresDialect({ pool: emergencyPool }),
  });

  return {
    defaultPool,
    emergencyPool,
    defaultDb,
    emergencyDb,
    close: async () => {
      await Promise.all([defaultDb.destroy(), emergencyDb.destroy()]);
    },
  };
}
