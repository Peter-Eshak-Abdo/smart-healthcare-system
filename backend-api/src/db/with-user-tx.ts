import { sql, type Kysely, type Transaction } from 'kysely';
import type { AuthLocals } from '../security/auth-context.js';
import type { DbPools } from './pool.js';
import type { Database } from './types.gen.js';

export type Tx = Transaction<Database>;

export interface UserTxOptions {
  pool?: 'default' | 'emergency';
  isolation?: 'read committed' | 'repeatable read';
}

function isRetryablePgError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null || !('code' in err)) return false;
  const code = (err as { code?: string }).code;
  return code === '40P01' || code === '40001';
}

/**
 * Mandatory database entrypoint for all authenticated domain operations.
 * Applies Postgres RLS by setting `LOCAL ROLE authenticated` + `request.jwt.claims`.
 * Retries once on deadlock (40P01) or serialization failure (40001).
 */
export async function withUserTx<T>(
  pools: DbPools,
  auth: Pick<AuthLocals, 'claims'>,
  fn: (tx: Tx) => Promise<T>,
  opts: UserTxOptions = {},
): Promise<T> {
  const db: Kysely<Database> = opts.pool === 'emergency' ? pools.emergencyDb : pools.defaultDb;
  const executeOnce = async (): Promise<T> =>
    db
      .transaction()
      .setIsolationLevel(opts.isolation ?? 'read committed')
      .execute(async (tx) => {
        await sql`set local role authenticated`.execute(tx);
        await sql`select set_config('request.jwt.claims', ${JSON.stringify(auth.claims)}, true)`.execute(
          tx,
        );
        await sql`set local statement_timeout = '8s'`.execute(tx);
        return fn(tx);
      });

  try {
    return await executeOnce();
  } catch (err) {
    if (isRetryablePgError(err)) {
      return executeOnce();
    }
    throw err;
  }
}

/**
 * Restricted system-level transaction runner for system/background workers & authContext hydration only.
 */
export async function withSystemTx<T>(
  pools: DbPools,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return pools.defaultDb.transaction().execute(async (tx) => {
    await sql`set local statement_timeout = '8s'`.execute(tx);
    return fn(tx);
  });
}
