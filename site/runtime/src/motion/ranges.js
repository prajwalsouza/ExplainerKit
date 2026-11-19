import { assert, number } from '../core/validate.js';

// Scroll and story pages map one progress value onto many effects. These helpers replace the
// smooth(a, b, x), keyed(t, keys) and envelope functions that pages otherwise copy by hand.

const unit = (v) => Math.min(1, Math.max(0, v));

/**
 * 0 before `from`, 1 after `to`, and a smooth S-curve (smoothstep) between. Reversed bounds
 * give a falling ramp. Use it to fade something in across a stretch of scroll.
 */
export function smoothWindow(from, to, value) {
  number(from, 'window from');
  number(to, 'window to');
  number(value, 'window value');
  if (from === to) return value >= to ? 1 : 0;
  const v = unit((value - from) / (to - from));
  return v * v * (3 - 2 * v);
}

/** Linear map of `value` from [a0, a1] to [b0, b1], clamped to the output range unless `clamp` is false. */
export function remap(value, a0, a1, b0, b1, clamp = true) {
  for (const [k, v] of Object.entries({ value, a0, a1, b0, b1 })) number(v, `remap ${k}`);
  assert(a0 !== a1, 'INVALID_RANGE', 'remap needs an input range with two different ends.');
  const t = (value - a0) / (a1 - a0);
  return b0 + (b1 - b0) * (clamp ? unit(t) : t);
}

/**
 * Rise, hold and fall: 0 before `start`, rising over `rise` to 1, holding until `end`, then
 * falling to 0 over `fall`. Each edge is a smoothstep.
 */
export function envelope(value, start, end, rise = 0.1, fall = rise) {
  number(value, 'envelope value');
  number(start, 'envelope start');
  number(end, 'envelope end', start);
  number(rise, 'envelope rise', 0);
  number(fall, 'envelope fall', 0);
  return Math.min(smoothWindow(start, start + rise, value), 1 - smoothWindow(end, end + fall, value));
}

/**
 * Interpolate keyed values: keys are [[at, value], ...] in increasing order of `at`. Values
 * hold before the first key and after the last. `ease` (default smoothstep) shapes each span;
 * pass 'linear' for straight segments.
 */
export function keyed(value, keys, ease = 'smooth') {
  number(value, 'keyed value');
  assert(
    Array.isArray(keys) && keys.length >= 1 && keys.length <= 10000,
    'INVALID_KEYS',
    'Give between 1 and 10000 keys as [at, value].',
  );
  assert(ease === 'smooth' || ease === 'linear', 'INVALID_EASE', "keyed eases are 'smooth' or 'linear'.");
  for (let k = 0; k < keys.length; k++) {
    assert(Array.isArray(keys[k]) && keys[k].length === 2, 'INVALID_KEYS', 'Each key is [at, value].');
    number(keys[k][0], 'key time');
    number(keys[k][1], 'key value', -1e12, 1e12);
    assert(k === 0 || keys[k][0] > keys[k - 1][0], 'INVALID_KEYS', 'Key times must increase.');
  }
  if (value <= keys[0][0]) return keys[0][1];
  if (value >= keys.at(-1)[0]) return keys.at(-1)[1];
  let i = 1;
  while (keys[i][0] < value) i++;
  const [t0, a] = keys[i - 1],
    [t1, b] = keys[i];
  const u = (value - t0) / (t1 - t0);
  return a + (b - a) * (ease === 'linear' ? u : u * u * (3 - 2 * u));
}
