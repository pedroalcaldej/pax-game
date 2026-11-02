/**
 * shared/MapGenerator.js
 * Genera un mapa de tierra y agua con pequeños territorios nacionales.
 */

import { ECONOMY, MAP_CONFIG, NATIONS, TERRAIN_TYPES, TILE_STATUS } from './Constants.js';

const DIRS8 = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],           [1, 0],
  [-1, 1],  [0, 1],  [1, 1]
];
const DIRS4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const MIN_WATER_BODY_SIZE = 12;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function inBounds(x, y, width, height) {
  return x >= 0 && y >= 0 && x < width && y < height;
}

function buildingForType(type) {
  if (type === TERRAIN_TYPES.CAP) return 'CAPITAL';
  if (type === TERRAIN_TYPES.CIU) return 'CITY';
  if (type === TERRAIN_TYPES.FT || type === TERRAIN_TYPES.FA) return 'FACTORY';
  return null;
}

function createTile(x, y, type, nationId = null) {
  const nation = nationId == null ? null : NATIONS[nationId];
  return {
    x,
    y,
    type,
    nationId,
    ownerId: nation ? nation.id : null,
    building: buildingForType(type),
    population: 0,
    troops: 0,
    defense: 0,
    status: TILE_STATUS.NORMAL
  };
}

function applyType(tile, type, extra = {}) {
  if (!tile) return;
  tile.type = type;
  tile.building = buildingForType(type);
  Object.assign(tile, extra);
}

function countLand(mask, width, height) {
  let land = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y][x]) land += 1;
    }
  }
  return land;
}

function smoothLand(mask, width, height) {
  const next = mask.map((row) => row.slice());
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let landNeighbors = 0;
      for (const [dx, dy] of DIRS8) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny, width, height) || mask[ny][nx]) landNeighbors += 1;
      }
      next[y][x] = landNeighbors >= 5;
    }
  }
  return next;
}

function enforceLandRatio(mask, rng, width, height, minRatio = 0.62, maxRatio = 0.78) {
  const total = width * height;
  let land = countLand(mask, width, height);

  const candidates = (wantLand) => {
    const cells = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (Boolean(mask[y][x]) === !wantLand) cells.push({ x, y });
      }
    }
    return cells;
  };

  while (land / total < minRatio) {
    const water = candidates(true);
    if (water.length === 0) break;
    const pick = water[Math.floor(rng() * water.length)];
    mask[pick.y][pick.x] = true;
    land += 1;
  }

  while (land / total > maxRatio) {
    const earth = candidates(false);
    if (earth.length === 0) break;
    const pick = earth[Math.floor(rng() * earth.length)];
    mask[pick.y][pick.x] = false;
    land -= 1;
  }
}

function createNationTerritories(width, height, rng) {
  const positions = [
    { x: [0.16, 0.34], y: [0.16, 0.34] },
    { x: [0.66, 0.84], y: [0.16, 0.34] },
    { x: [0.16, 0.34], y: [0.66, 0.84] },
    { x: [0.66, 0.84], y: [0.66, 0.84] }
  ];
  for (let index = positions.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [positions[index], positions[swapIndex]] = [positions[swapIndex], positions[index]];
  }
  const radius = 1;

  return positions.slice(0, NATIONS.length).map((position) => ({
    x: Math.round((width - 1) * (position.x[0] + rng() * (position.x[1] - position.x[0]))),
    y: Math.round((height - 1) * (position.y[0] + rng() * (position.y[1] - position.y[0]))),
    radius
  }));
}

function nationAt(x, y, territories) {
  return territories.findIndex((territory) => (
    Math.abs(x - territory.x) <= territory.radius
    && Math.abs(y - territory.y) <= territory.radius
  ));
}

function connectedWaterRegions(landMask, width, height) {
  const visited = new Set();
  const regions = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x;
      if (landMask[y][x] || visited.has(start)) continue;
      const region = [];
      const queue = [{ x, y }];
      visited.add(start);
      for (let index = 0; index < queue.length; index++) {
        const cell = queue[index];
        region.push(cell);
        for (const [dx, dy] of DIRS4) {
          const nx = cell.x + dx;
          const ny = cell.y + dy;
          if (!inBounds(nx, ny, width, height) || landMask[ny][nx]) continue;
          const key = ny * width + nx;
          if (visited.has(key)) continue;
          visited.add(key);
          queue.push({ x: nx, y: ny });
        }
      }
      regions.push(region);
    }
  }
  return regions;
}

