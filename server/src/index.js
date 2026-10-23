/**
 * server/src/index.js
 * Punto de entrada principal del servidor autoritativo de PAX.
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { SocketServer } from './network/SocketServer.js';

const PORT = process.env.PORT || 3000;

const app = express();
const httpServer = createServer(app);

// Configuración de Socket.io con soporte para CORS (permitiendo conexiones del cliente)
const io = new Server(httpServer, {
  cors: {
    origin: '*', // En producción se reemplazará por la URL del cliente
    methods: ['GET', 'POST']
  }
});

// Inicializar la capa de red WebSocket
new SocketServer(io);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', game: 'PAX Server Running' });
});

httpServer.listen(PORT, () => {
  console.log(`[PAX Server] Servidor ejecutándose en el puerto ${PORT}`);
});