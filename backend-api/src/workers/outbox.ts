import { sql } from 'kysely';
import type { Logger } from 'pino';
import type { DbPools } from '../db/pool.js';
import { withSystemTx } from '../db/with-user-tx.js';
import type { NotifierPort, NotificationDispatchItem } from '../integrations/notifier.js';

export async function processOutboxBatch(
  pools: DbPools,
  notifier: NotifierPort,
  logger: Logger,
): Promise<number> {
  const pending = await withSystemTx(pools, async (tx) => {
    const res = await sql<NotificationDispatchItem & { attempts: number }>`
      select id, user_id, channel, template, payload, attempts
        from app.notifications
       where status = 'pending'
       order by created_at asc
       limit 50
       for update skip locked
    `.execute(tx);
    return res.rows;
  });

  for (const item of pending) {
    try {
      await notifier.send(item);
      await withSystemTx(pools, async (tx) => {
        await sql`
          update app.notifications
             set status = 'sent',
                 attempts = attempts + 1,
                 sent_at = now()
           where id = ${item.id}::uuid
        `.execute(tx);
      });
    } catch (err) {
      logger.warn(
        { notification_id: item.id, attempts: item.attempts + 1, err: err instanceof Error ? err.message : 'failed' },
        'Outbox delivery attempt failed',
      );
      const nextStatus = item.attempts + 1 >= 5 ? 'failed' : 'pending';
      await withSystemTx(pools, async (tx) => {
        await sql`
          update app.notifications
             set status = ${nextStatus},
                 attempts = attempts + 1
           where id = ${item.id}::uuid
        `.execute(tx);
      });
    }
  }

  return pending.length;
}

export function startOutboxWorker(
  pools: DbPools,
  notifier: NotifierPort,
  logger: Logger,
  intervalMs = 5_000,
): { stop: () => void } {
  const timer = setInterval(() => {
    void processOutboxBatch(pools, notifier, logger).catch((err) => {
      logger.error({ err: err instanceof Error ? err.message : 'unknown' }, 'Outbox loop failed');
    });
  }, intervalMs);

  timer.unref();
  return {
    stop: () => clearInterval(timer),
  };
}
