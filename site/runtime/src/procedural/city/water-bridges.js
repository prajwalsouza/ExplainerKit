import { hsla } from '../../color/space.js';
import { clipConvex, meshBuilder, orientedBox, pointInRing, rgb, ringArea, triangulate } from './mesh.js';

const MAX_SAMPLES = 750_000;
const MAX_SEGMENTS = 20_000;
const END_SEARCH = 12;
const BUCKET_SIZE = 8;
const MAX_FOOTPRINTS = 64;
const MAX_FOOTPRINT_VERTICES = 96;
const MAX_FOOTPRINT_SPAN = 300;
const MAX_BRIDGE_WAYS = 2_000;
const MAX_FOOTPRINT_MATCH_WORK = 2_000_000;
const DECK = rgb(hsla(213, 8, 30));
const STRUCTURE = rgb(hsla(34, 12, 47));
const indexes = new WeakMap();

/** @typedef {[number, number, number]} BridgeVertex */
/** @typedef {{roadId: number | string, roadIds?: (number | string)[], explicit: boolean, quad: [BridgeVertex, BridgeVertex, BridgeVertex, BridgeVertex], approach?: true} | {footprintId: number | string, roadIds: (number | string)[], explicit: true, quad: [BridgeVertex, BridgeVertex, BridgeVertex], approach?: true}} WaterBridgeProfile */

function clipLine(a, b, bounds) {
  let start = 0;
  let end = 1;
  for (const [p, q, min, max] of [
    [a.x, b.x, bounds.x0, bounds.x1],
    [a.y, b.y, bounds.y0, bounds.y1],
  ]) {
    if (p === q) {
      if (p < min || p > max) return null;
      continue;
    }
    const u = (min - p) / (q - p);
    const v = (max - p) / (q - p);
    start = Math.max(start, Math.min(u, v));
    end = Math.min(end, Math.max(u, v));
  }
  return end > start ? [start, end] : null;
}

