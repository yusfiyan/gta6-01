// Marisol Bay — game loop, screens, save/load and the shared game state.
// Everything the other modules touch lives on one object, G, so the loop
// stays a straight line: read input, step the world, draw the frame.
import { VIEW_W, VIEW_H, STEP, MISSIONS, SAVE_KEY, STORY_INTRO, LANDMARKS } from './config.js';
import { mulberry32, range } from './random.js';
import { bindInput, keys, mouse, pressed, justPressed, consumeClick, axis } from './input.js';
import { buildWorld, dist } from './world.js';
import { createPlayer, updatePlayer, nearestCar, enterCar, exitCar } from './player.js';
import { updateTraffic, updatePedestrians, spawnTrafficCar, spawnPedestrian } from './traffic.js';
import { updateWanted, updatePolice, addWanted, clearPolice } from './police.js';
import { firePlayerShot, updateEnemies, updateBullets, updateParticles, explodeCar } from './combat.js';
import { startMission, updateMission, interact, onMissionKill, missionCount } from './missions.js';
import { drawWorld, drawEntities } from './render.js';
import { drawHUD } from './hud.js';
import { stageShot } from './shots.js';
import {
  initAudio, resumeAudio, toggleMute, startMusic, stopMusic,
  setEngine, sfx,
} from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const statusEl = document.getElementById('status');

export const G = {
  world: null,
  rng: mulberry32(1337),
  time: 0,
  screen: 'title',
  player: null,
  traffic: [],
  peds: [],
  parkedCars: [],
  policeCars: [],
  cops: [],
  enemies: [],
  bullets: [],
  particles: [],
  pickups: [],
  cashFloats: [],
  heli: { active: false, x: 0, y: 0, angle: 0 },
  camera: { x: 0, y: 0 },
  wanted: 0,
  wantedTimer: 0,
  flashStars: 0,
  wantedReason: '',
  missionIdx: 0,
  mission: null,
  briefing: null,
  hudMessage: '',
  hudMessageT: 0,
  fireCd: 0,
  shake: 0,
  cash: 0,
  stats: { kills: 0, missionsDone: 0, earned: 0 },
  startTime: 0,
  mouseX: VIEW_W / 2,
  mouseY: VIEW_H / 2,
  frozen: false,
  scriptedInput: null,
  muted: false,
  best: 0,
  deathReason: '',
  winStats: null,
};

G.fireBullet = function fireBullet(x, y, angle, speed, from) {
  G.bullets.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.8, from });
};
G.__firePlayerShot = function firePlayerShotBound() { firePlayerShot(G); };
G.addWanted = function addWantedBound(stars, reason) { addWanted(G, stars, reason); };
G.missionKill = function missionKillBound() { onMissionKill(G); };
G.addCashFloat = function addCashFloat(x, y, text) {
  G.cashFloats.push({ x, y, text, life: 1.2 });
};
G.damagePlayer = function damagePlayer(n, from) {
  const p = G.player;
  if (!p || p.invuln > 0 || G.screen !== 'play') return;
  p.health -= n;
  p.invuln = 0.25;
  G.shake = Math.max(G.shake, 0.15);
  if (p.health <= 0) {
    p.health = 0;
    G.wasted(from === 'cop' ? 'La policía te ha abatido.' : 'Te han dejado fuera de combate.');
  }
};
G.exitCarSilent = function exitCarSilent() {
  const p = G.player;
  if (!p.car) return;
  p.car.driver = null;
  p.car = null;
  p.onFoot = true;
  p.speed = 0;
};
G.onCrash = function onCrash(speed) {
  if (speed > 260) {
    sfx.crash();
    G.shake = Math.max(G.shake, 0.2);
  }
};

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

G.saveGame = function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      missionIdx: G.missionIdx,
      cash: G.cash,
      best: Math.max(G.best, G.cash + G.stats.missionsDone * 1000),
      stats: G.stats,
    }));
  } catch (err) { /* storage unavailable: the game still plays */ }
};

