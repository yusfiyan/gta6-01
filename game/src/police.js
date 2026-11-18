// The wanted system: stars 0-5, police cars and foot cops that hunt the
// player, roadblocks at high heat, and a helicopter from 4 stars up.
import { CAR_MODELS, WORLD_W, WORLD_H } from './config.js';
import { pick, range, chance } from './random.js';
import { nearestRoadPoint, dist, hitsSolid, moveWithCollision } from './world.js';
import { sfx, setSiren } from './audio.js';
import { scarePeds } from './traffic.js';

export function wantedTarget(G) {
  return G.wanted;
}

export function policeCountFor(wanted) {
  return [0, 1, 2, 3, 4, 5][wanted] || 0;
}

export function addWanted(G, stars, reason) {
  if (G.screen !== 'play') return;
  const before = G.wanted;
  G.wanted = Math.min(5, G.wanted + stars);
  G.wantedTimer = 0;
  G.wantedReason = reason || '';
  if (G.wanted > before) {
    G.flashStars = 1.2;
    if (G.wanted >= 1) sfx.sirenBlip();
    G.hudMessage = reason ? `¡Te han visto! ${reason}` : '¡La policía te busca!';
    G.hudMessageT = 2.5;
  }
}

export function spawnPoliceCar(G, nearPlayer) {
  const rng = G.rng;
  const p = nearestRoadPoint(
    G.player.x + (nearPlayer ? range(rng, -700, 700) : range(rng, -1200, 1200)),
    G.player.y + (nearPlayer ? range(rng, -700, 700) : range(rng, -1200, 1200)),
  );
  const car = {
    id: Math.floor(rng() * 1e9),
    model: 'police',
    x: p.x, y: p.y,
    angle: p.vertical ? Math.PI / 2 : 0,
    vx: 0, vy: 0,
    speed: 0,
    color: '#1d3f8f',
    police: true,
    repath: 0,
    targetX: G.player.x, targetY: G.player.y,
  };
  G.policeCars.push(car);
  return car;
}

export function spawnFootCop(G) {
  const rng = G.rng;
  const ang = range(rng, 0, Math.PI * 2);
  const x = G.player.x + Math.cos(ang) * range(rng, 380, 520);
  const y = G.player.y + Math.sin(ang) * range(rng, 380, 520);
  if (hitsSolid(G.world, x, y, 12)) return;
  G.cops.push({
    x, y, angle: 0, speed: 185, health: 2, shootCd: range(rng, 0.5, 1.5),
    bustT: 0, walkPhase: 0,
  });
}

export function updateWanted(G, dt) {
  const rng = G.rng;
  if (G.wanted > 0) {
    G.wantedTimer += dt;
    // Cool down one star after 14 quiet seconds with no cop nearby.
    const nearestCop = G.policeCars.concat(G.cops).reduce(
      (best, c) => Math.min(best, dist(c.x, c.y, G.player.x, G.player.y)), Infinity);
    if (G.wantedTimer > 14 && nearestCop > 500) {
      G.wanted -= 1;
      G.wantedTimer = 0;
      G.hudMessage = G.wanted === 0 ? 'Te has librado... por ahora.' : 'El calor baja.';
      G.hudMessageT = 2;
    }
  }
  if (G.flashStars > 0) G.flashStars -= dt;

  // Keep the right number of police cars on the streets.
  const want = policeCountFor(G.wanted);
  while (G.policeCars.length < want) spawnPoliceCar(G, G.policeCars.length < 2);
  while (G.policeCars.length > want) G.policeCars.pop();
  // Foot cops: one per star, capped at 3.
  const wantCops = Math.min(3, G.wanted);
  while (G.cops.length < wantCops && chance(rng, dt * 0.8)) spawnFootCop(G);
  while (G.cops.length > wantCops) G.cops.pop();

  // Helicopter from 4 stars.
  G.heli.active = G.wanted >= 4;
  if (G.heli.active) {
    G.heli.angle += dt * 0.55;
    G.heli.x = G.player.x + Math.cos(G.heli.angle) * 230;
    G.heli.y = G.player.y + Math.sin(G.heli.angle) * 230 - 60;
  }

  setSiren(G.wanted > 0 && G.screen === 'play');
}

