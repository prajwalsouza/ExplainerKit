import { assert, number, options } from '../core/validate.js';
import { solveBones, compileCharacter } from './runtime.js';

/**
 * Staging helpers: the ground a character stands on and its measured size. Character space is y-down with
 * the ground at y = 0 (the body centre for fish and microbes); every value here is a pure function.
 */
const f = (v) => Object.freeze(v);
const SURFACES = new WeakSet();
const MAX_POINTS = 4096;

/**
 * A ground to stand on: `{y}` is a flat floor, `{points: [[x, y], …]}` a polyline (slopes, hills, steps with
 * short risers) with strictly increasing x. Beyond the ends the first and last heights continue flat.
 */
export function surface(spec) {
  assert(spec && typeof spec === 'object', 'INVALID_GROUND', 'surface needs {y} or {points}.');
  options(spec, ['y', 'points'], 'surface');
  assert(
    (spec.y === undefined) !== (spec.points === undefined),
    'INVALID_GROUND',
    'Give a surface either y (flat) or points (a polyline), not both.',
  );
  if (spec.y !== undefined) {
    const y = number(spec.y, 'surface y', -1e6, 1e6);
    return make(
      'flat',
      f([]),
      () => y,
      (dy) => surface({ y: y - dy }),
    );
  }
  assert(
    Array.isArray(spec.points) && spec.points.length >= 2 && spec.points.length <= MAX_POINTS,
    'INVALID_GROUND',
    `A surface polyline needs 2 to ${MAX_POINTS} points.`,
  );
  const xs = new Float64Array(spec.points.length),
    ys = new Float64Array(spec.points.length);
  spec.points.forEach((p, i) => {
    assert(Array.isArray(p) && p.length === 2, 'INVALID_GROUND', 'Surface points are [x, y] pairs.');
    xs[i] = number(p[0], 'surface point x', -1e6, 1e6);
    ys[i] = number(p[1], 'surface point y', -1e6, 1e6);
    assert(
      i === 0 || xs[i] - xs[i - 1] >= 1e-6,
      'INVALID_GROUND',
      'Surface points need strictly increasing x; draw a step as a short steep riser.',
    );
  });
  const points = f(Array.from(xs, (x, i) => f([x, ys[i]])));
  const yAt = (x) => {
    if (x <= xs[0]) return ys[0];
    const n = xs.length - 1;
    if (x >= xs[n]) return ys[n];
    let lo = 0,
      hi = n;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] <= x) lo = mid;
      else hi = mid;
    }
    return ys[lo] + ((ys[hi] - ys[lo]) * (x - xs[lo])) / (xs[hi] - xs[lo]);
  };
  return make('polyline', points, yAt, (dy) => surface({ points: points.map(([x, y]) => [x, y - dy]) }));
}
function make(kind, points, yAt, raise) {
  const s = f({
    kind,
    points,
    /** Ground height at scene x. */
    yAt: (x) => yAt(number(x, 'surface x')),
    /** The same ground lifted by dy scene units (a farther row, a stage). */
    raise: (dy) => raise(number(dy, 'surface raise', -1e6, 1e6)),
    /** Closed path commands filling from the surface down to `bottom` between x0 and x1, for drawing the floor. */
    commands({ x0, x1, bottom } = {}) {
      x0 = number(x0 ?? points[0]?.[0] ?? 0, 'floor x0');
      x1 = number(x1 ?? points.at(-1)?.[0] ?? 1000, 'floor x1');
      bottom = number(bottom ?? 1e4, 'floor bottom');
      assert(x1 > x0, 'INVALID_GROUND', 'Floor x1 must be right of x0.');
      const inner = points.filter(([x]) => x > x0 && x < x1);
      return f(
        [
          ['M', x0, bottom],
          ['L', x0, yAt(x0)],
          ...inner.map(([x, y]) => ['L', x, y]),
          ['L', x1, yAt(x1)],
          ['L', x1, bottom],
          ['Z'],
        ].map(f),
      );
    },
  });
  SURFACES.add(s);
  return s;
}
export const isSurface = (value) => SURFACES.has(value);