function seedParkedCars() {
  const rng = G.rng;
  const models = ['sedan', 'taxi', 'sedan', 'muscle', 'van', 'sedan', 'truck'];
  G.parkedCars = [];
  const spots = [
    [1700, 300], [2150, 750], [800, 1200], [2600, 1650], [1250, 1650],
    [3050, 1200], [350, 2100], [2150, 350], [1700, 2100], [800, 2100],
    [2600, 800], [1250, 350], [3050, 2100], [350, 1650],
  ];
  for (const [x, y] of spots) {
    const model = models[Math.floor(rng() * models.length)];
    G.parkedCars.push({
      id: Math.floor(rng() * 1e9),
      model,
      x: x + range(rng, -30, 30),
      y: y + range(rng, -30, 30),
      angle: range(rng, 0, Math.PI * 2),
      vx: 0, vy: 0,
      color: ['#5b7fa6', '#c8c8c8', '#3d3d3d', '#7d8a96', '#a88f6a', '#4f8f5a'][Math.floor(rng() * 6)],
      hp: 100,
    });
  }
}

function seedWorldLife() {
  G.traffic = [];
  G.peds = [];
  for (let i = 0; i < 18; i += 1) G.traffic.push(spawnTrafficCar(G.rng, G.world));
  for (let i = 0; i < 30; i += 1) G.peds.push(spawnPedestrian(G.rng, G.world));
}

G.newGame = function newGame(opts) {
  const save = opts && opts.continueSave ? loadSave() : null;
  G.world = buildWorld();
  G.rng = mulberry32(1337);
  G.time = 0;
  G.cash = save ? save.cash : 0;
  G.stats = save ? save.stats : { kills: 0, missionsDone: 0, earned: 0 };
  G.best = save ? (save.best || 0) : 0;
  G.player = createPlayer(LANDMARKS.garage.x + 85, LANDMARKS.garage.y + 190);
  G.player.cash = G.cash;
  G.traffic = []; G.peds = []; G.policeCars = []; G.cops = [];
  G.enemies = []; G.bullets = []; G.particles = []; G.pickups = []; G.cashFloats = [];
  G.heli = { active: false, x: 0, y: 0, angle: 0 };
  G.wanted = 0; G.wantedTimer = 0; G.flashStars = 0;
  G.fireCd = 0; G.shake = 0;
  G.hudMessage = ''; G.hudMessageT = 0;
  G.missionIdx = save ? Math.min(save.missionIdx, missionCount() - 1) : 0;
  G.mission = null;
  G.briefing = null;
  G.startTime = 0;
  G.frozen = false;
  G.scriptedInput = null;
  G.camera.x = G.player.x - VIEW_W / 2;
  G.camera.y = G.player.y - VIEW_H / 2;
  seedParkedCars();
  seedWorldLife();
  startMission(G, G.missionIdx);
  G.screen = 'play';
  G.startTime = 0;
  setEngine(0, false);
  startMusic();
};

G.wasted = function wasted(reason) {
  if (G.screen !== 'play') return;
  G.screen = 'wasted';
  G.deathReason = reason || 'Te han dejado fuera de combate.';
  const lost = Math.floor(G.cash * 0.15);
  G.cash -= lost;
  G.player.cash = G.cash;
  clearPolice(G);
  sfx.fail();
  stopMusic();
  setEngine(0, false);
};

G.busted = function busted(reason) {
  if (G.screen !== 'play') return;
  G.screen = 'busted';
  G.deathReason = reason || 'La policía te ha atrapado.';
  const lost = Math.floor(G.cash * 0.2);
  G.cash -= lost;
  G.player.cash = G.cash;
  G.wanted = 0;
  clearPolice(G);
  sfx.busted();
  stopMusic();
  setEngine(0, false);
};

