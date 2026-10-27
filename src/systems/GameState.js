// Session-wide progress. Lives in the Phaser registry so scene restarts (retry, replay)
// never lose completed bridge stages.

const KEY = 'bridgeGameState';

export function getGameState(game) {
  let s = game.registry.get(KEY);
  if (!s) {
    s = { missionIndex: 0, completedStages: [], completedMissions: [] };
    game.registry.set(KEY, s);
  }
  return s;
}

export function resetGameState(game) {
  game.registry.remove(KEY);
  return getGameState(game);
}
