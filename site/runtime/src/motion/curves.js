import { assert, number, options } from '../core/validate.js';

// Private compiler provenance. Arbitrary callbacks never qualify as pure.
const libraryCurves = new WeakMap();
export const isLibraryCurve = (curve) => libraryCurves.has(curve);
export const libraryCurveIdentity = (curve) => libraryCurves.get(curve);

/** Compile a standard motion curve. Progress is normalized; overshoot is retained.
 * @param {{family?:'power'|'sine'|'expo'|'circ'|'back'|'elastic'|'bounce',mode?:'in'|'out'|'inOut'|'outIn',power?:number}} [spec]
 * @returns {(progress:number)=>number}
 */
export function easingCurve(spec = {}) {
  options(spec, ['family', 'mode', 'power'], 'easing curve');
  const family = spec.family ?? 'power',
    mode = spec.mode ?? 'inOut';
  assert(
    ['power', 'sine', 'expo', 'circ', 'back', 'elastic', 'bounce'].includes(family),
    'INVALID_EASING',
    'Use a documented easing family.',
  );
  assert(['in', 'out', 'inOut', 'outIn'].includes(mode), 'INVALID_EASING', 'Use in, out, inOut or outIn.');
  const power = number(spec.power ?? 2, 'easing power', 0.01, 100);
  assert(spec.power === undefined || family === 'power', 'INVALID_EASING', 'power applies only to the power family.');
  let base;
  if (family === 'power') base = (t) => t ** power;
  if (family === 'sine') base = (t) => 1 - Math.cos((t * Math.PI) / 2);
  if (family === 'expo') base = (t) => (t === 0 ? 0 : 2 ** (10 * t - 10));
  if (family === 'circ') base = (t) => 1 - Math.sqrt(Math.max(0, 1 - t * t));
  if (family === 'back') base = (t) => 2.70158 * t * t * t - 1.70158 * t * t;
  if (family === 'elastic')
    base = (t) => (t === 0 || t === 1 ? t : -(2 ** (10 * t - 10)) * Math.sin((t * 10 - 10.75) * ((2 * Math.PI) / 3)));
  if (family === 'bounce') {
    const bounce = (t) => {
      const n = 7.5625,
        d = 2.75;
      if (t < 1 / d) return n * t * t;
      if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
      if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
      return n * (t -= 2.625 / d) * t + 0.984375;
    };
    base = (t) => 1 - bounce(1 - t);
  }
  const curve =
    mode === 'in'
      ? base
      : mode === 'out'
        ? (t) => 1 - base(1 - t)
        : mode === 'outIn'
          ? (t) => (t < 0.5 ? (1 - base(1 - 2 * t)) / 2 : (base(2 * t - 1) + 1) / 2)
          : (t) => (t < 0.5 ? base(2 * t) / 2 : 1 - base(2 - 2 * t) / 2);
  const generated = Object.freeze((progress) => curve(number(progress, 'easing progress', 0, 1)));
  libraryCurves.set(generated, `${family}/${mode}/${family === 'power' ? power : ''}`);
  return generated;
}

/** Compile index-based spacing or delays, independent of DOM targets or clocks.
 * A scalar is a step; a two-number range spans the normalized distance.
 * @param {number|readonly [number,number]} value
 * @param {{from?:number|'first'|'center'|'last',grid?:readonly [number,number],axis?:'x'|'y',reverse?:boolean,ease?:(progress:number)=>number,start?:number,modifier?:(value:number)=>number}} [spec]
 * @returns {(index:number,count:number)=>number}
 */
