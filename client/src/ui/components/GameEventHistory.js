/** Merge server history and local notifications without losing event metadata. */
export function mergeGameEvents(history = [], localEvents = []) {
  return [...localEvents, ...history.slice().reverse()].sort((left, right) =>
    (Number(right.timestamp) || 0) - (Number(left.timestamp) || 0));
}

export function getGameEventNotifications(history = [], playerId) {
  return history.filter((event) => (
    ['oi-limit-approved', 'oi-resolution-expired'].includes(event?.category)
    || (event?.category === 'oi-limit-fine' && event.playerId === playerId)
    || (['treaty-expired', 'treaty-breach'].includes(event?.category)
      && (event.playerIds || [event.attackerId, event.defenderId]).includes(playerId))
  ));
}
