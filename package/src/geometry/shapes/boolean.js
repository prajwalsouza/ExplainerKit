import { assert, number, options } from '../../core/validate.js';
import { pathCommands } from '../../graphics/index.js';

const MAX_VERTICES = 20000,
  MAX_PAIRS = 16_000_000;

/** Flatten M/L/Q/C/Z commands into closed loops of points. Open subpaths are closed implicitly. */
export function pathLoops(commands, spec = {}) {
  options(spec, ['tolerance'], 'path loops');
  const tolerance = number(spec.tolerance ?? 0.25, 'flatten tolerance', 1e-6, 1e4),
    path = pathCommands(commands),
    loops = [];
  let loop = null,
    cursor = null,
    count = 0;
  const push = (x, y) => {
    const last = loop.at(-1);
    if (!last || last.x !== x || last.y !== y) {
      loop.push({ x, y });
      assert(++count <= MAX_VERTICES, 'RESOURCE_LIMIT', `Boolean operands are limited to ${MAX_VERTICES} vertices.`);
    }
  };
  const close = () => {
    if (loop) {
      if (loop.length > 1 && loop[0].x === loop.at(-1).x && loop[0].y === loop.at(-1).y) loop.pop();
      if (loop.length >= 3) loops.push(loop);
    }
    loop = null;
  };
  const curve = (points, at) => {
    let length = 0;
    for (let i = 1; i < points.length; i++)
      length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    const steps = Math.min(256, Math.max(2, Math.ceil(Math.sqrt(length / tolerance))));
    for (let i = 1; i <= steps; i++) {
      const p = at(i / steps);
      push(p.x, p.y);
    }
  };
  for (const [c, ...v] of path) {
    if (c === 'M') {
      close();
      loop = [];
      push(v[0], v[1]);
      cursor = { x: v[0], y: v[1] };
      continue;
    }
    if (c === 'Z') {
      close();
      continue;
    }
    if (!loop) {
      loop = [];
      push(cursor?.x ?? 0, cursor?.y ?? 0);
    }
    const p0 = loop.at(-1);
    if (c === 'L') push(v[0], v[1]);
    else if (c === 'Q') {
      const [x1, y1, x, y] = v;
      curve([p0, { x: x1, y: y1 }, { x, y }], (t) => ({
        x: (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * x1 + t * t * x,
        y: (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * y1 + t * t * y,
      }));
    } else {
      const [x1, y1, x2, y2, x, y] = v;
      curve([p0, { x: x1, y: y1 }, { x: x2, y: y2 }, { x, y }], (t) => ({
        x: (1 - t) ** 3 * p0.x + 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t * t * x2 + t ** 3 * x,
        y: (1 - t) ** 3 * p0.y + 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t * t * y2 + t ** 3 * y,
      }));
    }
    cursor = loop.at(-1);
  }
  close();
  return loops;
}

const signedArea = (loop) => {
  let s = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i],
      b = loop[(i + 1) % loop.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
};
function contains(loops, p) {
  let inside = false;
  for (const loop of loops)
    for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
      const a = loop[i],
        b = loop[j];
      if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
  return inside;
}
// Even-odd nesting decides orientation: outer boundaries counter-clockwise (positive), holes clockwise.
function orient(loops) {
  return loops.map((loop) => {
    const probe = loop.reduce((best, p) => (p.x < best.x ? p : best)),
      others = loops.filter((l) => l !== loop);
    let depth = 0;
    for (const other of others) if (contains([other], { x: probe.x, y: probe.y })) depth++;
    const positive = signedArea(loop) > 0;
    return positive === (depth % 2 === 0) ? loop : loop.toReversed();
  });
}

function edgesOf(loops, owner) {
  const edges = [];
  loops.forEach((loop) =>
    loop.forEach((a, i) => {
      const b = loop[(i + 1) % loop.length];
      edges.push({ owner, a, b, cuts: [] });
    }),
  );
  return edges;
}
function box(e) {
  return [Math.min(e.a.x, e.b.x), Math.min(e.a.y, e.b.y), Math.max(e.a.x, e.b.x), Math.max(e.a.y, e.b.y)];
}

/** Split both edge sets wherever they cross or overlap. Shared crossing points are one object on both sides. */
function split(left, right, eps) {
  assert(
    left.length * right.length <= MAX_PAIRS,
    'RESOURCE_LIMIT',
    'Boolean operands are too detailed; raise the flatten tolerance.',
  );
  const boxes = right.map(box);
  for (const e of left) {
    const [x0, y0, x1, y1] = box(e);
    right.forEach((f, k) => {
      const [u0, v0, u1, v1] = boxes[k];
      if (u0 > x1 + eps || u1 < x0 - eps || v0 > y1 + eps || v1 < y0 - eps) return;
      const r = { x: e.b.x - e.a.x, y: e.b.y - e.a.y },
        s = { x: f.b.x - f.a.x, y: f.b.y - f.a.y },
        q = { x: f.a.x - e.a.x, y: f.a.y - e.a.y },
        den = r.x * s.y - r.y * s.x,
        rr = r.x * r.x + r.y * r.y,
        ss = s.x * s.x + s.y * s.y;
      if (Math.abs(den) > eps * Math.sqrt(rr * ss)) {
        const t = (q.x * s.y - q.y * s.x) / den,
          u = (q.x * r.y - q.y * r.x) / den;
        if (t < -1e-12 || t > 1 + 1e-12 || u < -1e-12 || u > 1 + 1e-12) return;
        const point =
          t <= 1e-12
            ? e.a
            : t >= 1 - 1e-12
              ? e.b
              : u <= 1e-12
                ? f.a
                : u >= 1 - 1e-12
                  ? f.b
                  : { x: e.a.x + t * r.x, y: e.a.y + t * r.y };
        e.cuts.push({ t: Math.min(1, Math.max(0, t)), point });
        f.cuts.push({ t: Math.min(1, Math.max(0, u)), point });
      } else if (Math.abs(q.x * r.y - q.y * r.x) <= eps * Math.sqrt(rr)) {
        // Collinear: each segment is cut at the other's endpoints where they fall inside it.
        for (const p of [f.a, f.b]) {
          const t = ((p.x - e.a.x) * r.x + (p.y - e.a.y) * r.y) / rr;
          if (t > 1e-12 && t < 1 - 1e-12) e.cuts.push({ t, point: p });
        }
        for (const p of [e.a, e.b]) {
          const u = ((p.x - f.a.x) * s.x + (p.y - f.a.y) * s.y) / ss;
          if (u > 1e-12 && u < 1 - 1e-12) f.cuts.push({ t: u, point: p });
        }
      }
    });
  }
  const pieces = (edges) =>
    edges.flatMap((e) => {
      const points = [e.a, ...e.cuts.sort((a, b) => a.t - b.t).map((c) => c.point), e.b],
        out = [];
      for (let i = 1; i < points.length; i++) {
        const a = out.at(-1)?.b ?? points[0],
          b = points[i];
        if (Math.hypot(b.x - a.x, b.y - a.y) > eps) out.push({ owner: e.owner, a, b });
      }
      return out;
    });
  return [pieces(left), pieces(right)];
}

/** Inside, outside, or lying on the other boundary in the same or the opposite direction. */
function classify(edge, otherLoops, otherEdges, eps) {
  const m = { x: (edge.a.x + edge.b.x) / 2, y: (edge.a.y + edge.b.y) / 2 },
    d = { x: edge.b.x - edge.a.x, y: edge.b.y - edge.a.y };
  for (const f of otherEdges) {
    const s = { x: f.b.x - f.a.x, y: f.b.y - f.a.y },
      ss = s.x * s.x + s.y * s.y,
      t = ((m.x - f.a.x) * s.x + (m.y - f.a.y) * s.y) / ss;
    if (t < 0 || t > 1) continue;
    const px = f.a.x + t * s.x - m.x,
      py = f.a.y + t * s.y - m.y;
    if (Math.hypot(px, py) <= eps && Math.abs(d.x * s.y - d.y * s.x) <= 1e-6 * Math.sqrt((d.x * d.x + d.y * d.y) * ss))
      return d.x * s.x + d.y * s.y > 0 ? 'same' : 'opposite';
  }
  return contains(otherLoops, m) ? 'inside' : 'outside';
}

/** Chain kept edges end-to-start into closed loops. Points shared by construction compare exactly. */
function link(edges, eps) {
  const key = (p) => `${p.x},${p.y}`,
    starts = new Map();
  for (const e of edges) {
    const k = key(e.a);
    if (!starts.has(k)) starts.set(k, []);
    starts.get(k).push(e);
  }
  const used = new Set(),
    loops = [];
  const next = (p) => {
    const list = starts.get(key(p))?.filter((e) => !used.has(e));
    if (list?.length) return list[0];
    for (const e of edges) if (!used.has(e) && Math.hypot(e.a.x - p.x, e.a.y - p.y) <= eps) return e;
    return null;
  };
  for (const first of edges) {
    if (used.has(first)) continue;
    const loop = [];
    let e = first;
    while (e && !used.has(e)) {
      used.add(e);
      loop.push(e.a);
      if (e.b === first.a || Math.hypot(e.b.x - first.a.x, e.b.y - first.a.y) <= eps) break;
      e = next(e.b);
    }
    if (loop.length >= 3 && Math.abs(signedArea(loop)) > eps * eps) loops.push(loop);
  }
  return loops;
}

/**
 * Boolean of two filled outlines with any concavity and holes: 'union', 'intersect' or 'subtract' (a minus b).
 * Operands are path commands (curves flattened within tolerance) or loop arrays from pathLoops. Fill uses
 * even-odd nesting. The result keeps outer loops counter-clockwise and holes clockwise, so it draws with either
 * fill rule and strokes only real boundaries.
 */
export function booleanPath(operation, a, b, spec = {}) {
  assert(
    ['union', 'intersect', 'subtract'].includes(operation),
    'INVALID_BOOLEAN',
    'Use union, intersect or subtract.',
  );
  options(spec, ['tolerance'], 'boolean');
  const read = (v) =>
    Array.isArray(v) && Array.isArray(v[0]) && typeof v[0][0] === 'string' ? pathLoops(v, spec) : loopsFrom(v);
  const A = orient(read(a)),
    B = orient(read(b));
  const all = [...A, ...B].flat();
  let span = 1;
  if (all.length) {
    const xs = all.map((p) => p.x),
      ys = all.map((p) => p.y);
    span = Math.max(1, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  }
  const eps = span * 1e-9;
  const [ea, eb] = split(edgesOf(A, 'a'), edgesOf(B, 'b'), eps),
    kept = [];
  for (const e of ea) {
    const c = classify(e, B, eb, eps);
    if (
      operation === 'union'
        ? c === 'outside' || c === 'same'
        : operation === 'intersect'
          ? c === 'inside' || c === 'same'
          : c === 'outside' || c === 'opposite'
    )
      kept.push(e);
  }
  for (const e of eb) {
    const c = classify(e, A, ea, eps);
    if (operation === 'union' ? c === 'outside' : operation === 'intersect' ? c === 'inside' : c === 'inside')
      kept.push(operation === 'subtract' ? { owner: 'b', a: e.b, b: e.a } : e);
  }
  const loops = link(kept, eps),
    commands = [];
  for (const loop of loops) {
    loop.forEach((p, i) => commands.push(Object.freeze([i ? 'L' : 'M', p.x, p.y])));
    commands.push(Object.freeze(['Z']));
  }
  return Object.freeze({
    commands: Object.freeze(commands),
    loops: Object.freeze(loops.map((l) => Object.freeze(l.map((p) => Object.freeze({ x: p.x, y: p.y }))))),
    area: loops.reduce((n, l) => n + signedArea(l), 0),
  });
}
function loopsFrom(value) {
  assert(
    Array.isArray(value) && value.every((l) => Array.isArray(l)),
    'INVALID_BOOLEAN',
    'Operands are path commands or arrays of {x,y} loops.',
  );
  let count = 0;
  return value.map((loop) => {
    assert(loop.length >= 3, 'INVALID_BOOLEAN', 'Each loop needs at least three points.');
    return loop.map((p) => {
      options(p, ['x', 'y'], 'loop point');
      assert(++count <= MAX_VERTICES, 'RESOURCE_LIMIT', `Boolean operands are limited to ${MAX_VERTICES} vertices.`);
      return { x: number(p.x, 'x'), y: number(p.y, 'y') };
    });
  });
}
export const unionPaths = (a, b, spec) => booleanPath('union', a, b, spec);
export const intersectPaths = (a, b, spec) => booleanPath('intersect', a, b, spec);
export const subtractPaths = (a, b, spec) => booleanPath('subtract', a, b, spec);
