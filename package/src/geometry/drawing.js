import { assert, number, options, safeCopy } from '../core/validate.js';
import { validateProperty } from '../core/geometry.js';
import { measurePath } from './path.js';
import { seedValue, randomAt } from '../noise/vector.js';
const freeze = (commands) => Object.freeze(commands.map((c) => Object.freeze(c)));
const integer = (v, label, min, max) => {
  number(v, label, min, max);
  assert(Number.isInteger(v), 'INVALID_POINTS', `${label} must be an integer.`);
  return v;
};
function contours(input, spec) {
  const commands = validateProperty('path', 'commands', safeCopy(input)),
    parts = [];
  let current = [];
  for (const c of commands) {
    if (c[0] === 'M' && current.length) {
      parts.push(current);
      current = [];
    }
    current.push(c);
  }
  if (current.length) parts.push(current);
  assert(parts.length > 0 && parts.length <= 1024, 'RESOURCE_LIMIT', 'A drawing accepts 1–1024 contours.');
  let count = 0;
  return Object.freeze(
    parts.map((c) => {
      const p = measurePath(c, { tolerance: spec.tolerance ?? 0.25, maxPoints: spec.maxPoints ?? 8192 });
      count += p.points.length;
      assert(count <= 32768, 'RESOURCE_LIMIT', 'Drawing exceeds its total flattened point budget.');
      return p;
    }),
  );
}
/** Prepared arc-length path, including disconnected contours without linking their gaps. */
export class Line {
  constructor(commands, spec = {}) {
    options(spec, ['tolerance', 'maxPoints'], 'line');
    this.contours = contours(commands, spec);
    this.length = this.contours.reduce((n, p) => n + p.length, 0);
    this.closed = this.contours.length === 1 && this.contours[0].closed;
    Object.freeze(this);
  }
  at(fraction) {
    number(fraction, 'line fraction', 0, 1);
    const d = fraction * this.length;
    let start = 0;
    for (let i = 0; i < this.contours.length; i++) {
      const p = this.contours[i];
      if (d <= start + p.length || i === this.contours.length - 1)
        return Object.freeze({ ...p.at(Math.max(0, Math.min(1, (d - start) / p.length))), contour: i });
      start += p.length;
    }
  }
  trim(start = 0, end = 1) {
    number(start, 'trim start', 0, 1);
    number(end, 'trim end', start, 1);
    const output = [];
    let offset = 0;
    for (const p of this.contours) {
      const a = Math.max(0, (start * this.length - offset) / p.length),
        b = Math.min(1, (end * this.length - offset) / p.length);
      if (b > a) output.push(...p.trim(a, b));
      offset += p.length;
    }
    assert(output.length <= 10000, 'RESOURCE_LIMIT', 'Trimmed drawing exceeds the path command budget.');
    return freeze(output);
  }
}
/** Reveal compound outlines by concatenated length, or each contour at the same fraction. */
export function outlineDraw(commands, spec = {}) {
  options(spec, ['progress', 'mode', 'tolerance', 'maxPoints'], 'outline draw');
  const progress = number(spec.progress ?? 1, 'outline progress', 0, 1),
    mode = spec.mode ?? 'length';
  assert(['length', 'each'].includes(mode), 'INVALID_PATH_RANGE', 'Use length or each contour reveal.');
  const line = new Line(commands, { tolerance: spec.tolerance ?? 0.25, maxPoints: spec.maxPoints ?? 8192 });
  if (mode === 'length') return line.trim(0, progress);
  const result = progress === 0 ? [] : line.contours.flatMap((p) => p.trim(0, progress));
  assert(result.length <= 10000, 'RESOURCE_LIMIT', 'Outlined drawing exceeds the command budget.');
  return freeze(result);
}
/** Uniform arc-length samples. A closed single contour omits its duplicated endpoint. */
export function samplePath(commands, count, spec = {}) {
  options(spec, ['tolerance', 'maxPoints'], 'path samples');
  integer(count, 'sample count', 1, 8192);
  const line = new Line(commands, spec);
  return Object.freeze(
    Array.from({ length: count }, (_, i) => {
      const p = line.at(count === 1 ? 0 : i / (line.closed ? count : count - 1));
      return Object.freeze({ x: p.x, y: p.y });
    }),
  );
}
/** Explicit bijections; nearest is deterministic greedy matching, not a global optimum. */
export function pairPoints(from, to, spec = {}) {
  options(spec, ['by'], 'point pairing');
  const a = safeCopy(from),
    b = safeCopy(to),
    by = spec.by ?? 'nearest';
  assert(['x', 'nearest', 'arc'].includes(by), 'INVALID_POINTS', 'Use x, nearest or arc pairing.');
  assert(
    Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.length <= 8192,
    'INVALID_POINTS',
    'Pair equal point arrays of at most 8192 points.',
  );
  for (const p of [...a, ...b]) {
    options(p, ['x', 'y', 'z'], 'pair point');
    number(p.x, 'point x');
    number(p.y, 'point y');
    if (p.z !== undefined) number(p.z, 'point z');
  }
  assert(
    by !== 'nearest' || a.length <= 2048,
    'RESOURCE_LIMIT',
    'Greedy nearest pairing supports at most 2048 points.',
  );
  const order = a.map((_, i) => i),
    targets = b.map((_, i) => i),
    map = [];
  if (by === 'x') {
    const compare = (points) => (i, j) => points[i].x - points[j].x || points[i].y - points[j].y || i - j;
    order.sort(compare(a));
    targets.sort(compare(b));
  }
  if (by === 'nearest') {
    const remaining = new Set(targets);
    for (const i of order) {
      let best = -1,
        distance = Infinity;
      for (const j of remaining) {
        const d = (a[i].x - b[j].x) ** 2 + (a[i].y - b[j].y) ** 2 + ((a[i].z ?? 0) - (b[j].z ?? 0)) ** 2;
        if (d < distance) {
          distance = d;
          best = j;
        }
      }
      map[i] = best;
      remaining.delete(best);
    }
  } else for (let i = 0; i < order.length; i++) map[order[i]] = targets[i];
  return Object.freeze(a.map((p, i) => Object.freeze({ from: p, to: b[map[i]], fromIndex: i, toIndex: map[i] })));
}
/** Filled variable-width ribbon; bevel-like sampled joins, explicit butt endpoints. */
export function inkStroke(commands, spec = {}) {
  options(spec, ['width', 'taper', 'tremor', 'seed', 'samples', 'tolerance'], 'ink stroke');
  const samples = integer(spec.samples ?? 256, 'ink samples', 2, 2048),
    taper = number(spec.taper ?? 0, 'ink taper', 0, 0.5),
    tremor = number(spec.tremor ?? 0, 'ink tremor', 0, 1e4),
    seed = seedValue(spec.seed),
    width = spec.width ?? 3;
  assert(
    typeof width === 'function' || typeof width === 'number',
    'INVALID_INK',
    'Width must be a number or a pure function of arc fraction.',
  );
  if (typeof width === 'number') number(width, 'ink width', 0, 1e5);
  const line = new Line(commands, { tolerance: spec.tolerance ?? 0.25 });
  let total = 0;
  const result = [];
  for (const contour of line.contours) {
    const n = Math.max(2, Math.ceil((samples * contour.length) / line.length));
    const left = [],
      right = [];
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1),
        global = (total + u * contour.length) / line.length,
        p = contour.at(u),
        w = number(typeof width === 'function' ? width(global) : width, 'sampled ink width', 0, 1e5),
        edge = taper === 0 ? 1 : Math.min(1, u / taper, (1 - u) / taper),
        half = (w * edge) / 2,
        shift = tremor * (2 * randomAt(seed, Math.round(global * 1e6)) - 1),
        nx = -Math.sin(p.rotation),
        ny = Math.cos(p.rotation);
      left.push([p.x + nx * (shift + half), p.y + ny * (shift + half)]);
      right.push([p.x + nx * (shift - half), p.y + ny * (shift - half)]);
    }
    const boundary = [...left, ...right.reverse()];
    result.push(...boundary.map((p, i) => [i ? 'L' : 'M', ...p]), ['Z']);
    total += contour.length;
  }
  assert(result.length <= 10000, 'RESOURCE_LIMIT', 'Ink ribbon exceeds the path command budget.');
  return validateProperty('path', 'commands', result);
}
