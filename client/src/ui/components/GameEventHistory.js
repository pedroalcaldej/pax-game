/** Merge server history and local notifications without losing event metadata. */
export function mergeGameEvents(history = [], localEvents = []) {
  return [...localEvents, ...history.slice().reverse()].sort((left, right) =>
    (Number(right.timestamp) || 0) - (Number(left.timestamp) || 0));
}
