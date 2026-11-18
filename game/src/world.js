// The city of Marisol Bay: road grid, blocks, buildings, beach, port and park,
// all generated from one fixed seed so the map never changes between runs.
import {
  ROADS_V, ROADS_H, ROAD_W, SIDEWALK, WORLD_W, WORLD_H,
  WATER_X, SAND_X, CITY_SEED, BUILDING_COLORS, LANDMARKS,
} from './config.js';
import { mulberry32, pick, range, rangeInt, chance } from './random.js';

export function buildWorld() {
  const rng = mulberry32(CITY_SEED);
  const buildings = [];
  const trees = [];
  const containers = [];
  const umbrellas = [];

  // Blocks are the rectangles between neighbouring roads.
  const vEdges = [0, ...ROADS_V, WORLD_W];
  const hEdges = [0, ...ROADS_H, WORLD_H];
  for (let vi = 0; vi < vEdges.length - 1; vi += 1) {
    for (let hi = 0; hi < hEdges.length - 1; hi += 1) {
      const x0 = vEdges[vi] + (vi === 0 ? 0 : ROAD_W / 2 + SIDEWALK);
      const x1 = vEdges[vi + 1] - (vi + 1 === vEdges.length - 1 ? 0 : ROAD_W / 2 + SIDEWALK);
      const y0 = hEdges[hi] + (hi === 0 ? 0 : ROAD_W / 2 + SIDEWALK);
      const y1 = hEdges[hi + 1] - (hi + 1 === hEdges.length - 1 ? 0 : ROAD_W / 2 + SIDEWALK);
      const bw = x1 - x0;
      const bh = y1 - y0;
      if (bw < 60 || bh < 60) continue;
      // Beach strip: no buildings east of the sand.
      if (x0 >= SAND_X) continue;
      // Port quarter (south-west): containers instead of buildings.
      if (x0 < 1150 && y0 > 2150) {
        for (let i = 0; i < 10; i += 1) {
          containers.push({
            x: range(rng, x0 + 20, x1 - 90),
            y: range(rng, y0 + 20, y1 - 40),
            w: 70, h: 26,
            color: pick(rng, ['#b8543a', '#3a7ab8', '#c8a03a', '#4f8f5a', '#8a5fb8']),
          });
        }
        continue;
      }
      // Central park.
      if (x0 > 1600 && x0 < 2100 && y0 > 1600 && y0 < 2100) {
        for (let i = 0; i < 14; i += 1) {
          trees.push({ x: range(rng, x0 + 15, x1 - 15), y: range(rng, y0 + 15, y1 - 15), r: range(rng, 12, 20) });
        }
        continue;
      }
      // Plaza around the bank.
      if (Math.abs(x0 - 1586) < 200 && Math.abs(y0 - 1136) < 200) continue;
      const count = chance(rng, 0.5) ? 2 : 1;
      for (let i = 0; i < count; i += 1) {
        const w = range(rng, Math.min(90, bw * 0.42), Math.min(150, bw * 0.8));
        const h = range(rng, Math.min(80, bh * 0.42), Math.min(140, bh * 0.8));
        const bx = count === 1 ? x0 + (bw - w) / 2 : x0 + 12 + i * (bw / 2);
        const by = count === 1 ? y0 + (bh - h) / 2 : y0 + 12 + (i % 2) * 0;
        const tall = chance(rng, 0.22);
        buildings.push({
          x: bx, y: by, w, h,
          color: pick(rng, BUILDING_COLORS),
          tall,
          windows: rangeInt(rng, 2, 5),
        });
      }
      if (chance(rng, 0.6)) {
        trees.push({ x: range(rng, x0 + 15, x1 - 15), y: range(rng, y0 + 15, y1 - 15), r: range(rng, 10, 16) });
      }
    }
  }

  // Landmark buildings, placed by hand so missions always find them.
  const landmarks = [
    { kind: 'bank', x: 1640, y: 1190, w: 150, h: 110, color: '#d8cfb8', tall: false, windows: 3 },
    { kind: 'hospital', x: 690, y: 690, w: 160, h: 120, color: '#e8e8e8', tall: false, windows: 4 },
    { kind: 'garage', x: 1140, y: 2040, w: 170, h: 130, color: '#7a6a8f', tall: false, windows: 2 },
    { kind: 'hotel', x: 2960, y: 690, w: 150, h: 160, color: '#c98f5f', tall: true, windows: 6 },
    { kind: 'warehouse', x: 560, y: 2300, w: 200, h: 120, color: '#8a7a6a', tall: false, windows: 1 },
  ];
  for (const lm of landmarks) buildings.push(lm);

  // Beach umbrellas.
  for (let i = 0; i < 12; i += 1) {
    umbrellas.push({
      x: range(rng, SAND_X + 30, WATER_X - 40),
      y: range(rng, 120, WORLD_H - 120),
      color: pick(rng, ['#d94f4f', '#e8b93a', '#3a7ab8', '#e87d3a']),
    });
  }

  return { buildings, trees, containers, umbrellas, rng };
}

export function isOnRoad(x, y) {
  for (const rx of ROADS_V) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  for (const ry of ROADS_H) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  return false;
}

export function isInWater(x, y) {
  return x >= WATER_X;
}

export function isOnSand(x, y) {
  return x >= SAND_X && x < WATER_X;
}

// True when the point (with radius r) hits a building, the sea or the map edge.
export function hitsSolid(world, x, y, r) {
  if (x < r || y < r || x > WORLD_W - r || y > WORLD_H - r) return true;
  if (x + r >= WATER_X) return true;
  for (const b of world.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  return false;
}

// Slide a circle along solids: try x then y, so movement hugs walls.
export function moveWithCollision(world, pos, dx, dy, r) {
  const nx = pos.x + dx;
  if (!hitsSolid(world, nx, pos.y, r)) pos.x = nx;
  const ny = pos.y + dy;
  if (!hitsSolid(world, pos.x, ny, r)) pos.y = ny;
}

export function nearestRoadPoint(x, y) {
  // Snap to the closest road centre line.
  let bestV = ROADS_V[0]; let bestD = Infinity;
  for (const rx of ROADS_V) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; bestV = rx; }
  }
  let bestH = ROADS_H[0]; bestD = Infinity;
  for (const ry of ROADS_H) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; bestH = ry; }
  }
  if (Math.abs(x - bestV) < Math.abs(y - bestH)) return { x: bestV, y, vertical: true };
  return { x, y: bestH, vertical: false };
}

export function randomRoadPoint(rng) {
  if (chance(rng, 0.5)) {
    return { x: pick(rng, ROADS_V), y: range(rng, 80, WORLD_H - 80), vertical: true };
  }
  return { x: range(rng, 80, WORLD_W - 80), y: pick(rng, ROADS_H), vertical: false };
}

export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export { LANDMARKS };
