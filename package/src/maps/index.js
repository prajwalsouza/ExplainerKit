import { assert, number, options } from '../core/validate.js';
import { randomAt, seedValue } from '../noise/vector.js';
import { hsla, toHSLA } from '../color/space.js';
import { mix } from '../color/interpolate.js';

// Pure geography for relief maps: a local projection, heightfields, shading, water flow,
// rivers, contours, draping, colour ramps, cloud placement and river reveals. Nothing here
// fetches data, owns a clock or touches a renderer.

const EARTH_RADIUS = 6371008.8; // metres, the IUGG mean radius
const MAX_CELLS = 4_194_304; // 2048 x 2048 samples
const RAD = Math.PI / 180;

/**
 * A local projection for a region: longitude and latitude in degrees to metres east and north of
 * `center`. It is equirectangular, scaled by the cosine of the central latitude, which is accurate
 * enough at regional scale (a few hundred kilometres) but not for continents.
 */
export function localProjection(spec = {}) {
  options(spec, ['center'], 'localProjection');
  options(spec.center, ['lon', 'lat'], 'projection center');
  const lon0 = number(spec.center.lon, 'center longitude', -180, 180),
    lat0 = number(spec.center.lat, 'center latitude', -85, 85);
  const k = Math.cos(lat0 * RAD);
  return Object.freeze({
    center: Object.freeze({ lon: lon0, lat: lat0 }),
    project(lon, lat) {
      number(lon, 'longitude', -540, 540);
      number(lat, 'latitude', -90, 90);
      let d = lon - lon0;
      d = ((((d + 180) % 360) + 360) % 360) - 180;
      return Object.freeze({ x: EARTH_RADIUS * d * RAD * k, y: EARTH_RADIUS * (lat - lat0) * RAD });
    },
    unproject(x, y) {
      number(x, 'east metres', -2e7, 2e7);
      number(y, 'north metres', -2e7, 2e7);
      return Object.freeze({ lon: lon0 + x / (EARTH_RADIUS * RAD * k), lat: lat0 + y / (EARTH_RADIUS * RAD) });
    },
  });
}

/**
 * A validated grid of elevations in metres. `columns` x `rows` samples cover `bounds`
 * ({x0, y0, x1, y1} in region metres, y increasing north); row 0 is the north edge. Values can be
 * a plain array or a typed array; `noData` samples are refused rather than guessed.
 */
