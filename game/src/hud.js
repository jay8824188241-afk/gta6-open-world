// HUD, minimap, dialogs and menus: title screen, pause, game over, story
// complete. All drawn on the same canvas as the world.
import { missionTitle } from './missions.js';

const FONT = 'bold 16px "Segoe UI", system-ui, sans-serif';
const TITLE_FONT = 'bold 64px "Segoe UI", system-ui, sans-serif';

export function drawHUD(ctx, game, view) {
  const player = game.player;
  const w = view.w;
  const h = view.h;

  // Wanted stars, top right.
  const starSize = 26;
  const starsX = w - 30 - 5 * starSize;
  ctx.font = `${starSize}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < player.wanted ? '#ffd93b' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', starsX + i * starSize, 14);
  }

  // Cash and health, top left.
  ctx.font = FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, 12, 12, 250, 92, 10);
  ctx.fill();
  ctx.fillStyle = '#7CFC9A';
  ctx.fillText(`$ ${player.money.toLocaleString('en-US')}`, 24, 22);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`HEALTH ${Math.ceil(player.hp)}`, 24, 48);
  drawBar(ctx, 24, 70, 150, 10, player.hp / 100, '#e74c3c');
  if (player.armor > 0) {
    ctx.fillStyle = '#7db8ff';
    ctx.fillText(`ARMOR ${Math.ceil(player.armor)}`, 186, 48);
    drawBar(ctx, 186, 70, 52, 10, player.armor / 100, '#3498db');
  }

  // Mission objective, below the cash box.
  ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
  const obj = game.mission.objective || '';
  const objW = ctx.measureText(obj).width + 24;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, 12, 114, Math.min(objW, w - 24), 30, 8);
  ctx.fill();
  ctx.fillStyle = '#ffd93b';
  ctx.fillText(obj, 24, 122);

  // Dialog box at the bottom.
  const dialog = game.mission.dialog;
  if (dialog && game.time < dialog.until) {
    ctx.fillStyle = 'rgba(10,10,24,0.82)';
    roundRect(ctx, w / 2 - 330, h - 108, 660, 84, 10);
    ctx.fill();
    ctx.strokeStyle = '#ffd93b';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffd93b';
    ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(dialog.name, w / 2 - 314, h - 96);
    ctx.fillStyle = '#ffffff';
    ctx.font = '15px "Segoe UI", system-ui, sans-serif';
    wrapText(ctx, dialog.line, w / 2 - 314, h - 72, 628, 20);
  }

  // Controls hint, bottom left.
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '13px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('WASD move/drive · E enter/exit car · Mouse aim, Click/Space shoot · Shift boost · M mute · P pause', 14, h - 24);

  if (game.saveMessage && game.saveTimer > 0) {
    ctx.fillStyle = '#7CFC9A';
    ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(game.saveMessage, 14, h - 48);
  }

  drawMinimap(ctx, game, w, h);
  drawDirectionArrow(ctx, game, w, h);
}

function drawBar(ctx, x, y, w, h, ratio, color) {
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, ratio)), h);
}

function drawMinimap(ctx, game, w, h) {
  const size = 190;
  const x0 = w - size - 16;
  const y0 = 52;
  const scale = size / game.city.size;
  ctx.fillStyle = 'rgba(8,10,20,0.78)';
  roundRect(ctx, x0 - 6, y0 - 6, size + 12, size + 12, 10);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  // Water south of the city.
  ctx.fillStyle = '#123a4d';
  ctx.fillRect(x0, y0, size, size);
  // Land.
  ctx.fillStyle = '#3d5a3a';
  ctx.fillRect(x0, y0, size, size * 0.94);
  // Roads.
  ctx.strokeStyle = '#5a5a62';
  ctx.lineWidth = 2;
  for (const rx of game.city.roadsX) {
    ctx.beginPath();
    ctx.moveTo(x0 + rx * scale, y0);
    ctx.lineTo(x0 + rx * scale, y0 + size);
    ctx.stroke();
  }
  for (const ry of game.city.roadsY) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + ry * scale);
    ctx.lineTo(x0 + size, y0 + ry * scale);
    ctx.stroke();
  }
  // Landmarks.
  ctx.fillStyle = '#ffd93b';
  const marks = [game.city.docks, game.city.paintShop, game.city.motel, game.city.safehouse];
  for (const mark of marks) {
    ctx.fillRect(x0 + mark.x * scale - 3, y0 + mark.y * scale - 3, 6, 6);
  }
  // Mission target.
  const target = game.mission.target;
  if (target) {
    const pulse = 3 + Math.sin(game.time * 5) * 1.5;
    ctx.fillStyle = '#ff4757';
    ctx.beginPath();
    ctx.arc(x0 + target.x * scale, y0 + target.y * scale, pulse + 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police (red) and player (white).
  ctx.fillStyle = '#ff4757';
  for (const car of game.cars) {
    if (car.kind === 'police') {
      ctx.fillRect(x0 + car.x * scale - 2, y0 + car.y * scale - 2, 4, 4);
    }
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x0 + game.player.x * scale, y0 + game.player.y * scale, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('NEON BAY', x0, y0 + size + 16);
}

// Off-screen mission marker arrow at the screen edge.
function drawDirectionArrow(ctx, game, w, h) {
  const target = game.mission.target;
  if (!target) return;
  const cam = game.camera;
  const dx = target.x - cam.x;
  const dy = target.y - cam.y;
  if (Math.abs(dx) < w / 2 - 60 && Math.abs(dy) < h / 2 - 60) return;
  const angle = Math.atan2(dy, dx);
  const ax = w / 2 + Math.cos(angle) * (w / 2 - 70);
  const ay = h / 2 + Math.sin(angle) * (h / 2 - 70);
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(angle);
  ctx.fillStyle = '#ff4757';
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-10, -12);
  ctx.lineTo(-10, 12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(Math.hypot(dx, dy))}m`, ax, ay - 24);
  ctx.textAlign = 'left';
}

