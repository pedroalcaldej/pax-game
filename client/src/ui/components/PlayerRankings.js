function getPlayerTroops(grid, playerId) {
  return grid.flat().reduce((total, tile) => {
    const visitors = tile.visitingTroops || {};
    if (tile.ownerId === playerId) {
      const visitorCount = Object.values(visitors).reduce((sum, count) => sum + count, 0);
      return total + Math.max(0, (tile.troops || 0) - visitorCount);
    }
    return total + (visitors[playerId] || 0);
  }, 0);
}

export function getPlayerRankings(gameState) {
  const players = Array.isArray(gameState?.players) ? gameState.players : [];
  const grid = Array.isArray(gameState?.grid) ? gameState.grid : [];

  return players.map((player) => {
    const ownedTiles = grid.flat().filter((tile) => tile.ownerId === player.id);
    const resources = player.resources || {};
    const population = ownedTiles.reduce((sum, tile) => sum + (tile.population || 0), 0);
    const silver = resources.SILVER || 0;
    const materials = resources.MATERIALS || 0;
    const influence = resources.INFLUENCE || 0;
    return {
      player,
      ownedTiles,
      population,
      troops: getPlayerTroops(grid, player.id),
      cities: ownedTiles.filter((tile) => tile.type === 'CIU' || tile.type === 'CAP').length,
      factories: ownedTiles.filter((tile) => tile.building === 'FACTORY')
        .reduce((sum, tile) => sum + (tile.factoriesCount || 1), 0),
      silver,
      materials,
      influence,
      total: Math.floor(silver + materials + influence + population)
    };
  }).sort((left, right) => right.total - left.total);
}
