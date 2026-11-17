// World and entity rendering: roads, buildings, parks, water, cars, people,
// bullets, particles and the mission marker. Top-down, sun-soaked palette.
import { ROAD_WIDTH } from './city.js';

export function drawWorld(ctx, game, view) {
  const city = game.city;
  const cam = game.camera;
  const x0 = cam.x - view.w / 2;
  const y0 = cam.y - view.h / 2;

  // Ground: warm concrete, with the bay along the south edge.
  ctx.fillStyle = '#8a7a5f';
  ctx.fillRect(0, 0, view.w, view.h);
  const bayTop = city.size - y0;
  if (bayTop < view.h) {
    ctx.fillStyle = '#1d6a8a';
    ctx.fillRect(0, Math.max(0, bayTop), view.w, view.h - Math.max(0, bayTop));
    ctx.fillStyle = '#2a86ab';
    for (let i = 0; i < 6; i++) {
      const wy = bayTop + 24 + i * 26;
      if (wy > 0 && wy < view.h) {
        ctx.fillRect(0, wy, view.w, 3);
      }
    }
  }

  // Parks.
  for (const park of city.parks) {
    if (!onScreen(park.x, park.y, park.w, park.h, x0, y0, view)) continue;
    ctx.fillStyle = '#4a7a44';
    ctx.fillRect(park.x - x0, park.y - y0, park.w, park.h);
    ctx.fillStyle = '#5d8f55';
    ctx.fillRect(park.x - x0 + 8, park.y - y0 + 8, park.w - 16, park.h - 16);
  }
  // Trees.
  for (const tree of city.trees) {
    if (!onScreen(tree.x, tree.y, 30, 30, x0, y0, view)) continue;
    ctx.fillStyle = '#2f6b2f';
    ctx.beginPath();
    ctx.arc(tree.x - x0, tree.y - y0, tree.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3f8f3f';
    ctx.beginPath();
    ctx.arc(tree.x - x0 - 3, tree.y - y0 - 3, tree.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Parking lots.
  for (const lot of city.lots) {
    if (!onScreen(lot.x, lot.y, lot.w, lot.h, x0, y0, view)) continue;
    ctx.fillStyle = '#6a6a72';
    ctx.fillRect(lot.x - x0, lot.y - y0, lot.w, lot.h);
    ctx.strokeStyle = '#d8d8d8';
    ctx.lineWidth = 2;
    for (let sx = lot.x + 18; sx < lot.x + lot.w - 10; sx += 34) {
      ctx.beginPath();
      ctx.moveTo(sx - x0, lot.y - y0 + 10);
      ctx.lineTo(sx - x0, lot.y - y0 + 34);
      ctx.stroke();
    }
  }

  // Roads.
  ctx.fillStyle = '#33333c';
  for (const rx of city.roadsX) {
    ctx.fillRect(rx - ROAD_WIDTH / 2 - x0, -y0, ROAD_WIDTH, city.size);
  }
  for (const ry of city.roadsY) {
    ctx.fillRect(-x0, ry - ROAD_WIDTH / 2 - y0, city.size, ROAD_WIDTH);
  }
  // Lane dashes.
  ctx.fillStyle = '#e8d44d';
  for (const rx of city.roadsX) {
    for (let y = 0; y < city.size; y += 56) {
      ctx.fillRect(rx - 2 - x0, y - y0, 4, 28);
    }
  }
  for (const ry of city.roadsY) {
    for (let x = 0; x < city.size; x += 56) {
      ctx.fillRect(x - x0, ry - 2 - y0, 28, 4);
    }
  }
  // Crosswalks at intersections.
  ctx.fillStyle = '#d8d8d8';
  for (const rx of city.roadsX) {
    for (const ry of city.roadsY) {
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(rx + i * 10 - 3 - x0, ry - ROAD_WIDTH / 2 - 4 - y0, 6, 10);
        ctx.fillRect(rx + i * 10 - 3 - x0, ry + ROAD_WIDTH / 2 - 6 - y0, 6, 10);
      }
    }
  }

  // Buildings, with roof shading and a height shadow.
  for (const b of city.buildings) {
    if (!onScreen(b.x, b.y, b.w, b.h, x0, y0, view)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x - x0 + 6, b.y - y0 + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x - x0, b.y - y0, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x - x0 + 8, b.y - y0 + 8, b.w - 16, b.h - 16);
    // Windows.
    ctx.fillStyle = 'rgba(255,255,200,0.5)';
    for (let wx = b.x + 16; wx < b.x + b.w - 12; wx += 22) {
      for (let wy = b.y + 16; wy < b.y + b.h - 12; wy += 22) {
        ctx.fillRect(wx - x0, wy - y0, 8, 8);
      }
    }
    // Skip the building's own label when the mission pin sits on it, so the
    // two labels never stack on top of each other.
    const target = game.mission.target;
    const pinOnBuilding = target &&
      target.x > b.x && target.x < b.x + b.w && target.y > b.y && target.y < b.y + b.h;
    if (b.label && !pinOnBuilding) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.label, b.x + b.w / 2 - x0, b.y + b.h / 2 - y0 + 4);
      ctx.textAlign = 'left';
    }
  }

  // Safehouse glow.
  const safe = city.safehouse;
  ctx.strokeStyle = '#7CFC9A';
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(safe.x - 110 - x0, safe.y - 110 - y0, 220, 220);
  ctx.setLineDash([]);

  // Mission marker: bouncing pin at the target.
  const target = game.mission.target;
  if (target) {
    const bob = Math.sin(game.time * 4) * 8;
    const tx = target.x - x0;
    const ty = target.y - y0 + bob;
    ctx.fillStyle = '#ff4757';
    ctx.beginPath();
    ctx.arc(tx, ty, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(tx - 10, ty + 8);
    ctx.lineTo(tx + 10, ty + 8);
    ctx.lineTo(tx, ty + 26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(target.label || 'OBJECTIVE', tx, ty - 20);
    ctx.textAlign = 'left';
  }
}

function onScreen(x, y, w, h, x0, y0, view) {
  return x + w > x0 - 40 && x < x0 + view.w + 40 && y + h > y0 - 40 && y < y0 + view.h + 40;
}

export function drawPickups(ctx, game, view) {
  const cam = game.camera;
  const x0 = cam.x - view.w / 2;
  const y0 = cam.y - view.h / 2;
  for (const p of game.pickups) {
    const bob = Math.sin(game.time * 3 + p.bob) * 3;
    const px = p.x - x0;
    const py = p.y - y0 + bob;
    if (p.kind === 'cash') {
      ctx.fillStyle = '#7CFC9A';
      ctx.fillRect(px - 10, py - 6, 20, 12);
      ctx.fillStyle = '#1d5c2e';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', px, py + 4);
      ctx.textAlign = 'left';
    } else if (p.kind === 'health') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px - 9, py - 9, 18, 18);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(px - 2, py - 7, 4, 14);
      ctx.fillRect(px - 7, py - 2, 14, 4);
    } else if (p.kind === 'armor') {
      ctx.fillStyle = '#3498db';
      ctx.beginPath();
      ctx.arc(px, py, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('A', px, py + 4);
      ctx.textAlign = 'left';
    }
  }
}

export function drawCars(ctx, game, view) {
  const cam = game.camera;
  const x0 = cam.x - view.w / 2;
  const y0 = cam.y - view.h / 2;
  for (const car of game.cars) {
    const cx = car.x - x0;
    const cy = car.y - y0;
    if (cx < -60 || cx > view.w + 60 || cy < -60 || cy > view.h + 60) continue;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-21, -9, 46, 22);
    // Body.
    ctx.fillStyle = car.color;
    roundRectPath(ctx, -23, -11, 46, 22, 6);
    ctx.fill();
    // Roof and windshield.
    ctx.fillStyle = 'rgba(20,20,30,0.85)';
    ctx.fillRect(-6, -9, 14, 18);
    ctx.fillStyle = 'rgba(180,220,255,0.7)';
    ctx.fillRect(10, -8, 6, 16);
    // Headlights.
    ctx.fillStyle = '#fff8c0';
    ctx.fillRect(21, -8, 3, 4);
    ctx.fillRect(21, 4, 3, 4);
    // Police light bar.
    if (car.kind === 'police') {
      const flash = Math.sin(game.time * 12) > 0;
      ctx.fillStyle = flash ? '#ff2e2e' : '#2e7dff';
      ctx.fillRect(-4, -11, 8, 5);
      ctx.fillStyle = flash ? '#2e7dff' : '#ff2e2e';
      ctx.fillRect(-4, 6, 8, 5);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PD', 0, 3);
      ctx.textAlign = 'left';
    }
    if (car.kind === 'taxi') {
      ctx.fillStyle = '#111111';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 3);
      ctx.textAlign = 'left';
    }
    // Damage smoke.
    if (car.hp < 40) {
      ctx.fillStyle = 'rgba(120,120,120,0.7)';
      ctx.beginPath();
      ctx.arc(-18, 0, 5 + Math.sin(game.time * 9) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

export function drawPeople(ctx, game, view) {
  const cam = game.camera;
  const x0 = cam.x - view.w / 2;
  const y0 = cam.y - view.h / 2;
  // Pedestrians.
  for (const ped of game.peds) {
    const px = ped.x - x0;
    const py = ped.y - y0;
    if (px < -20 || px > view.w + 20 || py < -20 || py > view.h + 20) continue;
    drawPerson(ctx, px, py, ped.angle, ped.skin, ped.shirt, ped.state === 'down');
  }
  // On-foot police.
  for (const cop of game.cops) {
    drawPerson(ctx, cop.x - x0, cop.y - y0, cop.angle, '#f1c27d', '#2c3e50', false, true);
  }
  // Gangsters (red jackets).
  for (const g of game.gangsters) {
    drawPerson(ctx, g.x - x0, g.y - y0, g.angle, '#e0ac69', '#c0392b', false, false, true);
  }
  // The player.
  const player = game.player;
  if (!player.inCar && !player.dead) {
    drawPerson(ctx, player.x - x0, player.y - y0, player.angle, '#f1c27d', '#16a085', false, false, false, true);
  }
}

function drawPerson(ctx, x, y, angle, skin, shirt, down, isCop, isGang, isPlayer) {
  ctx.save();
  ctx.translate(x, y);
  if (down) {
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = shirt;
    ctx.fillRect(-9, -5, 18, 10);
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(12, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.rotate(angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 9, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body and head.
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(10, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  // Gun in hand when armed.
  if (isCop || isGang || isPlayer) {
    ctx.fillStyle = '#222222';
    ctx.fillRect(12, -1, 9, 2);
  }
  if (isCop) {
    ctx.fillStyle = '#ffd93b';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
    ctx.textAlign = 'left';
  }
  if (isPlayer) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawBullets(ctx, game, view) {
  const cam = game.camera;
  const x0 = cam.x - view.w / 2;
  const y0 = cam.y - view.h / 2;
  ctx.strokeStyle = '#ffe66d';
  ctx.lineWidth = 2;
  for (const b of game.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - x0 - b.vx * 0.02, b.y - y0 - b.vy * 0.02);
    ctx.lineTo(b.x - x0, b.y - y0);
    ctx.stroke();
  }
}

export function drawParticles(ctx, game, view) {
  const cam = game.camera;
  const x0 = cam.x - view.w / 2;
  const y0 = cam.y - view.h / 2;
  for (const p of game.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - x0 - p.size / 2, p.y - y0 - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
