import { texture } from './texture.js';
export { texture, textureTile, paint } from './texture.js';
import { assert, number, options, safeCopy } from '../core/validate.js';

import { solidColor as color } from '../color/space.js';
export { solidColor as color } from '../color/space.js';
const ARITY = { M: 3, L: 3, Q: 5, C: 7, Z: 1 };
export function strokeDasharray(value) {
  const array = safeCopy(value);
  assert(Array.isArray(array) && array.length <= 128, 'INVALID_DASH', 'Use at most128 nonnegative dash lengths.');
  let sum = 0;
  for (const v of array) sum += number(v, 'dash length', 0, 1e5);
  assert(sum <= 1e6, 'RESOURCE_LIMIT', 'Dash cycle exceeds its length budget.');
  return array;
}
export function fillRule(value) {
  assert(value === 'nonzero' || value === 'evenodd', 'INVALID_FILL_RULE', 'Use nonzero or evenodd.');
  return value;
}
// Validated paths and clips are deeply frozen, so passing one through validation again can return it as is.
// Character parts hand the same path to their fill, clip and lighting layers every frame.
const trustedPaths = new WeakSet(),
  trustedClips = new WeakSet();
const trustClip = (clip) => {
  trustedClips.add(clip);
  return clip;
};
export function pathCommands(value) {
  if (trustedPaths.has(value)) return value;
  const input = safeCopy(value);
  assert(Array.isArray(input) && input.length <= 10000, 'RESOURCE_LIMIT', 'A path accepts at most 10000 commands.');
  input.forEach((c, i) => {
    assert(
      Array.isArray(c) && Object.hasOwn(ARITY, c[0]) && c.length === ARITY[c[0]],
      'INVALID_PATH',
      'Use absolute M, L, C, Q or Z commands.',
    );
    assert(i !== 0 || c[0] === 'M', 'INVALID_PATH', 'Begin a path with M.');
    for (let k = 1; k < c.length; k++) number(c[k], 'path coordinate');
  });
  trustedPaths.add(input);
  return input;
}
/** All resource coordinates are in the owning node's local coordinate system. */
export function clipRect(spec = {}) {
  options(spec, ['x', 'y', 'width', 'height', 'rx'], 'rectangle clip');
  const width = number(spec.width, 'clip width', 0, 1e5),
    height = number(spec.height, 'clip height', 0, 1e5);
  return trustClip(
    Object.freeze({
      type: 'rect',
      x: number(spec.x ?? 0, 'clip x'),
      y: number(spec.y ?? 0, 'clip y'),
      width,
      height,
      rx: number(spec.rx ?? 0, 'clip radius', 0, 1e5),
    }),
  );
}
export function clipCircle(spec = {}) {
  options(spec, ['x', 'y', 'r'], 'circle clip');
  return trustClip(
    Object.freeze({
      type: 'circle',
      x: number(spec.x ?? 0, 'clip x'),
      y: number(spec.y ?? 0, 'clip y'),
      r: number(spec.r, 'clip radius', 0, 1e5),
    }),
  );
}
/** @param {{commands:Array<Array<string|number>>,fillRule?:'nonzero'|'evenodd',units?:'user'|'bounds'}} spec */
export function clipPath(spec = {}) {
  options(spec, ['commands', 'fillRule', 'units'], 'path clip');
  const units = spec.units ?? 'user';
  assert(['user', 'bounds'].includes(units), 'INVALID_CLIP', 'Use user or bounds clip units.');
  return trustClip(
    Object.freeze({
      type: 'path',
      commands: pathCommands(spec.commands),
      ...(units === 'bounds' ? { units } : {}),
      fillRule: fillRule(spec.fillRule ?? 'nonzero'),
    }),
  );
}
export function validateClip(value) {
  if (value === null) return null;
  if (trustedClips.has(value)) return value;
  const v = safeCopy(value);
  assert(
    v && typeof v === 'object' && !Array.isArray(v),
    'INVALID_CLIP',
    'Use a rectangle, circle or path clip descriptor.',
  );
  const { type, ...spec } = v;
  if (type === 'rect') return clipRect(spec);
  if (type === 'circle') return clipCircle(spec);
  if (type === 'path') return clipPath(spec);
  assert(false, 'INVALID_CLIP', 'Use a rectangle, circle or path clip descriptor.');
}
function stops(value) {
  const input = safeCopy(value);
  assert(
    Array.isArray(input) && input.length >= 2 && input.length <= 64,
    'INVALID_GRADIENT',
    'Use 2–64 ordered gradient stops.',
  );
  let previous = -1;
  return Object.freeze(
    input.map((v) => {
      options(v, ['offset', 'color'], 'gradient stop');
      const offset = number(v.offset, 'stop offset', 0, 1);
      assert(offset >= previous, 'INVALID_GRADIENT', 'Stop offsets must be ordered.');
      previous = offset;
      return Object.freeze({ offset, color: color(v.color, { stop: true }) });
    }),
  );
}
/** @param {{x1?:number,y1?:number,x2:number,y2?:number,stops:{offset:number,color:string}[],units?:'user'|'bounds'}} spec */
export function linearGradient(spec = {}) {
  options(spec, ['x1', 'y1', 'x2', 'y2', 'stops', 'units'], 'linear gradient');
  const units = spec.units ?? 'user';
  assert(['user', 'bounds'].includes(units), 'INVALID_GRADIENT', 'Use user or bounds gradient units.');
  const x1 = number(spec.x1 ?? 0, 'gradient x1'),
    y1 = number(spec.y1 ?? 0, 'gradient y1'),
    x2 = number(spec.x2, 'gradient x2'),
    y2 = number(spec.y2 ?? 0, 'gradient y2');
  assert(x1 !== x2 || y1 !== y2, 'INVALID_GRADIENT', 'A linear gradient needs distinct endpoints.');
  return Object.freeze({
    type: 'linear',
    x1,
    y1,
    x2,
    y2,
    stops: stops(spec.stops),
    ...(units === 'bounds' ? { units } : {}),
  });
}
export function radialGradient(spec = {}) {
  options(spec, ['x', 'y', 'r', 'stops'], 'radial gradient');
  return Object.freeze({
    type: 'radial',
    x: number(spec.x ?? 0, 'gradient x'),
    y: number(spec.y ?? 0, 'gradient y'),
    r: number(spec.r, 'gradient radius', 1e-6, 1e5),
    stops: stops(spec.stops),
  });
}
export function validatePaint(value) {
  if (typeof value === 'string' || (value && typeof value === 'object' && Object.hasOwn(value, 'h')))
    return color(value);
  const v = safeCopy(value);
  assert(
    v && typeof v === 'object' && !Array.isArray(v),
    'INVALID_GRADIENT',
    'Use a color or local linear/radial gradient.',
  );
  const { type, ...spec } = v;
  if (type === 'texture') return texture(v);
  if (type === 'linear') return linearGradient(spec);
  if (type === 'radial') return radialGradient(spec);
  assert(false, 'INVALID_GRADIENT', 'Use a local linear or radial gradient descriptor.');
}
