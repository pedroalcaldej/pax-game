import { Redis as UpstashRedis } from '@upstash/redis';
import { createClient } from 'redis';

/**
 * Build the Redis transport from REDIS_URL.
 * Upstash's TCP endpoint is not reachable on some hosts (including Render
 * configurations); its REST endpoint uses HTTPS/443 and the same credential.
 */
export function createRedisClient(redisUrl) {
  if (!redisUrl) throw new Error('Define REDIS_URL.');

  let parsedUrl;
  try {
    parsedUrl = new URL(redisUrl);
  } catch {
    throw new Error('REDIS_URL no es una URL válida.');
  }

  if (parsedUrl.hostname.endsWith('.upstash.io')) {
    const token = decodeURIComponent(parsedUrl.password);
    if (!token) throw new Error('REDIS_URL de Upstash debe incluir su token como contraseña.');

    const client = new UpstashRedis({
      url: `https://${parsedUrl.hostname}`,
      token
    });

    return {
      get isReady() { return true; },
      connect: () => client.ping(),
      ping: () => client.ping(),
      get: (...args) => client.get(...args),
      eval: (script, options) => client.eval(script, options.keys, options.arguments),
      zRange: (...args) => client.zrange(...args),
      zRem: (...args) => client.zrem(...args),
      rPush: (...args) => client.rpush(...args),
      lTrim: (...args) => client.ltrim(...args),
      expire: (...args) => client.expire(...args),
      lRange: (...args) => client.lrange(...args)
    };
  }

  const client = createClient({ url: redisUrl });
  return client;
}
