import { assert } from '../../core/validate.js';

// The street field: a grid over the area that records, for every cell, how far it is from the
// nearest carriageway edge, centre line, footpath, water, grass and wall. A renderer shades the
// whole ground from it in one pass, so junctions merge without overlapping strips, kerbs stay
// crisp at any zoom, and the same numbers place lane markings, puddles, snow ruts and props.
//
// Distances are metres. Signed distances are negative inside the feature. Positions are map
// coordinates (x east, y north); the grid's row 0 is its southern edge.

const FAR = 64;
export const MAX_FIELD_CELLS = 2048 * 2048;

/** Road classes that carry painted lane markings by default. */
const MARKED = new Set([
  'motorway',
  'trunk',
  'primary',
  'secondary',
  'tertiary',
  'motorway_link',
  'trunk_link',
  'primary_link',
  'secondary_link',
]);
/** Codes for surfaces people walk or cycle on. */
export const footKinds = Object.freeze({ footway: 1, path: 1, cycleway: 2, pedestrian: 3, steps: 4, track: 5 });
export const greenKinds = Object.freeze({ grass: 1, park: 2, wood: 3 });

/** A bridge deck is shaded only by the ways that use it and the ways that join its ends. */
export function bridgeStreetField(osm, bounds, cell, deckIds, underpassIds, approachIds = []) {
  const upper = new Set([...deckIds, ...approachIds]);
  const lower = new Set(underpassIds);
  const pointKey = (p) => `${Math.round(p.x * 10)},${Math.round(p.y * 10)}`;
  const upperNodes = new Set();
  for (const way of osm.roads) if (upper.has(way.id)) for (const point of way.points) upperNodes.add(pointKey(point));
  const roads = osm.roads.filter(
    (way) =>
      !lower.has(way.id) &&
      !way.tunnel &&
      !(way.layer < 0) &&
      way.points.length > 1 &&
      (upper.has(way.id) || way.points.some((point) => upperNodes.has(pointKey(point)))),
  );
  const crossings = osm.crossings.filter((crossing) => upperNodes.has(pointKey(crossing)));
  return streetField({ roads, crossings, buildings: [], green: [], water: [] }, bounds, Math.max(0.6, cell)).field;
}

/**
 * Bake the street field for parsed map features. `bounds` is {x0, y0, x1, y1} in metres and
 * `cell` the size of a grid cell. Work is bounded by the cell count and by the band around
 * each feature, never by the whole grid per feature.
 */
