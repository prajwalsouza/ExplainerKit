import { assert } from '../../core/validate.js';
import { rgb, shade, simplifyRing } from './mesh.js';
import { terrainHeight } from './terrain.js';

const MAX_INTERVALS = 1_000_000;
const CONTACT_DEPTH = 0.015;
const clamp = (value, max) => Math.max(0, Math.min(max, value));
const hasGroundContact = (building) =>
  !(building.minHeight > 0 || ['roof', 'canopy', 'shelter'].includes(building.tag));

function spend(work, intervals) {
  work.intervals += intervals;
  assert(work.intervals <= MAX_INTERVALS, 'RESOURCE_LIMIT', 'Building foundations exceed the terrain sampling limit.');
}

export function buildingFoundationLevel(building, terrain, work) {
  const ring = building.ring;
  const low = ring.reduce((height, p) => Math.min(height, terrainHeight(terrain, p.x, -p.y)), Infinity);
  // Keep a downhill datum while there is still a usable façade on the uphill side.
  const maxCover = Math.max(1.4, building.height * 0.45);
  if (!hasGroundContact(building) || terrain.max - low <= maxCover) return low;

  const { bounds, columns, rows } = terrain;
  const spacing = Math.max((bounds.x1 - bounds.x0) / (columns - 1), (bounds.y1 - bounds.y0) / (rows - 1));
  const setback = Math.max(2.5, Math.min(12, spacing * 1.5));
  const grades = [];
  let perimeter = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const dx = b.x - a.x;
    const dz = a.y - b.y;
    const length = Math.hypot(dx, dz);
    if (length < 0.05) continue;
    const samples = Math.min(16, Math.ceil(length / Math.max(2, setback)));
    const weight = length / samples;
    const nx = (-dz / length) * setback;
    const nz = (dx / length) * setback;
    spend(work, 3 * samples);
    perimeter += length;
    for (let j = 0; j < samples; j++) {
      const t = (j + 0.5) / samples;
      const x = a.x + dx * t;
      const z = -a.y + dz * t;
      // A surface model can contain roofs and trees. Count a high sample at
      // the wall only when the terrain farther outside supports that height.
      const height = Math.min(
        terrainHeight(terrain, x, z),
        terrainHeight(terrain, x + nx, z + nz),
        terrainHeight(terrain, x + 2 * nx, z + 2 * nz),
      );
      grades.push({ height, weight });
    }
  }
  grades.sort((a, b) => b.height - a.height);
  // Use an upper, length-weighted perimeter grade. Brief isolated spikes and
  // crowded vertices on an outline should not raise the whole building.
  let uphillLength = perimeter * 0.15;
  for (const { height, weight } of grades) {
    uphillLength -= weight;
    if (uphillLength <= 0) return Math.max(low, height - maxCover);
  }
  return low;
}

function gridCuts(cuts, start, delta, max) {
  if (!delta) return;
  const end = start + delta;
  const first = Math.max(0, Math.floor(Math.min(start, end)) + 1);
  const last = Math.min(max, Math.ceil(Math.max(start, end)) - 1);
  for (let i = first; i <= last; i++) cuts.push((i - start) / delta);
}

function* edgeProfile(terrain, a, b, work) {
  const { columns, rows, bounds } = terrain;
  const sx = (columns - 1) / (bounds.x1 - bounds.x0);
  const sy = (rows - 1) / (bounds.y1 - bounds.y0);
  const u = (a.x - bounds.x0) * sx;
  const v = (bounds.y1 - a.y) * sy;
  const du = (b.x - a.x) * sx;
  const dv = (a.y - b.y) * sy;
  const cuts = [0, 1];
  gridCuts(cuts, u, du, columns - 1);
  gridCuts(cuts, v, dv, rows - 1);
  spend(work, cuts.length);
  cuts.sort((x, y) => x - y);
  let start = 0;
  yield start;
  for (let i = 1; i < cuts.length; i++) {
    const end = cuts[i];
    if (end - start < 1e-10) continue;
    const u0 = clamp(u + du * start, columns - 1);
    const v0 = clamp(v + dv * start, rows - 1);
    const u1 = clamp(u + du * end, columns - 1);
    const v1 = clamp(v + dv * end, rows - 1);
    const column = Math.min(columns - 2, Math.floor((u0 + u1) / 2));
    const row = Math.min(rows - 2, Math.floor((v0 + v1) / 2));
    // Each DEM cell has a diagonal from its northeast to its southwest corner.
    // The surface is linear on either side, so this split follows it exactly.
    const diagonal = column + row + 1;
    const from = u0 + v0 - diagonal;
    const to = u1 + v1 - diagonal;
    if (from * to < 0) yield start + ((end - start) * from) / (from - to);
    yield end;
    start = end;
  }
}

export function addTerrainFoundation(building, style, terrain, level, trim, work) {
  // A mapped clearance belongs to the building. Leave passages and open canopies open.
  if (!hasGroundContact(building)) return;
  if (level - terrain.min <= 1e-3) return;
  const colour = shade(rgb(style.wall), 0.75);
  trim.reset().extra(0.93, 0, 0, 0);

  for (const outline of [building.ring, ...building.holes]) {
    const ring = simplifyRing(outline);
    if (ring.length < 3) continue;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      // Match the wall builder's minimum edge length and winding.
      if (Math.hypot(dx, dy) < 0.05) continue;
      const outward = [dy, 0, dx];
      let previous;
      for (const fraction of edgeProfile(terrain, a, b, work)) {
        const x = a.x + dx * fraction;
        const z = -(a.y + dy * fraction);
        const depth = level - terrainHeight(terrain, x, z);
        const current = { x, z, depth };
        if (previous && Math.max(previous.depth, depth) > 1e-3) {
          // A small overlap below the terrain hides seams from Float32 rounding.
          const left = Math.min(0, -previous.depth - CONTACT_DEPTH);
          const right = Math.min(0, -depth - CONTACT_DEPTH);
          const face = [
            [previous.x, left, previous.z],
            [current.x, right, current.z],
          ];
          if (right < 0) face.push([current.x, 0, current.z]);
          if (left < 0) face.push([previous.x, 0, previous.z]);
          trim.poly(face, colour, outward);
        }
        previous = current;
      }
    }
  }
}
