// The player: on foot with WASD + mouse aim, and behind the wheel with
// arcade driving physics (accelerate, steer, handbrake drift).
import { CAR_MODELS, WORLD_W, WORLD_H } from './config.js';
import { moveWithCollision, hitsSolid, dist } from './world.js';
import { axis, pressed, mouse } from './input.js';
import { sfx } from './audio.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: 0, // facing, radians (on foot: aim direction)
    speed: 0,
    onFoot: true,
    car: null, // the car object being driven, or null
    health: 100,
    maxHealth: 100,
    armor: 0,
    cash: 0,
    runPhase: 0,
    moving: false,
    invuln: 0,
  };
}

export function nearestCar(G, maxDist) {
  let best = null; let bestD = maxDist;
  const pool = [...G.parkedCars, ...G.traffic];
  for (const car of pool) {
    const d = dist(G.player.x, G.player.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function enterCar(G, car) {
  const p = G.player;
  p.onFoot = false;
  p.car = car;
  car.driver = 'player';
  // Traffic cars carry no velocity fields until they are driven; normalise
  // them here so the driving physics never sees undefined.
  car.vx = Number.isFinite(car.vx) ? car.vx : 0;
  car.vy = Number.isFinite(car.vy) ? car.vy : 0;
  car.hp = Number.isFinite(car.hp) ? car.hp : 100;
  // Pull it out of the parked/traffic pools so nobody else drives it.
  G.parkedCars = G.parkedCars.filter((c) => c !== car);
  G.traffic = G.traffic.filter((c) => c !== car);
  p.x = car.x; p.y = car.y;
  sfx.carDoor();
}

export function exitCar(G) {
  const p = G.player;
  if (!p.car) return;
  const car = p.car;
  car.driver = null;
  // Step out beside the car, on a free spot.
  const side = { x: car.x + Math.cos(car.angle + Math.PI / 2) * 34, y: car.y + Math.sin(car.angle + Math.PI / 2) * 34 };
  if (!hitsSolid(G.world, side.x, side.y, 12)) { p.x = side.x; p.y = side.y; }
  else { p.x = car.x - Math.cos(car.angle + Math.PI / 2) * 34; p.y = car.y - Math.sin(car.angle + Math.PI / 2) * 34; }
  p.onFoot = true;
  p.car = null;
  p.speed = 0;
  sfx.carDoor();
}

export function updatePlayer(G, dt) {
  const p = G.player;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.onFoot) {
    const a = axis();
    const sprint = pressed('ShiftLeft') || pressed('ShiftRight');
    const speed = sprint ? 305 : 205;
    const len = Math.hypot(a.x, a.y) || 1;
    const dx = (a.x / len) * speed * dt * (a.x || a.y ? 1 : 0);
    const dy = (a.y / len) * speed * dt * (a.x || a.y ? 1 : 0);
    p.moving = !!(a.x || a.y);
    if (p.moving) p.runPhase += dt * 11;
    moveWithCollision(G.world, p, dx, dy, 13);
    // Aim at the mouse.
    mouse.worldX = G.camera.x + mouse.x;
    mouse.worldY = G.camera.y + mouse.y;
    p.angle = Math.atan2(mouse.worldY - p.y, mouse.worldX - p.x);
  } else if (p.car) {
    updateDriving(G, dt);
  }
}

function updateDriving(G, dt) {
  const p = G.player;
  const car = p.car;
  const model = CAR_MODELS[car.model] || CAR_MODELS.sedan;
  if (!Number.isFinite(car.vx)) car.vx = 0;
  if (!Number.isFinite(car.vy)) car.vy = 0;
  const a = axis();
  const handbrake = pressed('Space');
  const forward = -a.y; // W = +1
  const steer = a.x;
  // Engine force along the car's heading.
  const speedAlong = Math.cos(car.angle) * car.vx + Math.sin(car.angle) * car.vy;
  const accel = forward * model.accel;
  car.vx += Math.cos(car.angle) * accel * dt;
  car.vy += Math.sin(car.angle) * accel * dt;
  // Steering: stronger at speed, weaker in reverse.
  const steerPower = model.grip * (speedAlong >= 0 ? 1 : -1) * Math.min(1, Math.abs(speedAlong) / 120);
  car.angle += steer * steerPower * dt * (handbrake ? 1.5 : 1);
  // Grip: kill lateral velocity, keep forward velocity (drift with handbrake).
  const fx = Math.cos(car.angle); const fy = Math.sin(car.angle);
  const fSpeed = car.vx * fx + car.vy * fy;
  const lSpeed = -car.vx * fy + car.vy * fx;
  const gripFactor = handbrake ? 1.2 : 6.5;
  const newL = lSpeed * Math.exp(-gripFactor * dt);
  car.vx = fx * fSpeed + -fy * newL;
  car.vy = fy * fSpeed + fx * newL;
  // Drag + top speed.
  const drag = 0.4 + (handbrake ? 1.6 : 0);
  car.vx *= Math.exp(-drag * dt);
  car.vy *= Math.exp(-drag * dt);
  const sp = Math.hypot(car.vx, car.vy);
  if (sp > model.top) { car.vx *= model.top / sp; car.vy *= model.top / sp; }
  // Move with building collision (slide).
  const nx = car.x + car.vx * dt;
  const ny = car.y + car.vy * dt;
  const r = 20;
  if (!hitsSolid(G.world, nx, car.y, r)) car.x = nx;
  else { car.vx *= -0.3; if (sp > 200) G.onCrash && G.onCrash(sp); }
  if (!hitsSolid(G.world, car.x, ny, r)) car.y = ny;
  else { car.vy *= -0.3; if (sp > 200) G.onCrash && G.onCrash(sp); }
  p.x = car.x; p.y = car.y;
  p.speed = sp;
  p.angle = car.angle;
  // Skid smoke when drifting hard.
  if (handbrake && sp > 150 && Math.random() < 0.5) {
    G.particles.push({
      kind: 'smoke', x: car.x - Math.cos(car.angle) * 20, y: car.y - Math.sin(car.angle) * 20,
      vx: 0, vy: -12, life: 0.7, max: 0.7, size: 14,
    });
  }
  // Run over pedestrians (a crime — the wanted system notices).
  for (const ped of G.peds) {
    if (dist(ped.x, ped.y, car.x, car.y) < 26 && sp > 60) {
      ped.flee = 3; ped.fleeX = car.x; ped.fleeY = car.y;
      G.addWanted(1, 'Atropello');
    }
  }
}
