// Combat: the player's pistol, gangster and cop gunfire, bullet flight,
// damage, explosions and muzzle particles.
import { range } from './rng.js';
import { hitsBuilding } from './city.js';

export function playerShoot(game, targetX, targetY) {
  const player = game.player;
  if (player.fireCooldown > 0 || player.inCar) return;
  player.fireCooldown = 0.28;
  game.stats.shotsFired += 1;
  const angle = Math.atan2(targetY - player.y, targetX - player.x);
  player.angle = angle;
  game.bullets.push({
    x: player.x + Math.cos(angle) * 18,
    y: player.y + Math.sin(angle) * 18,
    vx: Math.cos(angle) * 620, vy: Math.sin(angle) * 620,
    life: 0.9, from: 'player', damage: 34,
  });
  game.audio.shot();
  // Firing a gun in public draws the heat: at least one star.
  if (game.player.wanted < 1) {
    game.player.wanted = 1;
    game.player.crimeTimer = 0;
  }
  spawnMuzzle(game, player.x + Math.cos(angle) * 20, player.y + Math.sin(angle) * 20);
}

export function gangsterShoot(game, g, targetX, targetY) {
  g.fireTimer = range(game.rng, 0.8, 1.5);
  const angle = Math.atan2(targetY - g.y, targetX - g.x) + range(game.rng, -0.12, 0.12);
  game.bullets.push({
    x: g.x, y: g.y,
    vx: Math.cos(angle) * 480, vy: Math.sin(angle) * 480,
    life: 1.1, from: 'gang', damage: 6,
  });
  game.audio.shot();
  spawnMuzzle(game, g.x, g.y);
}

function spawnMuzzle(game, x, y) {
  for (let i = 0; i < 4; i++) {
    game.particles.push({
      x, y,
      vx: range(game.rng, -80, 80), vy: range(game.rng, -80, 80),
      life: 0.12, maxLife: 0.12, color: '#f7d038', size: 4,
    });
  }
}

export function updateBullets(game, dt) {
  const player = game.player;
  for (let i = game.bullets.length - 1; i >= 0; i--) {
    const b = game.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (hitsBuilding(game.city, b.x, b.y, 2)) {
      dead = true;
      spawnImpact(game, b.x, b.y);
    }
    if (!dead && b.from === 'player') {
      dead = hitTargets(game, b, game.cops) || hitTargets(game, b, game.gangsters);
      if (!dead) {
        // Shooting a car damages it.
        for (const car of game.cars) {
          if (car.kind === 'player') continue;
          if (Math.hypot(car.x - b.x, car.y - b.y) < 26) {
            car.hp -= b.damage;
            dead = true;
            spawnImpact(game, b.x, b.y);
            break;
          }
        }
      }
    }
    if (!dead && (b.from === 'cop' || b.from === 'gang')) {
      if (!player.inCar && Math.hypot(player.x - b.x, player.y - b.y) < 14) {
        damagePlayer(game, b.damage);
        dead = true;
      }
      if (player.inCar && Math.hypot(player.inCar.x - b.x, player.inCar.y - b.y) < 26) {
        player.inCar.hp -= b.damage * 0.5;
        dead = true;
      }
    }
    if (dead) game.bullets.splice(i, 1);
  }
}

function hitTargets(game, b, targets) {
  for (const t of targets) {
    if (t.hp > 0 && Math.hypot(t.x - b.x, t.y - b.y) < 15) {
      t.hp -= b.damage;
      spawnImpact(game, b.x, b.y);
      if (t.hp <= 0 && targets === game.cops) {
        game.player.wanted = Math.min(5, game.player.wanted + 1);
        game.player.crimeTimer = 0;
      }
      if (t.hp <= 0 && targets === game.gangsters) {
        game.player.kills += 1;
      }
      return true;
    }
  }
  return false;
}

function spawnImpact(game, x, y) {
  for (let i = 0; i < 3; i++) {
    game.particles.push({
      x, y,
      vx: range(game.rng, -60, 60), vy: range(game.rng, -60, 60),
      life: 0.2, maxLife: 0.2, color: '#f39c12', size: 2,
    });
  }
}

export function damagePlayer(game, amount) {
  const player = game.player;
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, amount);
    player.armor -= absorbed;
    amount -= absorbed;
  }
  player.hp -= amount;
  if (player.hp <= 0) {
    player.hp = 0;
    player.dead = true;
    game.mode = 'gameover';
    game.audio.fail();
  }
}

export function updateParticles(game, dt) {
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const p = game.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) game.particles.splice(i, 1);
  }
}
