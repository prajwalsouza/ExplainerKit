import { assert, number, options } from '../core/validate.js';

// A side-view quadruped gait planner. Each foot is planted at a fixed world position for the
// stance part of its cycle (no sliding) and swings to its next footfall on an arc. Legs are
// two-bone chains solved analytically. Everything is a pure function of time.
//
// Footfall phases follow the gait patterns described by Hildebrand (1965, 1977): the fraction
// of the stride at which each foot touches down, measured from the left hind foot, plus the duty
// factor (the fraction of the stride each foot spends on the ground). Values are rounded,
// representative patterns rather than measurements of one species.

export const QUADRUPED_GAITS = Object.freeze({
  walk: Object.freeze({ phases: Object.freeze({ LH: 0, LF: 0.25, RH: 0.5, RF: 0.75 }), duty: 0.7, bob: 0.02 }),
  trot: Object.freeze({ phases: Object.freeze({ LH: 0, RF: 0, RH: 0.5, LF: 0.5 }), duty: 0.5, bob: 0.04 }),
  pace: Object.freeze({ phases: Object.freeze({ LH: 0, LF: 0, RH: 0.5, RF: 0.5 }), duty: 0.5, bob: 0.04 }),
  canter: Object.freeze({ phases: Object.freeze({ LH: 0, RH: 0.3, LF: 0.3, RF: 0.6 }), duty: 0.4, bob: 0.07 }),
  gallop: Object.freeze({ phases: Object.freeze({ LH: 0, RH: 0.1, LF: 0.5, RF: 0.6 }), duty: 0.3, bob: 0.08 }),
});
const LEGS = ['LH', 'RH', 'LF', 'RF'];

/** Two-bone reach in 2D: the joint position for a chain from `root` toward `target`. */
export function twoBoneJoint(root, target, upper, lower, bend = 1) {
  const dx = target.x - root.x,
    dy = target.y - root.y,
    d = Math.min(upper + lower - 1e-9, Math.max(Math.abs(upper - lower) + 1e-9, Math.hypot(dx, dy)));
  const a = Math.atan2(dy, dx),
    cos = (upper * upper + d * d - lower * lower) / (2 * upper * d),
    off = Math.acos(Math.max(-1, Math.min(1, cos)));
  const angle = a + (bend >= 0 ? off : -off);
  return {
    x: root.x + Math.cos(angle) * upper,
    y: root.y + Math.sin(angle) * upper,
    reached: Math.hypot(dx, dy) <= upper + lower,
  };
}

/**
 * Plan a gait. `speed` is in body units per second and `stride` is the distance the body moves
 * per full cycle. `hip` and `shoulder` are offsets from the body centre to the hind and fore leg
 * roots (y down, so a root above the feet has negative y). `ground` is the ground's y.
 * pose(time) returns the body position and pitch, each foot (and whether it is planted) and each knee.
 */
