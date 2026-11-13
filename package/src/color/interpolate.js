import { assert, number, options } from '../core/validate.js';

import { toRGBA as parse, toHSLA, hsla, toHex } from './space.js';
const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
/** Premultiplied-alpha RGB interpolation; no hidden browser/CSS parsing. */
export function colorInterpolator(from, to, spec = {}) {
  assert(
    typeof from === 'string' && typeof to === 'string',
    'INVALID_COLOR',
    'Legacy interpolation accepts solid color strings.',
  );
  options(spec, ['space'], 'color interpolation');
  const space = spec.space ?? 'srgb';
  assert(['srgb', 'linearRGB'].includes(space), 'INVALID_COLOR_SPACE', 'Use srgb or linearRGB.');
  const a = parse(from),
    b = parse(to),
    encode = space === 'linearRGB' ? gamma : (v) => v,
    decode = space === 'linearRGB' ? linear : (v) => v;
  const left = a.slice(0, 3).map((v) => decode(v) * a[3]),
    right = b.slice(0, 3).map((v) => decode(v) * b[3]);
  return (t) => {
    number(t, 'color progress', 0, 1);
    if (t === 0) return from;
    if (t === 1) return to;
    const alpha = a[3] + (b[3] - a[3]) * t,
      rgb = left.map((v, i) => (alpha === 0 ? 0 : encode((v + (right[i] - v) * t) / alpha)));
    return (
      '#' +
      [...rgb, alpha]
        .map((v) =>
          Math.round(Math.max(0, Math.min(1, v)) * 255)
            .toString(16)
            .padStart(2, '0'),
        )
        .join('')
    );
  };
}

/** Procedural HSLA interpolation defaults to the shortest hue arc. RGB modes remain explicit. */
export function mix(from, to, t, spec = {}) {
  options(spec, ['space', 'hue'], 'color mix');
  number(t, 'color progress', 0, 1);
  const space = spec.space ?? 'hsla';
  assert(['hsla', 'srgb', 'linearRGB'].includes(space), 'INVALID_COLOR_SPACE', 'Use hsla, srgb or linearRGB.');
  assert(
    spec.hue === undefined || ['shorter', 'longer', 'increasing', 'decreasing'].includes(spec.hue),
    'INVALID_COLOR_SPACE',
    'Use a supported hue direction.',
  );
  if (space !== 'hsla')
    return colorInterpolator(typeof from === 'string' ? from : toHex(from), typeof to === 'string' ? to : toHex(to), {
      space,
    })(t);
  const a = toHSLA(from),
    b = toHSLA(to),
    left = a.s === 0 ? b.h : a.h,
    right = b.s === 0 ? left : b.h;
  const increasing = (((right - left) % 360) + 360) % 360;
  let delta = increasing > 180 ? increasing - 360 : increasing;
  if (spec.hue === 'longer' && delta !== 0) delta += delta > 0 ? -360 : 360;
  if (spec.hue === 'increasing') delta = increasing;
  if (spec.hue === 'decreasing') delta = increasing === 0 ? 0 : increasing - 360;
  return toHex(hsla(left + delta * t, a.s + (b.s - a.s) * t, a.l + (b.l - a.l) * t, a.a + (b.a - a.a) * t));
}