// Curves are sampled at 16 steps, matching what renderers draw to well under a unit at character scale.
function extent(commands, map, pad, box) {
  let at = [0, 0];
  const put = (x, y) => {
    const [px, py] = map(x, y);
    box[0] = Math.min(box[0], px - pad);
    box[1] = Math.min(box[1], py - pad);
    box[2] = Math.max(box[2], px + pad);
    box[3] = Math.max(box[3], py + pad);
  };
  for (const c of commands) {
    if (c[0] === 'M' || c[0] === 'L') {
      at = [c[1], c[2]];
      put(...at);
    } else if (c[0] === 'Q') {
      const p = at;
      for (let i = 1; i <= 16; i++) {
        const t = i / 16,
          u = 1 - t;
        put(u * u * p[0] + 2 * u * t * c[1] + t * t * c[3], u * u * p[1] + 2 * u * t * c[2] + t * t * c[4]);
      }
      at = [c[3], c[4]];
    } else if (c[0] === 'C') {
      const p = at;
      for (let i = 1; i <= 16; i++) {
        const t = i / 16,
          u = 1 - t;
        put(
          u ** 3 * p[0] + 3 * u * u * t * c[1] + 3 * u * t * t * c[3] + t ** 3 * c[5],
          u ** 3 * p[1] + 3 * u * u * t * c[2] + 3 * u * t * t * c[4] + t ** 3 * c[6],
        );
      }
      at = [c[5], c[6]];
    }
  }
}
const measured = new WeakMap();
/**
 * Drawn bounds of a character in its rest pose, in character units (y-down, ground at 0): {x0, y0, x1, y1,
 * width, height, head}. The ground shadow and invisible parts are left out; strokes count their half width.
 * `head` is the box of the parts on the head bone (the top 40% of the body when a rig has none).
 */
export function restBounds(definition) {
  assert(definition && typeof definition === 'object', 'INVALID_CHARACTER', 'restBounds needs a character definition.');
  const def = definition.order ? definition : compileCharacter(definition);
  if (measured.has(def)) return measured.get(def);
  const pose = { ...def.rest },
    world = solveBones(def, pose),
    ctx = {
      def,
      seed: 1,
      size: 1,
      clips: [],
      scene: null,
      travel: () => 0,
      facingAt: () => 1,
      look: () => ({ eyes: [0, 0], head: [0, 0] }),
    };
  const all = [Infinity, Infinity, -Infinity, -Infinity],
    head = [Infinity, Infinity, -Infinity, -Infinity];
  const onHead = new Set(
    def.order.filter((name) => {
      for (let b = name; b; b = def.bones[b].parent) if (b === 'head') return true;
      return false;
    }),
  );
  for (const part of def.parts) {
    if (part.slot === 'shadow' || part.id === 'shadow') continue;
    if ((part.opacity ?? 1) * (part.alpha ? part.alpha(pose) : 1) <= 0.02) continue;
    const commands = part.draw ? part.draw(pose, world, ctx) : part.local;
    if (!commands?.length) continue;
    const b = part.bone ? world[part.bone] : { x: 0, y: 0, r: 0, sx: 1, sy: 1 },
      c = Math.cos(b.r),
      s = Math.sin(b.r);
    const map = (x, y) => [b.x + c * x * b.sx - s * y * b.sy, b.y + s * x * b.sx + c * y * b.sy];
    extent(commands, map, part.stroke ? part.stroke / 2 : 0, all);
    if (part.bone && onHead.has(part.bone)) extent(commands, map, part.stroke ? part.stroke / 2 : 0, head);
  }
  assert(Number.isFinite(all[0]), 'INVALID_CHARACTER', `${def.name} draws nothing in its rest pose.`);
  const box = ([x0, y0, x1, y1]) => f({ x0, y0, x1, y1, width: x1 - x0, height: y1 - y0 });
  const out = f({
    ...box(all),
    head: Number.isFinite(head[0]) ? box(head) : box([all[0], all[1], all[2], all[1] + 0.4 * (all[3] - all[1])]),
  });
  measured.set(def, out);
  return out;
}
/** Drawn rest height of a character in character units (size 1). */
export const restHeight = (definition) => restBounds(definition).height;

const LENGTH = /^\s*(\d+(?:\.\d+)?|\.\d+)\s*(m|cm|mm)\s*$/;
/**
 * A height in scene units: a number is already in scene units; a string such as '1.7m', '170cm' or '1700mm'
 * is converted with `unit` scene units per metre.
 */
export function sceneLength(value, unit, label = 'height') {
  if (typeof value === 'number') return number(value, label, 1e-3, 1e6);
  const m = typeof value === 'string' && LENGTH.exec(value);
  assert(m, 'INVALID_CHARACTER', `${label} is a number of scene units or a length such as '1.7m' or '170cm'.`);
  assert(unit !== undefined, 'INVALID_CHARACTER', `A ${label} in metres needs unit (scene units per metre).`);
  const perMetre = number(unit, 'unit (scene units per metre)', 1e-6, 1e6);
  return number(Number(m[1]) * { m: 1, cm: 0.01, mm: 0.001 }[m[2]] * perMetre, label, 1e-3, 1e6);
}

/** Put an existing character on a surface: same as actor.standOn(surface). */
export function standOn(actor, where) {
  assert(
    actor && typeof actor.standOn === 'function',
    'INVALID_CHARACTER',
    'standOn needs a character from character().',
  );
  return actor.standOn(where);
}
