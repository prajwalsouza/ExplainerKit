// Continuity audit for handovers. When one representation of a thing hands over to another (a
// painted 2D drawing to a 3D model, one camera to another, a shell to the ring that replaces it),
// the eye follows a few named features. Each representation reports the same anchors in screen
// space; this audit measures how far each anchor jumps in position, size, angle and colour at the
// handover, or across the whole overlap window, and fits the similarity transform (shift, uniform
// scale, turn) that best carries the incoming anchors onto the outgoing ones. That fit is the
// correction: apply it to the incoming camera or layout and the handover becomes a match, not a jump.
//
// Thresholds are engineering choices, not perceptual truth: position as a fraction of the viewport
// diagonal, size as a ratio, angle in radians, and colour as a distance in OKLab, where about 0.02 is
// a just-noticeable difference. They are listed in CONTINUITY so a project can tighten or loosen them.
import { assert, number, options, safeCopy, text } from '../core/validate.js';
import { toRGBA } from '../color/space.js';
import { rgbaToOKLab as oklab } from '../color/perceptual.js';

export const CONTINUITY = Object.freeze({ position: 0.006, size: 0.08, angle: 0.12, color: 0.05 });
const MAX_ANCHORS = 256;
const MAX_SAMPLES = 240;

/** Perceptual colour distance in OKLab between two solid colours. */
export function colorDistance(a, b) {
  const [p, q] = [oklab(toRGBA(a)), oklab(toRGBA(b))];
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}

function anchors(list, name) {
  assert(
    Array.isArray(list) && list.length >= 1 && list.length <= MAX_ANCHORS,
    'INVALID_CONTINUITY_AUDIT',
    `${name} needs 1–${MAX_ANCHORS} anchors.`,
  );
  const out = new Map();
  for (const raw of list) {
    const a = safeCopy(raw);
    options(a, ['id', 'x', 'y', 'size', 'angle', 'color', 'visible'], `${name} anchor`);
    text(a.id, 'anchor id', 64);
    assert(!out.has(a.id), 'INVALID_CONTINUITY_AUDIT', `Anchor ${a.id} appears twice in ${name}.`);
    out.set(
      a.id,
      Object.freeze({
        id: a.id,
        x: number(a.x, 'anchor x', -1e6, 1e6),
        y: number(a.y, 'anchor y', -1e6, 1e6),
        size: a.size === undefined ? null : number(a.size, 'anchor size', 1e-6, 1e6),
        angle: a.angle === undefined ? null : number(a.angle, 'anchor angle', -1e3, 1e3),
        color: a.color === undefined ? null : (toRGBA(a.color), a.color),
        visible: a.visible === undefined ? true : !!a.visible,
      }),
    );
  }
  return out;
}

/**
 * Least-squares similarity (uniform scale, rotation, translation) carrying `to` points onto `from`
 * points (Umeyama 1991, in 2D). With a single anchor it uses the anchors' sizes, if both have one,
 * for the scale and no rotation. Returns {scale, rotation, x, y, residual} with residual the RMS
 * pixel error left after the fit.
 */
