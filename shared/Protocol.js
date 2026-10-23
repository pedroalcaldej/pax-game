/**
 * shared/Protocol.js
 * Definición centralizada de constantes de eventos Socket.io.
 * Garantiza que Servidor y Cliente usen exactamente los mismos nombres de eventos.
 */

// Eventos enviados del Cliente al Servidor (Acciones de jugador)
export const CLIENT_EVENTS = {
  JOIN_GAME: 'client:join_game',            // Unirse a una partida o lobby
  SET_TAX_RATE: 'client:set_tax_rate',        // Cambiar la tasa impositiva (tau)
  BUILD_STRUCTURE: 'client:build_structure',  // Construir una fábrica o infraestructura
  SEND_CHAT_MSG: 'client:send_chat_msg',      // Enviar mensaje de chat o diplomacia
  PLAYER_READY: 'client:player_ready'         // Confirmar que el jugador está listo
};

// Eventos enviados del Servidor al Cliente (Actualizaciones de estado)
export const SERVER_EVENTS = {
  GAME_STATE_UPDATE: 'server:game_state_update', // Transmisión del estado del mapa y jugadores
  PHASE_CHANGE: 'server:phase_change',           // Notificación de cambio de fase (1 a 5)
  TIMER_TICK: 'server:timer_tick',               // Actualización del reloj de 60s
  ERROR_MESSAGE: 'server:error_message',         // Mensaje de error o restricción
  CHAT_BROADCAST: 'server:chat_broadcast'        // Transmisión de mensaje a la sala
};