export function heightfield(spec = {}) {
  options(spec, ['columns', 'rows', 'values', 'bounds', 'seaLevel'], 'heightfield');
  const cols = number(spec.columns, 'columns', 2, 8192),
    rows = number(spec.rows, 'rows', 2, 8192);
  assert(
    Number.isInteger(cols) && Number.isInteger(rows),
    'INVALID_HEIGHTFIELD',
    'columns and rows must be whole numbers.',
  );
  assert(cols * rows <= MAX_CELLS, 'RESOURCE_LIMIT', `A heightfield holds at most ${MAX_CELLS} samples.`);
  const src = spec.values;
  assert(
    src && typeof src.length === 'number' && src.length === cols * rows,
    'INVALID_HEIGHTFIELD',
    `values must hold columns x rows = ${cols * rows} numbers.`,
  );
  const h = new Float64Array(cols * rows);
  let min = Infinity,
    max = -Infinity;
  for (let k = 0; k < h.length; k++) {
    const v = src[k];
    assert(
      typeof v === 'number' && Number.isFinite(v) && v > -12000 && v < 12000,
      'INVALID_HEIGHTFIELD',
      `Sample ${k} is not a finite elevation in metres.`,
    );
    h[k] = v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const b = spec.bounds ?? { x0: 0, y0: 0, x1: cols - 1, y1: rows - 1 };
  options(b, ['x0', 'y0', 'x1', 'y1'], 'heightfield bounds');
  const x0 = number(b.x0, 'bounds x0', -2e7, 2e7),
    y0 = number(b.y0, 'bounds y0', -2e7, 2e7),
    x1 = number(b.x1, 'bounds x1', x0 + 1e-9, 2e7),
    y1 = number(b.y1, 'bounds y1', y0 + 1e-9, 2e7);
  const dx = (x1 - x0) / (cols - 1),
    dy = (y1 - y0) / (rows - 1);
  const seaLevel = number(spec.seaLevel ?? 0, 'sea level', -12000, 12000);
  const toGrid = (x, y) => ({ i: (x - x0) / dx, j: (y1 - y) / dy });
  const at = (i, j) => h[Math.min(rows - 1, Math.max(0, j)) * cols + Math.min(cols - 1, Math.max(0, i))];
  const sampleGrid = (gi, gj) => {
    const i = Math.min(cols - 1, Math.max(0, gi)),
      j = Math.min(rows - 1, Math.max(0, gj));
    const i0 = Math.min(Math.floor(i), cols - 2),
      j0 = Math.min(Math.floor(j), rows - 2),
      a = i - i0,
      c = j - j0;
    return (
      (at(i0, j0) * (1 - a) + at(i0 + 1, j0) * a) * (1 - c) + (at(i0, j0 + 1) * (1 - a) + at(i0 + 1, j0 + 1) * a) * c
    );
  };
  return Object.freeze({
    columns: cols,
    rows,
    bounds: Object.freeze({ x0, y0, x1, y1 }),
    spacing: Object.freeze({ x: dx, y: dy }),
    min,
    max,
    seaLevel,
    /** The raw samples, row 0 first. A copy, so the field stays immutable. */
    values: () => Float64Array.from(h),
    /** Elevation at grid sample (i, j), clamped to the edge. */
    at(i, j) {
      return at(i, j);
    },
    /** Bilinear elevation at a region point in metres, clamped to the edge. */
    sample(x, y) {
      number(x, 'x', -2e7, 2e7);
      number(y, 'y', -2e7, 2e7);
      const g = toGrid(x, y);
      return sampleGrid(g.i, g.j);
    },
    /** Region coordinates of grid sample (i, j). */
    position(i, j) {
      return Object.freeze({ x: x0 + i * dx, y: y1 - j * dy });
    },
    /** Unit surface normal at a region point, with heights multiplied by `exaggeration`. z is up. */
    normal(x, y, exaggeration = 1) {
      number(exaggeration, 'exaggeration', 0, 1000);
      const g = toGrid(number(x, 'x', -2e7, 2e7), number(y, 'y', -2e7, 2e7));
      const ex = ((sampleGrid(g.i + 1, g.j) - sampleGrid(g.i - 1, g.j)) / (2 * dx)) * exaggeration;
      const ny = ((sampleGrid(g.i, g.j - 1) - sampleGrid(g.i, g.j + 1)) / (2 * dy)) * exaggeration;
      const l = Math.hypot(ex, ny, 1);
      return Object.freeze({ x: -ex / l, y: -ny / l, z: 1 / l });
    },
    /** Slope at a point in degrees. */
    slope(x, y, exaggeration = 1) {
      const n = this.normal(x, y, exaggeration);
      return Math.acos(Math.min(1, n.z)) / RAD;
    },
  });
}
const isField = (f) => f && typeof f.at === 'function' && Number.isInteger(f.columns) && typeof f.values === 'function';
const field = (f) => {
  assert(isField(f), 'INVALID_HEIGHTFIELD', 'Pass a heightfield made with heightfield().');
  return f;
};

/**
 * Lambert shading of the relief for a sun at `azimuth` degrees clockwise from north and
 * `altitude` degrees above the horizon. Returns brightness per sample in [0, 1], row 0 first.
 */
export function hillshade(f, spec = {}) {
  field(f);
  options(spec, ['azimuth', 'altitude', 'exaggeration'], 'hillshade');
  const az = number(spec.azimuth ?? 315, 'sun azimuth', -720, 720) * RAD,
    alt = number(spec.altitude ?? 45, 'sun altitude', 0, 90) * RAD,
    ex = number(spec.exaggeration ?? 1, 'exaggeration', 0, 1000);
  const sun = { x: Math.sin(az) * Math.cos(alt), y: Math.cos(az) * Math.cos(alt), z: Math.sin(alt) };
  const { columns: cols, rows } = f,
    { x: dx, y: dy } = f.spacing;
  const out = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const gx = ((f.at(i + 1, j) - f.at(i - 1, j)) / ((Math.min(cols - 1, i + 1) - Math.max(0, i - 1)) * dx)) * ex;
      const gy = ((f.at(i, j - 1) - f.at(i, j + 1)) / ((Math.min(rows - 1, j + 1) - Math.max(0, j - 1)) * dy)) * ex;
      const l = Math.hypot(gx, gy, 1);
      out[j * cols + i] = Math.max(0, (-gx * sun.x - gy * sun.y + sun.z) / l);
    }
  return out;
}

