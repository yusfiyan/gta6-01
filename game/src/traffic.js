// Traffic cars that follow the road grid and pedestrians on the sidewalks.
// Both flee or brake when the player makes trouble, which is what makes the
// city feel alive in the screenshots.
import { ROADS_V, ROADS_H, ROAD_W, CAR_MODELS, PED_COLORS, WORLD_W, WORLD_H } from './config.js';
import { mulberry32, pick, range, chance } from './random.js';
import { isOnRoad, nearestRoadPoint, dist, hitsSolid } from './world.js';

const TRAFFIC_MODELS = ['sedan', 'taxi', 'sedan', 'van', 'muscle', 'sedan', 'truck'];

export function spawnTrafficCar(rng, world, nearX, nearY) {
  let x; let y; let vertical; let dir;
  if (nearX !== undefined) {
    const p = nearestRoadPoint(nearX + range(rng, -500, 500), nearY + range(rng, -500, 500));
    x = p.x; y = p.y; vertical = p.vertical;
  } else {
    vertical = chance(rng, 0.5);
    if (vertical) { x = pick(rng, ROADS_V); y = range(rng, 80, WORLD_H - 80); }
    else { x = range(rng, 80, WORLD_W - 80); y = pick(rng, ROADS_H); }
  }
  dir = chance(rng, 0.5) ? 1 : -1;
  // Right-hand traffic: lane offset from the road centre.
  if (vertical) x += dir === 1 ? -ROAD_W / 4 : ROAD_W / 4;
  else y += dir === 1 ? ROAD_W / 4 : -ROAD_W / 4;
  const model = pick(rng, TRAFFIC_MODELS);
  return {
    id: Math.floor(rng() * 1e9),
    model,
    x, y, vertical, dir,
    angle: vertical ? (dir === 1 ? Math.PI / 2 : -Math.PI / 2) : (dir === 1 ? 0 : Math.PI),
    speed: range(rng, 85, 135),
    maxSpeed: range(rng, 110, 150),
    vx: 0, vy: 0, hp: 100,
    color: pick(rng, ['#5b7fa6', '#c8c8c8', '#3d3d3d', '#7d8a96', '#a88f6a', '#4f8f5a', '#8a5f6a']),
    honk: 0,
    brake: false,
  };
}

export function spawnPedestrian(rng, world, nearX, nearY) {
  let x; let y;
  if (nearX !== undefined) {
    const p = nearestRoadPoint(nearX + range(rng, -400, 400), nearY + range(rng, -400, 400));
    x = p.x + (p.vertical ? (chance(rng, 0.5) ? 1 : -1) * (ROAD_W / 2 + 12) : range(rng, -40, 40));
    y = p.y + (p.vertical ? range(rng, -40, 40) : (chance(rng, 0.5) ? 1 : -1) * (ROAD_W / 2 + 12));
  } else {
    const vertical = chance(rng, 0.5);
    if (vertical) {
      x = pick(rng, ROADS_V) + (chance(rng, 0.5) ? 1 : -1) * (ROAD_W / 2 + 12);
      y = range(rng, 80, WORLD_H - 80);
    } else {
      x = range(rng, 80, WORLD_W - 80);
      y = pick(rng, ROADS_H) + (chance(rng, 0.5) ? 1 : -1) * (ROAD_W / 2 + 12);
    }
  }
  return {
    id: Math.floor(rng() * 1e9),
    x, y,
    angle: range(rng, 0, Math.PI * 2),
    speed: range(rng, 38, 68),
    color: pick(rng, PED_COLORS),
    flee: 0, fleeX: 0, fleeY: 0,
    walkPhase: range(rng, 0, Math.PI * 2),
    panic: false,
  };
}

// Steer a traffic car along its road; at an intersection it may turn.
function steerTraffic(car, rng, dt) {
  const atV = ROADS_V.some((rx) => Math.abs(car.x - rx) < 4 && car.vertical);
  const atH = ROADS_H.some((ry) => Math.abs(car.y - ry) < 4 && !car.vertical);
  const atIntersection = (car.vertical && atH) || (!car.vertical && atV);
  if (!atIntersection) return;
  if (chance(rng, dt * 0.35)) {
    // Turn onto the crossing road.
    if (car.vertical) {
      const ry = ROADS_H.reduce((a, b) => (Math.abs(car.y - a) < Math.abs(car.y - b) ? a : b));
      car.y = ry;
      car.vertical = false;
      car.dir = chance(rng, 0.5) ? 1 : -1;
      car.x += car.dir === 1 ? 0 : 0;
      car.angle = car.dir === 1 ? 0 : Math.PI;
    } else {
      const rx = ROADS_V.reduce((a, b) => (Math.abs(car.x - a) < Math.abs(car.x - b) ? a : b));
      car.x = rx;
      car.vertical = true;
      car.dir = chance(rng, 0.5) ? 1 : -1;
      car.angle = car.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
    }
  }
}

