/**
 * Cliente Redis opcional (adapter Socket.IO, cache futura).
 */

import { createClient } from 'redis';
import { ENV } from './env.js';

type AppRedisClient = ReturnType<typeof createClient>;

let pubClient: AppRedisClient | null = null;
let subClient: AppRedisClient | null = null;
let connectPromise: Promise<{ pubClient: AppRedisClient; subClient: AppRedisClient }> | null = null;

export function isRedisConfigured(): boolean {
  return !!ENV.REDIS_URL?.trim();
}

export async function getRedisPubSub(): Promise<{
  pubClient: AppRedisClient;
  subClient: AppRedisClient;
}> {
  const url = ENV.REDIS_URL?.trim();
  if (!url) {
    throw new Error('REDIS_URL is not configured');
  }

  if (pubClient && subClient) {
    return { pubClient, subClient };
  }

  if (!connectPromise) {
    connectPromise = (async () => {
      const pub = createClient({ url });
      const sub = pub.duplicate();
      pub.on('error', (e) => console.error('[redis pub]', e.message));
      sub.on('error', (e) => console.error('[redis sub]', e.message));
      await Promise.all([pub.connect(), sub.connect()]);
      pubClient = pub;
      subClient = sub;
      return { pubClient: pub, subClient: sub };
    })().catch((e) => {
      connectPromise = null;
      pubClient = null;
      subClient = null;
      throw e;
    });
  }

  return connectPromise;
}
