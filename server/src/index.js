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
import { createClient } from 'redis';

// Importaciones respetando la carpeta src/network/
import { RoomManager } from './network/RoomManager.js';
import { SocketServer } from './network/SocketServer.js';
import { RedisLobbyStore } from './network/RedisLobbyStore.js';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env') });

const app = express();
const httpServer = createServer(app);

app.use(cors());

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const redis = createClient({ url: process.env.REDIS_URL || 'redis://127.0.0.1:6379' });
redis.on('error', (error) => console.error('[Redis] Error de conexión:', error.message));

const PORT = process.env.PORT || 3000;

app.get('/health', (_request, response) => {
  response.json({ ok: true, service: 'pax-game-server' });
});

app.get('/', (_request, response) => {
  response.json({
    service: 'pax-game-server',
    status: 'ok',
    health: '/health',
    message: 'Backend activo. Abre el cliente web de PAX para jugar.'
  });
});

await redis.connect();
const roomManager = new RoomManager();
new SocketServer(io, roomManager, new RedisLobbyStore(redis));

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Servidor ejecutándose en http://0.0.0.0:${PORT}`);
});
