import { radialReach } from './reach.js';
/**
 * Planar two-link kinematics, implemented directly in JavaScript.
 *
 * Mathematical references (formulas, not borrowed implementation):
 * - Lynch & Park, Modern Robotics, §6.1, planar 2R example:
 *   https://hades.mech.northwestern.edu/images/2/2a/Park-lynch.pdf
 * - CMU, An Introduction to Robot Kinematics, algebraic 2-link derivation:
 *   https://www.cs.cmu.edu/~16311/ppp/Kinematics_final.pdf
 *
 * Angles are radians, positive from +x toward +y. On a browser's y-down
 * stage this appears clockwise. The second angle is relative to the first
 * link. Inputs use one common coordinate unit; no pixels/metres conversion.
 * These analytical solvers have no simulation history or hidden state.
 */
const MAX_COORDINATE = 1e9;
const MIN_LENGTH = 1e-6;
const MAX_LENGTH = 1e9;
const MAX_ANGLE = 1e6;

function fail(code, message) {
  const error = new RangeError(message);
  error.code = code;
  throw error;
}

function finite(value, label, limit) {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > limit) {
    fail('INVALID_RIG_INPUT', `${label} must be a finite number within ±${limit}.`);
  }
  return value;
}

function point(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_RIG_INPUT', `${label} must contain numeric x and y coordinates.`);
  }
  return {
    x: finite(value.x, `${label}.x`, MAX_COORDINATE),
    y: finite(value.y, `${label}.y`, MAX_COORDINATE),
  };
}

function lengths(value) {
  if (!Array.isArray(value) || value.length !== 2) {
    fail('INVALID_RIG_INPUT', 'lengths must contain exactly two link lengths.');
  }
  return Array.from(value, (length, i) => {
    finite(length, `lengths[${i}]`, MAX_LENGTH);
    if (length < MIN_LENGTH) {
      fail('INVALID_RIG_INPUT', `lengths[${i}] must be at least ${MIN_LENGTH}.`);
    }
    return length;
  });
}

function forward(root, [a, b], [shoulder, elbowAngle]) {
  const elbow = {
    x: root.x + a * Math.cos(shoulder),
    y: root.y + a * Math.sin(shoulder),
  };
  return {
    root: { ...root },
    elbow,
    tip: {
      x: elbow.x + b * Math.cos(shoulder + elbowAngle),
      y: elbow.y + b * Math.sin(shoulder + elbowAngle),
    },
    angles: [shoulder, elbowAngle],
  };
}

/**
 * Pose an arm by its two joint angles. Returns independent coordinate objects.
 * Limits: each coordinate ±1e9, lengths [1e-6, 1e9], angles ±1e6 radians.
 * There are no implicit joint limits, collisions, stretch or mesh deformation.
 */
export function fkTwoBone(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    fail('INVALID_RIG_INPUT', 'Rig options must be an object.');
  }
  const origin = point(options.root ?? { x: 0, y: 0 }, 'root');
  const links = lengths(options.lengths);
  if (!Array.isArray(options.angles) || options.angles.length !== 2) {
    fail('INVALID_RIG_INPUT', 'angles must contain shoulder and relative elbow angles.');
  }
  const angles = Array.from(options.angles, (angle, i) => finite(angle, `angles[${i}]`, MAX_ANGLE));
  return forward(origin, links, angles);
}

/**
 * Reach toward a point, retaining link lengths unless stretch is explicit.
 *
 * bend: +1 or -1 selects the sign of the relative elbow angle.
 * pole chooses that branch from a point; a collinear pole retains bend.
 * stretch: 1–4 bounds proportional lengthening of both links (default 1).
 * compress: .25–1 bounds proportional shortening (default 1, no shortening).
 * softness: 0–1e9 distance units of exponential easing toward full reach.
 * Scale is chosen first; softness can intentionally leave a target residual.
 * unreachable: 'clamp' (default) reaches the nearest point in the arm's
 * annular workspace; 'error' throws RIG_TARGET_UNREACHABLE.
 * At target=root, +x supplies a deterministic direction. With equal links,
 * shoulder=0 and elbow=±π provide one of infinitely many valid folded poses.
 *
 * reachable describes the original target, not the clamped tip. error is
 * the actual Euclidean distance from the computed tip to the original target.
 * Coordinates remain floating-point approximations; never infer collisions
 * or mechanical feasibility from an analytical reach solution alone.
 */