class MinHeap {
  constructor() {
    this.k = [];
    this.v = [];
  }
  get size() {
    return this.k.length;
  }
  push(key, value) {
    const k = this.k,
      v = this.v;
    let i = k.length;
    k.push(key);
    v.push(value);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] < k[i] || (k[p] === k[i] && v[p] <= v[i])) break;
      [k[p], k[i]] = [k[i], k[p]];
      [v[p], v[i]] = [v[i], v[p]];
      i = p;
    }
  }
  pop() {
    const k = this.k,
      v = this.v,
      top = v[0],
      lk = k.pop(),
      lv = v.pop();
    if (k.length) {
      k[0] = lk;
      v[0] = lv;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1,
          r = l + 1;
        let m = i;
        if (l < k.length && (k[l] < k[m] || (k[l] === k[m] && v[l] < v[m]))) m = l;
        if (r < k.length && (k[r] < k[m] || (k[r] === k[m] && v[r] < v[m]))) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]];
        [v[m], v[i]] = [v[i], v[m]];
        i = m;
      }
    }
    return top;
  }
}
const D8 = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

/**
 * Water flow over the terrain. Depressions are filled first (priority flood, Barnes et al. 2014),
 * so every land cell drains to the edge or the sea. Returns, per sample, the downstream neighbour
 * (-1 at an outlet), the filled surface and the accumulation (how many samples drain through it).
 */
export function flow(f, spec = {}) {
  field(f);
  options(spec, ['seaLevel'], 'flow');
  const sea = number(spec.seaLevel ?? f.seaLevel, 'sea level', -12000, 12000);
  const { columns: cols, rows } = f,
    n = cols * rows,
    filled = f.values(),
    done = new Uint8Array(n),
    down = new Int32Array(n).fill(-1);
  const heap = new MinHeap();
  // Seeds: the border and every sea sample are outlets.
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      if (i === 0 || j === 0 || i === cols - 1 || j === rows - 1 || filled[k] <= sea) {
        done[k] = 1;
        heap.push(filled[k], k);
      }
    }
  const order = [];
  while (heap.size) {
    const k = heap.pop();
    order.push(k);
    const i = k % cols,
      j = (k - i) / cols;
    for (const [di, dj] of D8) {
      const a = i + di,
        b = j + dj;
      if (a < 0 || b < 0 || a >= cols || b >= rows) continue;
      const q = b * cols + a;
      if (done[q]) continue;
      done[q] = 1;
      // A tiny rise keeps filled flats draining toward the spill point.
      if (filled[q] <= filled[k]) filled[q] = filled[k] + 1e-6;
      down[q] = k;
      heap.push(filled[q], q);
    }
  }
  const accumulation = new Float64Array(n).fill(1);
  for (let o = order.length - 1; o >= 0; o--) {
    const k = order[o];
    if (down[k] >= 0) accumulation[down[k]] += accumulation[k];
  }
  return Object.freeze({ columns: cols, rows, downstream: down, filled, accumulation, seaLevel: sea });
}

/**
 * River polylines in region metres, traced downstream from every sample whose drainage reaches
 * `threshold` samples. Tributaries end where they join a river already traced. Rivers are sorted
 * largest first and capped at `maxRivers`.
 */
