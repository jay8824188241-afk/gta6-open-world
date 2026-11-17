// Neon Bay — bootstrap and the main loop. Wires input, audio, the city and
// every system together, then runs update + render at the display rate.
import { createGame } from './state.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { spawnTraffic, spawnParkedCars, drivePlayerCar, updateTraffic, nearestCar, removeWreckedCars } from './vehicles.js';
import { spawnPedestrians, updatePedestrians, checkPedCollisions, addWanted } from './pedestrians.js';
import { updateWanted, updatePolice } from './police.js';
import { playerShoot, updateBullets, updateParticles, damagePlayer } from './combat.js';
import { startMission, updateMissions, updateMissionQueue, setDialog } from './missions.js';
import { drawWorld, drawPickups, drawCars, drawPeople, drawBullets, drawParticles } from './render.js';
import { drawHUD, drawTitle, drawPause, drawGameOver, drawComplete } from './hud.js';
import { saveGame, loadSave, hasSave, applySave } from './save.js';
import { applyShot } from './shots.js';
import { hitsBuilding, clampToWorld } from './city.js';
import { range } from './rng.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed')) || 7;
const shot = params.get('shot');

const game = createGame({ seed, shot });
game.audio = createAudio();
game.input = createInput(canvas);
game.hasSave = hasSave();
// Debug handle for automated play-testing (read-only state inspection).
window.__neonBay = game;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Populate the living city.
spawnTraffic(game, 26);
spawnParkedCars(game, 30);
spawnPedestrians(game, 46);
spawnPickups(game);

function spawnPickups(game) {
  const spots = [
    { x: 600, y: 600, kind: 'health' },
    { x: 3000, y: 600, kind: 'armor' },
    { x: 600, y: 3000, kind: 'cash', value: 100 },
    { x: 3000, y: 3000, kind: 'health' },
    { x: 1800, y: 600, kind: 'cash', value: 80 },
    { x: 1200, y: 2400, kind: 'armor' },
    { x: 2400, y: 1200, kind: 'cash', value: 120 },
    { x: 1800, y: 3300, kind: 'health' },
  ];
  for (const spot of spots) {
    game.pickups.push({ x: spot.x, y: spot.y, kind: spot.kind, value: spot.value || 0, bob: range(game.rng, 0, 6) });
  }
}

// A shot preset takes over the spawn; otherwise the title screen waits.
if (shot) {
  applyShot(game, shot);
} else {
  game.mode = 'title';
}

let lastTime = performance.now();
let saveTimer = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  game.time += dt;
  update(dt);
  render();
  game.input.endFrame();
  requestAnimationFrame(frame);
}

function update(dt) {
  const input = game.input;
  const player = game.player;

  if (input.wasPressed('mute')) {
    game.muted = game.audio.toggleMute();
  }

  if (game.mode === 'title') {
    if (input.wasPressed('confirm')) {
      game.audio.ensure();
      startNewGame();
    }
    if (window.__continuePressed) {
      window.__continuePressed = false;
      if (game.hasSave) {
        game.audio.ensure();
        continueSave();
      }
    }
    return;
  }

  if (game.mode === 'gameover') {
    if (input.wasPressed('respawn')) startNewGame();
    if (input.wasPressed('confirm')) {
      game.mode = 'title';
      game.hasSave = hasSave();
    }
    return;
  }

  if (game.mode === 'complete') {
    if (input.wasPressed('confirm')) {
      game.mode = 'playing';
    }
    return;
  }

  if (input.wasPressed('pause')) {
    game.mode = game.mode === 'paused' ? 'playing' : 'paused';
    return;
  }
  if (game.mode === 'paused') return;

  // --- playing ---
  game.audio.ensure();
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);

  if (player.inCar) {
    updateDriving(dt);
  } else {
    updateOnFoot(dt);
  }

  updateTraffic(game, dt);
  updatePedestrians(game, dt);
  checkPedCollisions(game);
  updateWanted(game, dt);
  updatePolice(game, dt);
  updateBullets(game, dt);
  updateParticles(game, dt);
  updateMissions(game, dt);
  updateMissionQueue(game, dt);
  updatePickups(game, dt);
  removeWreckedCars(game);

  // Wrecked player car: eject the player in a shower of sparks.
  if (player.inCar && player.inCar.hp <= 0) {
    const car = player.inCar;
    player.inCar = null;
    car.kind = 'parked';
    damagePlayer(game, 25);
    game.audio.crash();
  }

  // Camera follows the player, clamped to the world.
  const targetX = player.x;
  const targetY = player.y;
  game.camera.x += (targetX - game.camera.x) * Math.min(1, dt * 5);
  game.camera.y += (targetY - game.camera.y) * Math.min(1, dt * 5);
  game.camera.x = Math.max(0, Math.min(game.city.size, game.camera.x));
  game.camera.y = Math.max(0, Math.min(game.city.size, game.camera.y));

  // Engine and siren follow the action.
  const speedRatio = player.inCar ? Math.abs(player.inCar.speed) / player.inCar.maxSpeed : 0;
  game.audio.setEngine(speedRatio, !!player.inCar);
  game.audio.setSiren(player.wanted > 0, dt);

  // Autosave every 30 seconds of play.
  saveTimer += dt;
  if (saveTimer > 30) {
    saveTimer = 0;
    saveGame(game);
  }
  if (game.saveTimer > 0) game.saveTimer -= dt;

  // Dialog expiry is time-based; nothing to do here.
  announceStatus();
}

