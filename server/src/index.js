/**
 * server/src/index.js
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

// Importaciones respetando la carpeta src/network/
import { RoomManager } from './network/RoomManager.js';
import { SocketServer } from './network/SocketServer.js';

const app = express();
const httpServer = createServer(app);

app.use(cors());

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const roomManager = new RoomManager();
new SocketServer(io, roomManager);

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

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Servidor ejecutándose en http://0.0.0.0:${PORT}`);
});
