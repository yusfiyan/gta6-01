// Missions and story: six jobs that pay off Milo's debt to Vera Solano.
// Each mission owns its objective, its target marker and its win/fail rules;
// main.js drives the transitions and the briefing overlays.
import { MISSIONS, LANDMARKS } from './config.js';
import { dist } from './world.js';
import { sfx } from './audio.js';
import { spawnGangster } from './combat.js';
import { addWanted, clearPolice } from './police.js';

export function missionByIndex(i) {
  return MISSIONS[i] || null;
}

export function missionCount() {
  return MISSIONS.length;
}

export function startMission(G, index) {
  const m = MISSIONS[index];
  if (!m) return;
  G.missionIdx = index;
  G.mission = {
    id: m.id,
    timer: m.timeLimit || 0,
    timeLeft: m.timeLimit || 0,
    kills: 0,
    killsNeeded: m.id === 'dockside-heat' ? 5 : 0,
    stage: 'go', // go | deliver | escape | done
    target: null,
    spawned: false,
  };
  G.briefing = { title: m.name, text: m.brief, t: 4.5 };
  switch (m.id) {
    case 'meet-vera':
      G.mission.target = { x: LANDMARKS.garage.x + 85, y: LANDMARKS.garage.y + 65, label: "Taller de Vera" };
      break;
    case 'first-run':
      G.mission.target = { x: LANDMARKS.docks.x, y: LANDMARKS.docks.y, label: 'Muelle — entrega' };
      break;
    case 'wheels-up':
      G.mission.target = { x: LANDMARKS.hotel.x + 80, y: LANDMARKS.hotel.y + 90, label: 'Comet GT' };
      // Park the Comet GT by the hotel.
      G.parkedCars.push({
        id: 900001, model: 'comet', x: LANDMARKS.hotel.x + 80, y: LANDMARKS.hotel.y + 90,
        angle: 0, vx: 0, vy: 0, color: '#c22f3d', missionCar: true, hp: 100,
      });
      break;
    case 'dockside-heat':
      G.mission.target = { x: LANDMARKS.docks.x, y: LANDMARKS.docks.y, label: 'Muelle' };
      break;
    case 'hot-pursuit':
      G.mission.target = { x: LANDMARKS.safehouse.x, y: LANDMARKS.safehouse.y, label: 'Piso franco' };
      addWanted(G, 3, 'La policía te ha fichado');
      G.mission.timer = 60;
      G.mission.timeLeft = 60;
      break;
    case 'marisol-score':
      G.mission.target = { x: LANDMARKS.bank.x + 75, y: LANDMARKS.bank.y + 55, label: 'Cámara del banco' };
      break;
    default:
      break;
  }
}

function completeMission(G) {
  const m = MISSIONS[G.missionIdx];
  G.cash += m.reward;
  G.stats.missionsDone += 1;
  G.stats.earned += m.reward;
  sfx.mission();
  G.hudMessage = `¡Trabajo hecho! +$${m.reward}`;
  G.hudMessageT = 3;
  if (m.reward > 0) G.addCashFloat(G.player.x, G.player.y - 30, `+$${m.reward}`);
  if (G.missionIdx + 1 >= MISSIONS.length) {
    G.winGame();
    return;
  }
  startMission(G, G.missionIdx + 1);
  // Save AFTER advancing, so Continue resumes at the next job, not the one
  // that was just finished.
  G.saveGame();
}

function failMission(G, reason) {
  sfx.fail();
  G.hudMessage = reason;
  G.hudMessageT = 3;
  startMission(G, G.missionIdx);
}

export function updateMission(G, dt) {
  const m = G.mission;
  if (!m || G.screen !== 'play') return;
  const def = MISSIONS[G.missionIdx];
  const p = G.player;
  if (m.timeLeft > 0) {
    m.timeLeft -= dt;
    if (m.timeLeft <= 0) {
      if (def.id === 'first-run') { failMission(G, 'Demasiado tarde: el paquete no llegó.'); return; }
      if (def.id === 'hot-pursuit') {
        // Survived the timer: now just reach the safehouse.
        m.timeLeft = 0;
        G.mission.stage = 'escape';
        G.hudMessage = 'Has aguantado. ¡Al piso franco!';
        G.hudMessageT = 3;
      }
    }
  }
  const t = m.target;
  if (!t) return;
  const d = dist(p.x, p.y, t.x, t.y);

  if (def.id === 'dockside-heat' && !m.spawned && d < 620) {
    m.spawned = true;
    // Clear ground south and east of the warehouse — never inside a wall.
    const spots = [
      [620, 2480], [820, 2460], [920, 2380], [700, 2560], [980, 2520], [760, 2540],
    ];
    for (const [x, y] of spots.slice(0, 5)) spawnGangster(G, x, y);
    G.hudMessage = '¡Los Tide Kings están aquí!';
    G.hudMessageT = 2.5;
  }
  if (def.id === 'dockside-heat') {
    m.target.label = `Muelle — elimina ( ${m.kills}/${m.killsNeeded} )`;
    if (m.kills >= m.killsNeeded) { completeMission(G); return; }
  }
  if (def.id === 'wheels-up' && m.stage === 'go' && p.car && p.car.missionCar) {
    m.stage = 'deliver';
    m.target = { x: LANDMARKS.garage.x + 85, y: LANDMARKS.garage.y + 65, label: 'Taller de Vera' };
    G.hudMessage = '¡Lo tienes! Llévalo al taller.';
    G.hudMessageT = 2.5;
  }
  // The delivery distance is measured against the NEW target (the garage),
  // not the stale distance to the hotel computed at the top of this update.
  if (def.id === 'wheels-up' && m.stage === 'deliver' && p.car && p.car.missionCar
    && dist(p.x, p.y, m.target.x, m.target.y) < 90) {
    completeMission(G); return;
  }
  if (def.id === 'marisol-score' && m.stage === 'go' && p.onFoot && d < 70) {
    m.stage = 'grab';
    G.hudMessage = 'Pulsa E para abrir la cámara.';
    G.hudMessageT = 3;
  }
  if (def.id === 'marisol-score' && m.stage === 'escape' && d < 90) {
    completeMission(G); return;
  }
  if (def.id === 'hot-pursuit' && m.stage === 'escape' && d < 90) {
    completeMission(G); return;
  }
  if ((def.id === 'meet-vera' || def.id === 'first-run') && d < 80) {
    completeMission(G); return;
  }
}

// Called when the player presses E near an interactable.
export function interact(G) {
  const m = G.mission;
  const p = G.player;
  if (!m) return false;
  if (m.id === 'marisol-score' && m.stage === 'grab' && p.onFoot) {
    const t = m.target;
    if (dist(p.x, p.y, t.x, t.y) < 90) {
      m.stage = 'escape';
      m.target = { x: LANDMARKS.safehouse.x, y: LANDMARKS.safehouse.y, label: 'Piso franco' };
      G.cash += 2000;
      addWanted(G, 4, '¡Alarma del banco!');
      G.hudMessage = '¡$2.000! ¡Escapa al piso franco!';
      G.hudMessageT = 3;
      sfx.cash();
      return true;
    }
  }
  return false;
}

export function onMissionKill(G) {
  const m = G.mission;
  if (m && m.id === 'dockside-heat') m.kills += 1;
}
