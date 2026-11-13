import { assert, number, options, safeCopy } from './validate.js';
const owned = new WeakSet();
const base = {
  beat: 0.3,
  hold: { duration: 0, probability: 0 },
  holdStill: false,
  anticipation: { probability: 1, amount: 0.05 },
  overshoot: { probability: 1, amount: 0.04 },
  arcs: 0,
  interpolation: 'joints',
  overlap: 1,
  idle: 1,
  stepping: { duration: 0.28, threshold: 12, lift: 14 },
  physics: {
    lagHalfLife: 0.12,
    jiggleFrequency: 4,
    jiggleDamping: 0.3,
    squashAmount: 0.2,
    springMass: 1,
    springStiffness: 170,
    springDamping: 26,
  },
};
/** Measured style controls are authoring conventions, not inferred reference-film fidelity. */
export const MOTION_STYLES = safeCopy({
  legacy: base,
  'snappy-stick': {
    ...base,
    beat: 5 / 24,
    hold: { duration: 0.25, probability: 0.28 },
    holdStill: true,
    anticipation: { probability: 0.23, amount: 0.19 },
    overshoot: { probability: 0.28, amount: 0.15 },
    arcs: 0.2,
    overlap: 0,
    stepping: { duration: 0.21, threshold: 12, lift: 14 },
    physics: { ...base.physics, lagHalfLife: 0.06, jiggleFrequency: 6, jiggleDamping: 1, springDamping: 30 },
  },
  classic: {
    ...base,
    beat: 1 / 3,
    hold: { duration: 0.2, probability: 0.35 },
    holdStill: true,
    anticipation: { probability: 0.15, amount: 0.08 },
    overshoot: { probability: 0.2, amount: 0.07 },
    arcs: 0.12,
    overlap: 0.25,
    stepping: { duration: 0.5, threshold: 12, lift: 12 },
    physics: { ...base.physics, lagHalfLife: 0.16, jiggleFrequency: 3, jiggleDamping: 0.8 },
  },
});
function fraction(value, label) {
  return number(value, label, 0, 1);
}
/** Capture a preset plus bounded overrides. Legacy preserves timing; F1 joint-space interpolation is shared by styles. */
export function resolveMotionStyle(input) {
  if (input && typeof input === 'object' && owned.has(input)) return input;
  const spec = typeof input === 'string' ? { preset: input } : safeCopy(input ?? {});
  options(
    spec,
    [
      'preset',
      'beat',
      'hold',
      'holdStill',
      'anticipation',
      'overshoot',
      'arcs',
      'interpolation',
      'overlap',
      'idle',
      'stepping',
      'physics',
    ],
    'motion style',
  );
  const name = spec.preset ?? 'legacy';
  assert(
    typeof name === 'string' && Object.hasOwn(MOTION_STYLES, name),
    'INVALID_MOTION_STYLE',
    'Use legacy, snappy-stick or classic, with optional overrides.',
  );
  const defaults = MOTION_STYLES[name];
  const chance = (value, defaultValue, label) => {
    const record = value ?? defaultValue;
    options(record, ['probability', 'amount'], label);
    return {
      probability: fraction(record.probability ?? defaultValue.probability, label + ' probability'),
      amount: number(record.amount ?? defaultValue.amount, label + ' amount', 0, 0.5),
    };
  };
  const hold = { ...defaults.hold, ...spec.hold };
  if (spec.hold !== undefined) options(spec.hold, ['duration', 'probability'], 'motion hold');
  number(hold.duration, 'motion hold duration', 0, 10);
  fraction(hold.probability, 'motion hold probability');
  const stepping = { ...defaults.stepping, ...spec.stepping };
  if (spec.stepping !== undefined) options(spec.stepping, ['duration', 'threshold', 'lift'], 'motion stepping');
  number(stepping.duration, 'style step duration', 0.02, 10);
  number(stepping.threshold, 'style step threshold', 0, 1000);
  number(stepping.lift, 'style step lift', 0, 1000);
  const physics = { ...defaults.physics, ...spec.physics };
  if (spec.physics !== undefined) options(spec.physics, Object.keys(base.physics), 'style physics');
  number(physics.lagHalfLife, 'style lag halfLife', 0.001, 10);
  number(physics.jiggleFrequency, 'style jiggle frequency', 0.01, 100);
  number(physics.jiggleDamping, 'style jiggle damping', 0.01, 10);
  fraction(physics.squashAmount, 'style squash amount');
  assert(physics.squashAmount <= 0.95, 'INVALID_MOTION_STYLE', 'Squash amount must not exceed.95');
  number(physics.springMass, 'style spring mass', 1e-4, 1e4);
  number(physics.springStiffness, 'style spring stiffness', 1e-4, 1e6);
  number(physics.springDamping, 'style spring damping', 0, 1e5);
  const result = {
    name,
    beat: number(spec.beat ?? defaults.beat, 'motion beat', 0.001, 10),
    hold,
    holdStill: spec.holdStill ?? defaults.holdStill,
    anticipation: chance(spec.anticipation, defaults.anticipation, 'motion anticipation'),
    overshoot: chance(spec.overshoot, defaults.overshoot, 'motion overshoot'),
    arcs: number(spec.arcs ?? defaults.arcs, 'motion arc bow', 0, 1),
    interpolation: spec.interpolation ?? defaults.interpolation,
    overlap: fraction(spec.overlap ?? defaults.overlap, 'motion overlap'),
    idle: fraction(spec.idle ?? defaults.idle, 'motion idle'),
    stepping,
    physics,
  };
  assert(
    typeof result.holdStill === 'boolean' && ['joints', 'targets'].includes(result.interpolation),
    'INVALID_MOTION_STYLE',
    'holdStill is boolean; interpolation is joints or targets.',
  );
  const captured = safeCopy(result);
  owned.add(captured);
  return captured;
}
export const motionStyle = resolveMotionStyle;
function unit(seed, index, salt) {
  let value = (seed ^ salt) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
  return (value / 4294967296 + index * 0.6180339887498949) % 1;
}
/** Deterministic per-transition decisions. Selection depends on identity/index, never sample order. */
export function motionTransition(input, seed = 1, index = 0) {
  const style = resolveMotionStyle(input);
  number(seed, 'motion seed', 0, 0xffffffff);
  number(index, 'motion transition index', 0, 100000);
  assert(
    Number.isInteger(seed) && Number.isInteger(index),
    'INVALID_MOTION_STYLE',
    'Seed and transition index must be integers.',
  );
  const anticipation = unit(seed, index, 0x6a09e667) < style.anticipation.probability ? style.anticipation.amount : 0,
    overshoot = unit(seed, index, 0xbb67ae85) < style.overshoot.probability ? style.overshoot.amount : 0,
    hold = unit(seed, index, 0x3c6ef372) < style.hold.probability ? style.hold.duration : 0;
  const ease = (t) => {
    number(t, 'motion progress', 0, 1);
    if (t === 0 || t === 1) return t;
    const begin = anticipation ? 0.15 : 0,
      end = overshoot ? 0.75 : 1;
    if (begin && t < begin) return -anticipation * Math.sin((Math.PI * t) / begin);
    if (t < end) {
      const u = (t - begin) / (end - begin);
      return (1 + overshoot) * u * u * (3 - 2 * u);
    }
    return 1 + overshoot * ((1 - t) / (1 - end)) ** 2;
  };
  return Object.freeze({
    duration: style.beat,
    hold,
    anticipation,
    overshoot,
    arc: style.arcs,
    overlap: style.overlap,
    interpolation: style.interpolation,
    ease,
  });
}
/** Explicit sampled hold windows for generic idle effects; boundaries are inclusive. */
export function motionHolds(input = []) {
  const rows = safeCopy(input);
  assert(Array.isArray(rows) && rows.length <= 10000, 'RESOURCE_LIMIT', 'Use at most10000 motion hold windows.');
  return Object.freeze(
    rows.map((row) => {
      assert(Array.isArray(row) && row.length === 2, 'INVALID_MOTION_STYLE', 'Holds are [from,to] pairs.');
      const from = number(row[0], 'hold start', 0, 86400),
        to = number(row[1], 'hold end', from, 86400);
      return Object.freeze([from, to]);
    }),
  );
}
