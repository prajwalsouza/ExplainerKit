/**
 * Construction helpers that encode common rigging rules so new characters are hard to build wrong:
 *  - bodies built around a spine never taper to zero where something attaches (tube + taper),
 *  - appendages are placed in the parent's local frame and sunk into it by an overlap (appendage),
 *  - ends are capped explicitly instead of letting a smoothing curve overshoot into a spike.
 * All functions are pure and return frozen path commands in character space.
 */
const f = (v) => Object.freeze(v);

/** Position, unit tangent and unit normal at fraction s (0–1, by length) along a polyline. */
export function frameAlong(points, s) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++)
    lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  const target = Math.max(0, Math.min(1, s)) * lengths.at(-1);
  let i = 1;
  while (i < points.length - 1 && lengths[i] < target) i++;
  const a = points[i - 1],
    b = points[i],
    seg = lengths[i] - lengths[i - 1] || 1,
    k = (target - lengths[i - 1]) / seg;
  const tx = (b[0] - a[0]) / seg,
    ty = (b[1] - a[1]) / seg;
  return f({
    point: f([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]),
    tangent: f([tx, ty]),
    normal: f([-ty, tx]),
    angle: Math.atan2(ty, tx),
  });
}

/**
 * A thickness profile along a body: rises from `nose` to `max` and narrows to `end` (never zero), the way a
 * fish narrows to its tail stalk or a limb to its wrist. peak is where the body is thickest (0–1).
 * @param {{max:number,nose?:number,end?:number,peak?:number}} spec
 */
export function taper({ max, nose = max * 0.35, end = max * 0.25, peak = 0.3 } = {}) {
  return (s) => {
    s = Math.max(0, Math.min(1, s));
    if (s <= peak) {
      const u = s / peak;
      return nose + (max - nose) * Math.sin((u * Math.PI) / 2);
    }
    const u = (s - peak) / (1 - peak);
    return end + ((max - end) * (1 + Math.cos(u * Math.PI))) / 2;
  };
}

/**
 * Closed outline around a spine (points from head to tail) with half-thickness given by width(s).
 * Ends get explicit round or flat caps, so the outline cannot overshoot into a needle or a loop.
 */
export function tube(spine, width, { startCap = 'round', endCap = 'flat', samples = 2 } = {}) {
  const n = (spine.length - 1) * samples + 1,
    left = [],
    right = [],
    frames = [];
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1),
      fr = frameAlong(spine, s),
      w = Math.max(0.5, width(s));
    frames.push(fr);
    left.push([fr.point[0] + fr.normal[0] * w, fr.point[1] + fr.normal[1] * w]);
    right.push([fr.point[0] - fr.normal[0] * w, fr.point[1] - fr.normal[1] * w]);
  }
  const out = [f(['M', ...left[0]])];
  const through = (pts) => {
    for (let i = 1; i < pts.length - 1; i++) {
      const m = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2];
      out.push(f(['Q', ...pts[i], ...m]));
    }
    out.push(f(['L', ...pts.at(-1)]));
  };
  through(left);
  const cap = (fr, w, from, to, kind, outward) => {
    if (kind === 'flat') {
      out.push(f(['L', ...to]));
      return;
    }
    // Round cap: two quarter curves around the end, bulging along the outward tangent.
    const tip = [fr.point[0] + outward[0] * w, fr.point[1] + outward[1] * w];
    out.push(
      f(['Q', from[0] + outward[0] * w, from[1] + outward[1] * w, ...tip]),
      f(['Q', to[0] + outward[0] * w, to[1] + outward[1] * w, ...to]),
    );
  };
  const last = frames.at(-1);
  cap(last, Math.max(0.5, width(1)), left.at(-1), right.at(-1), endCap, last.tangent);
  through(right.toReversed());
  const first = frames[0];
  cap(first, Math.max(0.5, width(0)), right[0], left[0], startCap, [-first.tangent[0], -first.tangent[1]]);
  out.push(f(['Z']));
  return f(out);
}

/**
 * Place a shape drawn in its own frame (root at the origin, growing along +x) onto a parent frame, sunk back
 * into the parent by `overlap` units so the seam hides inside the parent. angle adds a hinge rotation.
 */
export function appendage(shape, frame, { overlap = 4, angle = 0, scale = 1 } = {}) {
  // Sink against the appendage's own growth direction, so a dorsal fin sinks into the back, a tail into the stalk.
  const a = frame.angle + angle,
    c = Math.cos(a),
    s = Math.sin(a),
    ox = frame.point[0] - c * overlap,
    oy = frame.point[1] - s * overlap;
  return f(
    shape.map(([cmd, ...v]) => {
      const out = [cmd];
      for (let i = 0; i < v.length; i += 2) {
        const x = v[i] * scale,
          y = v[i + 1] * scale;
        out.push(ox + c * x - s * y, oy + s * x + c * y);
      }
      return f(out);
    }),
  );
}

/** A frame on the surface of a tube: the spine frame at s moved out along the normal by side × width(s). */
export function surfaceFrame(spine, width, s, side = 1) {
  const fr = frameAlong(spine, s),
    w = width(s) * side;
  return f({ ...fr, point: f([fr.point[0] + fr.normal[0] * w, fr.point[1] + fr.normal[1] * w]) });
}

/** Rounded polygon through points with corner radius r (quadratic corners, no overshoot). */
function roundedLocal(points, r) {
  const n = points.length,
    out = [];
  points.forEach((p, i) => {
    const a = points[(i + n - 1) % n],
      b = points[(i + 1) % n],
      la = Math.hypot(a[0] - p[0], a[1] - p[1]),
      lb = Math.hypot(b[0] - p[0], b[1] - p[1]),
      k = Math.min(r, la / 2, lb / 2);
    out.push(
      f([i ? 'L' : 'M', p[0] + ((a[0] - p[0]) * k) / la, p[1] + ((a[1] - p[1]) * k) / la]),
      f(['Q', p[0], p[1], p[0] + ((b[0] - p[0]) * k) / lb, p[1] + ((b[1] - p[1]) * k) / lb]),
    );
  });
  out.push(f(['Z']));
  return f(out);
}

/**
 * Common appendage shapes in their own frame (root at origin, extending along +x), ready for appendage():
 * forked and rounded tail fins, pointed fins, leaves/ears and petals. root is the half-width at the base.
 */
export const shapes = Object.freeze({
  forkedFin: ({ length = 24, spread = 20, root = 6, fork = 0.45, round = 3 } = {}) =>
    roundedLocal(
      [
        [0, -root],
        [length, -spread],
        [length * (1 - fork), 0],
        [length, spread],
        [0, root],
      ],
      round,
    ),
  roundFin: ({ length = 22, spread = 16, root = 6 } = {}) =>
    roundedLocal(
      [
        [0, -root],
        [length * 0.7, -spread],
        [length, 0],
        [length * 0.7, spread],
        [0, root],
      ],
      Math.min(length, spread) * 0.45,
    ),
  pointedFin: ({ length = 18, spread = 8, root = 5, sweep = 0.4 } = {}) =>
    roundedLocal(
      [
        [0, -root],
        [length, -spread * sweep],
        [length * 0.8, spread],
        [0, root],
      ],
      2.5,
    ),
  leaf: ({ length = 20, width = 8 } = {}) =>
    roundedLocal(
      [
        [0, -width * 0.3],
        [length * 0.5, -width],
        [length, 0],
        [length * 0.5, width],
        [0, width * 0.3],
      ],
      width * 0.6,
    ),
});
