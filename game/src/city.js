// Neon Bay: the city itself. A road grid with blocks of buildings, parks,
// parking lots and hand-placed landmarks (docks, paint shop, motel, safehouse).
// Everything is generated from the seed, so every run of the same seed is the
// same city. Nothing here is copied from any real game map.
import { makeRng, range, pick, chance } from './rng.js';

export const WORLD_SIZE = 3600;
export const ROAD_SPACING = 300;
export const ROAD_WIDTH = 76;

const BUILDING_COLORS = [
  '#c98f5f', '#b07a8a', '#7d9bb5', '#8fa98f', '#c9b458',
  '#a08cc9', '#c97e6a', '#6fa8a0', '#b5b5b5', '#d9a441',
];
const ROOF_COLORS = ['#5a4a3a', '#3f4a5a', '#6a5a6a', '#4a5a4a', '#7a3a3a'];

export function createCity(seed) {
  const rng = makeRng(seed);
  const city = {
    size: WORLD_SIZE,
    roadsX: [],
    roadsY: [],
    buildings: [],
    parks: [],
    lots: [],
    trees: [],
    // Landmarks (hand-placed on the grid, not random).
    docks: { x: 1800, y: 3420, label: 'Harbor Docks' },
    paintShop: { x: 900, y: 900, label: "Ray's Paint Shop" },
    motel: { x: 2700, y: 900, label: 'Sunset Motel' },
    safehouse: { x: 900, y: 2700, label: 'Safehouse' },
    hospital: { x: 2700, y: 2700, label: 'Bay General' },
    burgerBar: { x: 1800, y: 1800, label: 'Neon Burger' },
  };

  for (let v = ROAD_SPACING; v < WORLD_SIZE; v += ROAD_SPACING) {
    city.roadsX.push(v);
    city.roadsY.push(v);
  }

  // Blocks: the squares between roads. Each block gets buildings, a park or a lot.
  for (let bx = 0; bx < 11; bx++) {
    for (let by = 0; by < 11; by++) {
      const x0 = bx * ROAD_SPACING + ROAD_WIDTH / 2 + 14;
      const y0 = by * ROAD_SPACING + ROAD_WIDTH / 2 + 14;
      const w = ROAD_SPACING - ROAD_WIDTH - 28;
      const h = ROAD_SPACING - ROAD_WIDTH - 28;
      const cx = x0 + w / 2;
      const cy = y0 + h / 2;
      // Keep landmark blocks and the centre plaza clear of random buildings.
      if (isLandmarkBlock(city, cx, cy)) continue;
      const roll = rng();
      if (roll < 0.16) {
        city.parks.push({ x: x0, y: y0, w, h });
        for (let t = 0; t < 7; t++) {
          city.trees.push({
            x: range(rng, x0 + 16, x0 + w - 16),
            y: range(rng, y0 + 16, y0 + h - 16),
            r: range(rng, 9, 15),
          });
        }
      } else if (roll < 0.28) {
        city.lots.push({ x: x0, y: y0, w, h });
      } else {
        // Split the block into 1-4 buildings.
        const splitX = chance(rng, 0.5);
        const splitY = chance(rng, 0.5);
        const cols = splitX ? 2 : 1;
        const rows = splitY ? 2 : 1;
        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < rows; j++) {
            const bw = w / cols - 12;
            const bh = h / rows - 12;
            const bx0 = x0 + (w / cols) * i + 6;
            const by0 = y0 + (h / rows) * j + 6;
            city.buildings.push({
              x: bx0, y: by0, w: bw, h: bh,
              color: pick(rng, BUILDING_COLORS),
              roof: pick(rng, ROOF_COLORS),
              height: Math.floor(range(rng, 1, 4)),
            });
          }
        }
      }
    }
  }

  // Landmark buildings (bigger, named on the map).
  city.buildings.push(
    { x: 1710, y: 3300, w: 180, h: 120, color: '#8a6a4a', roof: '#3f4a5a', height: 2, label: 'Harbor Docks' },
    { x: 810, y: 810, w: 180, h: 120, color: '#c94f4f', roof: '#3a3a3a', height: 1, label: "Ray's Paint Shop" },
    { x: 2610, y: 810, w: 180, h: 120, color: '#e8b64c', roof: '#5a4a3a', height: 2, label: 'Sunset Motel' },
    { x: 810, y: 2610, w: 180, h: 120, color: '#6fa8a0', roof: '#3f4a5a', height: 2, label: 'Safehouse' },
    { x: 2610, y: 2610, w: 180, h: 120, color: '#dfe8ee', roof: '#7d9bb5', height: 3, label: 'Bay General' },
    { x: 1710, y: 1710, w: 180, h: 120, color: '#ff9f43', roof: '#3a3a3a', height: 1, label: 'Neon Burger' },
  );
  return city;
}

function isLandmarkBlock(city, cx, cy) {
  const landmarks = [
    city.docks, city.paintShop, city.motel, city.safehouse, city.hospital, city.burgerBar,
  ];
  return landmarks.some((mark) => Math.abs(mark.x - cx) < 190 && Math.abs(mark.y - cy) < 190);
}

// True when a point is on a road (used by traffic and pedestrians).
export function onRoad(city, x, y) {
  const half = ROAD_WIDTH / 2;
  for (const rx of city.roadsX) {
    if (Math.abs(x - rx) < half) return true;
  }
  for (const ry of city.roadsY) {
    if (Math.abs(y - ry) < half) return true;
  }
  return false;
}

// True when a circle overlaps any building (collision).
export function hitsBuilding(city, x, y, radius) {
  for (const b of city.buildings) {
    if (x + radius > b.x && x - radius < b.x + b.w &&
        y + radius > b.y && y - radius < b.y + b.h) {
      return b;
    }
  }
  return null;
}

export function clampToWorld(city, x, y, margin) {
  return {
    x: Math.max(margin, Math.min(city.size - margin, x)),
    y: Math.max(margin, Math.min(city.size - margin, y)),
  };
}
