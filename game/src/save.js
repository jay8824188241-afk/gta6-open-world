// Save and load through localStorage. The save holds money, mission progress,
// the player's position and wanted level — enough to pick up where you left off.
const SAVE_KEY = 'neon-bay-save-v1';

export function saveGame(game) {
  try {
    const data = {
      money: game.player.money,
      missionsDone: game.player.missionsDone,
      missionIndex: game.mission.index,
      x: Math.round(game.player.x),
      y: Math.round(game.player.y),
      wanted: game.player.wanted,
      kills: game.player.kills,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    game.saveMessage = 'Game saved.';
    game.saveTimer = 3;
    return true;
  } catch {
    game.saveMessage = 'Save failed (storage unavailable).';
    game.saveTimer = 3;
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

export function applySave(game, data) {
  game.player.money = data.money || 0;
  game.player.missionsDone = data.missionsDone || 0;
  game.player.kills = data.kills || 0;
  game.player.x = data.x || 1800;
  game.player.y = data.y || 1950;
  game.player.wanted = 0; // fresh start, no heat on load
  game.camera.x = game.player.x;
  game.camera.y = game.player.y;
  game.mission.index = Math.min(data.missionIndex || 0, 3);
}
