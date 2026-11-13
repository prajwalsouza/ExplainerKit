import { resolveMotionStyle } from '../core/motion-style.js';
import { assert, number, options } from '../core/validate.js';
export { lag, jiggle, squashStretch } from './secondary.js';

/** Analytic damped oscillator. Seconds and units/second; never frame-integrated. */
export function spring(spec = {}) {
  options(spec, ['from', 'to', 'velocity', 'mass', 'stiffness', 'damping', 'at', 'motionStyle'], 'spring');
  const from = number(spec.from ?? 0, 'spring from'),
    to = number(spec.to ?? 1, 'spring to'),
    velocity = number(spec.velocity ?? 0, 'spring velocity'),
    mass = number(spec.mass ?? resolveMotionStyle(spec.motionStyle).physics.springMass, 'spring mass', 1e-4, 1e4),
    stiffness = number(
      spec.stiffness ?? resolveMotionStyle(spec.motionStyle).physics.springStiffness,
      'spring stiffness',
      1e-4,
      1e6,
    ),
    damping = number(
      spec.damping ?? resolveMotionStyle(spec.motionStyle).physics.springDamping,
      'spring damping',
      0,
      1e5,
    ),
    at = number(spec.at ?? 0, 'spring start', 0, 86400);
  const w = Math.sqrt(stiffness / mass),
    alpha = damping / (2 * mass),
    y = from - to,
    delta = alpha * alpha - w * w;
  function state(time) {
    number(time, 'spring time', 0, 86400);
    const t = time - at;
    if (t < 0) return Object.freeze({ value: from, velocity: 0 });
    let displacement, v;
    if (Math.abs(delta) <= 1e-10 * Math.max(alpha * alpha, w * w)) {
      const b = velocity + alpha * y,
        e = Math.exp(-alpha * t);
      displacement = e * (y + b * t);
      v = e * (b - alpha * (y + b * t));
    } else if (delta < 0) {
      const wd = Math.sqrt(-delta),
        b = (velocity + alpha * y) / wd,
        c = Math.cos(wd * t),
        s = Math.sin(wd * t),
        e = Math.exp(-alpha * t);
      displacement = e * (y * c + b * s);
      v = e * (-y * wd * s + b * wd * c - alpha * (y * c + b * s));
    } else {
      const q = Math.sqrt(delta),
        r1 = (-w * w) / (alpha + q),
        r2 = -alpha - q,
        a = (velocity - r2 * y) / (r1 - r2),
        b = y - a;
      displacement = a * Math.exp(r1 * t) + b * Math.exp(r2 * t);
      v = r1 * a * Math.exp(r1 * t) + r2 * b * Math.exp(r2 * t);
    }
    return Object.freeze({ value: number(to + displacement, 'spring value'), velocity: number(v, 'spring velocity') });
  }
  const easing = (progress) => {
    assert(
      from === 0 && to === 1,
      'SPRING_EASING_RANGE',
      'A direct spring easing needs from:0,to:1. Use sample(seconds) for a physical position response.',
    );
    number(progress, 'spring easing progress', 0, 1);
    if (progress === 0) return 0;
    if (progress === 1) return 1;
    return state(at + progress).value;
  };
  return Object.freeze(
    Object.assign(easing, {
      sample: (time) => state(time).value,
      velocity: (time) => state(time).velocity,
      state,
      from,
      to,
      at,
      mass,
      stiffness,
      damping,
    }),
  );
}

/** An explicit finite-duration easing. Normalized progress 1 lands exactly on target. */
export function springEasing(spec = {}) {
  options(spec, ['mass', 'stiffness', 'damping', 'velocity', 'duration', 'clamp', 'motionStyle'], 'spring easing');
  const duration = number(spec.duration ?? 1, 'spring easing seconds', 1e-4, 3600),
    clamp = spec.clamp ?? false;
  assert(typeof clamp === 'boolean', 'INVALID_PHYSICS', 'clamp must be boolean.');
  const { duration: _, clamp: __, ...physical } = spec,
    oscillator = spring(physical);
  return (progress) => {
    number(progress, 'easing progress', 0, 1);
    if (progress === 0) return 0;
    if (progress === 1) return 1;
    const v = oscillator.sample(progress * duration);
    return clamp ? Math.max(0, Math.min(1, v)) : v;
  };
}

