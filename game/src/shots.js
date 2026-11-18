// Screenshot staging behind ?shot=start|drive|combat|chase&seed=N.
// Each scene plays the real rules forward from a fresh game for a fixed
// number of steps, steered by a tiny scripted driver, then freezes the frame
// so the screenshot is the same on every run from the same seed.
import { VIEW_W, VIEW_H, STEP, LANDMARKS } from './config.js';
import { mulberry32, range } from './random.js';
import { keys, mouse } from './input.js';
import { enterCar } from './player.js';
import { spawnGangster } from './combat.js';
import { spawnPoliceCar } from './police.js';
import { startMission } from './missions.js';
import { updateTraffic, updatePedestrians } from './traffic.js';
import { dist } from './world.js';

const DRIVE_SECONDS = 7;
const COMBAT_SECONDS = 6.5;
const CHASE_SECONDS = 5;
const TITLE_SECONDS = 5;

function clearKeys() {
  for (const code of Object.keys(keys)) keys[code] = false;
  mouse.down = false;
}

function runSteps(G, seconds, scripted) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (scripted) scripted(G, STEP);
    G.time += STEP;
    if (G.fireCd > 0) G.fireCd -= STEP;
    if (G.hudMessageT > 0) G.hudMessageT -= STEP;
    if (G.briefing) {
      G.briefing.t -= STEP;
      if (G.briefing.t <= 0) G.briefing = null;
    }
    G.mouseX = mouse.x;
    G.mouseY = mouse.y;
    if (G.scriptedInput) G.scriptedInput(G, STEP);
    else if (mouse.down) G.__firePlayerShot();
    // Drive the same world update as the main loop, minus the menu keys.
    G.__stepWorld(STEP);
  }
}

function freeze(G) {
  clearKeys();
  G.scriptedInput = null;
  G.frozen = true;
  window.__shotReady = true;
}

// Steer a driven car toward a point, full throttle.
function driveToward(G, tx, ty) {
  const car = G.player.car;
  if (!car) return;
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  keys.KeyW = true;
  keys.KeyA = diff < -0.08;
  keys.KeyD = diff > 0.08;
  keys.KeyS = false;
  keys.Space = false;
}

export function stageShot(name, G, seed) {
  G.rng = mulberry32(1337 + seed * 97);
  clearKeys();
  if (name === 'start') {
    G.screen = 'title';
    G.camera.x = 1700 - VIEW_W / 2;
    G.camera.y = 1250 - VIEW_H / 2;
    for (let i = 0; i < TITLE_SECONDS / STEP; i += 1) {
      G.time += STEP;
      updateTraffic(G, STEP);
      updatePedestrians(G, STEP);
    }
    window.__shotReady = true;
    return;
  }
  // Every play scene starts from a fresh game.
  G.newGame({});
  G.screen = 'play';

  if (name === 'drive') {
    startMission(G, 1); // "Primer encargo": a timed delivery, objective visible.
    // Put Milo in a muscle car on the downtown east-west road.
    const car = G.parkedCars.find((c) => c.model === 'muscle') || G.parkedCars[0];
    car.x = 1500; car.y = 1700; car.angle = 0; car.vx = 0; car.vy = 0;
    enterCar(G, car);
    G.player.x = car.x; G.player.y = car.y;
    G.cash = 1240;
    // A couple of cars ahead for traffic density.
    const t1 = G.traffic[0]; if (t1) { t1.x = 1750; t1.y = 1700; t1.vertical = false; t1.dir = 1; t1.angle = 0; }
    const t2 = G.traffic[1]; if (t2) { t2.x = 1400; t2.y = 1700; t2.vertical = false; t2.dir = -1; t2.angle = Math.PI; }
    G.scriptedInput = (g) => driveToward(g, 2600, 1700);
    runSteps(G, DRIVE_SECONDS, null);
    freeze(G);
    return;
  }

  if (name === 'combat') {
    startMission(G, 3); // "Calor en el muelle": 5 Tide Kings at the docks.
    G.player.x = 700; G.player.y = 2480;
    G.player.onFoot = true;
    G.player.health = 100;
    // Staged scenes must not end on the death screen: the player stands in
    // the open while five gangsters shoot back, so give the shot a long
    // invulnerability window (the real game has none).
    G.player.invuln = 999;
    G.cash = 2310;
    // Gangsters in a loose line among the containers, on clear ground.
    const spots = [[620, 2480], [820, 2460], [920, 2380], [700, 2560], [980, 2520]];
    for (const [x, y] of spots) spawnGangster(G, x, y);
    G.mission.spawned = true;
    G.mission.kills = 2;
    // One patrol car arriving, lights flashing, for the wanted stars.
    G.wanted = 1;
    const pc = spawnPoliceCar(G, true);
    pc.x = 800; pc.y = 2150;
    G.scriptedInput = (g) => {
      // Aim at the nearest living gangster and fire.
      let best = null; let bestD = Infinity;
      for (const e of g.enemies) {
        const d = dist(e.x, e.y, g.player.x, g.player.y);
        if (d < bestD) { bestD = d; best = e; }
      }
      if (best) {
        mouse.x = best.x - g.camera.x;
        mouse.y = best.y - g.camera.y;
        mouse.down = bestD < 420;
      }
    };
    runSteps(G, COMBAT_SECONDS, null);
    freeze(G);
    return;
  }

  if (name === 'chase') {
    startMission(G, 4); // "Persecución caliente": escape with heat on.
    // Milo in the Comet GT, foot down on the beachfront road.
    const car = G.parkedCars.find((c) => c.model === 'comet') || G.parkedCars[0];
    car.model = 'comet';
    car.color = '#c22f3d';
    car.x = 2600; car.y = 800; car.angle = Math.PI / 2;
    // Already at speed, foot down, so the frame catches a real chase.
    car.vx = 0; car.vy = 380;
    enterCar(G, car);
    G.player.x = car.x; G.player.y = car.y;
    G.cash = 4860;
    G.wanted = 4;
    G.heli.active = true;
    // Four patrol cars closing in from behind, so their rams push the
    // Comet forward down the road instead of spinning it off it.
    const spots = [[2600, 300], [2600, 520], [2150, 600], [3050, 600]];
    for (const [x, y] of spots) {
      const pc = spawnPoliceCar(G, true);
      pc.x = x; pc.y = y;
    }
    // Traffic to dodge, on the neighbouring lanes.
    const t1 = G.traffic[0]; if (t1) { t1.x = 2150; t1.y = 1050; t1.vertical = true; t1.dir = -1; t1.angle = -Math.PI / 2; }
    const t2 = G.traffic[1]; if (t2) { t2.x = 3050; t2.y = 1400; t2.vertical = true; t2.dir = 1; t2.angle = Math.PI / 2; }
    G.scriptedInput = (g) => driveToward(g, 2600, 2600);
    runSteps(G, CHASE_SECONDS, null);
    freeze(G);
    return;
  }

  // Unknown name: the title screen.
  G.screen = 'title';
  window.__shotReady = true;
}
