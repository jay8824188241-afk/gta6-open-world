// Screenshot presets: ?shot=start|play|chase|mission renders a fixed,
// reproducible state so the entry's screenshots can be retaken exactly.
// The seed comes from ?seed= (default 7).
import { makeCar } from './vehicles.js';
import { startMission } from './missions.js';

export function applyShot(game, shot) {
  if (shot === 'start') {
    game.mode = 'title';
    return;
  }
  if (shot === 'play') {
    game.mode = 'playing';
    startMission(game, 0);
    // Put the player behind the wheel at a busy downtown intersection.
    const car = makeCar(game.rng, 1800, 1950, -Math.PI / 2, 'player');
    car.speed = 160;
    game.cars.push(car);
    enterCar(game, car);
    game.mission.step = 1; // already stole the car: drive to the paint shop
    game.mission.objective = "Hot Wheels: Drive to Ray's Paint Shop";
    game.mission.target = game.city.paintShop;
    return;
  }
  if (shot === 'chase') {
    game.mode = 'playing';
    startMission(game, 3);
    game.player.wanted = 3;
    game.player.crimeTimer = 0;
    const car = makeCar(game.rng, 1500, 1500, 0, 'player');
    car.speed = 300;
    game.cars.push(car);
    enterCar(game, car);
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + 0.5;
      const cop = makeCar(game.rng, 1500 + Math.cos(angle) * 260, 1500 + Math.sin(angle) * 260, angle + Math.PI, 'police');
      cop.speed = 320;
      game.cars.push(cop);
    }
    game.mission.objective = 'Heat Wave: Lose the heat — reach the Safehouse';
    game.mission.target = game.city.safehouse;
    return;
  }
  if (shot === 'mission') {
    game.mode = 'playing';
    startMission(game, 2);
    // Player on foot at the docks, gangsters in view, mid-firefight.
    game.player.x = game.city.docks.x - 140;
    game.player.y = game.city.docks.y - 60;
    game.player.angle = 0;
    game.player.hp = 82;
    game.player.armor = 40;
    game.camera.x = game.player.x;
    game.camera.y = game.player.y;
    return;
  }
  // Unknown shot: just play.
  game.mode = 'playing';
  startMission(game, 0);
}

function enterCar(game, car) {
  car.kind = 'player';
  car.driver = 'player';
  game.player.inCar = car;
  game.player.x = car.x;
  game.player.y = car.y;
}