// Work is proportional to the clipped length inside the street field, with a global sample cap.
function* clippedRoad(road, bounds, step, work, classify) {
  const points = road.points;
  let run = [];
  let distance = 0;
  for (let k = 0; k + 1 < points.length; k++) {
    if (++work.count > MAX_SAMPLES) return;
    const a = points[k];
    const b = points[k + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (!(length > 0)) continue;
    const interval = clipLine(a, b, bounds);
    if ((!interval || interval[0] > 0) && run.length) {
      yield run;
      run = [];
      distance = 0;
    }
    if (!interval) continue;
    const [start, end] = interval;
    const count = Math.ceil(((end - start) * length) / step);
    for (let j = run.length ? 1 : 0; j <= count; j++) {
      if (++work.count > MAX_SAMPLES) return;
      const t = start + ((end - start) * j) / count;
      const x = a.x + t * dx;
      const y = a.y + t * dy;
      run.push({ x, y, distance: distance + (t - start) * length, body: classify(x, y) });
    }
    distance += (end - start) * length;
    if (end < 1) {
      yield run;
      run = [];
      distance = 0;
    }
  }
  if (run.length) yield run;
}

function bank(points, index, step, ground) {
  const edge = points[index].distance;
  let approach;
  for (let i = index + step; i >= 0 && i < points.length; i += step) {
    const p = points[i];
    const distance = Math.abs(p.distance - edge);
    if (distance > END_SEARCH || p.body > 0) break;
    if (p.body !== 0 || distance < 1.5) continue;
    if (!approach) {
      approach = { index: i, height: ground(p.x, -p.y) };
      continue;
    }
    const other = points[approach.index];
    const gap = Math.abs(other.distance - p.distance);
    if (gap >= 2.5) {
      const slope = Math.abs(ground(p.x, -p.y) - approach.height) / gap;
      return { ...approach, slope };
    }
  }
  return approach;
}

function fittedDeck(points, first, last, road, level, ground) {
  const a = bank(points, first, -1, ground);
  const b = bank(points, last, 1, ground);
  if (!a || !b || !Number.isFinite(level) || !Number.isFinite(a.height) || !Number.isFinite(b.height)) return null;
  const start = points[a.index];
  const end = points[b.index];
  const span = end.distance - start.distance;
  const chord = Math.hypot(end.x - start.x, end.y - start.y);
  const waterSpan = points[last].distance - points[first].distance;
  if (Math.abs(b.height - a.height) > 0.3 * span) return null;
  const clearance = Math.min(a.height, b.height) - level;
  // Untagged roads need two clear banks and a direct crossing.
  if (clearance < 0.9 || waterSpan < Math.max(3, road.width * 0.45) || chord / span < 0.86) return null;
  if (!(a.slope <= 0.3 && b.slope <= 0.3)) return null;
  const thickness = Math.min(0.65, 0.65 * clearance);
  return { a, b, start, span, thickness };
}

function mappedDeck(points, road, waterLevels, ground, lowerRailAt, classify) {
  let level = -Infinity;
  let railBed = -Infinity;
  for (const p of points) {
    const water = waterLevels[p.body - 1];
    if (water !== undefined) level = Math.max(level, water);
    if (lowerRailAt?.(p.x, p.y)) railBed = Math.max(railBed, ground(p.x, -p.y));
  }
  const start = points[0];
  const end = points.at(-1);
  const minHeight = Math.max(level + (road.foot ? 0.75 : 1.1), railBed + 5.1);
  const atBank = (p, next) => {
    let height = p.body <= 0 ? ground(p.x, -p.y) : minHeight;
    // The elevation raster can see the rail cutting right at a mapped deck end.
    if (Number.isFinite(railBed) && p.body <= 0) {
      const length = Math.hypot(p.x - next.x, p.y - next.y);
      const heights = [];
      for (const distance of [5, 8, 11]) {
        const x = p.x + ((p.x - next.x) / length) * distance;
        const y = p.y + ((p.y - next.y) / length) * distance;
        if (classify(x, y) === 0 && !lowerRailAt(x, y)) heights.push(ground(x, -y));
      }
      heights.sort((a, b) => a - b);
      if (heights.length) height = Math.max(height, heights[Math.floor(heights.length / 2)]);
    }
    return Math.max(minHeight, height);
  };
  let left = atBank(start, points[1]);
  let right = atBank(end, points.at(-2));
  if (start.body > 0) left = right;
  if (end.body > 0) right = left;
  return {
    a: { index: 0, height: left },
    b: { index: points.length - 1, height: right },
    start,
    span: end.distance - start.distance,
    thickness: road.foot ? 0.28 : 0.65,
  };
}

function direction(a, b) {
  const dx = b.x - a.x;
  const dz = a.y - b.y;
  const length = Math.hypot(dx, dz);
  return length > 0 ? [dx / length, dz / length] : [0, 0];
}

function deckSection(points, index, first, last, halfWidth, height) {
  const p = points[index];
  const previous = index > first && direction(points[index - 1], p);
  const next = index < last && direction(p, points[index + 1]);
  const [ux, uz] = previous || next;
  const [vx, vz] = next || previous;
  const length = Math.hypot(ux + vx, uz + vz);
  const miter = Math.min(1.5, 2 / length);
  const x = length > 1e-6 ? ((-(uz + vz) * miter) / length) * halfWidth : -uz * halfWidth;
  const z = length > 1e-6 ? (((ux + vx) * miter) / length) * halfWidth : ux * halfWidth;
  return [
    [p.x + x, height, -p.y + z],
    [p.x - x, height, -p.y - z],
  ];
}

function emitDeck(mesh, profiles, points, deck, road, approach) {
  const { a, b, start, span, thickness } = deck;
  const grade = (b.height - a.height) / span;
  const sidewalk = ['both', 'left', 'right'].includes(road.sidewalk) ? 1.4 : 0;
  const halfWidth = road.foot ? Math.max(0.6, road.width / 2) : Math.max(1.5, road.width / 2) + sidewalk;
  const lower = ([x, y, z]) => [x, y - thickness, z];
  let previous;
  for (let i = a.index; i <= b.index; i++) {
    const t = (points[i].distance - start.distance) / span;
    const section = deckSection(points, i, a.index, b.index, halfWidth, a.height + (b.height - a.height) * t + 0.025);
    if (previous) {
      const [ar, al] = previous;
      const [br, bl] = section;
      const quad = [ar, br, bl, al];
      mesh.extra(0.92).quad(...quad, DECK);
      mesh.extra(0.82).quad(lower(ar), lower(br), br, ar, STRUCTURE);
      mesh.quad(lower(bl), lower(al), al, bl, STRUCTURE);
      mesh.quad(lower(al), lower(bl), lower(br), lower(ar), STRUCTURE);
      if (i === a.index + 1) mesh.quad(lower(al), lower(ar), ar, al, STRUCTURE);
      if (i === b.index) mesh.quad(lower(br), lower(bl), bl, br, STRUCTURE);
      const [dx, dz] = direction(points[i - 1], points[i]);
      if (i === a.index + 1) approach.strip([al, ar], -dx, dz, -grade, { roadId: road.id, explicit: !!road.bridge });
      if (i === b.index) approach.strip([br, bl], dx, -dz, grade, { roadId: road.id, explicit: !!road.bridge });
      const top = ([x, y, z]) => [x, y + (road.foot ? 0.9 : 0.65), z];
      for (const [from, to] of [
        [ar, br],
        [bl, al],
      ]) {
        const end = top(to),
          begin = top(from);
        if (road.foot) {
          mesh.tube([begin, end], 0.043, DECK, 4, false);
          if ((i - a.index) % 3 === 1) mesh.tube([from, begin], 0.043, DECK, 4, false);
        } else {
          mesh.quad(from, to, end, begin, STRUCTURE);
          mesh.quad(to, from, begin, end, STRUCTURE);
        }
      }
      profiles.push({ roadId: road.id, explicit: !!road.bridge, quad });
    }
    previous = section;
  }
}

function wayOnFootprint(way, area, extent, work, pointCost) {
  if (
    way.tunnel ||
    way.ford ||
    way.bridgeDenied ||
    way.layer < 0 ||
    (area.layer && way.layer && way.layer !== area.layer)
  )
    return false;
  if (area.name && way.bridgeName && area.name !== way.bridgeName) return false;
  const points = way.points;
  const stride = Math.max(1, Math.floor((points.length - 1) / 24));
  for (let k = 0; k + 1 < points.length; k += stride) {
    if (++work.count > MAX_FOOTPRINT_MATCH_WORK) return false;
    const a = points[k],
      b = points[Math.min(points.length - 1, k + stride)];
    const clip = clipLine(a, b, extent);
    if (!clip) continue;
    const [start, end] = clip;
    for (const sample of [0.25, 0.5, 0.75]) {
      work.count += pointCost;
      if (work.count > MAX_FOOTPRINT_MATCH_WORK) return false;
      const t = start + (end - start) * sample;
      const x = a.x + (b.x - a.x) * t,
        y = a.y + (b.y - a.y) * t;
      if (pointInRing(x, y, area.ring) && !area.holes?.some((hole) => pointInRing(x, y, hole))) return true;
    }
  }
  return false;
}

function clipFootprintTriangle(triangle, bounds) {
  let polygon = triangle.map(({ x, y }) => [x, y]);
  for (const [axis, edge, sign] of [
    [0, bounds.x0, -1],
    [0, bounds.x1, 1],
    [1, bounds.y0, -1],
    [1, bounds.y1, 1],
  ])
    polygon = clipConvex(
      polygon,
      polygon.map((p) => (p[axis] - edge) * sign),
    );
  return polygon;
}

function footprintSurvey(ring, holes, ways, classify, waterLevels, ground, lowerRailAt) {
  const box = orientedBox(ring);
  let axisX = box.lx,
    axisY = box.ly;
  let score = 0;
  for (const way of ways) {
    const a = way.points[0],
      b = way.points.at(-1);
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const priority = length + (way.highway && !way.foot ? MAX_FOOTPRINT_SPAN : 0);
    if (length > 1 && priority > score) {
      axisX = (b.x - a.x) / length;
      axisY = (b.y - a.y) / length;
      score = priority;
    }
  }
  const along = (x, y) => (x - box.cx) * axisX + (y - box.cy) * axisY;
  const across = (x, y) => (y - box.cy) * axisX - (x - box.cx) * axisY;
  const u = ring.map(({ x, y }) => along(x, y));
  const v = ring.map(({ x, y }) => across(x, y));
  const start = Math.min(...u),
    end = Math.max(...u);
  const left = Math.min(...v),
    right = Math.max(...v);
  const at = (a, b) => [box.cx + a * axisX - b * axisY, box.cy + a * axisY + b * axisX];
  const crossSections = Math.min(64, Math.max(4, Math.ceil((end - start) / 2)));
  let water = -Infinity,
    railBed = -Infinity,
    wetStart = Infinity,
    wetEnd = -Infinity;
  for (let i = 0; i <= crossSections; i++) {
    const a = start + ((end - start) * i) / crossSections;
    for (const t of [0.2, 0.35, 0.5, 0.65, 0.8]) {
      const [x, y] = at(a, left + (right - left) * t);
      if (!pointInRing(x, y, ring) || holes.some((hole) => pointInRing(x, y, hole))) continue;
      if (classify(x, y) === 0 && lowerRailAt?.(x, y)) railBed = Math.max(railBed, ground(x, -y));
      const level = waterLevels[classify(x, y) - 1];
      if (!Number.isFinite(level)) continue;
      water = Math.max(water, level);
      wetStart = Math.min(wetStart, a);
      wetEnd = Math.max(wetEnd, a);
    }
  }
  const approach = (a, sign) => {
    const heights = [];
    const offsets = Number.isFinite(railBed) ? [5, 8, 11] : [0, 2, 5];
    for (const offset of offsets)
      for (const t of [0.3, 0.5, 0.7]) {
        const [x, y] = at(a + offset * sign, left + (right - left) * t);
        if (classify(x, y) !== 0 || lowerRailAt?.(x, y)) continue;
        const height = ground(x, -y);
        if (Number.isFinite(height)) heights.push(height);
      }
    heights.sort((a0, b0) => a0 - b0);
    return heights[Math.floor(heights.length / 2)];
  };
  const a = approach(start, -1),
    b = approach(end, 1);
  const fallback = ground(box.cx, -box.cy);
  const minimum = Math.max(water + 1.1, railBed + 5.1);
  const startHeight = Math.max(minimum, a ?? b ?? fallback);
  const endHeight = Math.max(minimum, b ?? a ?? fallback);
  const top = (x, y) => startHeight + ((endHeight - startHeight) * (along(x, y) - start)) / (end - start) + 0.025;
  return { along, top, water, wetStart, wetEnd, axisX, axisY };
}

function emitFootprint(mesh, profiles, area, ways, bounds, classify, waterLevels, ground, approach, lowerRailAt) {
  const ring = ringArea(area.ring) > 0 ? area.ring : [...area.ring].reverse();
  const holes = (area.holes ?? []).map((hole) => (ringArea(hole) < 0 ? hole : [...hole].reverse()));
  const survey = footprintSurvey(ring, holes, ways, classify, waterLevels, ground, lowerRailAt);
  if (!survey) return false;
  const { along, top, water, wetStart, wetEnd, axisX, axisY } = survey;
  const arch = area.structure === 'arch' && wetEnd - wetStart > 3;
  const archSteps = arch ? Math.min(32, Math.ceil((wetEnd - wetStart) / 2)) : 0;
  const archEdges = Array.from(
    { length: archSteps + 1 },
    (_, i) => wetStart + ((wetEnd - wetStart) * i) / (archSteps || 1),
  );
  const lower = (x, y) => {
    const ceiling = top(x, y) - 0.6;
    if (!arch) return ceiling;
    const phase = Math.max(0, Math.min(1, (along(x, y) - wetStart) / (wetEnd - wetStart)));
    return water - 0.4 + (ceiling - water + 0.4) * Math.sqrt(Math.max(0, 1 - (2 * phase - 1) ** 2));
  };
  const roadIds = [...new Set(ways.map((way) => way.id))];
  const { points, triangles } = triangulate(ring, holes);
  const point3 = ([x, y]) => [x, top(x, y), -y];
  const under = ([x, y]) => [x, lower(x, y), -y];
  const before = profiles.length;
  for (let i = 0; i < triangles.length; i += 3) {
    const polygon = clipFootprintTriangle(
      triangles.slice(i, i + 3).map((index) => points[index]),
      bounds,
    );
    if (polygon.length < 3) continue;
    const deck = polygon.map(point3);
    mesh.extra(0.92).poly(deck, DECK);
    for (let j = 1; j + 1 < deck.length; j++) {
      profiles.push({ footprintId: area.id, roadIds, explicit: true, quad: [deck[0], deck[j], deck[j + 1]] });
    }
    let remainder = polygon;
    for (const edge of arch ? archEdges : []) {
      const values = remainder.map(([x, y]) => along(x, y) - edge);
      const slice = clipConvex(remainder, values);
      if (slice.length > 2) mesh.extra(0.82).poly(slice.map(under).reverse(), STRUCTURE);
      remainder = clipConvex(
        remainder,
        values.map((v) => -v),
      );
      if (remainder.length < 3) break;
    }
    if (remainder.length > 2) mesh.extra(0.82).poly(remainder.map(under).reverse(), STRUCTURE);
  }
  if (profiles.length === before) return false;
  for (const boundary of [ring, ...holes])
    for (let i = 0; i < boundary.length; i++) {
      const a = boundary[i],
        b = boundary[(i + 1) % boundary.length];
      const clip = clipLine(a, b, bounds);
      if (!clip) continue;
      const dx = b.x - a.x,
        dy = b.y - a.y,
        length = Math.hypot(dx, dy);
      if (length < 1e-6) continue;
      const [first, last] = clip;
      const side = Math.abs(along(b.x, b.y) - along(a.x, a.y)) > length * 0.45;
      const knots = [first, last];
      const u = along(a.x, a.y),
        du = along(b.x, b.y) - u;
      if (arch && Math.abs(du) > 1e-6) {
        for (const edge of archEdges) {
          const t = (edge - u) / du;
          if (t > first && t < last) knots.push(t);
        }
        knots.sort((t0, t1) => t0 - t1);
      }
      const at = (t) => [a.x + dx * t, a.y + dy * t];
      const facing = (dy * axisX - dx * axisY) / length;
      if (boundary === ring && Math.abs(facing) >= 0.86) {
        const ux = Math.sign(facing) * axisX,
          uy = Math.sign(facing) * axisY;
        const grade = top(a.x + ux, a.y + uy) - top(a.x, a.y);
        approach.footprint([point3(at(first)), point3(at(last))], ux, uy, grade, {
          footprintId: area.id,
          roadIds,
          explicit: true,
        });
      }
      for (let j = 1; j < knots.length; j++) {
        const from = at(knots[j - 1]),
          to = at(knots[j]);
        mesh.quad(under(from), under(to), point3(to), point3(from), STRUCTURE);
      }
      if (side) {
        const from = point3(at(first)),
          to = point3(at(last));
        const tip = ([x, y, z], inset) => [x - (dy / length) * inset, y + 0.8, z - (dx / length) * inset];
        const a0 = tip(from, 0),
          b0 = tip(to, 0),
          a1 = tip(from, 0.24),
          b1 = tip(to, 0.24);
        mesh.quad(from, to, b0, a0, STRUCTURE);
        mesh.quad(a0, b0, b1, a1, STRUCTURE);
        mesh.quad(b1, [b1[0], to[1], b1[2]], [a1[0], from[1], a1[2]], a1, STRUCTURE);
      }
    }
  approach.finishFootprint();
  return true;
}

// Extend a deck across dry ground at its ends. The cubic has zero rate of change
// in its weight at either end, so the surface meets both the deck and the terrain.
function bridgeApproaches(mesh, profiles, ground, classify, bounds, blend, ways) {
  const connected = new Map();
  const endpoints = new Map();
  const key = ({ x, y }) => `${Math.round(x * 20)},${Math.round(y * 20)}`;
  const bridgeEnds = new Set();
  const register = (point, id) => {
    const ids = endpoints.get(point) ?? [];
    if (ids.length < 24 && !ids.includes(id)) ids.push(id);
    endpoints.set(point, ids);
  };
  for (const way of ways) {
    if (way.tunnel || way.ford || way.bridgeDenied || way.layer < 0 || !way.points.length) continue;
    const ends = [way.points[0], way.points.at(-1)];
    connected.set(way.id, ends);
    for (const end of ends) {
      const point = key(end);
      register(point, way.id);
      if (way.bridge) bridgeEnds.add(point);
    }
  }
  // A deck can meet a riverside path at an interior node of that path.
  if (bridgeEnds.size) {
    for (const way of ways) {
      if (!connected.has(way.id)) continue;
      for (let i = 1; i < way.points.length - 1; i++) {
        const point = key(way.points[i]);
        if (bridgeEnds.has(point)) register(point, way.id);
      }
    }
  }
  const approachIds = new Set();
  const related = (ids) => {
    const all = new Set(ids);
    for (const id of ids)
      for (const end of connected.get(id) ?? []) for (const next of endpoints.get(key(end)) ?? []) all.add(next);
    for (const id of all) approachIds.add(id);
    return [...all];
  };
  const bankAt = (edge, ux, uy, meta) => {
    const [a, b] = edge;
    const x = (a[0] + b[0]) / 2,
      z = (a[2] + b[2]) / 2,
      y = (a[1] + b[1]) / 2;
    const waysOnDeck = meta.roadIds ?? [meta.roadId];
    const threshold = Math.max(2, Math.hypot(a[0] - b[0], a[2] - b[2]) * 0.5 + 1);
    const hasLanding =
      meta.explicit &&
      waysOnDeck.some((id) =>
        connected
          .get(id)
          ?.some(
            (end) =>
              Math.hypot(end.x - x, end.y + z) < threshold &&
              endpoints.get(key(end))?.some((next) => !waysOnDeck.includes(next)),
          ),
      );
    for (let reach = 0.5; reach <= (hasLanding ? 4 : 1); reach += 0.5) {
      if (reach > 0.5 && !hasLanding && classify(x + 0.5 * ux, -z + 0.5 * uy) > 0) return;
      if (classify(x + reach * ux, -z + reach * uy) !== 0) continue;
      const gap = reach - 0.5;
      const dip = Math.max(
        0,
        y - ground(x + gap * ux, z - gap * uy),
        y - ground(x + (reach + 3) * ux, z - (reach + 3) * uy),
      );
      return { gap, dip };
    }
  };
  const emit = (edge, ux, uy, grade, meta, footprint, landing) => {
    if (!landing || (landing.dip < 0.08 && !meta.explicit)) return;
    const [a, b] = edge;
    const x = (a[0] + b[0]) / 2,
      z = (a[2] + b[2]) / 2;
    const { gap, dip } = landing;
    // Keep an overlap at a mapped abutment even when its grades already match.
    const length = Math.min(60, gap + (dip < 0.08 ? 1.6 : (10 + dip * 6) * blend));
    const rows = Math.max(4, Math.ceil(length / 1.25));
    const columns = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 1.5));
    if (profiles.length + rows * columns * 4 > MAX_SEGMENTS) return;
    const roadIds = related(meta.roadIds ?? [meta.roadId]);
    const at = (row, col) => {
      const t = row / rows,
        s = col / columns;
      const ax = a[0] + (b[0] - a[0]) * s + ux * length * t;
      const az = a[2] + (b[2] - a[2]) * s - uy * length * t;
      const terrain = ground(ax, az);
      const top = a[1] + (b[1] - a[1]) * s + grade * length * t;
      const blendAt = Math.max(0, (length * t - gap) / (length - gap));
      const weight = (1 - blendAt) * (1 - blendAt) * (1 + 2 * blendAt);
      // A small clearance at the tip avoids sharing the terrain's depth buffer.
      return [ax, terrain + (top - terrain) * weight + 0.02 * (1 - weight), az];
    };
    for (let row = 0; row < rows; row++) {
      const distance = ((row + 0.5) * length) / rows;
      if (distance > gap + 0.65 && classify(x + ux * distance, -z + uy * distance) > 0) break;
      for (let col = 0; col < columns; col++) {
        const quad = [at(row, col), at(row, col + 1), at(row + 1, col + 1), at(row + 1, col)];
        if (quad.some(([px, , pz]) => px < bounds.x0 || px > bounds.x1 || -pz < bounds.y0 || -pz > bounds.y1)) continue;
        if (
          (quad[1][2] - quad[0][2]) * (quad[2][0] - quad[0][0]) -
            (quad[1][0] - quad[0][0]) * (quad[2][2] - quad[0][2]) <
          0
        )
          quad.reverse();
        mesh.extra(0.92).quad(...quad, DECK);
        if (footprint) {
          const [p, q, r, s] = quad;
          profiles.push(
            { ...meta, roadIds, approach: true, quad: [p, q, r] },
            { ...meta, roadIds, approach: true, quad: [p, r, s] },
          );
        } else profiles.push({ ...meta, roadIds, approach: true, quad });
      }
    }
  };
  const groups = new Map();
  return {
    approachIds,
    footprint(edge, ux, uy, grade, meta) {
      const side = `${ux},${uy}`;
      const group = groups.get(side) ?? { ux, uy, grade, meta, edges: [] };
      group.edges.push(edge);
      groups.set(side, group);
    },
    finishFootprint() {
      for (const { ux, uy, grade, meta, edges } of groups.values()) {
        const banks = edges.map((edge) => bankAt(edge, ux, uy, meta));
        const dip = Math.max(0, ...banks.map((landing) => landing?.dip ?? 0));
        const gap = Math.max(0, ...banks.map((landing) => landing?.gap ?? 0));
        for (let i = 0; i < edges.length; i++) if (banks[i]) emit(edges[i], ux, uy, grade, meta, true, { dip, gap });
      }
      groups.clear();
    },
    strip(edge, ux, uy, grade, meta) {
      emit(edge, ux, uy, grade, meta, false, bankAt(edge, ux, uy, meta));
    },
  };
}