export function rivers(f, flowResult, spec = {}) {
  field(f);
  options(spec, ['threshold', 'maxRivers', 'minLength', 'smooth'], 'rivers');
  const fl = flowResult;
  assert(
    fl && fl.columns === f.columns && fl.rows === f.rows && fl.accumulation,
    'INVALID_FLOW',
    'Pass the flow() result for this heightfield.',
  );
  const cols = f.columns,
    n = cols * f.rows;
  const threshold = number(spec.threshold ?? Math.max(20, n / 400), 'river threshold', 2, n);
  const maxRivers = number(spec.maxRivers ?? 200, 'max rivers', 1, 5000),
    minLength = number(spec.minLength ?? 3, 'min river samples', 2, 1e6),
    smooth = number(spec.smooth ?? 8, 'river smoothing passes', 0, 64);
  assert(Number.isInteger(smooth), 'INVALID_FLOW', 'smooth is a whole number of passes from 0 to 64.');
  const acc = fl.accumulation,
    down = fl.downstream;
  const isRiver = (k) => acc[k] >= threshold && f.at(k % cols, Math.floor(k / cols)) > fl.seaLevel;
  const hasRiverInflow = new Uint8Array(n);
  for (let k = 0; k < n; k++) if (isRiver(k) && down[k] >= 0) hasRiverInflow[down[k]] = 1;
  const heads = [];
  for (let k = 0; k < n; k++) if (isRiver(k) && !hasRiverInflow[k]) heads.push(k);
  const owned = new Int32Array(n).fill(-1),
    traced = [];
  // Trace the biggest drainage first, so the main stem is one long line.
  const mouthAcc = (k) => {
    let m = k,
      guard = 0;
    while (down[m] >= 0 && guard++ < n) m = down[m];
    return acc[m];
  };
  heads.sort((a, b) => mouthAcc(b) - mouthAcc(a) || a - b);
  for (const head of heads) {
    const path = [];
    let k = head,
      guard = 0;
    while (k >= 0 && guard++ < n) {
      path.push(k);
      if (owned[k] >= 0 && path.length > 1) break;
      owned[k] = traced.length;
      const i = k % cols,
        j = (k - i) / cols;
      if (f.at(i, j) <= fl.seaLevel) break;
      k = down[k];
    }
    if (path.length < minLength) continue;
    const mouth = path.at(-1);
    traced.push({
      points: Object.freeze(path.map((q) => f.position(q % cols, Math.floor(q / cols)))),
      along: path.map((q) => acc[q]),
      drainage: acc[mouth],
    });
  }
  traced.sort((a, b) => b.drainage - a.drainage);
  // Water traced cell by cell runs in 45-degree steps. Repeated neighbour averaging (a [1, 2, 1]
  // kernel per pass, close to a Gaussian over a few cells) rounds those steps off. Both ends stay
  // fixed, so a river still meets its tributary and the sea.
  const soften = (pts) => {
    let line = pts.map((p) => ({ x: p.x, y: p.y }));
    for (let pass = 0; pass < smooth && line.length > 2; pass++)
      line = line.map((p, k) =>
        k === 0 || k === line.length - 1
          ? p
          : { x: (line[k - 1].x + 2 * p.x + line[k + 1].x) / 4, y: (line[k - 1].y + 2 * p.y + line[k + 1].y) / 4 },
      );
    return Object.freeze(line.map((p) => Object.freeze(p)));
  };
  return Object.freeze(
    traced
      .slice(0, maxRivers)
      .map((r) =>
        Object.freeze({ points: soften(r.points), drainage: r.drainage, drainageAlong: Object.freeze(r.along) }),
      ),
  );
}

/**
 * Contour lines at `level` metres by marching squares. Returns polylines in region metres;
 * closed rings repeat their first point at the end.
 */