/** Exponential drag release with optional inelastic bounds. No hidden simulation clock. */
export function inertia(spec = {}) {
  options(spec, ['from', 'velocity', 'friction', 'at', 'min', 'max'], 'inertia');
  const from = number(spec.from ?? 0, 'release position'),
    velocity = number(spec.velocity ?? 0, 'release velocity'),
    friction = number(spec.friction ?? 6, 'release friction', 1e-4, 1e4),
    at = number(spec.at ?? 0, 'release time', 0, 86400),
    min = number(spec.min ?? -1e7, 'release minimum'),
    max = number(spec.max ?? 1e7, 'release maximum');
  assert(
    max > min && from >= min && from <= max,
    'INVALID_PHYSICS',
    'Release bounds must contain the starting position.',
  );
  const endpoint = from + velocity / friction;
  const state = (time) => {
    number(time, 'release sample time', 0, 86400);
    const t = time - at;
    if (t < 0) return Object.freeze({ value: from, velocity: 0, clamped: false });
    const decay = Math.exp(-friction * t),
      position = from - (velocity * Math.expm1(-friction * t)) / friction,
      value = Math.max(min, Math.min(max, position)),
      clamped = value !== position || (value === min && velocity < 0) || (value === max && velocity > 0);
    return Object.freeze({ value: number(value, 'release value'), velocity: clamped ? 0 : velocity * decay, clamped });
  };
  return Object.freeze({
    from,
    velocity0: velocity,
    at,
    friction,
    state,
    sample: (time) => state(time).value,
    get target() {
      return Math.max(min, Math.min(max, endpoint));
    },
  });
}

/** Fit pointer velocity over a short, bounded window for a release sampler. */
export function velocityTracker(spec = {}) {
  options(spec, ['window', 'maxSamples'], 'velocity tracker');
  const window = number(spec.window ?? 0.12, 'velocity window', 0.001, 2),
    maxSamples = number(spec.maxSamples ?? 32, 'velocity sample cap', 2, 256);
  assert(Number.isInteger(maxSamples), 'INVALID_PHYSICS', 'Sample cap must be an integer.');
  let samples = [];
  return Object.freeze({
    add(time, point) {
      number(time, 'pointer seconds', 0, 86400);
      options(point, ['x', 'y'], 'pointer');
      const next = { time, x: number(point.x, 'pointer x'), y: number(point.y, 'pointer y') };
      assert(
        !samples.length || time >= samples.at(-1).time,
        'NON_MONOTONIC_TIME',
        'Pointer samples must use one monotonic clock.',
      );
      if (samples.at(-1)?.time === time) samples.pop();
      samples.push(next);
      samples = samples.filter((s) => time - s.time <= window).slice(-maxSamples);
      return this;
    },
    sample(time = samples.at(-1)?.time ?? 0) {
      number(time, 'velocity time', 0, 86400);
      const recent = samples.filter((s) => s.time <= time && time - s.time <= window);
      if (recent.length < 2) return Object.freeze({ x: 0, y: 0 });
      const origin = recent.at(-1).time,
        mt = recent.reduce((n, p) => n + p.time - origin, 0) / recent.length,
        mx = recent.reduce((n, p) => n + p.x, 0) / recent.length,
        my = recent.reduce((n, p) => n + p.y, 0) / recent.length;
      let covarianceX = 0,
        covarianceY = 0,
        variance = 0;
      for (const p of recent) {
        const dt = p.time - origin - mt;
        variance += dt * dt;
        covarianceX += dt * (p.x - mx);
        covarianceY += dt * (p.y - my);
      }
      return Object.freeze({
        x: variance ? number(covarianceX / variance, 'velocity x') : 0,
        y: variance ? number(covarianceY / variance, 'velocity y') : 0,
      });
    },
    clear() {
      samples = [];
    },
    get size() {
      return samples.length;
    },
  });
}

export { fall } from './fall.js';
