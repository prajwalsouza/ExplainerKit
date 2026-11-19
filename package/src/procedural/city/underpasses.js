import { hsla } from '../../color/space.js';
import { meshBuilder, rgb } from './mesh.js';
import { bridgeSurfaceHeight } from './water-bridges.js';

const SAMPLE_STEP = 0.8;
const MAX_SAMPLES = 150_000;
const MAX_PASSAGES = 100;
const MAX_LENGTH = 100;
const CUT_MARGIN = 0.34;
const PAVING = rgb(hsla(12, 20, 36));
const WALL = rgb(hsla(33, 10, 49));
const LIGHT = rgb(hsla(44, 28, 93));
const pointKey = ({ x, y }) => `${Math.round(x * 10)},${Math.round(y * 10)}`;
const ease = (t) => {
  const s = Math.max(0, Math.min(1, t));
  return s * s * (3 - 2 * s);
};

function sampleWay(way, deck, budget) {
  const points = way.points;
  const samples = [];
  let distance = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (!length) continue;
    const steps = Math.ceil(length / SAMPLE_STEP);
    if ((budget.samples += steps + 1) > MAX_SAMPLES) return [];
    for (let j = i === 1 ? 0 : 1; j <= steps; j++) {
      const t = j / steps;
      const x = a.x + dx * t;
      const y = a.y + dy * t;
      samples.push({ x, y, distance: distance + t * length, deck: bridgeSurfaceHeight(deck, x, -y) });
    }
    distance += length;
  }
  return samples;
}

function survey(samples, first, last, way, field, ground) {
  const entrance = samples[first];
  const exit = samples[last];
  const span = exit.distance - entrance.distance;
  if (span < 2 || span > MAX_LENGTH) return null;
  const clearance = way.highway === 'cycleway' || way.bicycle === 'yes' ? 2.75 : way.foot ? 2.55 : 4.4;
  const dry = (p) => {
    const col = Math.floor((p.x - field.x0) / field.cell);
    const row = Math.floor((p.y - field.y0) / field.cell);
    return (
      col >= 0 && col < field.width && row >= 0 && row < field.height && field.water[row * field.width + col] > -0.3
    );
  };
  let start = first;
  let end = last;
  while (start > 0 && samples[start - 1].deck === undefined && entrance.distance - samples[start - 1].distance <= 8)
    start--;
  while (
    end + 1 < samples.length &&
    samples[end + 1].deck === undefined &&
    samples[end + 1].distance - exit.distance <= 8
  )
    end++;
  if (start === first || end === last || !dry(samples[start]) || !dry(samples[end])) return null;
  const from = samples[start];
  const to = samples[end];
  const y0 = ground(from.x, -from.y);
  const y1 = ground(to.x, -to.y);
  const centre = samples[(first + last) >> 1];
  const lower = way.tunnel || way.layer < 0;
  if (!lower && centre.deck - (y0 + y1) / 2 < 1.35) return null;
  let ceiling = Infinity;
  for (let i = first; i <= last; i++) ceiling = Math.min(ceiling, samples[i].deck - 0.45);
  const length = to.distance - from.distance;
  return samples.slice(start, end + 1).map((p, i) => {
    const t = (p.distance - from.distance) / length;
    const expected = y0 + (y1 - y0) * t;
    const bed = Math.min(expected, ceiling - clearance);
    const section = start + i;
    const blend =
      section < first
        ? ease((p.distance - from.distance) / (entrance.distance - from.distance))
        : section > last
          ? ease((to.distance - p.distance) / (to.distance - exit.distance))
          : 1;
    const terrain = ground(p.x, -p.y);
    return { ...p, floor: terrain + (bed - terrain) * blend, terrain, blend, clearance };
  });
}

function passageSections(points, way, ground, shoulder) {
  const cycling = way.highway === 'cycleway' || way.bicycle === 'yes';
  const half = Math.max(cycling ? 1.7 : way.foot ? 1.15 : 1.8, Math.min(5, way.width / 2));
  const approachHalf = Math.max(0.85, Math.min(half, way.width / 2));
  return points.map((p, i) => {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    const norm = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const dx = (b.y - a.y) / norm;
    const dz = (b.x - a.x) / norm;
    const width = approachHalf + (half - approachHalf) * p.blend;
    const covered = p.deck !== undefined;
    const section = (side) => {
      const x = p.x + dx * width * side;
      const z = -p.y + dz * width * side;
      const y = p.floor + (ground(x, z) - p.terrain) * (1 - p.blend) + 0.025;
      const outsideX = x + dx * shoulder * side;
      const outsideZ = z + dz * shoulder * side;
      const outsideY = ground(outsideX, outsideZ);
      const roof = y + p.clearance;
      return {
        floor: [x, y, z],
        roof: [x, roof, z],
        top: [x, covered ? roof : Math.max(y, ground(x, z)), z],
        bank: [outsideX, covered ? Math.min(roof, Math.max(y, outsideY)) : outsideY, outsideZ],
      };
    };
    return { left: section(-1), right: section(1), covered, deck: p.deck };
  });
}