function updateOnFoot(dt) {
  const input = game.input;
  const player = game.player;
  const dx = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
  const dy = (input.isDown('down') ? 1 : 0) - (input.isDown('up') ? 1 : 0);
  const speed = input.isDown('sprint') ? 270 : player.onFootSpeed;
  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    const nx = player.x + (dx / len) * speed * dt;
    const ny = player.y + (dy / len) * speed * dt;
    if (!hitsBuilding(game.city, nx, player.y, 12)) player.x = nx;
    if (!hitsBuilding(game.city, player.x, ny, 12)) player.y = ny;
    player.angle = Math.atan2(dy, dx);
    const clamped = clampToWorld(game.city, player.x, player.y, 24);
    player.x = clamped.x;
    player.y = clamped.y;
  }
  // Aim at the mouse; fire on click or Space.
  const cam = game.camera;
  const aimX = cam.x - canvas.width / 2 + input.mouse.x;
  const aimY = cam.y - canvas.height / 2 + input.mouse.y;
  if (input.mouse.down || input.isDown('fire')) {
    player.angle = Math.atan2(aimY - player.y, aimX - player.x);
    playerShoot(game, aimX, aimY);
  }
  // Enter / exit a car.
  if (input.wasPressed('enter')) {
    const car = nearestCar(game, player.x, player.y, 70);
    if (car) {
      if (car.kind === 'traffic' || car.kind === 'taxi') {
        addWanted(game, 1);
        setDialog(game, { name: 'You', line: 'This one\'s mine now.' });
      }
      car.kind = 'player';
      car.driver = 'player';
      player.inCar = car;
      player.carsStolen += 1;
      game.audio.pickup();
    }
  }
}

function updateDriving(dt) {
  const input = game.input;
  const player = game.player;
  const car = player.inCar;
  drivePlayerCar(game, car, input, dt);
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  // Exit the car.
  if (input.wasPressed('enter')) {
    const sideX = car.x + Math.cos(car.angle + Math.PI / 2) * 36;
    const sideY = car.y + Math.sin(car.angle + Math.PI / 2) * 36;
    if (!hitsBuilding(game.city, sideX, sideY, 12)) {
      player.x = sideX;
      player.y = sideY;
    } else {
      player.x = car.x - Math.cos(car.angle + Math.PI / 2) * 36;
      player.y = car.y - Math.sin(car.angle + Math.PI / 2) * 36;
    }
    car.kind = 'parked';
    car.speed = 0;
    player.inCar = null;
  }
}

function updatePickups(game, dt) {
  const player = game.player;
  for (let i = game.pickups.length - 1; i >= 0; i--) {
    const p = game.pickups[i];
    const d = Math.hypot(player.x - p.x, player.y - p.y);
    if (d < 30) {
      if (p.kind === 'cash') {
        player.money += p.value;
        setDialog(game, { name: 'You', line: `Picked up $${p.value}.` });
      } else if (p.kind === 'health') {
        player.hp = Math.min(100, player.hp + 35);
      } else if (p.kind === 'armor') {
        player.armor = Math.min(100, player.armor + 50);
      }
      game.audio.pickup();
      game.pickups.splice(i, 1);
    }
  }
  // Trickle new cash pickups into the world over time.
  if (game.pickups.length < 6 && game.rng() < dt * 0.05) {
    const vertical = game.rng() < 0.5;
    const road = vertical
      ? game.city.roadsX[Math.floor(game.rng() * game.city.roadsX.length)]
      : game.city.roadsY[Math.floor(game.rng() * game.city.roadsY.length)];
    const along = range(game.rng, 200, game.city.size - 200);
    game.pickups.push({
      x: vertical ? road : along,
      y: vertical ? along : road,
      kind: 'cash', value: 50, bob: 0,
    });
  }
}

function startNewGame() {
  const keepSeed = game.seed;
  const fresh = createGame({ seed: keepSeed, shot: null });
  Object.assign(game, fresh);
  game.audio = createAudio();
  game.audio.ensure();
  game.input = createInput(canvas);
  game.hasSave = hasSave();
  game.mode = 'playing';
  spawnTraffic(game, 26);
  spawnParkedCars(game, 30);
  spawnPedestrians(game, 46);
  spawnPickups(game);
  startMission(game, 0);
  saveTimer = 0;
}

function continueSave() {
  const data = loadSave();
  if (!data) return;
  applySave(game, data);
  game.mode = 'playing';
  startMission(game, Math.min(data.missionIndex || 0, 3));
  game.mission.step = 0;
}

function announceStatus() {
  const player = game.player;
  statusEl.textContent =
    `Neon Bay. Health ${Math.ceil(player.hp)}. Cash $${player.money}. ` +
    `Wanted ${player.wanted} star${player.wanted === 1 ? '' : 's'}. ${game.mission.objective || ''}`;
}

function render() {
  const view = { w: canvas.width, h: canvas.height };
  ctx.clearRect(0, 0, view.w, view.h);
  if (game.mode === 'title') {
    drawTitle(ctx, game, view);
    return;
  }
  drawWorld(ctx, game, view);
  drawPickups(ctx, game, view);
  drawCars(ctx, game, view);
  drawPeople(ctx, game, view);
  drawBullets(ctx, game, view);
  drawParticles(ctx, game, view);
  if (game.mode === 'playing' || game.mode === 'paused' || game.mode === 'complete') {
    drawHUD(ctx, game, view);
  }
  if (game.mode === 'paused') drawPause(ctx, view);
  if (game.mode === 'gameover') drawGameOver(ctx, view, game);
  if (game.mode === 'complete') drawComplete(ctx, view, game);
}

// The C key is not in the input map (it is only for "continue" on the title
// screen), so it gets its own tiny listener.
window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyC' && game.mode === 'title') {
    window.__continuePressed = true;
  }
  if (event.code === 'Enter' && game.mode === 'title') {
    // Confirm is already mapped; this is a no-op guard for browsers that
    // swallow Enter keydown repeats on the title screen.
  }
});

requestAnimationFrame(frame);