export function solveTwoBone(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    fail('INVALID_RIG_INPUT', 'Rig options must be an object.');
  }
  const origin = point(options.root ?? { x: 0, y: 0 }, 'root');
  const target = point(options.target, 'target');
  const links = lengths(options.lengths);
  let bend = options.bend ?? 1;
  const policy = options.unreachable ?? 'clamp';
  if (bend !== 1 && bend !== -1) fail('INVALID_RIG_INPUT', 'bend must be 1 or -1.');
  if (policy !== 'clamp' && policy !== 'error') {
    fail('INVALID_RIG_INPUT', "unreachable must be 'clamp' or 'error'.");
  }
  const stretchLimit = options.stretch ?? 1;
  if (typeof stretchLimit !== 'number' || !Number.isFinite(stretchLimit) || stretchLimit < 1 || stretchLimit > 4) {
    fail('INVALID_RIG_INPUT', 'stretch must be a finite number from 1 to 4.');
  }
  const control = (name, fallback, min, max) => {
    const descriptor = Object.getOwnPropertyDescriptor(options, name);
    if (descriptor && !('value' in descriptor)) fail('INVALID_RIG_INPUT', name + ' must be a data value.');
    const value = descriptor?.value === undefined ? fallback : descriptor.value;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
      fail('INVALID_RIG_INPUT', name + ' must be within [' + min + ', ' + max + '].');
    return value;
  };
  const compressLimit = control('compress', 1, 0.25, 1),
    softness = control('softness', 0, 0, MAX_LENGTH);
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const distance = Math.hypot(dx, dy);
  // A pole point chooses the bend side: the elbow/knee falls on the pole's side of the root–target line.
  // Collinear poles keep `bend`, so a limb never flips on a degenerate hint.
  if (options.pole !== undefined) {
    const pole = point(options.pole, 'pole');
    const cross = dx * (pole.y - origin.y) - dy * (pole.x - origin.x);
    if (Math.abs(cross) > 1e-9 * Math.max(1, distance * Math.hypot(pole.x - origin.x, pole.y - origin.y)))
      bend = cross > 0 ? -1 : 1;
  }
  // Stretch: cartoon limbs lengthen to reach, up to the given factor, keeping their proportions.
  const radial = radialReach(
      links[0] + links[1],
      Math.abs(links[0] - links[1]),
      distance,
      stretchLimit,
      compressLimit,
      softness,
    ),
    stretch = radial.scale;
  const [a, b] = stretch === 1 ? links : [links[0] * stretch, links[1] * stretch];
  const inner = Math.abs(a - b);
  const outer = a + b;
  const envelopeTolerance = Number.EPSILON * 16 * Math.max(1, distance, outer);
  const reachable = distance >= inner - envelopeTolerance && distance <= outer + envelopeTolerance;
  if (!reachable && policy === 'error') {
    fail('RIG_TARGET_UNREACHABLE', `Target distance ${distance} is outside [${inner}, ${outer}].`);
  }
  const softenedDistance = radial.effectiveDistance;
  const d = Math.max(inner, Math.min(outer, softenedDistance));
  const heading = distance === 0 ? 0 : Math.atan2(dy, dx);
  let shoulder;
  let elbowAngle;
  if (d === 0) {
    shoulder = 0;
    elbowAngle = bend * Math.PI;
  } else if (d <= inner) {
    // Explicit singular branches avoid atan2 of small trig round-off terms.
    elbowAngle = bend * Math.PI;
    shoulder = a >= b ? heading : heading - bend * Math.PI;
  } else if (d >= outer) {
    shoulder = heading;
    elbowAngle = 0;
  } else {
    // cos(q2)=(d²-a²-b²)/(2ab). Factoring d²-a² reduces cancellation
    // when the target distance is close to the first link length.
    const cosine = Math.max(-1, Math.min(1, ((d - a) * (d + a) - b * b) / (2 * a * b)));
    const sine = bend * Math.sqrt(Math.max(0, (1 - cosine) * (1 + cosine)));
    elbowAngle = Math.atan2(sine, cosine);
    shoulder = heading - Math.atan2(b * sine, a + b * cosine);
  }
  const result = forward(origin, stretch === 1 ? links : [a, b], [shoulder, elbowAngle]);
  return {
    ...result,
    bend,
    stretch,
    scale: stretch,
    effectiveTarget: {
      x: origin.x + softenedDistance * Math.cos(heading),
      y: origin.y + softenedDistance * Math.sin(heading),
    },
    softness,
    reachable,
    target,
    error: Math.hypot(result.tip.x - target.x, result.tip.y - target.y),
  };
}
