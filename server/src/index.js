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

roomManager.getOrCreateRoom('room-1');

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`[Server] Servidor ejecutándose en http://localhost:${PORT}`);
});