export function fitSimilarity(from, to) {
  assert(
    Array.isArray(from) &&
      Array.isArray(to) &&
      from.length === to.length &&
      from.length >= 1 &&
      from.length <= MAX_ANCHORS,
    'INVALID_CONTINUITY_AUDIT',
    `fitSimilarity needs two equal lists of 1–${MAX_ANCHORS} points.`,
  );
  const P = from.map((p) => [number(p.x, 'point x', -1e6, 1e6), number(p.y, 'point y', -1e6, 1e6)]),
    Q = to.map((p) => [number(p.x, 'point x', -1e6, 1e6), number(p.y, 'point y', -1e6, 1e6)]),
    n = P.length;
  const cp = [P.reduce((s, p) => s + p[0], 0) / n, P.reduce((s, p) => s + p[1], 0) / n],
    cq = [Q.reduce((s, p) => s + p[0], 0) / n, Q.reduce((s, p) => s + p[1], 0) / n];
  let a = 0,
    b = 0,
    spread = 0;
  for (let i = 0; i < n; i++) {
    const [px, py] = [P[i][0] - cp[0], P[i][1] - cp[1]],
      [qx, qy] = [Q[i][0] - cq[0], Q[i][1] - cq[1]];
    a += qx * px + qy * py;
    b += qx * py - qy * px;
    spread += qx * qx + qy * qy;
  }
  let scale = 1,
    rotation = 0;
  if (n > 1 && spread > 1e-9) {
    rotation = Math.atan2(b, a);
    scale = Math.hypot(a, b) / spread;
  } else if (from[0].size && to[0].size) scale = from[0].size / to[0].size;
  const c = Math.cos(rotation) * scale,
    s = Math.sin(rotation) * scale;
  const x = cp[0] - (c * cq[0] - s * cq[1]),
    y = cp[1] - (s * cq[0] + c * cq[1]);
  let error = 0;
  for (let i = 0; i < n; i++) {
    const fx = c * Q[i][0] - s * Q[i][1] + x,
      fy = s * Q[i][0] + c * Q[i][1] + y;
    error += (fx - P[i][0]) ** 2 + (fy - P[i][1]) ** 2;
  }
  return Object.freeze({ scale, rotation, x, y, residual: Math.sqrt(error / n) });
}

function limits(tolerance = {}) {
  options(tolerance, ['position', 'size', 'angle', 'color'], 'continuity tolerance');
  return {
    position: number(tolerance.position ?? CONTINUITY.position, 'position tolerance', 0, 1),
    size: number(tolerance.size ?? CONTINUITY.size, 'size tolerance', 0, 10),
    angle: number(tolerance.angle ?? CONTINUITY.angle, 'angle tolerance', 0, Math.PI),
    color: number(tolerance.color ?? CONTINUITY.color, 'color tolerance', 0, 2),
  };
}
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Measure one handover. `from` and `to` are the outgoing and incoming representations' anchors in
 * screen pixels: {id, x, y, size?, angle?, color?, visible?}. Anchors are matched by id. Returns a
 * report whose `status` is 'pass' when every shared anchor stays within tolerance, `checks` with
 * each anchor's jumps, `missing` anchors one side lacks, and `correction`, the similarity transform
 * that carries the incoming anchors onto the outgoing ones.
 */
export function auditHandover(spec) {
  options(spec, ['from', 'to', 'viewport', 'tolerance', 'at'], 'handover audit');
  options(spec.viewport, ['width', 'height'], 'handover viewport');
  const width = number(spec.viewport.width, 'viewport width', 1, 1e5),
    height = number(spec.viewport.height, 'viewport height', 1, 1e5),
    diagonal = Math.hypot(width, height),
    limit = limits(spec.tolerance),
    at = spec.at === undefined ? null : number(spec.at, 'handover time', -1e7, 1e7);
  const A = anchors(spec.from, 'from'),
    B = anchors(spec.to, 'to');
  const shared = [...A.keys()].filter((id) => B.has(id) && A.get(id).visible && B.get(id).visible);
  const missing = [...new Set([...A.keys(), ...B.keys()])].filter((id) => !shared.includes(id));
  const checks = shared.map((id) => {
    const a = A.get(id),
      b = B.get(id),
      jump = Math.hypot(b.x - a.x, b.y - a.y) / diagonal;
    const measure = (value, tolerance, unit) =>
      Object.freeze({
        value,
        tolerance,
        unit,
        status: value === null ? 'unknown' : value <= tolerance ? 'pass' : 'fail',
      });
    const check = {
      id,
      position: measure(jump, limit.position, 'viewport diagonal'),
      shift: Object.freeze({ x: b.x - a.x, y: b.y - a.y }),
      size: measure(
        a.size && b.size ? Math.abs(Math.log(b.size / a.size)) : null,
        Math.log(1 + limit.size),
        'log ratio',
      ),
      angle: measure(
        a.angle !== null && b.angle !== null ? Math.abs(wrap(b.angle - a.angle)) : null,
        limit.angle,
        'radians',
      ),
      color: measure(
        a.color !== null && b.color !== null ? colorDistance(a.color, b.color) : null,
        limit.color,
        'OKLab',
      ),
    };
    check.status = ['position', 'size', 'angle', 'color'].some((k) => check[k].status === 'fail') ? 'fail' : 'pass';
    return Object.freeze(check);
  });
  const correction = shared.length
    ? fitSimilarity(
        shared.map((id) => A.get(id)),
        shared.map((id) => B.get(id)),
      )
    : null;
  const worst = checks.reduce((w, c) => Math.max(w, c.position.value / limit.position), 0);
  return Object.freeze({
    protocol: 'explainerkit.continuity-audit/1',
    at,
    status: !checks.length ? 'unknown' : checks.some((c) => c.status === 'fail') ? 'fail' : 'pass',
    checks: Object.freeze(checks),
    missing: Object.freeze(missing),
    correction,
    worst,
    message: describe(checks, missing, correction, diagonal),
  });
}