export function updatePolice(G, dt) {
  const rng = G.rng;
  const model = CAR_MODELS.police;
  // Keep patrol cars from stacking into one pile.
  for (let i = 0; i < G.policeCars.length; i += 1) {
    for (let j = i + 1; j < G.policeCars.length; j += 1) {
      const a = G.policeCars[i]; const b = G.policeCars[j];
      const d = dist(a.x, a.y, b.x, b.y);
      if (d > 0 && d < 56) {
        const push = (56 - d) * 0.5;
        const nx = (b.x - a.x) / d; const ny = (b.y - a.y) / d;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
      }
    }
  }
  for (const car of G.policeCars) {
    car.repath -= dt;
    if (car.repath <= 0) {
      car.repath = 0.8 + rng() * 0.6;
      car.targetX = G.player.x + range(rng, -40, 40);
      car.targetY = G.player.y + range(rng, -40, 40);
    }
    // Chase steering: aim at the target, with road snapping to avoid buildings.
    const dx = car.targetX - car.x;
    const dy = car.targetY - car.y;
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turn = Math.max(-3.4 * dt, Math.min(3.4 * dt, diff));
    car.angle += turn;
    const accel = model.accel * 0.92;
    car.vx += Math.cos(car.angle) * accel * dt;
    car.vy += Math.sin(car.angle) * accel * dt;
    const fx = Math.cos(car.angle); const fy = Math.sin(car.angle);
    const fSpeed = car.vx * fx + car.vy * fy;
    const lSpeed = -car.vx * fy + car.vy * fx;
    const newL = lSpeed * Math.exp(-6 * dt);
    car.vx = fx * fSpeed - fy * newL;
    car.vy = fy * fSpeed + fx * newL;
    const sp = Math.hypot(car.vx, car.vy);
    if (sp > model.top) { car.vx *= model.top / sp; car.vy *= model.top / sp; }
    const nx = car.x + car.vx * dt;
    const ny = car.y + car.vy * dt;
    if (!hitsSolid(G.world, nx, car.y, 20)) car.x = nx; else car.vx *= -0.4;
    if (!hitsSolid(G.world, car.x, ny, 20)) car.y = ny; else car.vy *= -0.4;
    // Ram the player's car.
    if (G.player.car) {
      const d = dist(car.x, car.y, G.player.car.x, G.player.car.y);
      if (d < 44) {
        const push = 150;
        G.player.car.vx += ((G.player.car.x - car.x) / (d || 1)) * push * dt * 4;
        G.player.car.vy += ((G.player.car.y - car.y) / (d || 1)) * push * dt * 4;
        car.vx *= 0.6; car.vy *= 0.6;
        if (sp > 180 && G.shake < 0.2) { G.shake = 0.25; sfx.crash(); }
      }
    } else {
      // On foot: a police car that reaches the player stops and a cop gets out.
      const d = dist(car.x, car.y, G.player.x, G.player.y);
      if (d < 70 && G.cops.length < 4) {
        car.vx *= 0.5; car.vy *= 0.5;
        spawnFootCop(G);
        car.x += Math.cos(car.angle + Math.PI) * 120;
        car.y += Math.sin(car.angle + Math.PI) * 120;
      }
    }
  }

  // Foot cops run at the player, shoot close up, and bust on contact.
  for (const cop of G.cops) {
    const d = dist(cop.x, cop.y, G.player.x, G.player.y);
    cop.angle = Math.atan2(G.player.y - cop.y, G.player.x - cop.x);
    cop.walkPhase += dt * 10;
    if (d > 34) {
      const step = cop.speed * dt;
      const nx = cop.x + Math.cos(cop.angle) * step;
      const ny = cop.y + Math.sin(cop.angle) * step;
      if (!hitsSolid(G.world, nx, ny, 12)) { cop.x = nx; cop.y = ny; }
    } else if (G.player.onFoot) {
      cop.bustT += dt;
      if (cop.bustT > 1.1) {
        G.busted('La policía te ha atrapado.');
        return;
      }
    }
    cop.shootCd -= dt;
    if (cop.shootCd <= 0 && d < 300 && d > 60 && G.player.onFoot) {
      cop.shootCd = 1.1 + rng() * 0.7;
      G.fireBullet(cop.x, cop.y, cop.angle + range(rng, -0.12, 0.12), 620, 'cop');
      sfx.enemyShot();
    }
  }
}

export function clearPolice(G) {
  G.policeCars = [];
  G.cops = [];
  G.heli.active = false;
  setSiren(false);
}
