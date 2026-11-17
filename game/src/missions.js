// Missions and the story of Neon Bay. Four missions in order, each with steps,
// a map marker, dialog from original characters, and a cash reward. After the
// last one the city is free roam with the story complete.
import { gangsterShoot } from './combat.js';
import { range } from './rng.js';

const MISSIONS = [
  {
    name: 'Hot Wheels',
    intro: { name: 'Mara Voss', line: 'Kid, you need wheels to survive Neon Bay. Jack any car and bring it to Ray\'s Paint Shop — he owes me a favor.' },
    steps: [
      { objective: 'Steal a car (walk up and press E)', check: (g) => !!g.player.inCar, target: null },
      { objective: "Drive to Ray's Paint Shop", check: (g) => near(g, g.city.paintShop, 90), target: (g) => g.city.paintShop },
    ],
    reward: 300,
    outro: { name: 'Ray', line: 'Nice ride. Mara says you\'re good people. Keep the paint job — on the house.' },
  },
  {
    name: 'The Package',
    intro: { name: 'Mara Voss', line: 'A crate came in at the Harbor Docks. Pick it up, run it to the Sunset Motel. And kid — the harbor cops are jumpy tonight.' },
    steps: [
      { objective: 'Pick up the package at the Harbor Docks', check: (g) => near(g, g.city.docks, 100), target: (g) => g.city.docks },
      { objective: 'Deliver the package to the Sunset Motel', check: (g) => near(g, g.city.motel, 90), target: (g) => g.city.motel },
    ],
    reward: 600,
    outro: { name: 'Mara Voss', line: 'Clean run. The Vipers are sniffing around the docks, though. Watch your back.' },
    onStart: (g) => { g.player.wanted = Math.max(g.player.wanted, 1); g.player.crimeTimer = 0; },
  },
  {
    name: 'Dockside Dispute',
    intro: { name: 'Mara Voss', line: 'The Vipers took our turf at the docks. Six of them, armed. Go remind them who runs Neon Bay.' },
    steps: [
      { objective: 'Clear the docks of the Vipers (0/6)', check: (g) => g.gangsters.length === 0 && g.mission.kills >= 6, target: (g) => g.city.docks },
    ],
    reward: 900,
    outro: { name: 'Mara Voss', line: 'The docks are ours again. The whole bay is talking about you.' },
    onStart: (g) => spawnGangsters(g, 6),
  },
  {
    name: 'Heat Wave',
    intro: { name: 'Mara Voss', line: 'The whole Bay PD is after you now. Lose them — lay low at the Safehouse until the heat dies down.' },
    steps: [
      { objective: 'Lose the heat — reach the Safehouse', check: (g) => near(g, g.city.safehouse, 110) && g.player.wanted === 0, target: (g) => g.city.safehouse },
    ],
    reward: 1200,
    outro: { name: 'Mara Voss', line: 'You made it. Neon Bay is yours now, kid. The story\'s just getting started.' },
    onStart: (g) => { g.player.wanted = 3; g.player.crimeTimer = 0; },
  },
];

function near(game, point, dist) {
  return Math.hypot(game.player.x - point.x, game.player.y - point.y) < dist;
}

function spawnGangsters(game, count) {
  const docks = game.city.docks;
  for (let i = 0; i < count; i++) {
    game.gangsters.push({
      x: docks.x + range(game.rng, -120, 120),
      y: docks.y + range(game.rng, -120, 120),
      angle: 0, hp: 60,
      fireTimer: range(game.rng, 0.5, 1.5),
      moveTimer: 0,
    });
  }
  game.mission.kills = 0;
}

export function startMission(game, index) {
  const mission = MISSIONS[index];
  if (!mission) return;
  game.mission.index = index;
  game.mission.step = 0;
  game.mission.timer = 0;
  game.mission.kills = 0;
  setDialog(game, mission.intro);
  if (mission.onStart) mission.onStart(game);
  refreshObjective(game);
}

export function updateMissions(game, dt) {
  const mission = MISSIONS[game.mission.index];
  if (!mission) return;
  game.mission.timer += dt;
  const step = mission.steps[game.mission.step];
  if (!step) return;
  refreshObjective(game);
  if (step.check(game)) {
    game.mission.step += 1;
    game.audio.pickup();
    if (game.mission.step >= mission.steps.length) {
      completeMission(game, mission);
    } else {
      refreshObjective(game);
    }
  }
  // Gangster AI during the dock fight.
  updateGangsters(game, dt);
}

function refreshObjective(game) {
  const mission = MISSIONS[game.mission.index];
  if (!mission) {
    game.mission.objective = 'Free roam — Neon Bay is yours.';
    game.mission.target = null;
    return;
  }
  const step = mission.steps[game.mission.step];
  if (!step) return;
  let objective = step.objective;
  if (game.mission.index === 2) {
    objective = `Clear the docks of the Vipers (${game.mission.kills}/6)`;
  }
  game.mission.objective = `${mission.name}: ${objective}`;
  game.mission.target = step.target ? step.target(game) : null;
}

function completeMission(game, mission) {
  game.player.money += mission.reward;
  game.player.missionsDone += 1;
  game.audio.jingle();
  setDialog(game, mission.outro);
  game.mission.index += 1;
  if (game.mission.index >= MISSIONS.length) {
    game.mode = 'complete';
    game.mission.objective = 'Story complete — free roam Neon Bay!';
    game.mission.target = null;
    return;
  }
  // Next mission starts after a short breather.
  game.mission.step = 0;
  game.mission.pendingNext = 3;
}

export function updateMissionQueue(game, dt) {
  if (game.mission.pendingNext === undefined) return;
  game.mission.pendingNext -= dt;
  if (game.mission.pendingNext <= 0) {
    game.mission.pendingNext = undefined;
    startMission(game, game.mission.index);
  }
}

export function setDialog(game, dialog) {
  game.mission.dialog = { name: dialog.name, line: dialog.line, until: game.time + 6 };
}

export function updateGangsters(game, dt) {
  const player = game.player;
  for (let i = game.gangsters.length - 1; i >= 0; i--) {
    const g = game.gangsters[i];
    if (g.hp <= 0) {
      game.mission.kills = (game.mission.kills || 0) + 1;
      game.gangsters.splice(i, 1);
      game.pickups.push({ x: g.x, y: g.y, kind: 'cash', value: 50, bob: 0 });
      continue;
    }
    const dx = player.x - g.x;
    const dy = player.y - g.y;
    const dist = Math.hypot(dx, dy);
    g.angle = Math.atan2(dy, dx);
    // Strafe and shoot when in range; close in when far.
    g.moveTimer -= dt;
    if (dist > 320) {
      g.x += Math.cos(g.angle) * 110 * dt;
      g.y += Math.sin(g.angle) * 110 * dt;
    } else if (g.moveTimer <= 0) {
      g.moveTimer = 1.2;
      g.strafe = (game.rng() < 0.5 ? -1 : 1);
    } else if (g.strafe) {
      g.x += Math.cos(g.angle + Math.PI / 2) * g.strafe * 60 * dt;
      g.y += Math.sin(g.angle + Math.PI / 2) * g.strafe * 60 * dt;
    }
    g.fireTimer -= dt;
    if (dist < 340 && g.fireTimer <= 0) {
      gangsterShoot(game, g, player.x, player.y);
    }
  }
}

export function missionTitle(game) {
  const mission = MISSIONS[game.mission.index];
  return mission ? mission.name : 'Free Roam';
}