export function stagger(value, spec = {}) {
  options(spec, ['from', 'grid', 'axis', 'reverse', 'ease', 'start', 'modifier'], 'stagger');
  let first, last;
  if (Array.isArray(value)) {
    assert(value.length === 2, 'INVALID_STAGGER', 'A stagger range contains two numbers.');
    const a = Object.getOwnPropertyDescriptor(value, '0'),
      b = Object.getOwnPropertyDescriptor(value, '1');
    assert(a && 'value' in a && b && 'value' in b, 'INVALID_STAGGER', 'Use a dense numeric range without accessors.');
    first = number(a.value, 'range start');
    last = number(b.value, 'range end');
  } else first = number(value, 'stagger step');
  const from = spec.from ?? 'first',
    reverse = spec.reverse ?? false,
    start = number(spec.start ?? 0, 'stagger start'),
    ease = spec.ease,
    modifier = spec.modifier;
  assert(
    ['first', 'center', 'last'].includes(from) ||
      (typeof from === 'number' && Number.isInteger(from) && from >= 0 && from < 10000),
    'INVALID_STAGGER',
    'Use first, center, last or an item index.',
  );
  assert(typeof reverse === 'boolean', 'INVALID_STAGGER', 'reverse must be boolean.');
  assert(ease === undefined || typeof ease === 'function', 'INVALID_EASING', 'Use a trusted easing function.');
  assert(
    modifier === undefined || typeof modifier === 'function',
    'INVALID_STAGGER',
    'Use a trusted numeric modifier.',
  );
  assert(spec.axis === undefined || spec.axis === 'x' || spec.axis === 'y', 'INVALID_STAGGER', 'axis must be x or y.');
  let width, height;
  if (spec.grid !== undefined) {
    const grid = spec.grid;
    assert(Array.isArray(grid) && grid.length === 2, 'INVALID_STAGGER', 'Use two grid dimensions.');
    const a = Object.getOwnPropertyDescriptor(grid, '0'),
      b = Object.getOwnPropertyDescriptor(grid, '1');
    assert(a && 'value' in a && b && 'value' in b, 'INVALID_STAGGER', 'Use dense grid dimensions without accessors.');
    width = number(a.value, 'grid columns', 1, 10000);
    height = number(b.value, 'grid rows', 1, 10000);
    assert(
      Number.isInteger(width) && Number.isInteger(height) && width * height <= 10000,
      'RESOURCE_LIMIT',
      'A stagger grid contains at most 10000 cells.',
    );
  }
  assert(spec.axis === undefined || width !== undefined, 'INVALID_STAGGER', 'An axis requires a grid.');
  const axis = spec.axis;
  return Object.freeze((index, count) => {
    number(count, 'stagger count', 1, 10000);
    number(index, 'stagger index', 0, count - 1);
    assert(
      Number.isInteger(count) && Number.isInteger(index),
      'INVALID_STAGGER',
      'Use integer item counts and indices.',
    );
    assert(!width || count <= width * height, 'INVALID_STAGGER', 'Item count exceeds grid dimensions.');
    const origin = from === 'center' ? (count - 1) / 2 : from === 'last' ? count - 1 : from === 'first' ? 0 : from;
    assert(origin < count, 'INVALID_STAGGER', 'The origin index must exist.');
    let distance = Math.abs(index - origin),
      maximum = Math.max(origin, count - 1 - origin);
    if (width) {
      const ox = from === 'center' ? (width - 1) / 2 : origin % width,
        oy = from === 'center' ? (height - 1) / 2 : Math.floor(origin / width),
        dx = (index % width) - ox,
        dy = Math.floor(index / width) - oy;
      distance = axis === 'x' ? dx : axis === 'y' ? dy : Math.hypot(dx, dy);
      maximum =
        axis === 'x'
          ? Math.max(ox, width - 1 - ox)
          : axis === 'y'
            ? Math.max(oy, height - 1 - oy)
            : Math.max(Math.hypot(ox, oy), Math.hypot(width - 1 - ox, height - 1 - oy));
    }
    if (reverse) distance = maximum - distance;
    let fraction = maximum ? distance / maximum : 0;
    if (ease) fraction = number(ease(Math.max(0, Math.min(1, fraction))), 'stagger eased fraction');
    let result =
      last === undefined ? first * (ease ? fraction * maximum : distance) : first + (last - first) * fraction;
    if (modifier) result = number(modifier(result), 'stagger modifier result');
    return number(start + result, 'stagger result');
  });
}
