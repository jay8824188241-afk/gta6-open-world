// The whole game state in one object. main.js creates it; every system reads
// and writes it, so the update order in main.js is the only coupling.
import { createCity } from './city.js';
import { makeRng } from './rng.js';

export function createGame(options) {
  const seed = (options && options.seed) || 7;
  const rng = makeRng(seed);
  const city = createCity(seed);

  return {
    seed,
    rng,
    city,
    time: 0,
    mode: 'title', // title | playing | paused | gameover | complete
    muted: false,
    // The player: on foot or in a car.
    player: {
      x: 1800, y: 1950, angle: -Math.PI / 2,
      hp: 100, armor: 0, money: 250,
      wanted: 0, wantedTimer: 0, crimeTimer: 0,
      inCar: null, // car object when driving
      onFootSpeed: 190,
      fireCooldown: 0,
      kills: 0, carsStolen: 0, missionsDone: 0,
      dead: false,
    },
    camera: { x: 1800, y: 1950 },
    cars: [],
    peds: [],
    cops: [], // on-foot police
    gangsters: [],
    bullets: [],
    pickups: [],
    particles: [],
    // Mission progress (missions.js owns the details).
    mission: {
      index: 0, // 0..3, 4 = all done (free roam)
      step: 0,
      timer: 0,
      target: null, // {x, y, label}
      text: '',
      dialog: null, // {name, line, until}
      objective: '',
    },
    stats: {
      shotsFired: 0,
      pedsHit: 0,
      copsDown: 0,
      distanceDriven: 0,
    },
    // Shot presets (shots.js) may override spawn and mode.
    shot: (options && options.shot) || null,
    saveMessage: '',
    saveTimer: 0,
  };
}
