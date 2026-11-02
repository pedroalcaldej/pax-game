/**
 * server/src/index.js
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

// Importaciones respetando la carpeta src/network/
import { RoomManager } from './network/RoomManager.js';
import { SocketServer } from './network/SocketServer.js';
import { RedisLobbyStore } from './network/RedisLobbyStore.js';
import { createRedisClient } from './network/RedisClient.js';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });

const app = express();
const httpServer = createServer(app);

const allowedOrigins = (process.env.CLIENT_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
if (!allowedOrigins.length) {
  throw new Error('Define CLIENT_ORIGINS con los orígenes permitidos del cliente.');
}
app.use(cors({ origin: allowedOrigins }));

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST']
  }
});

if (!process.env.REDIS_URL) {
  throw new Error('Define REDIS_URL en server/.env o en el entorno del servidor.');
}
const redis = createRedisClient(process.env.REDIS_URL);
redis.on?.('error', (error) => console.error('[Redis] Error de conexión:', error.message));
redis.on?.('ready', () => console.info('[Redis] Conexión disponible.'));

const PORT = Number(process.env.PORT);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('Define PORT como un puerto válido en server/.env o en el entorno del servidor.');
}
const HOST = process.env.HOST;
if (!HOST) throw new Error('Define HOST en server/.env o en el entorno del servidor.');

app.get('/health', async (_request, response) => {
  let redisConnected = false;
  try {
    await redis.ping();
    redisConnected = true;
  } catch {
    // Keep health response useful without exposing Redis credentials/errors.
  }
  response.json({ ok: true, service: 'pax-game-server', redisConnected });
});

app.get('/', (_request, response) => {
  response.json({
    service: 'pax-game-server',
    status: 'ok',
    health: '/health',
    message: 'Backend activo. Abre el cliente web de PAX para jugar.'
  });
});

const roomManager = new RoomManager();
new SocketServer(io, roomManager, new RedisLobbyStore(redis));

httpServer.listen(PORT, HOST, () => {
  console.log(`[Server] Servidor ejecutándose en http://${HOST}:${PORT}`);
});

redis.connect()
  .then(() => console.info('[Redis] Conexión disponible.'))
  .catch((error) => {
    console.error('[Redis] No se pudo conectar; el lobby seguirá no disponible hasta recuperar Redis:', error.message);
  });