export function updateTraffic(G, dt) {
  const rng = G.rng;
  // Keep the streets busy near the camera.
  const want = 22;
  while (G.traffic.length < want) {
    G.traffic.push(spawnTrafficCar(rng, G.world, G.camera.x + 640, G.camera.y + 360));
  }
  for (const car of G.traffic) {
    // Brake for the car ahead on the same lane.
    car.brake = false;
    for (const other of G.traffic) {
      if (other === car || other.vertical !== car.vertical) continue;
      const along = car.vertical ? (other.y - car.y) * car.dir : (other.x - car.x) * car.dir;
      const across = car.vertical ? Math.abs(other.x - car.x) : Math.abs(other.y - car.y);
      if (along > 0 && along < 70 && across < 30) { car.brake = true; break; }
    }
    // Brake for the player's car too.
    if (G.player.car) {
      const pc = G.player.car;
      const along = car.vertical ? (pc.y - car.y) * car.dir : (pc.x - car.x) * car.dir;
      const across = car.vertical ? Math.abs(pc.x - car.x) : Math.abs(pc.y - car.y);
      if (along > 0 && along < 80 && across < 34) car.brake = true;
    }
    const target = car.brake ? 0 : car.maxSpeed;
    car.speed += Math.max(-260 * dt, Math.min(140 * dt, target - car.speed));
    steerTraffic(car, rng, dt);
    if (car.vertical) car.y += car.dir * car.speed * dt;
    else car.x += car.dir * car.speed * dt;
    // Wrap around the map edges so traffic never runs out.
    if (car.x < -80) car.x = WORLD_W + 60;
    if (car.x > WORLD_W + 80) car.x = -60;
    if (car.y < -80) car.y = WORLD_H + 60;
    if (car.y > WORLD_H + 80) car.y = -60;
    // A car that got shoved off its road drifts back to it.
    const p = nearestRoadPoint(car.x, car.y);
    if (car.vertical) car.x += (p.x + (car.dir === 1 ? -ROAD_W / 4 : ROAD_W / 4) - car.x) * Math.min(1, dt * 2);
    else car.y += (p.y + (car.dir === 1 ? ROAD_W / 4 : -ROAD_W / 4) - car.y) * Math.min(1, dt * 2);
  }
  // Cull far-away cars and re-seed near the player.
  G.traffic = G.traffic.filter((car) => dist(car.x, car.y, G.player.x, G.player.y) < 1600);
}

export function updatePedestrians(G, dt) {
  const rng = G.rng;
  const want = 36;
  while (G.peds.length < want) {
    G.peds.push(spawnPedestrian(rng, G.world, G.camera.x + 640, G.camera.y + 360));
  }
  for (const ped of G.peds) {
    ped.walkPhase += dt * 8;
    if (ped.flee > 0) {
      ped.flee -= dt;
      const d = dist(ped.x, ped.y, ped.fleeX, ped.fleeY) || 1;
      ped.angle = Math.atan2(ped.y - ped.fleeY, ped.x - ped.fleeX);
      const sp = 150;
      const nx = ped.x + Math.cos(ped.angle) * sp * dt;
      const ny = ped.y + Math.sin(ped.angle) * sp * dt;
      if (!hitsSolid(G.world, nx, ny, 10)) { ped.x = nx; ped.y = ny; }
      continue;
    }
    // Wander along sidewalks; turn at intersections.
    const p = nearestRoadPoint(ped.x, ped.y);
    const onV = Math.abs(ped.x - p.x) < Math.abs(ped.y - p.y);
    if (chance(rng, dt * 0.12)) ped.angle = range(rng, 0, Math.PI * 2);
    const nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
    const ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
    if (!hitsSolid(G.world, nx, ny, 10) && !isOnRoad(nx, ny)) { ped.x = nx; ped.y = ny; }
    else ped.angle = range(rng, 0, Math.PI * 2);
    void onV;
  }
  G.peds = G.peds.filter((ped) => dist(ped.x, ped.y, G.player.x, G.player.y) < 1400);
}

export function scarePeds(G, x, y, radius) {
  for (const ped of G.peds) {
    if (dist(ped.x, ped.y, x, y) < radius) {
      ped.flee = 2.5;
      ped.fleeX = x; ped.fleeY = y;
      ped.panic = true;
    }
  }
}