export function contours(f, level, spec = {}) {
  field(f);
  options(spec, ['maxSegments'], 'contours');
  number(level, 'contour level', -12000, 12000);
  const maxSegments = number(spec.maxSegments ?? 500000, 'max segments', 1, 4e6);
  const { columns: cols, rows } = f;
  const segs = [];
  const edge = (i0, j0, i1, j1) => {
    const a = f.at(i0, j0) - level,
      b = f.at(i1, j1) - level,
      t = a / (a - b);
    return [i0 + (i1 - i0) * t, j0 + (j1 - j0) * t];
  };
  for (let j = 0; j < rows - 1; j++)
    for (let i = 0; i < cols - 1; i++) {
      const c =
        (f.at(i, j) > level ? 8 : 0) |
        (f.at(i + 1, j) > level ? 4 : 0) |
        (f.at(i + 1, j + 1) > level ? 2 : 0) |
        (f.at(i, j + 1) > level ? 1 : 0);
      if (c === 0 || c === 15) continue;
      const top = () => edge(i, j, i + 1, j),
        right = () => edge(i + 1, j, i + 1, j + 1),
        bottom = () => edge(i, j + 1, i + 1, j + 1),
        left = () => edge(i, j, i, j + 1);
      const centre = (f.at(i, j) + f.at(i + 1, j) + f.at(i + 1, j + 1) + f.at(i, j + 1)) / 4 > level;
      const table = {
        1: [[left, bottom]],
        2: [[bottom, right]],
        3: [[left, right]],
        4: [[top, right]],
        5: centre
          ? [
              [left, top],
              [bottom, right],
            ]
          : [
              [left, bottom],
              [top, right],
            ],
        6: [[top, bottom]],
        7: [[left, top]],
        8: [[left, top]],
        9: [[top, bottom]],
        10: centre
          ? [
              [top, right],
              [left, bottom],
            ]
          : [
              [left, top],
              [bottom, right],
            ],
        11: [[top, right]],
        12: [[left, right]],
        13: [[bottom, right]],
        14: [[left, bottom]],
      };
      for (const [p, q] of table[c]) {
        const a = p(),
          b = q();
        // A corner exactly on the level gives a zero-length piece; it would split the line.
        if (Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9) continue;
        segs.push([a, b]);
        assert(segs.length <= maxSegments, 'RESOURCE_LIMIT', 'This contour has more segments than maxSegments allows.');
      }
    }
  // Join segments that share endpoints into polylines.
  const key = (p) => `${Math.round(p[0] * 1e6)},${Math.round(p[1] * 1e6)}`;
  const ends = new Map();
  segs.forEach((s, k) => {
    for (const p of s) {
      const kk = key(p);
      ends.set(kk, [...(ends.get(kk) ?? []), k]);
    }
  });
  const used = new Uint8Array(segs.length),
    lines = [];
  const extend = (line, from) => {
    for (let guard = 0; guard < segs.length; guard++) {
      const tail = line.at(-1),
        next = (ends.get(key(tail)) ?? []).find((k) => !used[k]);
      if (next === undefined) return;
      used[next] = 1;
      const s = segs[next];
      line.push(key(s[0]) === key(tail) ? s[1] : s[0]);
    }
  };
  for (let k = 0; k < segs.length; k++) {
    if (used[k]) continue;
    used[k] = 1;
    const line = [segs[k][0], segs[k][1]];
    extend(line);
    line.reverse();
    extend(line);
    lines.push(Object.freeze(line.map(([gi, gj]) => f.position(gi, gj))));
  }
  return Object.freeze(lines);
}

/**
 * Lay a polyline on the terrain: resample it every `step` metres and give each point the ground
 * height times `exaggeration`, plus `lift` so a river or road sits just above the surface.
 */
