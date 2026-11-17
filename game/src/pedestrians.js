// Pedestrians: ordinary citizens strolling the sidewalks, who flee when a
// gun goes off or a car comes at them. Hitting one is a crime.
import { range, pick } from './rng.js';
import { onRoad, hitsBuilding, clampToWorld, ROAD_WIDTH } from './city.js';

const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
const SHIRTS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#ecf0f1', '#1abc9c'];

export function spawnPedestrians(game, count) {
  for (let i = 0; i < count; i++) {
    const vertical = game.rng() < 0.5;
    const road = pick(game.rng, vertical ? game.city.roadsX : game.city.roadsY);
    const along = range(game.rng, 100, game.city.size - 100);
    const side = (game.rng() < 0.5 ? -1 : 1) * (ROAD_WIDTH / 2 + 14);
    const x = vertical ? road + side : along;
    const y = vertical ? along : road + side;
    game.peds.push({
      x, y,
      angle: game.rng() * Math.PI * 2,
      speed: range(game.rng, 28, 55),
      skin: pick(game.rng, SKINS),
      shirt: pick(game.rng, SHIRTS),
      state: 'walk', // walk | flee | down
      panic: 0,
      wanderTimer: range(game.rng, 2, 6),
    });
  }
}

export function updatePedestrians(game, dt) {
  const player = game.player;
  for (const ped of game.peds) {
    if (ped.state === 'down') continue;
    // Panic: gunfire nearby, or the player's car bearing down.
    let threat = null;
    const playerCar = player.inCar;
    if (playerCar) {
      const d = Math.hypot(playerCar.x - ped.x, playerCar.y - ped.y);
      if (d < 110 && Math.abs(playerCar.speed) > 120) threat = playerCar;
    } else {
      const d = Math.hypot(player.x - ped.x, player.y - ped.y);
      if (d < 60 && game.stats.shotsFired > 0) threat = player;
    }
    if (threat) {
      ped.state = 'flee';
      ped.panic = 3;
    }
    if (ped.panic > 0) ped.panic -= dt;
    if (ped.panic <= 0 && ped.state === 'flee') ped.state = 'walk';

    if (ped.state === 'flee') {
      const away = Math.atan2(ped.y - (threat ? threat.y : player.y), ped.x - (threat ? threat.x : player.x));
      ped.angle = away;
      movePed(game, ped, 130 * dt);
    } else {
      ped.wanderTimer -= dt;
      if (ped.wanderTimer <= 0) {
        ped.wanderTimer = range(game.rng, 2, 6);
        // Turn to walk along a road or sidewalk.
        ped.angle = pick(game.rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2])
          + range(game.rng, -0.2, 0.2);
      }
      movePed(game, ped, ped.speed * dt);
    }
  }
}

function movePed(game, ped, dist) {
  const nx = ped.x + Math.cos(ped.angle) * dist;
  const ny = ped.y + Math.sin(ped.angle) * dist;
  if (hitsBuilding(game.city, nx, ny, 10)) {
    ped.angle += Math.PI / 2;
    return;
  }
  const clamped = clampToWorld(game.city, nx, ny, 24);
  ped.x = clamped.x;
  ped.y = clamped.y;
  // Drift back toward a road if stranded in a block.
  if (!onRoad(game.city, ped.x, ped.y)) {
    const rx = nearestRoad(game.city.roadsX, ped.x);
    const ry = nearestRoad(game.city.roadsY, ped.y);
    ped.angle = Math.abs(ped.x - rx) < Math.abs(ped.y - ry)
      ? Math.atan2(0, rx - ped.x)
      : Math.atan2(ry - ped.y, 0);
  }
}

function nearestRoad(roads, v) {
  let best = roads[0];
  let bestD = Infinity;
  for (const r of roads) {
    const d = Math.abs(r - v);
    if (d < bestD) { bestD = d; best = r; }
  }
  return best;
}

// A car hitting a pedestrian: they go down, it is a crime, witnesses notice.
export function checkPedCollisions(game) {
  const player = game.player;
  const cars = player.inCar ? [player.inCar] : [];
  for (const car of game.cars) {
    if (car.kind === 'traffic' || car.kind === 'taxi') {
      if (Math.abs(car.speed) > 60) cars.push(car);
    }
  }
  for (const car of cars) {
    for (const ped of game.peds) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(car.x - ped.x, car.y - ped.y);
      if (d < 26 && Math.abs(car.speed) > 40) {
        ped.state = 'down';
        game.stats.pedsHit += 1;
        game.audio.crash();
        if (car === player.inCar) {
          addWanted(game, 1);
          game.player.money = Math.max(0, game.player.money - 25);
        }
        for (let i = 0; i < 8; i++) {
          game.particles.push({
            x: ped.x, y: ped.y,
            vx: range(game.rng, -90, 90), vy: range(game.rng, -90, 90),
            life: 0.5, maxLife: 0.5, color: '#e74c3c', size: 3,
          });
        }
      }
    }
  }
}

export function addWanted(game, stars) {
  const player = game.player;
  player.wanted = Math.min(5, player.wanted + stars);
  player.crimeTimer = 0;
}