function portalFrame(mesh, opening, deck) {
  const { left, right } = opening;
  const cap = Math.max(left.roof[1], right.roof[1], deck - 0.22);
  const at = ([x, , z], y) => [x, y, z];
  mesh.quad(left.roof, right.roof, at(right.roof, cap), at(left.roof, cap), WALL);
  for (const edge of [left, right]) {
    const bottom = Math.min(edge.floor[1], edge.bank[1]) - 0.1;
    mesh.quad(at(edge.floor, bottom), at(edge.bank, bottom), at(edge.bank, cap), at(edge.floor, cap), WALL);
  }
}

function approachApron(mesh, end, next, ground, reach) {
  const dx = end.left.floor[0] + end.right.floor[0] - next.left.floor[0] - next.right.floor[0];
  const dz = end.left.floor[2] + end.right.floor[2] - next.left.floor[2] - next.right.floor[2];
  const length = Math.hypot(dx, dz);
  if (length < 0.001) return;
  const extend = ([x, , z]) => {
    const px = x + (dx / length) * reach;
    const pz = z + (dz / length) * reach;
    return [px, ground(px, pz) + 0.028, pz];
  };
  const { left, right } = end;
  mesh.extra(0.88).quad(left.floor, right.floor, extend(right.floor), extend(left.floor), PAVING, [0, 1, 0]);
  for (const side of [left, right])
    mesh.extra(0.85).quad(side.floor, side.bank, extend(side.bank), extend(side.floor), WALL);
}

function passageMask(profiles, deck) {
  // The shoulder covers the margin around the terrain cut. Bridge faces use
  // the clear opening, so the cut ends against the lining at the portal.
  const widen = (a, b) => {
    const dx = b[0] - a[0];
    const dz = b[2] - a[2];
    const reach = CUT_MARGIN / (Math.hypot(dx, dz) || 1);
    return [
      [a[0] - dx * reach, a[1], a[2] - dz * reach],
      [b[0] + dx * reach, b[1], b[2] + dz * reach],
    ];
  };
  const openings = profiles.map(({ quad: [a, b, c, d], clearance }) => {
    const [ar, al] = widen(a, d);
    const [br, bl] = widen(b, c);
    return { quad: [ar, br, bl, al], bore: [a, b, c, d], clearance };
  });
  const extent = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity };
  for (const profile of openings)
    for (const [x, , z] of profile.quad) {
      extent.x0 = Math.min(extent.x0, x);
      extent.x1 = Math.max(extent.x1, x);
      extent.z0 = Math.min(extent.z0, z);
      extent.z1 = Math.max(extent.z1, z);
    }
  const cell = Math.max(0.28, (extent.x1 - extent.x0) / 2046, (extent.z1 - extent.z0) / 2046);
  const width = Math.min(2048, Math.ceil((extent.x1 - extent.x0) / cell) + 2);
  const height = Math.min(2048, Math.ceil((extent.z1 - extent.z0) / cell) + 2);
  const x0 = extent.x0 - cell;
  const z0 = extent.z0 - cell;
  const values = new Float32Array(width * height * 4);
  for (const { quad, bore, clearance } of openings) {
    const xs = quad.map((p) => p[0]);
    const zs = quad.map((p) => p[2]);
    const i0 = Math.max(0, Math.floor((Math.min(...xs) - x0) / cell));
    const i1 = Math.min(width, Math.ceil((Math.max(...xs) - x0) / cell));
    const j0 = Math.max(0, Math.floor((Math.min(...zs) - z0) / cell));
    const j1 = Math.min(height, Math.ceil((Math.max(...zs) - z0) / cell));
    const surface = [{ quad, roadId: 0, explicit: true }];
    const lining = [{ quad: bore, roadId: 0, explicit: true }];
    for (let row = j0; row < j1; row++) {
      const z = z0 + (row + 0.5) * cell;
      for (let col = i0; col < i1; col++) {
        const x = x0 + (col + 0.5) * cell;
        const floor = bridgeSurfaceHeight(surface, x, z);
        if (floor === undefined) continue;
        const i = (row * width + col) * 4;
        const top = bridgeSurfaceHeight(deck, x, z);
        if (values[i + 2] && values[i] <= floor) continue;
        values[i] = floor;
        values[i + 1] = Math.min(floor + clearance, (top ?? Infinity) - 0.35);
        values[i + 2] = 1;
        values[i + 3] = bridgeSurfaceHeight(lining, x, z) !== undefined ? 1 : 0;
      }
    }
  }
  return { x0, z0, cell, width, height, values };
}