/** @param {{infer?: boolean, footprints?: any[], rails?: any[], blend?: number, lowerRailAt?: (x: number, y: number) => boolean}} [spec] */
export function buildWaterBridges(roads, field, waterIds, waterLevels, ground, budget, bounds, spec = {}) {
  const { infer = true, footprints = [], rails = [], blend = 1, lowerRailAt } = spec;
  const mesh = meshBuilder(4, budget);
  /** @type {WaterBridgeProfile[]} */
  const profiles = [];
  const roadIds = new Set();
  const hasWater = waterLevels.some(Number.isFinite);
  const { width, height, cell, x0, y0 } = field;
  const classify = (x, y) => {
    if (x < bounds.x0 || x > bounds.x1 || y < bounds.y0 || y > bounds.y1) return -1;
    const col = Math.min(width - 1, Math.max(0, Math.floor((x - x0) / cell)));
    const row = Math.min(height - 1, Math.max(0, Math.floor((y - y0) / cell)));
    const k = row * width + col;
    return waterIds?.[k] || (field.water[k] > cell / 2 ? 0 : -1);
  };
  const approach = bridgeApproaches(mesh, profiles, ground, classify, bounds, blend, [...roads, ...rails]);
  if (footprints.length) {
    const candidates = [];
    for (const group of [roads, rails])
      for (const way of group) {
        if (candidates.length >= MAX_BRIDGE_WAYS) break;
        if (way.points.length >= 2 && (way.bridge || way.bridgeName || way.layer > 0)) candidates.push(way);
      }
    const matchWork = { count: 0 };
    for (const area of footprints.slice(0, MAX_FOOTPRINTS)) {
      const pointCost = area.ring.length + (area.holes ?? []).reduce((n, h) => n + h.length, 0);
      if (area.ring.length < 3 || pointCost > MAX_FOOTPRINT_VERTICES) continue;
      const x = area.ring.map((p) => p.x),
        y = area.ring.map((p) => p.y);
      const extent = { x0: Math.min(...x), x1: Math.max(...x), y0: Math.min(...y), y1: Math.max(...y) };
      if (
        extent.x1 - extent.x0 > MAX_FOOTPRINT_SPAN ||
        extent.y1 - extent.y0 > MAX_FOOTPRINT_SPAN ||
        extent.x1 < bounds.x0 ||
        extent.x0 > bounds.x1 ||
        extent.y1 < bounds.y0 ||
        extent.y0 > bounds.y1
      )
        continue;
      const ways = candidates.filter((way) => wayOnFootprint(way, area, extent, matchWork, pointCost));
      if (emitFootprint(mesh, profiles, area, ways, bounds, classify, waterLevels, ground, approach, lowerRailAt))
        for (const way of ways) roadIds.add(way.id);
    }
  }
  const step = Math.max(0.6, Math.min(1.6, cell));
  const work = { count: 0 };
  for (const explicit of infer && hasWater ? [true, false] : [true]) {
    for (const road of roads) {
      if (++work.count >= MAX_SAMPLES || profiles.length >= MAX_SEGMENTS) break;
      if (
        !!road.bridge !== explicit ||
        road.tunnel ||
        road.ford ||
        road.bridgeDenied ||
        roadIds.has(road.id) ||
        road.layer < 0 ||
        road.points.length < 2
      )
        continue;
      for (const path of clippedRoad(road, bounds, step, work, classify)) {
        if (explicit) {
          const deck = mappedDeck(path, road, waterLevels, ground, lowerRailAt, classify);
          if (deck && profiles.length + path.length - 1 <= MAX_SEGMENTS)
            emitDeck(mesh, profiles, path, deck, road, approach);
          continue;
        }
        let start = 0;
        while (start < path.length) {
          const body = path[start].body;
          let end = start + 1;
          while (end < path.length && path[end].body === body) end++;
          if (body > 0) {
            const deck = fittedDeck(path, start, end - 1, road, waterLevels[body - 1], ground);
            if (deck && profiles.length + deck.b.index - deck.a.index <= MAX_SEGMENTS)
              emitDeck(mesh, profiles, path, deck, road, approach);
          }
          start = end;
        }
      }
    }
  }
  for (const profile of profiles) if ('roadId' in profile) roadIds.add(profile.roadId);
  return { mesh: mesh.finish(), profiles, roadIds: [...roadIds], approachIds: [...approach.approachIds] };
}

