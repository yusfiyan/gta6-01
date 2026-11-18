// HUD: cash, health, wanted stars, mission objective, speed, messages —
// and the minimap, the small city the player steers by.
import { VIEW_W, VIEW_H, ROADS_V, ROADS_H, WORLD_W, WORLD_H, WATER_X, SAND_X, MISSIONS } from './config.js';
import { dist } from './world.js';

const MAP_W = 196;
const MAP_H = 150;
const MAP_X = VIEW_W - MAP_W - 16;
const MAP_Y = VIEW_H - MAP_H - 16;

export function drawHUD(G, ctx) {
  const p = G.player;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Top-left: cash + health.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(12, 12, 230, 62);
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(`$${G.cash.toLocaleString('en-US')}`, 24, 42);
  ctx.fillStyle = '#222';
  ctx.fillRect(24, 52, 200, 12);
  ctx.fillStyle = p.health > 40 ? '#4ade80' : '#ff4d4d';
  ctx.fillRect(24, 52, 200 * (p.health / p.maxHealth), 12);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1;
  ctx.strokeRect(24, 52, 200, 12);

  // Top-right: wanted stars.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(VIEW_W - 212, 12, 200, 46);
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i < 5; i += 1) {
    const lit = i < G.wanted;
    const flash = G.flashStars > 0 && Math.floor(G.time * 6) % 2 === 0;
    ctx.fillStyle = lit ? (flash ? '#ffffff' : '#ffd700') : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', VIEW_W - 28 - i * 34, 44);
  }
  ctx.textAlign = 'left';

  // Top-centre: mission objective.
  if (G.mission) {
    const def = MISSIONS[G.missionIdx];
    const obj = def ? def.objective : '';
    const label = def.id === 'dockside-heat'
      ? `Elimina a 5 Tide Kings (${G.mission.kills}/${G.mission.killsNeeded})`
      : obj;
    ctx.font = 'bold 15px sans-serif';
    const w = ctx.measureText(label).width + 90;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect((VIEW_W - w) / 2, 12, w, 40);
    ctx.fillStyle = '#ffd700';
    ctx.fillText('◈', (VIEW_W - w) / 2 + 14, 38);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, (VIEW_W - w) / 2 + 38, 38);
    if (G.mission.timeLeft > 0) {
      ctx.fillStyle = G.mission.timeLeft < 15 ? '#ff6b6b' : '#fff';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(`${Math.ceil(G.mission.timeLeft)}s`, (VIEW_W - w) / 2 + w - 52, 39);
    }
    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    const sub = `${G.missionIdx + 1}/${MISSIONS.length} · ${def.name}`;
    ctx.fillText(sub, (VIEW_W - w) / 2 + 38, 66);
  }

  // Bottom-left: speed + controls hint.
  if (!p.onFoot && p.car) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(12, VIEW_H - 66, 150, 54);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(`${Math.round(Math.hypot(p.car.vx, p.car.vy) * 0.36)}`, 24, VIEW_H - 30);
    ctx.font = '12px sans-serif';
    ctx.fillText('km/h', 82, VIEW_H - 30);
  } else if (G.time - G.startTime < 9) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(12, VIEW_H - 66, 330, 54);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.fillText('WASD moverse · Ratón apuntar · Clic disparar', 24, VIEW_H - 44);
    ctx.fillText('E entrar/salir del coche · Shift correr · P pausa', 24, VIEW_H - 24);
  }

  // Centre message.
  if (G.hudMessageT > 0 && G.hudMessage) {
    ctx.font = 'bold 19px sans-serif';
    ctx.textAlign = 'center';
    const w = ctx.measureText(G.hudMessage).width + 36;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect((VIEW_W - w) / 2, 96, w, 36);
    ctx.fillStyle = '#ffd700';
    ctx.fillText(G.hudMessage, VIEW_W / 2, 120);
    ctx.textAlign = 'left';
  }

  drawMinimap(G, ctx);
}

function drawMinimap(G, ctx) {
  const sx = MAP_W / WORLD_W;
  const sy = MAP_H / WORLD_H;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(MAP_X - 4, MAP_Y - 4, MAP_W + 8, MAP_H + 8);
  ctx.fillStyle = '#5d9448';
  ctx.fillRect(MAP_X, MAP_Y, MAP_W, MAP_H);
  // Sea + sand.
  ctx.fillStyle = '#2e7fb8';
  ctx.fillRect(MAP_X + WATER_X * sx, MAP_Y, MAP_W - WATER_X * sx, MAP_H);
  ctx.fillStyle = '#e6cf9a';
  ctx.fillRect(MAP_X + SAND_X * sx, MAP_Y, (WATER_X - SAND_X) * sx, MAP_H);
  // Roads.
  ctx.strokeStyle = '#cfc9ba';
  ctx.lineWidth = 2;
  for (const rx of ROADS_V) {
    ctx.beginPath(); ctx.moveTo(MAP_X + rx * sx, MAP_Y); ctx.lineTo(MAP_X + rx * sx, MAP_Y + MAP_H); ctx.stroke();
  }
  for (const ry of ROADS_H) {
    ctx.beginPath(); ctx.moveTo(MAP_X, MAP_Y + ry * sy); ctx.lineTo(MAP_X + MAP_W, MAP_Y + ry * sy); ctx.stroke();
  }
  // Mission marker.
  if (G.mission && G.mission.target) {
    const t = G.mission.target;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(MAP_X + t.x * sx, MAP_Y + t.y * sy, 5 + Math.sin(G.time * 5) * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police blips.
  ctx.fillStyle = '#3b82ff';
  for (const car of G.policeCars) {
    ctx.beginPath(); ctx.arc(MAP_X + car.x * sx, MAP_Y + car.y * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#ff3b30';
  for (const cop of G.cops) {
    ctx.fillRect(MAP_X + cop.x * sx - 2, MAP_Y + cop.y * sy - 2, 4, 4);
  }
  // Enemies.
  ctx.fillStyle = '#c084fc';
  for (const e of G.enemies) {
    ctx.beginPath(); ctx.arc(MAP_X + e.x * sx, MAP_Y + e.y * sy, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow.
  const px = MAP_X + G.player.x * sx;
  const py = MAP_Y + G.player.y * sy;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(G.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  // Frame + label.
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(MAP_X - 4, MAP_Y - 4, MAP_W + 8, MAP_H + 8);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('MARISOL BAY', MAP_X, MAP_Y - 8);
}