export function drape(points, f, spec = {}) {
  field(f);
  options(spec, ['step', 'exaggeration', 'lift', 'maxPoints'], 'drape');
  assert(
    Array.isArray(points) && points.length >= 2 && points.length <= 100000,
    'INVALID_PATH',
    'Drape a polyline of 2 to 100000 points.',
  );
  const pts = points.map((p) => {
    options(p, ['x', 'y', 'z'], 'path point');
    return { x: number(p.x, 'x', -2e7, 2e7), y: number(p.y, 'y', -2e7, 2e7) };
  });
  const step = number(spec.step ?? Math.min(f.spacing.x, f.spacing.y), 'drape step', 1e-6, 1e7),
    ex = number(spec.exaggeration ?? 1, 'exaggeration', 0, 1000),
    lift = number(spec.lift ?? 0, 'lift', -1e5, 1e5),
    maxPoints = number(spec.maxPoints ?? 200000, 'max points', 2, 2e6);
  const out = [];
  const push = (x, y) => {
    assert(out.length < maxPoints, 'RESOURCE_LIMIT', 'The draped path exceeds maxPoints. Use a larger step.');
    out.push(Object.freeze({ x, y, z: f.sample(x, y) * ex + lift }));
  };
  push(pts[0].x, pts[0].y);
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1],
      b = pts[k],
      d = Math.hypot(b.x - a.x, b.y - a.y),
      count = Math.max(1, Math.ceil(d / step));
    for (let s = 1; s <= count; s++) push(a.x + ((b.x - a.x) * s) / count, a.y + ((b.y - a.y) * s) / count);
  }
  return Object.freeze(out);
}

/** A colour ramp by elevation: stops are [{metres, color}] in increasing order. Returns an HSLA string. */
export function elevationRamp(stops) {
  assert(
    Array.isArray(stops) && stops.length >= 2 && stops.length <= 64,
    'INVALID_RAMP',
    'A ramp needs between 2 and 64 stops.',
  );
  const s = stops.map((stop) => {
    assert(stop && typeof stop === 'object', 'INVALID_RAMP', 'Each stop is {metres, color}.');
    const c = toHSLA(stop.color);
    return { m: number(stop.metres, 'stop metres', -12000, 12000), color: hsla(c.h, c.s, c.l, c.a) };
  });
  for (let k = 1; k < s.length; k++) assert(s[k].m > s[k - 1].m, 'INVALID_RAMP', 'Ramp stops must increase in metres.');
  return (metres) => {
    number(metres, 'elevation', -12000, 12000);
    if (metres <= s[0].m) return s[0].color;
    if (metres >= s.at(-1).m) return s.at(-1).color;
    let k = 1;
    while (s[k].m < metres) k++;
    return mix(s[k - 1].color, s[k].color, (metres - s[k - 1].m) / (s[k].m - s[k - 1].m));
  };
}

/**
 * Seeded cloud placement over high ground. Clouds favour higher samples, keep `spacing` apart,
 * stay outside every `avoid` circle (the subject of the current beat) and float at
 * `altitudeFactor` times the highest exaggerated peak. Work is bounded by `attempts` per cloud.
 */
