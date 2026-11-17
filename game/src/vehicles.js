// Cars: driving physics for the player, traffic AI for the city, parked cars
// to steal, and police interceptors. A car is a small physics body with an
// angle, speed and steering; traffic follows the road grid.
import { makeRng, range, pick } from './rng.js';
import { onRoad, hitsBuilding, clampToWorld, ROAD_WIDTH } from './city.js';

const CAR_COLORS = [
  '#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#e67e22',
  '#9b59b6', '#ecf0f1', '#1abc9c', '#fd79a8', '#636e72',
];
const TAXI_COLOR = '#f7d038';

export function makeCar(rng, x, y, angle, kind) {
  return {
    x, y, angle,
    speed: 0,
    maxSpeed: kind === 'police' ? 420 : range(rng, 200, 300),
    color: kind === 'taxi' ? TAXI_COLOR : kind === 'police' ? '#2c3e50' : pick(rng, CAR_COLORS),
    kind: kind || 'traffic', // traffic | parked | player | police | taxi
    hp: 100,
    // Traffic AI state: which road lane it follows and where it turns.
    dir: angle,
    turnAt: null,
    stopped: 0,
    siren: kind === 'police',
    driver: kind === 'parked' ? null : 'ai',
    w: 46, h: 22,
  };
}

export function spawnTraffic(game, count) {
  const rng = game.rng;
  for (let i = 0; i < count; i++) {
    const vertical = rng() < 0.5;
    const road = pick(rng, vertical ? game.city.roadsX : game.city.roadsY);
    const along = range(rng, 100, game.city.size - 100);
    const x = vertical ? road : along;
    const y = vertical ? along : road;
    const angle = vertical ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2)
                           : (rng() < 0.5 ? 0 : Math.PI);
    const car = makeCar(rng, x, y, angle, rng() < 0.08 ? 'taxi' : 'traffic');
    car.speed = range(rng, 90, 170);
    car.dir = angle;
    game.cars.push(car);
  }
}

export function spawnParkedCars(game, count) {
  const rng = game.rng;
  for (let i = 0; i < count; i++) {
    const vertical = rng() < 0.5;
    const road = pick(rng, vertical ? game.city.roadsX : game.city.roadsY);
    const along = range(rng, 120, game.city.size - 120);
    const offset = (rng() < 0.5 ? -1 : 1) * (ROAD_WIDTH / 2 - 12);
    const x = vertical ? road + offset : along;
    const y = vertical ? along : road + offset;
    const angle = vertical ? (offset > 0 ? Math.PI / 2 : -Math.PI / 2)
                           : (offset > 0 ? 0 : Math.PI);
    const car = makeCar(rng, x, y, angle, 'parked');
    game.cars.push(car);
  }
}

// Player driving: arcade handling, drift on handbrake, damage on hard hits.
export function drivePlayerCar(game, car, input, dt) {
  const forward = input.isDown('up') ? 1 : 0;
  const brake = input.isDown('down') ? 1 : 0;
  const steer = (input.isDown('left') ? -1 : 0) + (input.isDown('right') ? 1 : 0);
  const sprint = input.isDown('sprint');

  const accel = 260;
  const maxSpeed = sprint ? car.maxSpeed * 1.12 : car.maxSpeed;
  if (forward) car.speed += accel * dt;
  if (brake) car.speed -= (car.speed > 0 ? 380 : 160) * dt;
  if (!forward && !brake) car.speed -= Math.sign(car.speed) * 90 * dt;
  car.speed = Math.max(-120, Math.min(maxSpeed, car.speed));
  if (Math.abs(car.speed) < 4 && !forward && !brake) car.speed = 0;

  const grip = sprint ? 2.6 : 3.4;
  car.angle += steer * grip * dt * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 90);

  moveCar(game, car, dt);
  game.stats.distanceDriven += Math.abs(car.speed) * dt;
  return Math.abs(car.speed) / car.maxSpeed;
}

function moveCar(game, car, dt) {
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const hit = hitsBuilding(game.city, nx, ny, 22);
  if (hit) {
    if (Math.abs(car.speed) > 200) {
      car.hp -= 12;
      game.audio.crash();
      spawnCrashSparks(game, car.x, car.y);
    }
    car.speed *= -0.25;
    return;
  }
  const clamped = clampToWorld(game.city, nx, ny, 30);
  car.x = clamped.x;
  car.y = clamped.y;
}

export function spawnCrashSparks(game, x, y) {
  for (let i = 0; i < 10; i++) {
    game.particles.push({
      x, y,
      vx: range(game.rng, -140, 140), vy: range(game.rng, -140, 140),
      life: 0.4, maxLife: 0.4, color: '#f7d038', size: 3,
    });
  }
}

// Traffic AI: cruise along its road; at an intersection, sometimes turn.
export function updateTraffic(game, dt) {
  const city = game.city;
  for (const car of game.cars) {
    if (car.kind !== 'traffic' && car.kind !== 'taxi') continue;
    // Slow down for a car ahead on the same road.
    let blocked = false;
    for (const other of game.cars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const ahead = dx * Math.cos(car.dir) + dy * Math.sin(car.dir);
      const side = Math.abs(-dx * Math.sin(car.dir) + dy * Math.cos(car.dir));
      if (ahead > 0 && ahead < 70 && side < 26) { blocked = true; break; }
    }
    if (blocked) {
      car.speed = Math.max(0, car.speed - 220 * dt);
      continue;
    }
    const target = Math.min(car.maxSpeed, 150);
    car.speed += (target - car.speed) * dt * 0.8;

    // At an intersection, maybe turn onto the crossing road.
    const nearX = nearestRoad(city.roadsX, car.x);
    const nearY = nearestRoad(city.roadsY, car.y);
    const atCross = Math.abs(car.x - nearX) < 8 && Math.abs(car.y - nearY) < 8;
    if (atCross && game.rng() < 0.012) {
      const vertical = game.rng() < 0.5;
      car.dir = vertical ? (game.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2)
                         : (game.rng() < 0.5 ? 0 : Math.PI);
    }
    // Ease the drawn angle toward the driving direction.
    car.angle += angleDiff(car.dir, car.angle) * Math.min(1, dt * 5);
    const nx = car.x + Math.cos(car.dir) * car.speed * dt;
    const ny = car.y + Math.sin(car.dir) * car.speed * dt;
    if (onRoad(city, nx, ny) && !hitsBuilding(city, nx, ny, 22)) {
      car.x = nx;
      car.y = ny;
    } else {
      // Reached the edge or a dead end: turn around.
      car.dir += Math.PI;
      car.angle = car.dir;
    }
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

function angleDiff(target, current) {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// The nearest stealable / enterable car within reach of the player.
export function nearestCar(game, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of game.cars) {
    if (car.kind === 'police') continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function removeWreckedCars(game) {
  for (let i = game.cars.length - 1; i >= 0; i--) {
    const car = game.cars[i];
    if (car.hp <= 0 && car.kind !== 'player') {
      spawnCrashSparks(game, car.x, car.y);
      if (car.kind === 'police') game.player.wanted = Math.max(0, game.player.wanted - 0);
      game.cars.splice(i, 1);
      // A wreck drops cash.
      game.pickups.push({ x: car.x, y: car.y, kind: 'cash', value: 60, bob: 0 });
    }
  }
}