export function drawTitle(ctx, game, view) {
  const w = view.w;
  const h = view.h;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#1a1033');
  grad.addColorStop(0.55, '#c0392b');
  grad.addColorStop(1, '#f39c12');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // Sun, upper right so it never sits behind the title text.
  ctx.fillStyle = '#ffd93b';
  ctx.beginPath();
  ctx.arc(w * 0.84, h * 0.20, 72, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,217,59,0.25)';
  ctx.beginPath();
  ctx.arc(w * 0.84, h * 0.20, 104, 0, Math.PI * 2);
  ctx.fill();
  // Skyline silhouette.
  ctx.fillStyle = '#14102a';
  let bx = 0;
  const rngHeights = [120, 190, 150, 230, 170, 260, 140, 200, 110, 180, 240, 130];
  for (let i = 0; i < rngHeights.length; i++) {
    const bw = w / rngHeights.length;
    ctx.fillRect(bx, h - rngHeights[i] - 40, bw - 6, rngHeights[i] + 40);
    bx += bw;
  }
  ctx.fillStyle = '#0d0a1e';
  ctx.fillRect(0, h - 40, w, 40);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = TITLE_FONT;
  ctx.shadowColor = '#ff2e88';
  ctx.shadowBlur = 30;
  ctx.fillText('NEON BAY', w / 2, h * 0.30);
  ctx.shadowBlur = 0;
  ctx.font = 'bold 22px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#ffd93b';
  ctx.fillText('AN OPEN-WORLD CRIME STORY', w / 2, h * 0.30 + 44);
  ctx.font = '16px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  const lines = [
    'Steal cars. Outrun the Bay PD. Run jobs for Mara Voss.',
    'Four missions across a living city — traffic, pedestrians,',
    'wanted stars, shootouts, and one very hot sunset.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, w / 2, h * 0.52 + i * 26));

  const blink = Math.sin(game.time * 4) > -0.2;
  if (blink) {
    ctx.font = 'bold 24px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('PRESS ENTER TO START', w / 2, h * 0.72);
  }
  if (game.hasSave) {
    ctx.font = '16px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#7CFC9A';
    ctx.fillText('Saved game found — press C to CONTINUE, or Enter for a new game', w / 2, h * 0.72 + 34);
  }
  ctx.font = '14px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('WASD move / drive · E enter or exit a car · Mouse aim, click or Space to shoot · Shift boost · M mute · P pause', w / 2, h - 64);
  ctx.fillText('An original game. Not affiliated with any existing game series.', w / 2, h - 40);
  ctx.textAlign = 'left';
}

export function drawPause(ctx, view) {
  dim(ctx, view);
  centerText(ctx, view, 'PAUSED', 'Press P or Esc to resume', '#ffffff');
}

export function drawGameOver(ctx, view, game) {
  dim(ctx, view);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff4757';
  ctx.font = 'bold 56px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('BUSTED... OR WORSE', view.w / 2, view.h / 2 - 20);
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`You went down with $${game.player.money.toLocaleString('en-US')} and ${game.player.missionsDone} mission(s) done.`, view.w / 2, view.h / 2 + 24);
  ctx.fillText('Press R to start over, or Enter for the title screen', view.w / 2, view.h / 2 + 56);
  ctx.textAlign = 'left';
}

export function drawComplete(ctx, view, game) {
  dim(ctx, view);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd93b';
  ctx.font = 'bold 48px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('NEON BAY IS YOURS', view.w / 2, view.h / 2 - 20);
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`Story complete — $${game.player.money.toLocaleString('en-US')} banked, ${game.player.kills} Vipers down.`, view.w / 2, view.h / 2 + 24);
  ctx.fillText('Keep playing in free roam — press Enter to continue', view.w / 2, view.h / 2 + 56);
  ctx.textAlign = 'left';
}

function dim(ctx, view) {
  ctx.fillStyle = 'rgba(5,5,15,0.72)';
  ctx.fillRect(0, 0, view.w, view.h);
}

function centerText(ctx, view, big, small, color) {
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = 'bold 48px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(big, view.w / 2, view.h / 2 - 10);
  ctx.font = '18px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(small, view.w / 2, view.h / 2 + 30);
  ctx.textAlign = 'left';
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, cy);
}