function removeSmallWaterBodies(landMask, width, height) {
  for (const region of connectedWaterRegions(landMask, width, height)) {
    if (region.length >= MIN_WATER_BODY_SIZE) continue;
    for (const { x, y } of region) landMask[y][x] = true;
  }
}

function carveStartingPorts(landMask, width, height, territories) {
  for (const territory of territories) {
    territory.portTile = { x: territory.x, y: territory.y - 1 };
    for (let y = territory.y - 4; y <= territory.y - 2; y++) {
      for (let x = territory.x - 2; x <= territory.x + 2; x++) {
        if (inBounds(x, y, width, height)) landMask[y][x] = false;
      }
    }
  }
}

function carveInlandWaterBodies(landMask, width, height, territories, rng) {
  const bodyCount = 1 + Math.floor(rng() * 2);
  const minX = 5;
  const minY = 5;
  const maxX = width - 6;
  const maxY = height - 6;

  for (let body = 0; body < bodyCount; body++) {
    let center = null;
    for (let attempt = 0; attempt < 40 && !center; attempt++) {
      const x = minX + Math.floor(rng() * (maxX - minX + 1));
      const y = minY + Math.floor(rng() * (maxY - minY + 1));
      const nearNation = territories.some((territory) => (
        Math.abs(x - territory.x) < 7 && Math.abs(y - territory.y) < 7
      ));
      if (!nearNation) center = { x, y };
    }
    if (!center) continue;

    const targetSize = 20 + Math.floor(rng() * 16);
    const bodyCells = [{ x: center.x, y: center.y }];
    while (bodyCells.length < targetSize) {
      const frontier = [];
      for (const cell of bodyCells) {
        for (const [dx, dy] of DIRS4) {
          const candidate = { x: cell.x + dx, y: cell.y + dy };
          if (
            Math.abs(candidate.x - center.x) <= 4
            && Math.abs(candidate.y - center.y) <= 4
            && !bodyCells.some(({ x, y }) => x === candidate.x && y === candidate.y)
            && !frontier.some(({ x, y }) => x === candidate.x && y === candidate.y)
          ) frontier.push(candidate);
        }
      }
      if (!frontier.length) break;
      bodyCells.push(frontier[Math.floor(rng() * frontier.length)]);
    }
    for (const { x, y } of bodyCells) landMask[y][x] = false;
  }
}

function carveRiver(landMask, width, height, territories, rng) {
  if (width < 3 || height < 2) return;

  const minX = 1;
  const maxX = width - 2;
  let x = minX + Math.floor(rng() * (maxX - minX + 1));
  let y = 0;
  landMask[y][x] = false;

  while (y < height - 1) {
    const drift = Math.floor(rng() * 3) - 1;
    const nextX = Math.max(minX, Math.min(maxX, x + drift));
    const stepX = Math.sign(nextX - x);

    while (x !== nextX) {
      const candidateX = x + stepX;
      if (nationAt(candidateX, y, territories) >= 0) break;
      x = candidateX;
      landMask[y][x] = false;
    }

    const nextY = y + 1;
    if (nationAt(x, nextY, territories) >= 0) {
      const alternateX = x === minX ? x + 1 : x - 1;
      if (alternateX < minX || alternateX > maxX || nationAt(alternateX, nextY, territories) >= 0) {
        break;
      }
      x = alternateX;
    }
    y = nextY;
    landMask[y][x] = false;
  }
}

function randomLandTile(grid, rng, predicate) {
  const matches = [];
  for (const row of grid) {
    for (const tile of row) {
      if (predicate(tile)) matches.push(tile);
    }
  }
  if (matches.length === 0) return null;
  return matches[Math.floor(rng() * matches.length)];
}

function placeNear(grid, origin, rng, nationId, excludedTile = null) {
  const candidates = [];
  for (let y = origin.y - 2; y <= origin.y + 2; y++) {
    for (let x = origin.x - 2; x <= origin.x + 2; x++) {
      const tile = grid[y] && grid[y][x];
      if (!tile) continue;
      if (tile.nationId !== nationId) continue;
      if (tile.x === origin.x && tile.y === origin.y) continue;
      if (tile === excludedTile) continue;
      if (tile.type !== TERRAIN_TYPES.TR) continue;
      candidates.push(tile);
    }
  }
  if (candidates.length > 0) {
    return candidates[Math.floor(rng() * candidates.length)];
  }
  return randomLandTile(grid, rng, (tile) => (
    tile.nationId === nationId && tile.type === TERRAIN_TYPES.TR && tile !== excludedTile
  ));
}

