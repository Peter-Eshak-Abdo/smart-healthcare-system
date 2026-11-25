import type { Firestore } from 'firebase-admin/firestore';
import type { Logger } from 'pino';
import { COLLECTIONS } from '../firebase/firestore-types.js';
import type { NotifierPort, NotificationDispatchItem } from '../integrations/notifier.js';

export async function processOutboxBatch(
  db: Firestore,
  notifier: NotifierPort,
  logger: Logger,
): Promise<number> {
  const snap = await db
    .collection(COLLECTIONS.outboxEvents)
    .where('status', '==', 'pending')
    .orderBy('created_at', 'asc')
    .limit(25)
    .get();

  for (const doc of snap.docs) {
    const data = doc.data() as NotificationDispatchItem & { attempts: number };
    try {
      await notifier.send({
        id: doc.id,
        user_id: data.user_id,
        channel: data.channel,
        template: data.template,
        payload: data.payload,
      });
      await doc.ref.update({
        status: 'sent',
        attempts: (data.attempts ?? 0) + 1,
        sent_at: new Date().toISOString(),
      });
    } catch (err) {
      const nextAttempts = (data.attempts ?? 0) + 1;
      logger.warn(
        {
          notification_id: doc.id,
          attempts: nextAttempts,
          err: err instanceof Error ? err.message : 'failed',
        },
        'Outbox delivery attempt failed',
      );
      await doc.ref.update({
        status: nextAttempts >= 5 ? 'failed' : 'pending',
        attempts: nextAttempts,
      });
    }
  }

  return snap.size;
}

export function startOutboxWorker(
  db: Firestore,
  notifier: NotifierPort,
  logger: Logger,
  intervalMs = 10_000,
): { stop: () => void } {
  const timer = setInterval(() => {
    void processOutboxBatch(db, notifier, logger).catch((err) => {
      logger.error({ err: err instanceof Error ? err.message : 'unknown' }, 'Outbox loop failed');
    });
  }, intervalMs);

  timer.unref();
  return {
    stop: () => clearInterval(timer),
  };
}
