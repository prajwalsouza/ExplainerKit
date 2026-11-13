import { assert, number, options, safeCopy } from '../../core/validate.js';

const compiled = new WeakSet(),
  MAX_PIECES = 256,
  MAX_POINTS = 8192;
const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function polygonArea(points) {
  if (points.length < 3) return 0;
  const p = points[0];
  let sum = 0;
  for (let i = 1; i < points.length - 1; i++) sum += cross(p, points[i], points[i + 1]);
  return sum / 2;
}
function epsilon(points) {
  let span = 0;
  const p = points[0];
  for (const q of points) span = Math.max(span, Math.abs(q.x - p.x), Math.abs(q.y - p.y));
  return Math.max(1, span) * 1e-10;
}
function clean(points) {
  if (points.length < 3) return [];
  const eps = epsilon(points),
    out = [];
  for (const p of points) if (!out.length || distance(p, out.at(-1)) > eps) out.push(p);
  if (out.length > 1 && distance(out[0], out.at(-1)) <= eps) out.pop();
  let changed = true;
  while (changed && out.length >= 3) {
    changed = false;
    for (let i = 0; i < out.length; i++) {
      const a = out[(i + out.length - 1) % out.length],
        b = out[i],
        c = out[(i + 1) % out.length];
      if (Math.abs(cross(a, b, c)) <= eps * (distance(a, b) + distance(b, c))) {
        out.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return out.length >= 3 && Math.abs(polygonArea(out)) > eps * eps ? out : [];
}
function capturePolygon(input) {
  const values = safeCopy(input);
  assert(
    Array.isArray(values) && values.length >= 3 && values.length <= 256,
    'INVALID_POLYGON',
    'Use 3–256 ordered vertices for one convex polygon.',
  );
  const points = values.map((p) => {
    options(p, ['x', 'y'], 'polygon vertex');
    return { x: number(p.x, 'polygon x', -1e6, 1e6), y: number(p.y, 'polygon y', -1e6, 1e6) };
  });
  // Collapse only adjacent duplicates and the optional closing point before
  // checking identity: repeated laps have valid half-planes but double area.
  const epsInput = epsilon(points),
    distinct = [];
  for (const p of points) if (!distinct.length || distance(p, distinct.at(-1)) > epsInput) distinct.push(p);
  if (distinct.length > 1 && distance(distinct[0], distinct.at(-1)) <= epsInput) distinct.pop();
  for (let i = 0; i < distinct.length; i++)
    for (let j = i + 1; j < distinct.length; j++)
      assert(
        distance(distinct[i], distinct[j]) > epsInput,
        'NONCONVEX_POLYGON',
        'A simple polygon cannot repeat a nonadjacent vertex or trace its contour more than once.',
      );
  const out = clean(points);
  assert(out.length >= 3, 'DEGENERATE_POLYGON', 'Polygon must have positive area.');
  if (polygonArea(out) < 0) out.reverse();
  const eps = epsilon(out);
  // A local positive turn is not sufficient: stars can keep their turn sign.
  // Every vertex must lie inside every directed edge of this convex contour.
  for (let i = 0; i < out.length; i++)
    for (const p of out) {
      const a = out[i],
        b = out[(i + 1) % out.length];
      assert(
        cross(a, b, p) >= -eps * distance(a, b),
        'NONCONVEX_POLYGON',
        'Use a simple convex polygon; concave, holes and self-crossing inputs need explicit convex pieces.',
      );
    }
  return out;
}
function finish(polygons, diagnostics = {}) {
  const cleaned = polygons.map(clean).filter((p) => p.length >= 3);
  assert(cleaned.length <= MAX_PIECES, 'RESOURCE_LIMIT', 'Shape operation exceeds 256 convex pieces.');
  assert(
    cleaned.reduce((n, p) => n + p.length, 0) <= MAX_POINTS,
    'RESOURCE_LIMIT',
    'Shape operation exceeds 8192 vertices.',
  );
  const frozen = Object.freeze(
    cleaned.map((p) =>
      Object.freeze(
        p.map((q) => Object.freeze({ x: number(q.x, 'output x', -1e6, 1e6), y: number(q.y, 'output y', -1e6, 1e6) })),
      ),
    ),
  );
  const commands = Object.freeze(
    frozen.flatMap((p) => [...p.map((q, i) => Object.freeze([i ? 'L' : 'M', q.x, q.y])), Object.freeze(['Z'])]),
  );
  const result = Object.freeze({
    polygons: frozen,
    commands,
    area: frozen.reduce((n, p) => n + Math.abs(polygonArea(p)), 0),
    diagnostics: Object.freeze({ method: 'convexHalfPlanes', partitionSeams: cleaned.length > 1, ...diagnostics }),
  });
  compiled.add(result);
  return result;
}
export function polygon(points) {
  return finish([capturePolygon(points)]);
}
export function asShape(value) {
  return compiled.has(value) ? value : polygon(value);
}
function plane(a, b) {
  const length = distance(a, b);
  return { origin: a, nx: -(b.y - a.y) / length, ny: (b.x - a.x) / length };
}
function clip(points, p, inside = true) {
  if (!points.length) return [];
  const eps = epsilon(points),
    sign = inside ? 1 : -1,
    signed = (q) => {
      const d = sign * ((q.x - p.origin.x) * p.nx + (q.y - p.origin.y) * p.ny);
      return Math.abs(d) <= eps ? 0 : d;
    },
    out = [];
  let previous = points.at(-1),
    last = signed(previous);
  for (const current of points) {
    const d = signed(current);
    if (last < 0 !== d < 0) {
      const t = last / (last - d);
      out.push({ x: previous.x + (current.x - previous.x) * t, y: previous.y + (current.y - previous.y) * t });
    }
    if (d >= 0) out.push(current);
    previous = current;
    last = d;
  }
  return clean(out);
}
function workBudget() {
  let work = 0;
  return (count) => {
    work += count;
    assert(work <= 2000000, 'RESOURCE_LIMIT', 'Polygon clipping work exceeds its bounded budget.');
  };
}
function intersection(a, b, tick) {
  let current = a;
  for (let i = 0; i < b.length && current.length; i++) {
    tick(current.length);
    current = clip(current, plane(b[i], b[(i + 1) % b.length]));
  }
  return current;
}
function difference(a, b, tick) {
  let current = a;
  const pieces = [];
  for (let i = 0; i < b.length && current.length; i++) {
    tick(current.length * 2);
    const boundary = plane(b[i], b[(i + 1) % b.length]),
      outside = clip(current, boundary, false);
    if (outside.length) pieces.push(outside);
    current = clip(current, boundary, true);
  }
  return pieces;
}
export function intersect(left, right) {
  const a = asShape(left),
    b = asShape(right),
    tick = workBudget(),
    out = [];
  for (const p of a.polygons)
    for (const q of b.polygons) {
      const r = intersection(p, q, tick);
      if (r.length) out.push(r);
      assert(out.length <= MAX_PIECES, 'RESOURCE_LIMIT', 'Intersection exceeds the piece budget.');
    }
  return finish(out);
}
export function subtract(left, right) {
  const a = asShape(left),
    b = asShape(right),
    tick = workBudget();
  let out = [...a.polygons];
  for (const q of b.polygons) {
    out = out.flatMap((p) => difference(p, q, tick));
    assert(out.length <= MAX_PIECES, 'RESOURCE_LIMIT', 'Subtraction exceeds the piece budget.');
  }
  return finish(out);
}
export function union(left, right) {
  const a = asShape(left),
    b = asShape(right),
    differenceShape = subtract(a, b);
  return finish([...differenceShape.polygons, ...b.polygons]);
}
export function centroid(value) {
  const shape = asShape(value);
  assert(shape.area > 0, 'DEGENERATE_POLYGON', 'An empty shape has no centroid.');
  let x = 0,
    y = 0,
    total = 0;
  for (const points of shape.polygons) {
    const p = points[0];
    for (let i = 1; i < points.length - 1; i++) {
      const q = points[i],
        r = points[i + 1],
        weight = Math.abs(cross(p, q, r));
      x += ((p.x + q.x + r.x) / 3) * weight;
      y += ((p.y + q.y + r.y) / 3) * weight;
      total += weight;
    }
  }
  return Object.freeze({ x: x / total, y: y / total });
}
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function contains(points, p) {
  const eps = epsilon(points);
  return points.every(
    (a, i) => cross(a, points[(i + 1) % points.length], p) >= -eps * distance(a, points[(i + 1) % points.length]),
  );
}
/** Seeded Voronoi cells clipped against actual source geometry, not duplicates. */
export function fracture(input, spec = {}) {
  options(spec, ['pieces', 'seed', 'sites'], 'fracture');
  const shape = asShape(input);
  assert(shape.area > 0, 'DEGENERATE_POLYGON', 'Fracture needs nonempty geometry.');
  const count = number(spec.pieces ?? 8, 'fracture count', 1, 64);
  assert(Number.isInteger(count), 'INVALID_FRACTURE', 'Piece count must be an integer.');
  const seed = number(spec.seed ?? 1, 'fracture seed', 0, 4294967295);
  assert(Number.isInteger(seed), 'INVALID_FRACTURE', 'Seed must be an integer.');
  const all = shape.polygons.flat(),
    bounds = {
      x0: Math.min(...all.map((p) => p.x)),
      x1: Math.max(...all.map((p) => p.x)),
      y0: Math.min(...all.map((p) => p.y)),
      y1: Math.max(...all.map((p) => p.y)),
    },
    random = rng(seed),
    sites = [];
  if (spec.sites !== undefined) {
    const values = safeCopy(spec.sites);
    assert(
      Array.isArray(values) && values.length === count,
      'INVALID_FRACTURE',
      'Provide exactly one site per requested piece.',
    );
    for (const p of values) {
      options(p, ['x', 'y'], 'fracture site');
      sites.push({ x: number(p.x, 'site x', -1e6, 1e6), y: number(p.y, 'site y', -1e6, 1e6) });
    }
  } else {
    let attempts = 0;
    while (sites.length < count) {
      assert(
        ++attempts <= 100000,
        'RESOURCE_LIMIT',
        'Could not sample distinct sites inside this thin/disconnected shape; supply explicit sites.',
      );
      const p = {
        x: bounds.x0 + random() * (bounds.x1 - bounds.x0),
        y: bounds.y0 + random() * (bounds.y1 - bounds.y0),
      };
      if (shape.polygons.some((poly) => contains(poly, p)) && sites.every((q) => distance(p, q) > 1e-8)) sites.push(p);
    }
  }
  for (let i = 0; i < sites.length; i++) {
    assert(
      shape.polygons.some((p) => contains(p, sites[i])),
      'INVALID_FRACTURE',
      'Sites must lie inside the source shape.',
    );
    assert(
      sites.slice(0, i).every((p) => distance(p, sites[i]) > 1e-8),
      'INVALID_FRACTURE',
      'Sites must be distinct.',
    );
  }
  const tick = workBudget(),
    pieces = sites.map((site, i) => {
      let polygons = [...shape.polygons];
      for (let j = 0; j < sites.length && polygons.length; j++)
        if (i !== j) {
          const other = sites[j],
            distanceToOther = distance(site, other),
            boundary = {
              origin: { x: (site.x + other.x) / 2, y: (site.y + other.y) / 2 },
              nx: (site.x - other.x) / distanceToOther,
              ny: (site.y - other.y) / distanceToOther,
            };
          polygons = polygons
            .map((p) => {
              tick(p.length);
              return clip(p, boundary);
            })
            .filter((p) => p.length);
        }
      const result = finish(polygons, { method: 'clippedVoronoi', index: i, seed });
      assert(result.area > 0, 'NUMERIC_DEGENERACY', 'A fracture cell collapsed at supported precision.');
      return Object.freeze({
        id: `piece-${i}`,
        shape: result,
        commands: result.commands,
        polygons: result.polygons,
        area: result.area,
        site: Object.freeze({ ...site }),
      });
    });
  assert(
    pieces.reduce((n, p) => n + p.polygons.reduce((k, q) => k + q.length, 0), 0) <= MAX_POINTS,
    'RESOURCE_LIMIT',
    'Fracture output exceeds the total vertex budget.',
  );
  return Object.freeze({
    pieces: Object.freeze(pieces),
    source: shape,
    seed,
    area: shape.area,
    diagnostics: Object.freeze({ method: 'clippedVoronoi', partition: true, exactArithmetic: false }),
  });
}
export { booleanPath, unionPaths, intersectPaths, subtractPaths, pathLoops } from './boolean.js';
