// All canvas drawing: the city, the cars, the people, the bullets, the
// particles, the helicopter and the weather of light that makes Marisol Bay
// look sun-soaked at a glance.
import {
  VIEW_W, VIEW_H, ROADS_V, ROADS_H, ROAD_W, SIDEWALK, WORLD_W, WORLD_H,
  WATER_X, SAND_X, PALETTE, CAR_MODELS, LANDMARKS,
} from './config.js';
import { dist } from './world.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCar(ctx, car, isPlayer) {
  const model = CAR_MODELS[car.model] || CAR_MODELS.sedan;
  const len = model.len; const wid = model.wid;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  roundRect(ctx, -len / 2 + 3, -wid / 2 + 4, len, wid, 8);
  ctx.fill();
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 8);
  ctx.fill();
  // Roof + windows.
  ctx.fillStyle = 'rgba(20,28,40,0.85)';
  roundRect(ctx, -len / 5, -wid / 2 + 3, len / 2.2, wid - 6, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,240,0.7)';
  ctx.fillRect(-len / 5 + 3, -wid / 2 + 5, 7, wid - 10);
  ctx.fillRect(len / 5 - 2, -wid / 2 + 5, 7, wid - 10);
  // Headlights / taillights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(len / 2 - 2, -wid / 2 + 2, 2, 5);
  ctx.fillRect(len / 2 - 2, wid / 2 - 7, 2, 5);
  ctx.fillStyle = '#ff4d4d';
  ctx.fillRect(-len / 2, -wid / 2 + 2, 2, 5);
  ctx.fillRect(-len / 2, wid / 2 - 7, 2, 5);
  if (car.police) {
    // Light bar, flashing with the game clock.
    const on = Math.floor(performance.now() / 260) % 2 === 0;
    ctx.fillStyle = on ? '#ff3b30' : '#3b82ff';
    ctx.fillRect(-6, -wid / 2 - 1, 12, 4);
    ctx.fillStyle = on ? '#3b82ff' : '#ff3b30';
    ctx.fillRect(-6, wid / 2 - 3, 12, 4);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLICÍA', 0, 3);
  }
  if (car.missionCar) {
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    roundRect(ctx, -len / 2 - 5, -wid / 2 - 5, len + 10, wid + 10, 10);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (isPlayer) {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    roundRect(ctx, -len / 2 - 4, -wid / 2 - 4, len + 8, wid + 8, 10);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, color, walkPhase, isCop) {
  ctx.save();
  ctx.translate(x, y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(1, 3, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
  const bob = Math.sin(walkPhase) * 1.5;
  ctx.rotate(angle);
  // Body.
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  // Head + facing.
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath(); ctx.arc(5, 0, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(8, 0, 2, 0, Math.PI * 2); ctx.fill();
  if (isCop) {
    ctx.fillStyle = '#1d3f8f';
    ctx.beginPath(); ctx.arc(-2, -5, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-2, 5, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  void bob;
}

export function drawWorld(G, ctx, cam) {
  const x0 = cam.x; const y0 = cam.y; const x1 = cam.x + VIEW_W; const y1 = cam.y + VIEW_H;
  // Ground.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(x0, y0, VIEW_W, VIEW_H);
  // Beach + sea.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(Math.max(x0, SAND_X), y0, Math.min(x1, WORLD_W) - Math.max(x0, SAND_X), VIEW_H);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(Math.max(x0, WATER_X), y0, Math.min(x1, WORLD_W) - Math.max(x0, WATER_X), VIEW_H);
  ctx.fillStyle = PALETTE.waterDeep;
  const waveT = G.time * 1.4;
  for (let wy = Math.floor(y0 / 46) * 46; wy < y1; wy += 46) {
    ctx.beginPath();
    ctx.arc(WATER_X + 14 + Math.sin(wy * 0.05 + waveT) * 5, wy, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  // Park.
  ctx.fillStyle = PALETTE.park;
  ctx.fillRect(1636, 1636, 430, 430);
  // Plaza.
  ctx.fillStyle = PALETTE.plaza;
  ctx.fillRect(1586, 1136, 260, 260);
  // Roads.
  ctx.fillStyle = PALETTE.road;
  for (const rx of ROADS_V) ctx.fillRect(rx - ROAD_W / 2, y0, ROAD_W, VIEW_H);
  for (const ry of ROADS_H) ctx.fillRect(x0, ry - ROAD_W / 2, VIEW_W, ROAD_W);
  // Sidewalks.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const rx of ROADS_V) {
    ctx.fillRect(rx - ROAD_W / 2 - SIDEWALK, y0, SIDEWALK, VIEW_H);
    ctx.fillRect(rx + ROAD_W / 2, y0, SIDEWALK, VIEW_H);
  }
  for (const ry of ROADS_H) {
    ctx.fillRect(x0, ry - ROAD_W / 2 - SIDEWALK, VIEW_W, SIDEWALK);
    ctx.fillRect(x0, ry + ROAD_W / 2, VIEW_W, SIDEWALK);
  }
  // Centre dashes.
  ctx.strokeStyle = PALETTE.roadLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 26]);
  ctx.beginPath();
  for (const rx of ROADS_V) { ctx.moveTo(rx, y0); ctx.lineTo(rx, y1); }
  for (const ry of ROADS_H) { ctx.moveTo(x0, ry); ctx.lineTo(x1, ry); }
  ctx.stroke();
  ctx.setLineDash([]);
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const rx of ROADS_V) {
    for (const ry of ROADS_H) {
      for (let i = -3; i <= 3; i += 1) {
        ctx.fillRect(rx - ROAD_W / 2 + 8 + i * 16, ry - ROAD_W / 2 - 8, 8, 14);
        ctx.fillRect(rx - ROAD_W / 2 + 8 + i * 16, ry + ROAD_W / 2 - 6, 8, 14);
      }
    }
  }
  // Port containers.
  for (const c of G.world.containers) {
    if (c.x > x1 || c.x + c.w < x0 || c.y > y1 || c.y + c.h < y0) continue;
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(c.x, c.y, c.w, 4);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.strokeRect(c.x, c.y, c.w, c.h);
  }
  // Buildings.
  for (const b of G.world.buildings) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    // Roof details + windows.
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    const cols = Math.max(1, Math.floor(b.w / 34));
    const rows = Math.max(1, Math.floor(b.h / 34));
    for (let cx = 0; cx < cols; cx += 1) {
      for (let cy = 0; cy < rows; cy += 1) {
        ctx.fillRect(b.x + 10 + cx * 34, b.y + 10 + cy * 34, 16, 12);
      }
    }
    if (b.kind === 'bank') {
      ctx.fillStyle = '#fff8e0';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BANCO DE LA BAHÍA', b.x + b.w / 2, b.y + b.h / 2 + 5);
    }
    if (b.kind === 'hospital') {
      ctx.fillStyle = '#d94f4f';
      ctx.fillRect(b.x + b.w / 2 - 16, b.y + b.h / 2 - 5, 32, 10);
      ctx.fillRect(b.x + b.w / 2 - 5, b.y + b.h / 2 - 16, 10, 32);
    }
    if (b.kind === 'garage') {
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText("TALLER DE VERA", b.x + b.w / 2, b.y + b.h / 2 + 4);
    }
  }
  // Trees.
  for (const t of G.world.trees) {
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    ctx.fillStyle = '#3f7a34';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5d9448';
    ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.7, 0, Math.PI * 2); ctx.fill();
  }
  // Beach umbrellas.
  for (const u of G.world.umbrellas) {
    if (u.x < x0 || u.x > x1 || u.y < y0 || u.y > y1) continue;
    ctx.fillStyle = u.color;
    ctx.beginPath(); ctx.arc(u.x, u.y, 12, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#8a6f4f';
    ctx.fillRect(u.x - 1, u.y, 2, 10);
  }
  // Mission target marker (pulsing beacon + ground ring).
  if (G.mission && G.mission.target && G.screen === 'play') {
    const t = G.mission.target;
    const pulse = 1 + Math.sin(G.time * 5) * 0.18;
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(t.x, t.y, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,215,0,0.25)';
    ctx.beginPath(); ctx.arc(t.x, t.y, 30 * pulse, 0, Math.PI * 2); ctx.fill();
    // Beacon column.
    const grad = ctx.createLinearGradient(t.x, t.y - 260, t.x, t.y);
    grad.addColorStop(0, 'rgba(255,215,0,0)');
    grad.addColorStop(1, 'rgba(255,215,0,0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(t.x - 8, t.y - 260, 16, 260);
  }
}

export function drawEntities(G, ctx) {
  // Pickups.
  for (const pk of G.pickups) {
    ctx.fillStyle = pk.kind === 'health' ? '#e8e8e8' : '#ffd700';
    ctx.beginPath(); ctx.arc(pk.x, pk.y, 11, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.stroke();
    if (pk.kind === 'health') {
      ctx.fillStyle = '#d94f4f';
      ctx.fillRect(pk.x - 6, pk.y - 2, 12, 4);
      ctx.fillRect(pk.x - 2, pk.y - 6, 4, 12);
    } else {
      ctx.fillStyle = '#333';
      ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('$', pk.x, pk.y + 4);
    }
  }
  // Parked cars.
  for (const car of G.parkedCars) drawCar(ctx, car, false);
  // Traffic.
  for (const car of G.traffic) drawCar(ctx, car, false);
  // Police cars.
  for (const car of G.policeCars) drawCar(ctx, car, false);
  // Pedestrians.
  for (const ped of G.peds) {
    drawPerson(ctx, ped.x, ped.y, ped.angle, ped.color, ped.walkPhase, false);
  }
  // Foot cops.
  for (const cop of G.cops) {
    drawPerson(ctx, cop.x, cop.y, cop.angle, '#1d3f8f', cop.walkPhase, true);
  }
  // Gangsters.
  for (const e of G.enemies) {
    drawPerson(ctx, e.x, e.y, e.angle, '#5a2d8f', e.walkPhase, false);
    // Health bar.
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(e.x - 14, e.y - 20, 28, 5);
    ctx.fillStyle = '#ff4d4d';
    ctx.fillRect(e.x - 14, e.y - 20, 28 * (e.health / e.maxHealth), 5);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('TIDE', e.x, e.y - 24);
  }
  // Player.
  const p = G.player;
  if (p.car) drawCar(ctx, p.car, true);
  else {
    drawPerson(ctx, p.x, p.y, p.angle, '#c22f3d', p.runPhase, false);
    // Pistol in hand.
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#222';
    ctx.fillRect(8, -2, 12, 4);
    ctx.restore();
  }
  // Bullets.
  for (const b of G.bullets) {
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Particles.
  for (const pt of G.particles) {
    const a = Math.max(0, pt.life / pt.max);
    if (pt.kind === 'fire') ctx.fillStyle = `rgba(255,${Math.floor(120 + 100 * a)},30,${a})`;
    else if (pt.kind === 'smoke') ctx.fillStyle = `rgba(60,60,60,${a * 0.55})`;
    else if (pt.kind === 'spark') ctx.fillStyle = `rgba(255,230,120,${a})`;
    else if (pt.kind === 'hit') ctx.fillStyle = `rgba(255,80,80,${a})`;
    else ctx.fillStyle = `rgba(255,240,160,${a})`;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (0.5 + a * 0.5), 0, Math.PI * 2); ctx.fill();
  }
  // Cash floats.
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  for (const f of G.cashFloats) {
    ctx.fillStyle = `rgba(255,215,0,${Math.max(0, f.life / 1.2)})`;
    ctx.fillText(f.text, f.x, f.y);
  }
  // Helicopter + spotlight.
  if (G.heli.active) {
    const h = G.heli;
    const grad = ctx.createRadialGradient(h.x, h.y, 10, h.x, h.y, 260);
    grad.addColorStop(0, 'rgba(255,250,200,0.28)');
    grad.addColorStop(1, 'rgba(255,250,200,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(h.x, h.y, 260, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.ellipse(h.x, h.y, 26, 10, Math.sin(G.time * 2) * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#888';
    ctx.fillRect(h.x - 30, h.y - 2, 60, 3);
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath(); ctx.arc(h.x, h.y, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Off-screen mission arrow at the screen edge.
  if (G.mission && G.mission.target && G.screen === 'play') {
    const t = G.mission.target;
    const sx = t.x - G.camera.x; const sy = t.y - G.camera.y;
    if (sx < 60 || sx > VIEW_W - 60 || sy < 60 || sy > VIEW_H - 60) {
      const cx = Math.max(50, Math.min(VIEW_W - 50, sx));
      const cy = Math.max(50, Math.min(VIEW_H - 50, sy));
      const ang = Math.atan2(sy - cy, sx - cx);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.fillStyle = '#ffd700';
      ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-10, 11); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(dist(t.x, t.y, p.x, p.y))} m`, cx, cy + 26);
    }
  }
}