function describe(checks, missing, correction, diagonal) {
  const failing = checks.filter((c) => c.status === 'fail');
  const parts = failing.map((c) => {
    const what = ['position', 'size', 'angle', 'color'].filter((k) => c[k].status === 'fail');
    return `${c.id} jumps in ${what.join(', ')}${c.position.status === 'fail' ? ` (${Math.round(c.position.value * diagonal)} px)` : ''}`;
  });
  if (missing.length) parts.push(`no counterpart for ${missing.join(', ')}`);
  if (correction && failing.length)
    parts.push(
      `move the incoming view by (${correction.x.toFixed(1)}, ${correction.y.toFixed(1)}) px about the origin, scale ${correction.scale.toFixed(3)}, turn ${correction.rotation.toFixed(3)} rad`,
    );
  return parts.length ? parts.join('; ') + '.' : 'Continuous.';
}

/**
 * Audit a handover over its overlap window: `from(t)` and `to(t)` are trusted, pure, synchronous
 * samplers returning anchors at time t (each anchor may set `visible: false`). Samples evenly from
 * `start` to `end` and reports each sample and the worst one.
 */
export function auditHandoverWindow(spec) {
  options(spec, ['from', 'to', 'start', 'end', 'samples', 'viewport', 'tolerance'], 'handover window audit');
  assert(
    typeof spec.from === 'function' && typeof spec.to === 'function',
    'INVALID_CONTINUITY_AUDIT',
    'from and to must be samplers.',
  );
  const start = number(spec.start, 'window start', -1e7, 1e7),
    end = number(spec.end, 'window end', start, 1e7),
    count = number(spec.samples ?? 24, 'sample count', 1, MAX_SAMPLES);
  assert(Number.isInteger(count), 'INVALID_CONTINUITY_AUDIT', 'Sample count must be an integer.');
  const samples = [];
  for (let i = 0; i < count; i++) {
    const at = count === 1 ? start : start + ((end - start) * i) / (count - 1);
    samples.push(
      auditHandover({ from: spec.from(at), to: spec.to(at), viewport: spec.viewport, tolerance: spec.tolerance, at }),
    );
  }
  const worst = samples.reduce((w, s) => (s.worst > w.worst ? s : w), samples[0]);
  return Object.freeze({
    protocol: 'explainerkit.continuity-window/1',
    status: samples.some((s) => s.status === 'fail')
      ? 'fail'
      : samples.every((s) => s.status === 'unknown')
        ? 'unknown'
        : 'pass',
    start,
    end,
    samples: Object.freeze(samples),
    worst,
  });
}
