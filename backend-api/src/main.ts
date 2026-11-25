import { buildApp } from './app.js';
import { createAppDeps } from './app-deps.js';
import { loadEnv } from './config/env.js';
import { createNotifier } from './integrations/notifier.js';
import { startOutboxWorker } from './workers/outbox.js';

const env = loadEnv();
const deps = createAppDeps(env);
const app = buildApp(env, { deps });

const outboxHandle = deps.pools
  ? startOutboxWorker(deps.pools, createNotifier(deps.logger), deps.logger)
  : null;

const server = app.listen(env.PORT, () => {
  deps.logger.info({ port: env.PORT, env: env.APP_ENV }, 'backend-api listening');
});

async function shutdown(signal: string): Promise<void> {
  deps.logger.info({ signal }, 'Shutting down backend-api');
  outboxHandle?.stop();
  server.close(async () => {
    await deps.close();
    process.exit(0);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