G.winGame = function winGame() {
  G.screen = 'win';
  G.winStats = {
    cash: G.cash,
    kills: G.stats.kills,
    missions: G.stats.missionsDone,
    score: G.cash + G.stats.missionsDone * 1000,
  };
  G.best = Math.max(G.best, G.winStats.score);
  G.saveGame();
  sfx.mission();
  stopMusic();
  setEngine(0, false);
};

function respawn() {
  const keepMission = G.missionIdx;
  const keepCash = G.cash;
  const keepStats = { ...G.stats };
  const keepBest = G.best;
  G.newGame({});
  G.missionIdx = keepMission;
  G.cash = keepCash;
  G.stats = keepStats;
  G.best = keepBest;
  G.player.cash = keepCash;
  G.player.x = LANDMARKS.hospital.x + 80;
  G.player.y = LANDMARKS.hospital.y + 90;
  G.player.health = 100;
  startMission(G, keepMission);
  G.screen = 'play';
}

function updateCamera(dt) {
  const p = G.player;
  const tx = p.x - VIEW_W / 2 + Math.cos(p.angle) * (p.car ? 60 : 0);
  const ty = p.y - VIEW_H / 2 + Math.sin(p.angle) * (p.car ? 60 : 0);
  const k = 1 - Math.exp(-5 * dt);
  G.camera.x += (tx - G.camera.x) * k;
  G.camera.y += (ty - G.camera.y) * k;
  G.camera.x = Math.max(0, Math.min(3600 - VIEW_W, G.camera.x));
  G.camera.y = Math.max(0, Math.min(2700 - VIEW_H, G.camera.y));
  if (G.shake > 0) {
    G.shake -= dt;
    G.camera.x += (Math.random() - 0.5) * G.shake * 22;
    G.camera.y += (Math.random() - 0.5) * G.shake * 22;
  }
}

function stepWorld(dt) {
  updatePlayer(G, dt);
  updateTraffic(G, dt);
  updatePedestrians(G, dt);
  updateWanted(G, dt);
  updatePolice(G, dt);
  updateEnemies(G, dt);
  updateBullets(G, dt);
  updateParticles(G, dt);
  updateMission(G, dt);
  updateCamera(dt);
  // Pickups.
  for (const pk of G.pickups) {
    pk.t += dt;
    if (dist(pk.x, pk.y, G.player.x, G.player.y) < 26) {
      if (pk.kind === 'health') {
        G.player.health = Math.min(G.player.maxHealth, G.player.health + 40);
        G.hudMessage = 'Salud +40';
      }
      G.hudMessageT = 1.5;
      sfx.pickup();
      pk.t = 99;
    }
  }
  G.pickups = G.pickups.filter((pk) => pk.t < 20);
  // Engine hum follows the driven car.
  if (G.player.car) {
    const sp = Math.hypot(G.player.car.vx, G.player.car.vy);
    setEngine(Math.min(1, sp / 500), true);
  } else setEngine(0, false);
  // Health pickups near the hospital.
  if (G.time % 7 < dt && G.pickups.filter((p) => p.kind === 'health').length < 2) {
    G.pickups.push({ kind: 'health', x: LANDMARKS.hospital.x + 90, y: LANDMARKS.hospital.y + 60, t: 0 });
  }
}

// The world half of a step, exposed so the screenshot stager can run the
// real rules forward without the menu keys.
G.__stepWorld = stepWorld;

function step(dt) {
  if (G.screen !== 'play' || G.frozen) return;
  G.time += dt;
  if (G.fireCd > 0) G.fireCd -= dt;
  if (G.hudMessageT > 0) G.hudMessageT -= dt;
  if (G.briefing) {
    G.briefing.t -= dt;
    if (G.briefing.t <= 0) G.briefing = null;
  }
  G.mouseX = mouse.x;
  G.mouseY = mouse.y;
  // Scripted input (screenshots) overrides the keyboard.
  if (G.scriptedInput) G.scriptedInput(G, dt);
  else if (mouse.down) firePlayerShot(G);
  stepWorld(dt);
}

