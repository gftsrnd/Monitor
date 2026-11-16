import 'dotenv/config';
import './init.js';
import { initUdpServer } from './udp/server.js';
import { createServer } from 'http';
import { initAIGatewayResponsesWebSocket, initSocketio } from './ws/index.js';
import { monitorManager } from './model/monitor/index.js';
import { workerCronManager } from './model/worker/manager.js';
import { env } from './utils/env.js';
import { initCronjob } from './cronjob/index.js';
import { logger } from './utils/logger.js';
import { app } from './app.js';
import { runMQWorker } from './mq/worker.js';
import { initCounter } from './utils/prometheus/index.js';
import { initClickHouse } from './clickhouse/index.js';
import { flushAllBatchWriters } from './utils/batchWriter.js';
import { logSystemInfo } from './utils/system.js';
import { monitorBroadcast } from './model/monitor/broadcast.js';
import { workerCronBroadcast } from './model/worker/broadcast.js';
import { prisma } from './model/_client.js';
import { hashPassword } from './model/user.js';

logSystemInfo();

const port = env.port;

const httpServer = createServer(app);
let isShuttingDown = false;

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

initUdpServer(port, env.host);

const aiGatewayResponsesWebSocket =
  initAIGatewayResponsesWebSocket(httpServer);
initSocketio(httpServer);

initCronjob();

initCounter();

runMQWorker();

if (env.clickhouse.enable) {
  initClickHouse().then(() => {
    logger.info('ClickHouse initialized.');
  });
}

await startServer();

async function startServer() {
  await monitorBroadcast.start(
    (event) => monitorManager.handleBroadcast(event),
    () => monitorManager.reconcileAll()
  );
  if (isShuttingDown) {
    return;
  }

  await monitorManager.startAll();
  if (isShuttingDown) {
    return;
  }

  if (env.enableFunctionWorker) {
    await workerCronBroadcast.start(
      (event) => workerCronManager.handleBroadcast(event),
      () => workerCronManager.reconcileAll()
    );
    if (isShuttingDown) {
      return;
    }

    await workerCronManager.startAll();
    if (isShuttingDown) {
      return;
    }
  }

  await bootstrapAdminPassword();

  httpServer.listen(port, env.host, () => {
    logger.info(`Server is listening on ${env.host}:${port}...`);
    const displayHost = env.host === '0.0.0.0' ? '127.0.0.1' : env.host;
    if (env.allowOpenapi) {
      logger.info(`Openapi UI: http://${displayHost}:${port}/open/_ui`);
    }
    logger.info(`Website: http://${displayHost}:${port}`);
  });
}

async function bootstrapAdminPassword() {
  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD;
  if (!initialPassword) return;

  const FACTORY_HASH =
    '$2a$10$V384zbubCaykNgBHs5mag.AngiWhAgRR.KLoxal7xh8sfOBwnASN2';

  try {
    const adminUser = await prisma.user.findFirst({
      where: { username: 'admin' },
    });

    if (adminUser && adminUser.password === FACTORY_HASH) {
      logger.info(
        '[Security] Rotating factory admin password with ADMIN_INITIAL_PASSWORD...'
      );
      const newHash = await hashPassword(initialPassword);
      await prisma.user.update({
        where: { id: adminUser.id },
        data: { password: newHash },
      });

      // Also rename default seeded workspace 'admin' to 'TFG Monitor' with Vietnam timezone
      await prisma.workspace.updateMany({
        where: {
          id: 'clnzoxcy10001vy2ohi4obbi0',
          name: 'admin',
        },
        data: {
          name: 'TFG Monitor',
          settings: {
            timezone: process.env.TZ || 'Asia/Ho_Chi_Minh',
          },
        },
      });

      logger.info(
        '[Security] Factory admin password rotated and default workspace renamed to TFG Monitor.'
      );
    }
  } catch (err) {
    logger.error('[Security] Failed to bootstrap admin password:', err);
  }
}

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  logger.info(`Received ${signal}, shutting down gracefully...`);

  // Stop accepting new connections
  httpServer.close();

  await Promise.all([
    aiGatewayResponsesWebSocket.close(),
    monitorBroadcast.close(),
    workerCronBroadcast.close(),
  ]);

  // Flush all pending batch writes
  await flushAllBatchWriters();

  logger.info('Graceful shutdown complete.');
  process.exit(0);
}
