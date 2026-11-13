import { assert, number, options } from '../core/validate.js';

/** Seekable fall with exponential drag: terminal is speed in units/s, ramp is seconds.
 * @param {{from?:number,to:number,terminal?:number,ramp?:number,at?:number}} spec
 */
export function fall(spec = {}) {
  options(spec, ['from', 'to', 'terminal', 'ramp', 'at'], 'fall');
  const from = number(spec.from ?? 0, 'fall from'),
    to = number(spec.to, 'fall to'),
    terminal = number(spec.terminal ?? 300, 'terminal speed', 1e-6, 1e7),
    ramp = number(spec.ramp ?? 0.3, 'fall ramp', 1e-6, 3600),
    at = number(spec.at ?? 0, 'fall start', 0, 86400);
  const direction = Math.sign(to - from),
    distance = Math.abs(to - from);
  const travel = (t) => terminal * (t + ramp * Math.expm1(-t / ramp));
  let lo = 0,
    hi = distance / terminal + ramp;
  assert(hi + at <= 86400, 'INVALID_PHYSICS', 'Fall must land within 86400 seconds.');
  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2;
    if (travel(mid) < distance) lo = mid;
    else hi = mid;
  }
  const duration = distance === 0 ? 0 : hi,
    end = at + duration;
  const state = (time) => {
    number(time, 'fall time', 0, 86400);
    const t = time - at;
    if (t < 0) return Object.freeze({ value: from, velocity: 0, landed: false });
    if (t >= duration) return Object.freeze({ value: to, velocity: 0, landed: true });
    return Object.freeze({
      value: from + direction * travel(t),
      velocity: direction * terminal * -Math.expm1(-t / ramp),
      landed: false,
    });
  };
  return Object.freeze({
    from,
    to,
    at,
    end,
    duration,
    terminal,
    ramp,
    state,
    sample: (time) => state(time).value,
    velocity: (time) => state(time).velocity,
  });
}
