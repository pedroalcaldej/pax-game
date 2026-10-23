/**
 * server/src/game/GameState.js
 */

export class GameState {
  constructor() {
    this.gridWidth = 16;
    this.gridHeight = 16;
    this.players = new Map();
    this.currentPhase = 1;
    this.timeRemaining = 60;

    this.grid = this.createEmptyGrid();
  }

  createEmptyGrid() {
    const grid = [];
    for (let y = 0; y < this.gridHeight; y++) {
      const row = [];
      for (let x = 0; x < this.gridWidth; x++) {
        row.push({
          x,
          y,
          ownerId: null,
          building: null
        });
      }
      grid.push(row);
    }
    return grid;
  }

addPlayer(socketId, playerName, playerId) {
  const id = playerId || socketId;

  // Si el jugador ya existe, actualizamos su socket.id activo y no creamos uno nuevo
  if (this.players.has(id)) {
    const existingPlayer = this.players.get(id);
    existingPlayer.socketId = socketId; // Actualizar socket activo
    return existingPlayer;
  }

  const player = {
    id: id,
    socketId: socketId,
    name: playerName || 'Nación Alpha',
    gdiPoints: 100,
    taxRate: 0.2
  };

  this.players.set(id, player);
  this.spawnPlayerCapital(id);

  return player;
}

  spawnPlayerCapital(socketId) {
    const spawnPositions = [
      { x: 2, y: 2 },
      { x: 13, y: 13 },
      { x: 2, y: 13 },
      { x: 13, y: 2 }
    ];

    const pos = spawnPositions[this.players.size - 1] || { x: 0, y: 0 };

    if (this.grid[pos.y] && this.grid[pos.y][pos.x]) {
      this.grid[pos.y][pos.x].ownerId = socketId;
      this.grid[pos.y][pos.x].building = 'CAPITAL';
    }
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
  }

  setPlayerTaxRate(socketId, taxRate) {
    const player = this.players.get(socketId);
    if (player) {
      player.taxRate = taxRate;
    }
  }

  getState() {
    return {
      grid: this.grid,
      // Convertir el Map a Array para la transmisión JSON
      players: Array.from(this.players.values()),
      currentPhase: this.currentPhase,
      timeRemaining: this.timeRemaining
    };
  }
}