function handleKeys() {
  if (justPressed('KeyM')) {
    G.muted = toggleMute();
  }
  if (G.screen === 'title') {
    if (justPressed('Enter')) {
      initAudio(); resumeAudio();
      G.newGame({});
      statusEl.textContent = 'Marisol Bay: juega con WASD y el ratón.';
    }
    if (justPressed('KeyC') && loadSave()) {
      initAudio(); resumeAudio();
      G.newGame({ continueSave: true });
    }
    return;
  }
  if (G.screen === 'play') {
    if (justPressed('KeyP') || justPressed('Escape')) {
      G.screen = 'pause';
      setEngine(0, false);
      return;
    }
    if (justPressed('KeyE')) {
      const p = G.player;
      if (p.onFoot) {
        if (interact(G)) return;
        const car = nearestCar(G, 70);
        if (car) {
          if (car.police) return;
          enterCar(G, car);
          if (!car.ownedByPlayer) {
            car.stolen = true;
            addWanted(G, 1, 'Has robado un coche');
          }
        }
      } else {
        exitCar(G);
      }
    }
    return;
  }
  if (G.screen === 'pause') {
    if (justPressed('KeyP') || justPressed('Escape') || justPressed('Enter')) {
      G.screen = 'play';
      startMusic();
    }
    if (justPressed('KeyR')) {
      G.newGame({});
    }
    return;
  }
  if (G.screen === 'wasted' || G.screen === 'busted') {
    if (justPressed('Enter') || justPressed('KeyR')) respawn();
    return;
  }
  if (G.screen === 'win') {
    if (justPressed('Enter') || justPressed('KeyR')) {
      G.newGame({});
    }
  }
}

function drawTitle() {
  const t = G.time;
  ctx.save();
  // City backdrop: slow pan over downtown.
  const cx = 1700 - VIEW_W / 2 + Math.sin(t * 0.05) * 300;
  const cy = 1250 - VIEW_H / 2 + Math.cos(t * 0.04) * 200;
  G.camera.x = cx; G.camera.y = cy;
  ctx.translate(-G.camera.x, -G.camera.y);
  drawWorld(G, ctx, G.camera);
  drawEntities(G, ctx);
  ctx.restore();
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,24,0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // Title block.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText('MARISOL BAY', VIEW_W / 2, 190);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('EL CALOR DE LA COSTA', VIEW_W / 2, 236);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(STORY_INTRO, VIEW_W / 2, 278);
  const save = loadSave();
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#7dff8a';
  ctx.fillText('ENTER — Nueva partida', VIEW_W / 2, 380);
  if (save) {
    ctx.fillStyle = '#fff';
    ctx.fillText(`C — Continuar (trabajo ${Math.min(save.missionIdx + 1, 6)}/6 · $${save.cash})`, VIEW_W / 2, 420);
  }
  ctx.font = '15px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('WASD moverse / conducir · Ratón apuntar · Clic disparar · E entrar y robar coches', VIEW_W / 2, 500);
  ctx.fillText('Shift correr · Espacio freno de mano · P pausa · M silencio', VIEW_W / 2, 526);
  ctx.fillText('6 trabajos · 5 estrellas de búsqueda · 1 ciudad que es tuya', VIEW_W / 2, 566);
  if (G.best > 0) {
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`Récord: $${G.best.toLocaleString('en-US')}`, VIEW_W / 2, 610);
  }
  ctx.textAlign = 'left';
  ctx.restore();
}

function drawOverlay(title, sub, color) {
  ctx.fillStyle = 'rgba(8,10,24,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = 'bold 72px sans-serif';
  ctx.fillText(title, VIEW_W / 2, 300);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText(sub, VIEW_W / 2, 350);
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#7dff8a';
  ctx.fillText('ENTER — Reintentar', VIEW_W / 2, 430);
  ctx.textAlign = 'left';
}