/** Build short passages where a lower way actually crosses from one edge of a bridge to another. */
export function buildUnderpasses(roads, bridges, field, ground, budget, inferLights = true) {
  const deck = bridges.profiles.filter((p) => !p.approach);
  if (!deck.length) return null;
  const upper = new Set(bridges.roadIds);
  const upperNodes = new Set();
  for (const way of roads) if (upper.has(way.id)) for (const p of way.points) upperNodes.add(pointKey(p));
  const mesh = meshBuilder(4, budget);
  const profiles = [];
  const lights = [];
  const roadIds = new Set();
  const work = { samples: 0 };
  const maskCell = Math.max(0.28, (Math.max(field.width, field.height) * field.cell) / 2046);
  const shoulder = CUT_MARGIN + maskCell + 0.2;
  for (const way of roads) {
    if (roadIds.size >= MAX_PASSAGES || work.samples >= MAX_SAMPLES) break;
    if (upper.has(way.id) || way.bridge || way.layer > 0 || way.ford || way.points.length < 2) continue;
    const taggedLower = way.tunnel || way.layer < 0;
    if (!taggedLower && !way.foot) continue;
    if (
      !taggedLower &&
      way.points.some((p) => upperNodes.has(pointKey(p)) && bridgeSurfaceHeight(deck, p.x, -p.y) !== undefined)
    )
      continue;
    const points = sampleWay(way, deck, work);
    for (let first = 0; first < points.length; first++) {
      if (points[first].deck === undefined) continue;
      let last = first;
      while (last + 1 < points.length && points[last + 1].deck !== undefined) last++;
      const fit = survey(points, first, last, way, field, ground);
      first = last;
      if (!fit) continue;
      const sections = passageSections(fit, way, ground, shoulder);
      approachApron(mesh, sections[0], sections[1], ground, maskCell + 0.4);
      approachApron(mesh, sections.at(-1), sections.at(-2), ground, maskCell + 0.4);
      let lastLight = -Infinity;
      for (let i = 1; i < sections.length; i++) {
        const a = sections[i - 1];
        const b = sections[i];
        const quad = [a.right.floor, b.right.floor, b.left.floor, a.left.floor];
        mesh.extra(0.88).quad(...quad, PAVING, [0, 1, 0]);
        const covered = a.covered || b.covered;
        const leftA = covered ? a.left.roof : a.left.top;
        const leftB = covered ? b.left.roof : b.left.top;
        const rightA = covered ? a.right.roof : a.right.top;
        const rightB = covered ? b.right.roof : b.right.top;
        mesh.extra(0.85).quad(a.left.floor, leftA, leftB, b.left.floor, WALL);
        mesh.quad(b.right.floor, rightB, rightA, a.right.floor, WALL);
        mesh.quad(leftA, a.left.bank, b.left.bank, leftB, WALL);
        mesh.quad(rightB, b.right.bank, a.right.bank, rightA, WALL);
        if (covered) mesh.quad(leftA, leftB, rightB, rightA, WALL, [0, -1, 0]);
        if (a.covered !== b.covered) portalFrame(mesh, a.covered ? b : a, (a.covered ? a : b).deck);
        if (a.covered && b.covered) {
          const position = fit[i];
          if ((way.lit === true || (inferLights && way.lit !== false)) && position.distance - lastLight >= 9) {
            const x = position.x,
              y = b.left.roof[1],
              z = -position.y;
            mesh.extra(0.3, 0.45, 7, 0).box(x - 0.18, y - 0.1, z - 0.13, x + 0.18, y - 0.025, z + 0.13, LIGHT);
            lights.push({ x, y: y - 0.14, z, kind: 'underpass', mapped: false });
            lastLight = position.distance;
          }
        }
        profiles.push({ roadId: way.id, explicit: !!taggedLower, quad, clearance: fit[i].clearance });
      }
      roadIds.add(way.id);
    }
  }
  return profiles.length
    ? { roadIds: [...roadIds], profiles, mesh: mesh.finish(), mask: passageMask(profiles, bridges.profiles), lights }
    : null;
}

export function underpassSurfaceHeight(profiles, x, z, roadId) {
  return bridgeSurfaceHeight(profiles, x, z, roadId);
}
