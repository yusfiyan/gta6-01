// Combat: the player's pistol, enemy gangsters, bullets, explosions and
// pickups. Shooting is a crime, and the city reacts to it.
import { range, chance } from './random.js';
import { dist, hitsSolid } from './world.js';
import { sfx } from './audio.js';
import { addWanted } from './police.js';
import { scarePeds } from './traffic.js';

export function firePlayerShot(G) {
  const p = G.player;
  if (G.fireCd > 0 || G.screen !== 'play' || !p.onFoot) return;
  G.fireCd = 0.24;
  const mx = G.camera.x + (G.mouseX || 640);
  const my = G.camera.y + (G.mouseY || 360);
  const angle = Math.atan2(my - p.y, mx - p.x);
  const bx = p.x + Math.cos(angle) * 22;
  const by = p.y + Math.sin(angle) * 22;
  G.bullets.push({ x: bx, y: by, vx: Math.cos(angle) * 1100, vy: Math.sin(angle) * 1100, life: 0.7, from: 'player' });
  G.particles.push({ kind: 'flash', x: bx, y: by, vx: 0, vy: 0, life: 0.06, max: 0.06, size: 16 });
  G.shake = Math.max(G.shake, 0.06);
  sfx.shot();
  scarePeds(G, p.x, p.y, 320);
  // Firing in the open draws the law.
  if (G.wanted === 0) addWanted(G, 1, 'Disparos en la calle');
}

export function spawnGangster(G, x, y) {
  // Never spawn inside a wall: nudge to the nearest free spot.
  const offsets = [[0, 0], [0, 40], [40, 0], [0, -40], [-40, 0], [40, 40], [-40, 40], [40, -40], [-40, -40]];
  for (const [dx, dy] of offsets) {
    if (!hitsSolid(G.world, x + dx, y + dy, 12)) { x += dx; y += dy; break; }
  }
  G.enemies.push({
    x, y, angle: 0, speed: 120, health: 3, maxHealth: 3,
    shootCd: range(G.rng, 0.4, 1.4), walkPhase: 0, kind: 'tide',
    strafe: chance(G.rng, 0.5) ? 1 : -1, strafeT: 0,
  });
}

export function updateEnemies(G, dt) {
  const rng = G.rng;
  for (const e of G.enemies) {
    const d = dist(e.x, e.y, G.player.x, G.player.y);
    e.walkPhase += dt * 9;
    e.strafeT -= dt;
    if (e.strafeT <= 0) { e.strafe = -e.strafe; e.strafeT = 1 + rng() * 1.5; }
    // Strafe at mid range, close in when far, back off when too close.
    let moveAngle = Math.atan2(G.player.y - e.y, G.player.x - e.x);
    if (d < 170) moveAngle += Math.PI / 2 * e.strafe;
    if (d > 340) { /* approach */ } else if (d < 120) moveAngle += Math.PI;
    const nx = e.x + Math.cos(moveAngle) * e.speed * dt;
    const ny = e.y + Math.sin(moveAngle) * e.speed * dt;
    if (!hitsSolid(G.world, nx, ny, 12)) { e.x = nx; e.y = ny; }
    e.angle = Math.atan2(G.player.y - e.y, G.player.x - e.x);
    e.shootCd -= dt;
    if (e.shootCd <= 0 && d < 380) {
      e.shootCd = 0.9 + rng() * 0.8;
      G.fireBullet(e.x, e.y, e.angle + range(rng, -0.14, 0.14), 560, 'enemy');
      sfx.enemyShot();
    }
  }
  G.enemies = G.enemies.filter((e) => e.health > 0);
}

export function updateBullets(G, dt) {
  for (const b of G.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (hitsSolid(G.world, b.x, b.y, 2)) {
      b.life = 0;
      G.particles.push({ kind: 'spark', x: b.x, y: b.y, vx: 0, vy: 0, life: 0.18, max: 0.18, size: 8 });
    }
  }
  // Player bullets vs enemies / cops / peds.
  for (const b of G.bullets) {
    if (b.from !== 'player' || b.life <= 0) continue;
    for (const e of G.enemies) {
      if (e.health > 0 && dist(b.x, b.y, e.x, e.y) < 18) {
        e.health -= 1; b.life = 0;
        G.particles.push({ kind: 'hit', x: b.x, y: b.y, vx: 0, vy: 0, life: 0.25, max: 0.25, size: 12 });
        sfx.hit();
        if (e.health <= 0) {
          G.stats.kills += 1;
          G.cash += 50;
          G.addCashFloat(e.x, e.y, '+$50');
          G.missionKill();
          if (chance(G.rng, 0.35)) G.pickups.push({ kind: 'health', x: e.x, y: e.y, t: 0 });
        }
        break;
      }
    }
    if (b.life <= 0) continue;
    for (const cop of G.cops) {
      if (cop.health > 0 && dist(b.x, b.y, cop.x, cop.y) < 16) {
        cop.health -= 1; b.life = 0;
        sfx.hit();
        if (cop.health <= 0) {
          addWanted(G, 2, 'Has abatido a un policía');
          G.stats.kills += 1;
        }
        break;
      }
    }
    if (b.life <= 0) continue;
    for (const ped of G.peds) {
      if (dist(b.x, b.y, ped.x, ped.y) < 13) {
        b.life = 0;
        ped.flee = 4; ped.fleeX = b.x; ped.fleeY = b.y;
        addWanted(G, 1, 'Has herido a un civil');
        break;
      }
    }
  }
  // Enemy / cop bullets vs the player.
  const p = G.player;
  for (const b of G.bullets) {
    if (b.from === 'player' || b.life <= 0) continue;
    if (p.onFoot && dist(b.x, b.y, p.x, p.y) < 14) {
      b.life = 0;
      G.damagePlayer(12, b.from);
    } else if (!p.onFoot && p.car && dist(b.x, b.y, p.car.x, p.car.y) < 24) {
      b.life = 0;
      p.car.hp = (p.car.hp ?? 100) - 8;
      if (p.car.hp <= 0) explodeCar(G, p.car);
    }
  }
  G.bullets = G.bullets.filter((b) => b.life > 0);
}

export function explodeCar(G, car) {
  car.dead = true;
  sfx.explosion();
  G.shake = 0.5;
  for (let i = 0; i < 26; i += 1) {
    G.particles.push({
      kind: i % 3 === 0 ? 'smoke' : 'fire',
      x: car.x, y: car.y,
      vx: range(G.rng, -160, 160), vy: range(G.rng, -160, 160),
      life: range(G.rng, 0.4, 1.1), max: 1.1, size: range(G.rng, 10, 26),
    });
  }
  if (G.player.car === car) {
    G.damagePlayer(35, 'explosion');
    G.exitCarSilent();
  }
  G.parkedCars = G.parkedCars.filter((c) => c !== car);
  G.traffic = G.traffic.filter((c) => c !== car);
  G.policeCars = G.policeCars.filter((c) => c !== car);
}

export function updateParticles(G, dt) {
  for (const pt of G.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= Math.exp(-2 * dt);
    pt.vy *= Math.exp(-2 * dt);
    pt.life -= dt;
  }
  G.particles = G.particles.filter((pt) => pt.life > 0);
  for (const f of G.cashFloats) { f.y -= 34 * dt; f.life -= dt; }
  G.cashFloats = G.cashFloats.filter((f) => f.life > 0);
}