export function streetField(osm, bounds, cell, separateWater = false) {
  const width = Math.max(2, Math.ceil((bounds.x1 - bounds.x0) / cell)),
    height = Math.max(2, Math.ceil((bounds.y1 - bounds.y0) / cell));
  assert(
    width * height <= MAX_FIELD_CELLS,
    'RESOURCE_LIMIT',
    `The street field holds at most ${MAX_FIELD_CELLS} cells. Use a larger cell or a smaller area.`,
  );
  const size = width * height;
  const make = (fill) => new Float32Array(size).fill(fill);
  const f = {
    width,
    height,
    cell,
    x0: bounds.x0,
    y0: bounds.y0,
    edge: make(FAR),
    centre: make(FAR),
    along: make(0),
    half: make(0),
    lanes: make(0),
    junction: make(FAR),
    zebra: make(FAR),
    foot: make(FAR),
    footKind: make(0),
    water: make(FAR),
    green: make(FAR),
    greenKind: make(0),
    wall: make(FAR),
    bridge: make(FAR),
    lamp: make(0),
    roof: make(0),
  };
  const road = new Int32Array(size).fill(-1);
  const waterIds = separateWater && osm.water.length ? new Uint32Array(size) : null;
  const cx = (x) => (x - bounds.x0) / cell - 0.5,
    cy = (y) => (y - bounds.y0) / cell - 0.5;
  // Visit every cell within `reach` metres of a segment.
  const nearSegment = (a, b, reach, visit) => {
    const i0 = Math.max(0, Math.floor(cx(Math.min(a.x, b.x) - reach))),
      i1 = Math.min(width - 1, Math.ceil(cx(Math.max(a.x, b.x) + reach))),
      j0 = Math.max(0, Math.floor(cy(Math.min(a.y, b.y) - reach))),
      j1 = Math.min(height - 1, Math.ceil(cy(Math.max(a.y, b.y) + reach)));
    const dx = b.x - a.x,
      dy = b.y - a.y,
      l2 = dx * dx + dy * dy;
    for (let j = j0; j <= j1; j++) {
      const py = bounds.y0 + (j + 0.5) * cell;
      for (let i = i0; i <= i1; i++) {
        const px = bounds.x0 + (i + 0.5) * cell;
        const t = l2 ? Math.min(1, Math.max(0, ((px - a.x) * dx + (py - a.y) * dy) / l2)) : 0;
        const d = Math.hypot(px - a.x - dx * t, py - a.y - dy * t);
        if (d <= reach) visit(j * width + i, d, t);
      }
    }
  };

  // -------------------------------------------------------------------------- roads
  const cars = [];
  osm.roads.forEach((r, index) => {
    if (r.tunnel || r.points.length < 2) return;
    if (r.foot) {
      const half = Math.max(0.6, r.width / 2),
        kind = footKinds[r.highway] ?? 1;
      for (let k = 0; k + 1 < r.points.length; k++)
        nearSegment(r.points[k], r.points[k + 1], half + 3, (c, d) => {
          const v = d - half;
          if (v < f.foot[c]) {
            f.foot[c] = v;
            f.footKind[c] = kind;
          }
        });
      return;
    }
    const half = Math.max(1.5, r.width / 2);
    const marks = MARKED.has(r.highway) || (!r.inferred.includes('lanes') && r.lanes >= 2) ? r.lanes : 0;
    const lanes = marks + (r.oneway ? 0.5 : 0);
    let s = 0;
    cars.push({ road: r, index, half });
    for (let k = 0; k + 1 < r.points.length; k++) {
      const a = r.points[k],
        b = r.points[k + 1],
        len = Math.hypot(b.x - a.x, b.y - a.y);
      nearSegment(a, b, half + 8, (c, d, t) => {
        const v = d - half;
        if (v < f.edge[c]) {
          f.edge[c] = v;
          f.centre[c] = d;
          f.along[c] = s + t * len;
          f.half[c] = half;
          f.lanes[c] = lanes;
          road[c] = index;
        }
      });
      if (r.bridge)
        nearSegment(a, b, half + 4, (c, d) => {
          f.bridge[c] = Math.min(f.bridge[c], d - half - 2.4);
        });
      s += len;
    }
  });
  // Bridges for footpaths too, so a path over a canal keeps its deck.
  for (const r of osm.roads)
    if (r.foot && r.bridge && !r.tunnel)
      for (let k = 0; k + 1 < r.points.length; k++)
        nearSegment(r.points[k], r.points[k + 1], r.width / 2 + 3, (c, d) => {
          f.bridge[c] = Math.min(f.bridge[c], d - r.width / 2 - 0.6);
        });

  // Reserve the whole surface track, including between its mapped vertices.
  // Add half a cell diagonal because placement samples the nearest cell centre.
  const cellAllowance = cell * Math.SQRT1_2;
  const surfaceTracks = [
    ...(osm.rails ?? []).filter((track) => !track.tunnel && Array.isArray(track.points) && track.points.length > 1),
    ...osm.roads.filter((r) => !r.tunnel && r.foot && r.tramTrack && r.points.length > 1),
  ];
  const trackCells = surfaceTracks.length ? new Uint8Array(size) : null;
  const treeClearance = 1;
  const lowerRail = 2;
  for (const track of surfaceTracks) {
    const clearance = Math.max(1.5, (track.gauge ?? 1.435) / 2 + 0.8, (track.width ?? 0) / 2 + 0.35) + cellAllowance;
    const lower = track.kind === 'rail' && !track.bridge && !(track.layer > 0);
    const railReach = Math.max(0.6, cellAllowance);
    for (let k = 1; k < track.points.length; k++)
      nearSegment(track.points[k - 1], track.points[k], clearance, (c, d) => {
        trackCells[c] |= treeClearance;
        if (lower && d <= railReach) trackCells[c] |= lowerRail;
      });
  }

  // Junctions: points where three or more road ends meet, or one road ends on another.
  const nodes = new Map();
  const key = (p) => `${Math.round(p.x * 10)},${Math.round(p.y * 10)}`;
  for (const { road: r } of cars)
    r.points.forEach((p, i) => {
      const k = key(p);
      const n = nodes.get(k) ?? { x: p.x, y: p.y, arms: 0, roads: new Set(), width: 0 };
      n.arms += i === 0 || i === r.points.length - 1 ? 1 : 2;
      n.roads.add(r.id);
      n.width = Math.max(n.width, r.width);
      nodes.set(k, n);
    });
  const junctions = [];
  for (const n of nodes.values())
    if (n.roads.size >= 2 && n.arms >= 3) junctions.push({ x: n.x, y: n.y, arms: n.arms, width: n.width });
  for (const j of junctions)
    nearSegment(j, j, 32, (c, d) => {
      f.junction[c] = Math.min(f.junction[c], d);
    });

  // Crossings: record the distance along the road from the crossing, for the stripes.
  const crossings = [];
  for (const x of osm.crossings) {
    if (x.kind === 'unmarked') continue;
    const i = Math.round(cx(x.x)),
      j = Math.round(cy(x.y));
    if (i < 0 || j < 0 || i >= width || j >= height) continue;
    const c = j * width + i;
    if (road[c] < 0 || f.edge[c] > 0.5) continue;
    const id = road[c],
      s0 = f.along[c],
      reach = f.half[c] + 5;
    crossings.push({ x: x.x, y: x.y, kind: x.kind, road: id, half: f.half[c] });
    nearSegment(x, x, reach, (k) => {
      if (road[k] !== id) return;
      const d = f.along[k] - s0;
      if (Math.abs(d) < Math.abs(f.zebra[k])) f.zebra[k] = d;
    });
  }

  // ------------------------------------------------------------------------- areas
  const rasterArea = (target, kindTarget, kind, ring, holes, band, interiorOnly = false) => {
    // Inside cells by scanline, across the ring and its holes together (even-odd rule).
    const rings = [ring, ...holes];
    let y0 = Infinity,
      y1 = -Infinity;
    for (const p of ring) {
      y0 = Math.min(y0, p.y);
      y1 = Math.max(y1, p.y);
    }
    const j0 = Math.max(0, Math.floor(cy(y0))),
      j1 = Math.min(height - 1, Math.ceil(cy(y1)));
    const edges = [];
    for (const rg of rings)
      for (let i = 0, n = rg.length; i < n; i++) {
        const a = rg[i];
        const b = rg[(i + 1) % n];
        if (Math.max(a.y, b.y) >= bounds.y0 - band && Math.min(a.y, b.y) <= bounds.y1 + band) edges.push([a, b]);
      }
    const inside = new Set();
    for (let j = j0; j <= j1; j++) {
      const py = bounds.y0 + (j + 0.5) * cell;
      const xs = [];
      for (const [a, b] of edges) if (a.y > py !== b.y > py) xs.push(a.x + ((py - a.y) * (b.x - a.x)) / (b.y - a.y));
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const i0 = Math.max(0, Math.ceil(cx(xs[k]))),
          i1 = Math.min(width - 1, Math.floor(cx(xs[k + 1])));
        for (let i = i0; i <= i1; i++) {
          const c = j * width + i;
          inside.add(c);
          if (interiorOnly && !kindTarget[c]) kindTarget[c] = kind;
          if (target[c] > -band) {
            target[c] = -band;
            if (kindTarget && !interiorOnly) kindTarget[c] = kind;
          }
        }
      }
    }
    // Exact distance in a band around every edge.
    for (const [a, b] of edges)
      nearSegment(a, b, band, (c, d) => {
        const wet = inside.has(c);
        if (wet) {
          if (-d > target[c] || target[c] === -band) target[c] = Math.max(-d, -band);
        } else if (d < target[c]) {
          target[c] = d;
          if (kindTarget && !interiorOnly && d < 1) kindTarget[c] = kind;
        }
      });
  };
  for (const [index, w] of osm.water.entries())
    rasterArea(f.water, waterIds, index + 1, w.ring, w.holes, 6, !!waterIds);
  for (const g of osm.green) rasterArea(f.green, f.greenKind, greenKinds[g.kind] ?? 1, g.ring, g.holes, 4);
  for (const b of osm.buildings) if (b.minHeight < 1) rasterArea(f.wall, null, 0, b.ring, b.holes, 5);
  // How high the roofs stand over each cell. Light is traced against this: a ray from a point
  // to a lamp or to the sky is blocked where it passes below a roof.
  for (const b of osm.buildings) {
    const rings = [b.ring, ...b.holes];
    let lo = Infinity,
      hi = -Infinity;
    for (const p of b.ring) {
      lo = Math.min(lo, p.y);
      hi = Math.max(hi, p.y);
    }
    const j0 = Math.max(0, Math.floor(cy(lo))),
      j1 = Math.min(height - 1, Math.ceil(cy(hi)));
    for (let j = j0; j <= j1; j++) {
      const py = bounds.y0 + (j + 0.5) * cell;
      const xs = [];
      for (const rg of rings)
        for (let i = 0, n = rg.length; i < n; i++) {
          const a = rg[i],
            c = rg[(i + 1) % n];
          if (a.y > py !== c.y > py) xs.push(a.x + ((py - a.y) * (c.x - a.x)) / (c.y - a.y));
        }
      xs.sort((a, c) => a - c);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const i0 = Math.max(0, Math.ceil(cx(xs[k]))),
          i1 = Math.min(width - 1, Math.floor(cx(xs[k + 1])));
        for (let i = i0; i <= i1; i++) f.roof[j * width + i] = Math.max(f.roof[j * width + i], b.height);
      }
    }
  }

  const cellAt = (x, y) => {
    const i = Math.min(width - 1, Math.max(0, Math.round(cx(x)))),
      j = Math.min(height - 1, Math.max(0, Math.round(cy(y))));
    return j * width + i;
  };
  const sample = (name, x, y) => f[name][cellAt(x, y)];
  const clearOfTransport = (x, y) => {
    const i = cellAt(x, y);
    return f.edge[i] >= 0.35 + cellAllowance && !trackCells?.[i];
  };
  const lowerRailAt = (x, y) => trackCells !== null && (trackCells[cellAt(x, y)] & lowerRail) !== 0;
  const scatterLeaves = (x, y, radius) => {
    const leaves = (f.leaves ??= make(0));
    const centre = { x, y };
    nearSegment(centre, centre, radius, (c, d) => {
      const falloff = 1 - (d / radius) ** 2;
      leaves[c] = Math.min(1, leaves[c] + falloff * falloff * 0.9);
    });
  };
  /** Add the pool of light under a lamp to the field. */
  const light = (x, y, radius = 15, strength = 1) => {
    nearSegment({ x, y }, { x, y }, radius, (c, d) => {
      const fall = 1 / (1 + (d / (radius * 0.24)) ** 2),
        edge = 1 - (d / radius) ** 2;
      f.lamp[c] = Math.min(4, f.lamp[c] + strength * fall * edge * edge);
    });
  };
  return {
    field: f,
    waterIds,
    junctions,
    crossings,
    cars,
    sample,
    clearOfTransport,
    lowerRailAt,
    scatterLeaves,
    light,
  };
}

/** Points every `step` metres along a road, with the direction of travel at each. */
export function alongRoad(points, step, start = 0) {
  const out = [];
  let carry = start;
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i],
      b = points[i + 1],
      len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-6) continue;
    const dx = (b.x - a.x) / len,
      dy = (b.y - a.y) / len;
    let d = carry;
    for (; d < len; d += step) out.push({ x: a.x + dx * d, y: a.y + dy * d, dx, dy });
    carry = d - len;
  }
  return out;
}