export function placeClouds(f, spec = {}) {
  field(f);
  options(
    spec,
    ['seed', 'count', 'spacing', 'avoid', 'minElevation', 'altitudeFactor', 'exaggeration', 'attempts'],
    'placeClouds',
  );
  const seed = seedValue(spec.seed ?? 1),
    count = number(spec.count ?? 8, 'cloud count', 0, 500),
    attempts = number(spec.attempts ?? 40, 'attempts', 1, 500);
  const { x0, y0, x1, y1 } = f.bounds;
  const spacing = number(spec.spacing ?? Math.min(x1 - x0, y1 - y0) / 6, 'cloud spacing', 0, 1e7);
  const minElevation = number(spec.minElevation ?? f.min + (f.max - f.min) * 0.4, 'min elevation', -12000, 12000);
  const ex = number(spec.exaggeration ?? 1, 'exaggeration', 0, 1000),
    altitude = number(spec.altitudeFactor ?? 1.2, 'altitude factor', 0, 100) * f.max * ex;
  const avoid = (spec.avoid ?? []).map((c) => {
    options(c, ['x', 'y', 'radius'], 'avoid circle');
    return {
      x: number(c.x, 'avoid x', -2e7, 2e7),
      y: number(c.y, 'avoid y', -2e7, 2e7),
      r: number(c.radius, 'avoid radius', 0, 1e7),
    };
  });
  assert(avoid.length <= 100, 'RESOURCE_LIMIT', 'Avoid at most 100 circles.');
  const clouds = [];
  let tries = 0;
  for (let c = 0; c < count; c++)
    for (let a = 0; a < attempts; a++) {
      const n = c * attempts + a;
      tries++;
      const x = x0 + (x1 - x0) * randomAt(seed, n, 0),
        y = y0 + (y1 - y0) * randomAt(seed, n, 1);
      const h = f.sample(x, y);
      if (h < minElevation) continue;
      // Higher ground is more likely to hold a cloud.
      if (randomAt(seed, n, 2) > 0.25 + 0.75 * ((h - minElevation) / Math.max(1e-9, f.max - minElevation))) continue;
      if (avoid.some((q) => Math.hypot(q.x - x, q.y - y) < q.r)) continue;
      if (clouds.some((q) => Math.hypot(q.x - x, q.y - y) < spacing)) continue;
      clouds.push(
        Object.freeze({
          x,
          y,
          z: altitude,
          size: 0.7 + 0.6 * randomAt(seed, n, 3),
          sprite: Math.floor(randomAt(seed, n, 4) * 8),
          drift: randomAt(seed, n, 5) * 2 * Math.PI,
        }),
      );
      break;
    }
  return Object.freeze({ clouds: Object.freeze(clouds), missing: count - clouds.length, tries });
}

const EASES = {
  linear: (t) => t,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outCubic: (t) => 1 - (1 - t) ** 3,
};

/**
 * A river draw-on: reveal(time) gives the drawn fraction, the length drawn and the tip position.
 * Use the fraction to trim the river line and the tip to place its brighter head.
 */
export function riverReveal(points, spec = {}) {
  options(spec, ['at', 'duration', 'ease', 'headLength'], 'riverReveal');
  assert(
    Array.isArray(points) && points.length >= 2 && points.length <= 200000,
    'INVALID_PATH',
    'A river needs 2 to 200000 points.',
  );
  const pts = points.map((p) => ({
    x: number(p.x, 'x', -2e7, 2e7),
    y: number(p.y, 'y', -2e7, 2e7),
    z: number(p.z ?? 0, 'z', -2e7, 2e7),
  }));
  const at = number(spec.at ?? 0, 'reveal start', -86400, 86400),
    duration = number(spec.duration ?? 2.4, 'reveal duration', 0, 3600),
    head = number(spec.headLength ?? 0.04, 'head length', 0, 1);
  const ease = EASES[spec.ease ?? 'inOutCubic'];
  assert(ease, 'INVALID_EASE', `Use one of ${Object.keys(EASES).join(', ')}.`);
  const cumulative = [0];
  for (let k = 1; k < pts.length; k++)
    cumulative.push(
      cumulative[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y, pts[k].z - pts[k - 1].z),
    );
  const total = cumulative.at(-1);
  const pointAt = (d) => {
    let lo = 0,
      hi = pts.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (cumulative[m] <= d) lo = m;
      else hi = m;
    }
    const span = cumulative[hi] - cumulative[lo] || 1,
      t = Math.min(1, Math.max(0, (d - cumulative[lo]) / span));
    return Object.freeze({
      x: pts[lo].x + (pts[hi].x - pts[lo].x) * t,
      y: pts[lo].y + (pts[hi].y - pts[lo].y) * t,
      z: pts[lo].z + (pts[hi].z - pts[lo].z) * t,
    });
  };
  return Object.freeze({
    length: total,
    reveal(time) {
      number(time, 'time', -86400, 86400);
      const raw = duration === 0 ? (time >= at ? 1 : 0) : Math.min(1, Math.max(0, (time - at) / duration));
      const fraction = ease(raw);
      return Object.freeze({
        fraction,
        length: fraction * total,
        tip: pointAt(fraction * total),
        headStart: Math.max(0, fraction - head),
        drawing: raw > 0 && raw < 1,
      });
    },
  });
}