export function quadrupedGait(spec = {}) {
  options(
    spec,
    ['gait', 'speed', 'stride', 'hip', 'shoulder', 'legs', 'ground', 'stepHeight', 'start', 'bend'],
    'quadrupedGait',
  );
  const name = spec.gait ?? 'walk';
  assert(
    Object.hasOwn(QUADRUPED_GAITS, name),
    'INVALID_GAIT',
    `Use one of ${Object.keys(QUADRUPED_GAITS).join(', ')}.`,
  );
  const g = QUADRUPED_GAITS[name];
  const speed = number(spec.speed ?? 1, 'speed', 0, 1e5),
    stride = number(spec.stride ?? 1, 'stride', 1e-6, 1e5),
    ground = number(spec.ground ?? 0, 'ground y', -1e7, 1e7),
    start = number(spec.start ?? 0, 'start x', -1e7, 1e7);
  const pt = (p, n, fallback) => {
    const q = p ?? fallback;
    options(q, ['x', 'y'], n);
    return { x: number(q.x, `${n} x`, -1e5, 1e5), y: number(q.y, `${n} y`, -1e5, 1e5) };
  };
  const hip = pt(spec.hip, 'hip', { x: -0.5, y: -0.1 }),
    shoulder = pt(spec.shoulder, 'shoulder', { x: 0.5, y: -0.1 });
  const legs = spec.legs ?? {};
  options(legs, ['upper', 'lower'], 'legs');
  const upper = number(legs.upper ?? 0.5, 'upper leg', 1e-6, 1e5),
    lower = number(legs.lower ?? 0.5, 'lower leg', 1e-6, 1e5);
  const height = (upper + lower) * 0.92;
  const stepHeight = number(spec.stepHeight ?? height * 0.18, 'step height', 0, 1e5);
  const bend = spec.bend ?? {};
  options(bend, ['fore', 'hind'], 'bend');
  const foreBend = number(bend.fore ?? -1, 'fore bend', -1, 1),
    hindBend = number(bend.hind ?? 1, 'hind bend', -1, 1);
  const period = speed > 0 ? stride / speed : Infinity;
  const reach = (stride * g.duty) / 2;
  // Body x at time t; with speed 0 the animal stands still.
  const bodyX = (t) => start + speed * t;

  const foot = (leg, t) => {
    const root = leg.endsWith('H') ? hip : shoulder;
    if (!Number.isFinite(period)) return { x: start + root.x, y: ground, planted: true, phase: 0 };
    const phase = g.phases[leg];
    // Cycle n: the foot touches down at (n + phase) * period, ahead of its root by `reach`.
    const u = t / period - phase,
      n = Math.floor(u),
      f = u - n;
    const land = (k) => bodyX((k + phase) * period) + root.x + reach;
    if (f < g.duty) return { x: land(n), y: ground, planted: true, phase: f / g.duty };
    // Swing from where it lifted to the next footfall.
    const s = (f - g.duty) / (1 - g.duty),
      e = s * s * (3 - 2 * s);
    return {
      x: land(n) + (land(n + 1) - land(n)) * e,
      y: ground - stepHeight * Math.sin(Math.PI * s),
      planted: false,
      phase: s,
    };
  };

  return Object.freeze({
    gait: name,
    period,
    duty: g.duty,
    pose(time) {
      number(time, 'time', -1e7, 1e7);
      const feet = Object.fromEntries(LEGS.map((leg) => [leg, Object.freeze(foot(leg, time))]));
      // The body dips a little when fewer feet carry it, and pitches with the front-back difference.
      const swinging = (pair) =>
        pair.reduce((s, l) => s + (feet[l].planted ? 0 : Math.sin(Math.PI * feet[l].phase)), 0) / pair.length;
      const hindLift = swinging(['LH', 'RH']),
        foreLift = swinging(['LF', 'RF']);
      const bob = g.bob * height;
      const body = {
        x: bodyX(time),
        y: ground - height + bob * (hindLift + foreLift) * 0.5 - bob * 0.5,
        pitch: Math.atan2((foreLift - hindLift) * bob, shoulder.x - hip.x),
      };
      const rotate = (p) => {
        const c = Math.cos(body.pitch),
          s = Math.sin(body.pitch);
        return { x: body.x + p.x * c - p.y * s, y: body.y + p.x * s + p.y * c };
      };
      const roots = { hind: rotate(hip), fore: rotate(shoulder) };
      const knees = Object.fromEntries(
        LEGS.map((leg) => {
          const hind = leg.endsWith('H'),
            root = hind ? roots.hind : roots.fore;
          return [leg, Object.freeze(twoBoneJoint(root, feet[leg], upper, lower, hind ? hindBend : foreBend))];
        }),
      );
      return Object.freeze({
        body: Object.freeze(body),
        roots: Object.freeze(roots),
        feet: Object.freeze(feet),
        knees: Object.freeze(knees),
      });
    },
  });
}