function profileIndex(profiles) {
  if (indexes.has(profiles)) return indexes.get(profiles);
  const index = new Map();
  for (const profile of profiles) {
    const xs = profile.quad.map((p) => Math.floor(p[0] / BUCKET_SIZE));
    const zs = profile.quad.map((p) => Math.floor(p[2] / BUCKET_SIZE));
    for (let i = Math.min(...xs); i <= Math.max(...xs); i++) {
      for (let j = Math.min(...zs); j <= Math.max(...zs); j++) {
        const key = `${i},${j}`;
        const bucket = index.get(key) ?? [];
        bucket.push(profile);
        index.set(key, bucket);
      }
    }
  }
  indexes.set(profiles, index);
  return index;
}

function triangleHeight(x, z, a, b, c) {
  const ux = b[0] - a[0];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vz = c[2] - a[2];
  const det = ux * vz - uz * vx;
  if (Math.abs(det) < 1e-8) return undefined;
  const s = ((x - a[0]) * vz - (z - a[2]) * vx) / det;
  const t = (ux * (z - a[2]) - uz * (x - a[0])) / det;
  if (s < -1e-6 || t < -1e-6 || s + t > 1.000001) return undefined;
  return a[1] + s * (b[1] - a[1]) + t * (c[1] - a[1]);
}

/**
 * @param {readonly WaterBridgeProfile[] | null | undefined} profiles
 * @param {number} x
 * @param {number} z
 * @param {number | string} [roadId]
 */
export function bridgeSurfaceHeight(profiles, x, z, roadId) {
  if (!profiles?.length) return undefined;
  const bucket = profileIndex(profiles).get(`${Math.floor(x / BUCKET_SIZE)},${Math.floor(z / BUCKET_SIZE)}`);
  if (!bucket) return undefined;
  let height;
  for (const profile of bucket) {
    if (
      roadId !== undefined &&
      profile.roadIds?.includes(roadId) !== true &&
      (!('roadId' in profile) || profile.roadId !== roadId)
    )
      continue;
    const [a, b, c, d] = profile.quad;
    const y = triangleHeight(x, z, a, b, c) ?? (d && triangleHeight(x, z, a, c, d));
    if (y !== undefined && (height === undefined || y > height)) height = y;
  }
  return height;
}
