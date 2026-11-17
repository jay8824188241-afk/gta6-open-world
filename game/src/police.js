// Wanted stars and the police response. Stars rise with crimes and fade when
// the player lays low. Police cars ram the player's car; on-foot officers
// chase and shoot. More stars means more, faster police.
import { makeCar } from './vehicles.js';
import { range } from './rng.js';
import { hitsBuilding, clampToWorld } from './city.js';

const COP_COLORS = ['#2c3e50', '#34495e'];

export function updateWanted(game, dt) {
  const player = game.player;
  player.crimeTimer += dt;
  // Lay low: no crime for a while and the heat fades, one star at a time.
  if (player.wanted > 0 && player.crimeTimer > 22) {
    player.wantedTimer += dt;
    if (player.wantedTimer > 8) {
      player.wantedTimer = 0;
      player.wanted -= 1;
    }
  } else {
    player.wantedTimer = 0;
  }
  // Hiding inside the safehouse clears heat fast.
  const safe = game.city.safehouse;
  const dSafe = Math.hypot(player.x - safe.x, player.y - safe.y);
  if (dSafe < 130 && player.wanted > 0) {
    player.wantedTimer += dt * 4;
    if (player.wantedTimer > 8) {
      player.wantedTimer = 0;
      player.wanted -= 1;
    }
  }
}

export function updatePolice(game, dt) {
  const player = game.player;
  const wanted = player.wanted;
  const targetCars = Math.min(wanted, 3);
  const targetCops = wanted >= 2 ? Math.min((wanted - 1) * 2, 6) : 0;

  // Spawn police cars near (but not on top of) the player.
  const policeCars = game.cars.filter((c) => c.kind === 'police');
  if (policeCars.length < targetCars && game.rng() < dt * 0.8) {
    spawnPoliceCar(game);
  }
  // Despawn police when the heat is gone.
  if (wanted === 0) {
    for (let i = game.cars.length - 1; i >= 0; i--) {
      if (game.cars[i].kind === 'police') game.cars.splice(i, 1);
    }
    game.cops.length = 0;
    return;
  }

  // Police cars chase and ram.
  for (const car of policeCars) {
    const dx = player.x - car.x;
    const dy = player.y - car.y;
    const dist = Math.hypot(dx, dy);
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
    const targetSpeed = dist > 320 ? 430 : 380;
    car.speed += (targetSpeed - car.speed) * dt * 0.7;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (!hitsBuilding(game.city, nx, ny, 22)) {
      car.x = nx;
      car.y = ny;
    } else {
      car.speed *= 0.4;
    }
    car.x = Math.max(30, Math.min(game.city.size - 30, car.x));
    car.y = Math.max(30, Math.min(game.city.size - 30, car.y));
    // Ramming the player's car damages it and shakes the player.
    if (player.inCar) {
      const ram = Math.hypot(car.x - player.inCar.x, car.y - player.inCar.y);
      if (ram < 48 && Math.abs(car.speed) > 150) {
        player.inCar.hp -= 6;
        player.inCar.speed *= 0.6;
        car.speed *= 0.5;
        game.audio.crash();
      }
    }
  }

  // On-foot officers: spawn, chase, and shoot at close range.
  if (game.cops.length < targetCops && game.rng() < dt * 0.6) {
    spawnCop(game);
  }
  for (let i = game.cops.length - 1; i >= 0; i--) {
    const cop = game.cops[i];
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 900) {
      game.cops.splice(i, 1);
      continue;
    }
    cop.angle = Math.atan2(dy, dx);
    const speed = player.inCar ? 0 : 150;
    if (dist > 30) {
      const nx = cop.x + Math.cos(cop.angle) * speed * dt;
      const ny = cop.y + Math.sin(cop.angle) * speed * dt;
      if (!hitsBuilding(game.city, nx, ny, 10)) {
        cop.x = nx;
        cop.y = ny;
      }
    }
    // Officers open fire when close and the player is on foot.
    cop.fireTimer -= dt;
    if (!player.inCar && dist < 260 && dist > 40 && cop.fireTimer <= 0) {
      cop.fireTimer = range(game.rng, 0.9, 1.6);
      game.bullets.push({
        x: cop.x, y: cop.y,
        vx: Math.cos(cop.angle) * 520, vy: Math.sin(cop.angle) * 520,
        life: 1.2, from: 'cop', damage: 7,
      });
      game.audio.shot();
    }
    if (cop.hp <= 0) {
      game.stats.copsDown += 1;
      game.cops.splice(i, 1);
      game.pickups.push({ x: cop.x, y: cop.y, kind: 'cash', value: 40, bob: 0 });
    }
  }
}

function spawnPoliceCar(game) {
  const player = game.player;
  const angle = game.rng() * Math.PI * 2;
  const dist = range(game.rng, 420, 560);
  const x = Math.max(60, Math.min(game.city.size - 60, player.x + Math.cos(angle) * dist));
  const y = Math.max(60, Math.min(game.city.size - 60, player.y + Math.sin(angle) * dist));
  const car = makeCar(game.rng, x, y, Math.atan2(player.y - y, player.x - x), 'police');
  car.color = COP_COLORS[Math.floor(game.rng() * COP_COLORS.length)];
  car.speed = 200;
  game.cars.push(car);
}

function spawnCop(game) {
  const player = game.player;
  const angle = game.rng() * Math.PI * 2;
  const dist = range(game.rng, 240, 380);
  const pos = clampToWorld(
    game.city,
    player.x + Math.cos(angle) * dist,
    player.y + Math.sin(angle) * dist,
    40,
  );
  game.cops.push({
    x: pos.x, y: pos.y, angle: 0, hp: 50,
    fireTimer: range(game.rng, 0.5, 1.5),
  });
}
