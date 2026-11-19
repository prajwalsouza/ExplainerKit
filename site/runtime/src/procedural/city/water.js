import { hsla } from '../../color/space.js';
import { meshBuilder, rgb } from './mesh.js';

const bankColour = rgb(hsla(38, 17, 28));

// Ignore elevated deck samples and prefer the interior of each mapped water polygon.
export function levelWater(water, field, waterIds, ground, bounds, budget) {
  const { width, height, cell, x0, y0 } = field;
  const samples = water.map(() => []);
  const deepest = water.map(() => ({ distance: Infinity, x: 0, z: 0 }));
  const deepestUnderDeck = water.map(() => ({ distance: Infinity, x: 0, z: 0 }));
  const area = new Uint32Array(water.length);
  const stride = Math.max(1, Math.round(4 / cell));
  for (let row = 0; row < height; row++) {
    const z = -(y0 + (row + 0.5) * cell);
    for (let col = 0; col < width; col++) {
      const index = row * width + col;
      const body = waterIds[index] - 1;
      if (body < 0) continue;
      area[body]++;
      const distance = field.water[index];
      const point = field.bridge[index] > 0 ? deepest[body] : deepestUnderDeck[body];
      const x = x0 + (col + 0.5) * cell;
      if (distance < point.distance) {
        point.distance = distance;
        point.x = x;
        point.z = z;
      }
      if (distance < -1 && field.bridge[index] > 0 && !(row % stride) && !(col % stride)) {
        samples[body].push(ground(x, z));
      }
    }
  }
  const levels = water.map((body, index) => {
    const readings = samples[index];
    if (readings.length) {
      readings.sort((a, b) => a - b);
      // The lower interior readings are less affected by banks and structures in a surface DEM.
      const low = readings[Math.floor(readings.length * 0.2)];
      const median = readings[Math.floor(readings.length * 0.5)];
      const upper = readings[Math.floor(readings.length * 0.8)];
      const plateau = readings.length >= 8 && upper - low <= 0.22;
      if (!Number.isFinite(body.elevation)) return Math.round((plateau ? median : low) * 10) / 10;
      // A spot height rounded to whole metres can be refined by a matching, flat DEM surface.
      if (Number.isInteger(body.elevation) && plateau && Math.abs(median - body.elevation) <= 0.52)
        return Math.round(median * 10) / 10;
      return body.elevation;
    }
    if (Number.isFinite(body.elevation)) return body.elevation;
    const point = deepest[index].distance !== Infinity ? deepest[index] : deepestUnderDeck[index];
    return point.distance !== Infinity ? ground(point.x, point.z) : undefined;
  });

  // Join directly touching areas when the same surface is within the sampling uncertainty.
  // Separate levels at locks and dams remain separate.
  const parent = water.map((_, index) => index);
  const root = (index) => {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]];
      index = parent[index];
    }
    return index;
  };
  const join = (a, b) => {
    if (!a || !b || a === b) return;
    const left = root(a - 1),
      right = root(b - 1);
    if (left === right || Math.abs(levels[left] - levels[right]) > 0.42) return;
    if (area[left] >= area[right]) parent[right] = left;
    else parent[left] = right;
  };
  for (let row = 0; row < height; row++)
    for (let col = 0; col < width; col++) {
      const index = row * width + col;
      if (col + 1 < width) join(waterIds[index], waterIds[index + 1]);
      if (row + 1 < height) join(waterIds[index], waterIds[index + width]);
    }
  const joined = levels.map((_, index) => levels[root(index)]);

  // Horizontal strips follow the same mask as the shoreline shader and keep different
  // river reaches, lakes and ponds on independent planes, including islands and holes.
  const mesh = meshBuilder(0, budget);
  const bank = meshBuilder(4, budget);
  const white = [1, 1, 1];
  const up = [0, 1, 0];
  const closeBank = (ax, az, bx, bz, level) => {
    const a = ground(ax, az);
    const b = ground(bx, bz);
    if (Math.max(Math.abs(a - level), Math.abs(b - level)) < 0.01) return;
    bank.extra(0.85).quad([ax, a, az], [bx, b, bz], [bx, level, bz], [ax, level, az], bankColour);
  };
  for (let row = 0; row < height; row++) {
    const south = -(y0 + row * cell);
    const north = -Math.min(bounds.y1, y0 + (row + 1) * cell);
    let start = 0;
    while (start < width) {
      const id = waterIds[row * width + start];
      let end = start + 1;
      while (end < width && waterIds[row * width + end] === id) end++;
      const level = joined[id - 1];
      if (level !== undefined) {
        const west = x0 + start * cell;
        const east = Math.min(bounds.x1, x0 + end * cell);
        mesh.quad([west, level, south], [east, level, south], [east, level, north], [west, level, north], white, up);
        const offset = row * width;
        if (start > 0 && !waterIds[offset + start - 1]) closeBank(west, south, west, north, level);
        if (end < width && !waterIds[offset + end]) closeBank(east, north, east, south, level);
        for (let col = start; col < end; col++) {
          const left = x0 + col * cell;
          const right = Math.min(bounds.x1, left + cell);
          if (row > 0 && !waterIds[offset + col - width]) closeBank(right, south, left, south, level);
          if (row + 1 < height && !waterIds[offset + col + width]) closeBank(left, north, right, north, level);
        }
      }
      start = end;
    }
  }
  return { levels: joined, mesh: mesh.finish(), bank: bank.finish() };
}