/**
 * Crea un mapa con mayoría de tierra neutral y pequeños enclaves nacionales.
 * @param {number} [seed]
 * @returns {Array<Array<object>>}
 */
export function generateInitialGrid(seed = Date.now()) {
  const rng = mulberry32(Math.floor(seed) || 1);
  const width = MAP_CONFIG.GRID_WIDTH;
  const height = MAP_CONFIG.GRID_HEIGHT;

  let landMask = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      row.push(rng() < 0.74);
    }
    landMask.push(row);
  }

  for (let i = 0; i < 3; i++) {
    landMask = smoothLand(landMask, width, height);
  }
  enforceLandRatio(landMask, rng, width, height, 0.60, 0.75);

  const seeds = createNationTerritories(width, height, rng);

  seeds.forEach((territory) => {
    for (let y = territory.y - territory.radius; y <= territory.y + territory.radius; y++) {
      for (let x = territory.x - territory.radius; x <= territory.x + territory.radius; x++) {
        if (inBounds(x, y, width, height)) landMask[y][x] = true;
      }
    }
  });

  removeSmallWaterBodies(landMask, width, height);
  carveStartingPorts(landMask, width, height, seeds);
  carveInlandWaterBodies(landMask, width, height, seeds, rng);
  carveRiver(landMask, width, height, seeds, rng);

  const grid = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      const isLand = landMask[y][x];
      const territoryNationId = isLand ? nationAt(x, y, seeds) : -1;
      const nationId = territoryNationId >= 0 ? territoryNationId : null;
      const type = isLand ? TERRAIN_TYPES.TR : TERRAIN_TYPES.AG;
      const tile = createTile(x, y, type, nationId);
      row.push(tile);
    }
    grid.push(row);
  }

  seeds.forEach((seedPos, nationId) => {
    applyType(grid[seedPos.y][seedPos.x], TERRAIN_TYPES.CAP, {
      nationId,
      ownerId: NATIONS[nationId].id,
      defense: 4,
      population: ECONOMY.POPULATION.CAPITAL_START,
      troops: 4
    });

    const portTile = grid[seedPos.portTile.y][seedPos.portTile.x];
    const city = placeNear(grid, seedPos, rng, nationId, portTile);
    if (city) {
      applyType(city, TERRAIN_TYPES.CIU, {
        defense: 2,
        population: ECONOMY.POPULATION.CITY_START,
        troops: 2
      });
    }

    const mpt = placeNear(grid, seedPos, rng, nationId, portTile);
    if (mpt) applyType(mpt, TERRAIN_TYPES.MPT);

    if (portTile) applyType(portTile, TERRAIN_TYPES.FT);
  });

  const scatter = (baseType, nextType, chance) => {
    for (const row of grid) {
      for (const tile of row) {
        if (tile.type === baseType && rng() < chance) {
          applyType(tile, nextType);
        }
      }
    }
  };

  scatter(TERRAIN_TYPES.TR, TERRAIN_TYPES.MPT, 0.08);
  scatter(TERRAIN_TYPES.TR, TERRAIN_TYPES.FT, 0.05);
  scatter(TERRAIN_TYPES.AG, TERRAIN_TYPES.MPA, 0.08);
  scatter(TERRAIN_TYPES.AG, TERRAIN_TYPES.FA, 0.04);

  const ensureType = (type, predicate) => {
    const exists = grid.some((row) => row.some((tile) => tile.type === type));
    if (exists) return;
    const tile = randomLandTile(grid, rng, predicate);
    if (tile) applyType(tile, type);
  };

  ensureType(TERRAIN_TYPES.MPA, (tile) => tile.type === TERRAIN_TYPES.AG);
  ensureType(TERRAIN_TYPES.FA, (tile) => tile.type === TERRAIN_TYPES.AG);
  ensureType(TERRAIN_TYPES.MPT, (tile) => tile.type === TERRAIN_TYPES.TR);
  ensureType(TERRAIN_TYPES.FT, (tile) => tile.type === TERRAIN_TYPES.TR);

  return grid;
}
