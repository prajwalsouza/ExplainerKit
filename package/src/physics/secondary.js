import { resolveMotionStyle } from '../core/motion-style.js';
import { assert, number, options } from '../core/validate.js';

// First-party closed-form solution of x'' + 2 alpha x' + omega² (x-target) = 0.
function advance(value, velocity, target, seconds, omega, alpha) {
  const y = value - target,
    delta = alpha * alpha - omega * omega;
  if (Math.abs(delta) <= 1e-12 * Math.max(alpha * alpha, omega * omega)) {
    const b = velocity + alpha * y,
      e = Math.exp(-alpha * seconds);
    return [target + e * (y + b * seconds), e * (b - alpha * (y + b * seconds))];
  }
  if (delta < 0) {
    const wd = Math.sqrt(-delta),
      b = (velocity + alpha * y) / wd,
      c = Math.cos(wd * seconds),
      s = Math.sin(wd * seconds),
      e = Math.exp(-alpha * seconds);
    return [target + e * (y * c + b * s), e * (-y * wd * s + b * wd * c - alpha * (y * c + b * s))];
  }
  const q = Math.sqrt(delta),
    r1 = (-omega * omega) / (alpha + q),
    r2 = -alpha - q,
    a = (velocity - r2 * y) / (r1 - r2),
    b = y - a,
    e1 = Math.exp(r1 * seconds),
    e2 = Math.exp(r2 * seconds);
  return [target + a * e1 + b * e2, r1 * a * e1 + r2 * b * e2];
}

function follower(scene, driver, spec, omega, alpha) {
  assert(
    scene && typeof scene.derive === 'function' && typeof scene._ownsInput === 'function',
    'INVALID_BINDING',
    'Use an ExplainerKit scene.',
  );
  assert(
    typeof driver === 'function' || scene._ownsInput(driver),
    'INVALID_BINDING',
    'A motion driver must be this scene’s numeric input or a pure function of seconds and context.',
  );
  const style = resolveMotionStyle(spec.motionStyle),
    overlap = number(spec.overlap ?? (spec.motionStyle === undefined ? 1 : style.overlap), 'secondary overlap', 0, 1);
  const initial = spec.initial === undefined ? undefined : number(spec.initial, 'motion initial value');
  const maxSteps = number(spec.maxSteps ?? 2048, 'motion interval cap', 4, 4096);
  assert(Number.isInteger(maxSteps), 'INVALID_PHYSICS', 'maxSteps must be an integer.');
  // The slow real pole determines the window for overdamped responses.
  const decay = alpha > omega ? (omega * omega) / (alpha + Math.sqrt(alpha * alpha - omega * omega)) : alpha;
  const history = number(spec.history ?? Math.min(60, (16 * Math.LN2) / decay), 'motion history seconds', 1e-6, 60);
  const step = number(
    spec.step ?? Math.max(Math.min(1 / 120, 1 / (omega * 32)), history / (maxSteps - 2)),
    'motion substep seconds',
    1e-6,
    60,
  );
  assert(
    Math.ceil(history / step) + 1 <= maxSteps,
    'RESOURCE_LIMIT',
    'Motion history exceeds maxSteps; increase step or reduce history.',
  );
  const source =
    typeof driver === 'function' ? null : scene.derive([driver], (value) => number(value, 'motion driver'));
  const read = (time, context) => {
    const at = Object.freeze({ ...context, time });
    return number(source ? source.sample(at) : driver(time, at), 'motion driver');
  };
  return scene.derive([], (context) => {
    const time = number(context.time, 'motion time', 0, 86400),
      start = Math.max(0, time - history);
    if (overlap === 0) return read(time, context);
    let value = start === 0 && initial !== undefined ? initial : read(start, context),
      velocity = 0,
      cursor = start;
    let gridIndex = Math.floor(start / step) + 1;
    // Grid boundaries are anchored at scene time zero; partial edge intervals are exact.
    for (let count = 0; cursor < time && count < maxSteps; count++) {
      const end = Math.min(time, gridIndex * step);
      if (end <= cursor) {
        gridIndex++;
        continue;
      }
      [value, velocity] = advance(value, velocity, read((cursor + end) / 2, context), end - cursor, omega, alpha);
      cursor = end;
      gridIndex++;
    }
    assert(cursor >= time, 'RESOURCE_LIMIT', 'Motion interval cap reached.');
    return number(
      overlap === 1 ? value : value * overlap + read(time, context) * (1 - overlap),
      'secondary motion value',
    );
  });
}

/** Seekable critically damped tracking. halfLife is the decay envelope half-life, not half the step rise time. */
export function lag(scene, driver, spec = {}) {
  options(spec, ['halfLife', 'initial', 'history', 'step', 'maxSteps', 'motionStyle', 'overlap'], 'lag');
  const halfLife = number(
      spec.halfLife ?? resolveMotionStyle(spec.motionStyle).physics.lagHalfLife,
      'lag half-life',
      0.001,
      10,
    ),
    omega = Math.LN2 / halfLife;
  return follower(scene, driver, spec, omega, omega);
}

/** Seekable damped tracking; frequency is undamped Hz and damping is a damping ratio. */
export function jiggle(scene, driver, spec = {}) {
  options(spec, ['frequency', 'damping', 'initial', 'history', 'step', 'maxSteps', 'motionStyle', 'overlap'], 'jiggle');
  const frequency = number(
      spec.frequency ?? resolveMotionStyle(spec.motionStyle).physics.jiggleFrequency,
      'jiggle frequency',
      0.01,
      100,
    ),
    damping = number(
      spec.damping ?? resolveMotionStyle(spec.motionStyle).physics.jiggleDamping,
      'jiggle damping ratio',
      0.01,
      10,
    ),
    omega = 2 * Math.PI * frequency;
  return follower(scene, driver, spec, omega, omega * damping);
}

/** Bind positive, reciprocal scale multipliers around the handle’s authored scale. */
export function squashStretch(handle, spec = {}) {
  options(spec, ['input', 'amount', 'axis', 'motionStyle'], 'squash and stretch');
  const scene = handle?._scene;
  assert(
    scene && typeof handle.bind === 'function' && scene._ownsInput(spec.input),
    'INVALID_BINDING',
    'Squash/stretch needs a handle and an input owned by its scene.',
  );
  const amount = number(
      spec.amount ?? resolveMotionStyle(spec.motionStyle).physics.squashAmount,
      'squash amount',
      0,
      0.95,
    ),
    axis = spec.axis ?? 'y';
  assert(axis === 'x' || axis === 'y', 'INVALID_PHYSICS', 'Squash axis is x or y.');
  const x = number(handle._record.props.scaleX, 'authored scale x'),
    y = number(handle._record.props.scaleY, 'authored scale y');
  return handle.bind(['scaleX', 'scaleY'], {
    inputs: [spec.input],
    map: (value) => {
      const multiplier = 1 + amount * Math.max(-1, Math.min(1, number(value, 'squash input')));
      return {
        scaleX: x * (axis === 'x' ? multiplier : 1 / multiplier),
        scaleY: y * (axis === 'y' ? multiplier : 1 / multiplier),
      };
    },
  });
}
