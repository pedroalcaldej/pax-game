export function roundMapOptions(state) {
  return [...new Set(state?.mapHistoryRounds || [])]
    .filter((round) => Number.isInteger(round) && round < state.currentRound)
    .sort((left, right) => left - right).concat(null);
}

export function roundMapStep(state, selectedRound, direction) {
  const options = roundMapOptions(state);
  const index = Math.max(0, options.indexOf(selectedRound));
  return options[Math.max(0, Math.min(options.length - 1, index + direction))];
}