function drawPause() {
  ctx.fillStyle = 'rgba(8,10,24,0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 54px sans-serif';
  ctx.fillText('PAUSA', VIEW_W / 2, 280);
  ctx.font = '18px sans-serif';
  ctx.fillText('P / Esc — Seguir · R — Reiniciar partida', VIEW_W / 2, 340);
  ctx.fillText(`Progreso guardado: trabajo ${G.missionIdx + 1}/6 · $${G.cash}`, VIEW_W / 2, 380);
  ctx.textAlign = 'left';
}

function drawWin() {
  ctx.fillStyle = 'rgba(8,10,24,0.78)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('DEUDA SALDADA', VIEW_W / 2, 250);
  ctx.fillStyle = '#fff';
  ctx.font = '22px sans-serif';
  ctx.fillText('Milo entrega el último fajo a Vera. Marisol Bay vuelve a ser suya.', VIEW_W / 2, 300);
  const s = G.winStats || { cash: 0, kills: 0, missions: 0, score: 0 };
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`Dinero: $${s.cash.toLocaleString('en-US')} · Enemigos: ${s.kills} · Trabajos: ${s.missions}/6`, VIEW_W / 2, 360);
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(`Puntuación final: ${s.score.toLocaleString('en-US')}`, VIEW_W / 2, 410);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  ctx.fillText('ENTER — Jugar de nuevo', VIEW_W / 2, 470);
  ctx.textAlign = 'left';
}

function drawBriefing() {
  const b = G.briefing;
  if (!b) return;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  const w = 640;
  ctx.fillRect((VIEW_W - w) / 2, 150, w, 130);
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 2;
  ctx.strokeRect((VIEW_W - w) / 2, 150, w, 130);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(b.title, VIEW_W / 2, 190);
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  const words = b.text.split(' ');
  let line = '';
  let y = 222;
  for (const word of words) {
    if ((line + ' ' + word).length > 62) {
      ctx.fillText(line, VIEW_W / 2, y);
      y += 22;
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) ctx.fillText(line, VIEW_W / 2, y);
  ctx.textAlign = 'left';
}

function draw() {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.save();
  if (G.screen === 'title') {
    drawTitle();
    ctx.restore();
    return;
  }
  ctx.translate(-G.camera.x, -G.camera.y);
  drawWorld(G, ctx, G.camera);
  drawEntities(G, ctx);
  ctx.restore();
  drawHUD(G, ctx);
  drawBriefing();
  if (G.screen === 'pause') drawPause();
  if (G.screen === 'wasted') drawOverlay('HAS MUERTO', G.deathReason, '#ff4d4d');
  if (G.screen === 'busted') drawOverlay('ARRESTADO', G.deathReason, '#3b82ff');
  if (G.screen === 'win') drawWin();
}

let last = performance.now();
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  handleKeys();
  consumeClick();
  acc += dt;
  while (acc >= STEP) {
    step(STEP);
    acc -= STEP;
  }
  if (G.screen === 'title') G.time += dt;
  draw();
  if (G.screen === 'play') {
    statusEl.textContent = `Marisol Bay — trabajo ${G.missionIdx + 1}/6, $${G.cash}, ${G.wanted} estrellas.`;
  }
}

export function boot() {
  bindInput(canvas);
  G.world = buildWorld();
  G.player = createPlayer(LANDMARKS.garage.x + 85, LANDMARKS.garage.y + 190);
  seedParkedCars();
  seedWorldLife();
  const save = loadSave();
  if (save) G.best = save.best || 0;
  // Screenshot staging: ?shot=start|drive|combat|chase&seed=N
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot) {
    const seed = Number.parseInt(params.get('seed') || '7', 10) || 7;
    stageShot(shot, G, seed);
  }
  requestAnimationFrame(frame);
}

window.__game = G;
window.__shotReady = false;
boot();
