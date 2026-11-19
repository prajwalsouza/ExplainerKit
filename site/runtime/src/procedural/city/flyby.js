import { assert, number, options } from '../../core/validate.js';
import { randomAt } from '../../noise/vector.js';

// A flyby is a camera flight through a city model, like a small drone flown in first person.
// The planner threads a path through open space: it keeps a set distance from walls and tree
// trunks, climbs over anything it cannot pass, banks into turns and always looks along its own
// path, so the view ahead is never blocked. The result is a pure function of time.

const MAX_SAMPLES = 20000;

function clearance(city) {
  const f = city.field;
  assert(f && f.wall && f.cell > 0, 'INVALID_CITY', 'Pass a city model from buildCity().');
  const wall = (x, y) => {
    const i = Math.min(f.width - 1, Math.max(0, Math.round((x - f.x0) / f.cell - 0.5))),
      j = Math.min(f.height - 1, Math.max(0, Math.round((y - f.y0) / f.cell - 0.5)));
    return f.wall[j * f.width + i];
  };
  // Trees in a coarse grid, so each query looks at a handful of trunks.
  const size = 12,
    grid = new Map();
  for (const t of city.trees ?? []) {
    const key = `${Math.floor(t.x / size)},${Math.floor(t.y / size)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(t);
  }
  const tree = (x, y, height) => {
    let best = Infinity;
    const gx = Math.floor(x / size),
      gy = Math.floor(y / size);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const t of grid.get(`${gx + dx},${gy + dy}`) ?? []) {
          if (height > t.height + 1) continue;
          // Below the crown only the trunk is in the way; inside the crown the whole crown is.
          const radius = height > t.height * 0.4 ? t.height * 0.32 : 0.5;
          best = Math.min(best, Math.hypot(x - t.x, y - t.y) - radius);
        }
    return best;
  };
  return { wall, tree, at: (x, y, height) => Math.min(wall(x, y), tree(x, y, height)), cell: f.cell };
}

/**
 * Plan a flight. `route` is an optional list of {x, z} places to pass in scene coordinates;
 * without one the planner tours the junctions of the model. `height` is the cruising height in
 * metres, `clearance` the distance kept from walls and trees, `speed` in metres a second.
 * Returns {duration, length, minClearance, climbs, pose(time)}; a pose is {position, target,
 * roll, fov, speed} with roll in radians, positive banking to the right.
 */
export function planFlyby(city, spec = {}) {
  options(
    spec,
    ['route', 'height', 'clearance', 'speed', 'duration', 'lookAhead', 'bank', 'seed', 'stops', 'fov', 'loop'],
    'planFlyby',
  );
  const room = clearance(city);
  const cruise = number(spec.height ?? 3.2, 'flight height', 0.5, 2000),
    keep = number(spec.clearance ?? 3, 'clearance', 0.2, 100),
    speed = number(spec.speed ?? 9, 'speed', 0.1, 200),
    lookAhead = number(spec.lookAhead ?? 22, 'look ahead', 1, 500),
    maxBank = number(spec.bank ?? 0.45, 'bank', 0, 1.2),
    fov = number(spec.fov ?? 62, 'field of view', 10, 140),
    seed = number(spec.seed ?? 1, 'seed', 0, 0xffffffff) >>> 0,
    stops = number(spec.stops ?? 7, 'stops', 2, 200);
  const top = (city.bounds?.top ?? 30) + 6;
  const b = city.bounds;

  // 1. Places to pass, in map coordinates (y north; scene z is -y).
  let places;
  if (spec.route !== undefined) {
    assert(
      Array.isArray(spec.route) && spec.route.length >= 2 && spec.route.length <= 500,
      'INVALID_ROUTE',
      'A route is 2 to 500 places.',
    );
    places = spec.route.map((p) => {
      options(p, ['x', 'z'], 'route place');
      return { x: number(p.x, 'route x', -1e6, 1e6), y: -number(p.z, 'route z', -1e6, 1e6) };
    });
  } else {
    // Junctions are open ground with streets leading off them, so they make good waypoints.
    const inset = 25;
    const pool = (city.junctions ?? [])
      .map((j) => ({ x: j.x, y: j.y }))
      .filter(
        (p) =>
          p.x > b.x0 + inset &&
          p.x < b.x1 - inset &&
          -p.y > b.z0 + inset &&
          -p.y < b.z1 - inset &&
          room.wall(p.x, p.y) > keep,
      );
    assert(pool.length >= 2, 'INVALID_ROUTE', 'This model has too few open junctions to plan a flight. Pass a route.');
    // Spread the stops out: start anywhere, then keep taking the junction farthest from those taken.
    const chosen = [pool[Math.floor(randomAt(seed, 1, 0) * pool.length)]];
    while (chosen.length < Math.min(stops, pool.length)) {
      let best = null,
        bestD = -1;
      for (const p of pool) {
        const d = Math.min(...chosen.map((q) => Math.hypot(p.x - q.x, p.y - q.y)));
        if (d > bestD) {
          bestD = d;
          best = p;
        }
      }
      chosen.push(best);
    }
    // Visit them in a short tour: always fly to the nearest stop not yet visited.
    places = [chosen.shift()];
    while (chosen.length) {
      const last = places.at(-1);
      let k = 0;
      for (let i = 1; i < chosen.length; i++)
        if (
          Math.hypot(chosen[i].x - last.x, chosen[i].y - last.y) <
          Math.hypot(chosen[k].x - last.x, chosen[k].y - last.y)
        )
          k = i;
      places.push(chosen.splice(k, 1)[0]);
    }
    if (spec.loop) places.push(places[0]);
  }

  // 2. A smooth curve through the places, sampled every two metres.
  const step = 2;
  let pts = [];
  const P = (i) => places[Math.min(places.length - 1, Math.max(0, i))];
  for (let i = 0; i < places.length - 1; i++) {
    const p0 = P(i - 1),
      p1 = P(i),
      p2 = P(i + 1),
      p3 = P(i + 2);
    const n = Math.max(2, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n,
        t2 = t * t,
        t3 = t2 * t;
      const cr = (a, bb, c, d) =>
        0.5 * (2 * bb + (-a + c) * t + (2 * a - 5 * bb + 4 * c - d) * t2 + (-a + 3 * bb - 3 * c + d) * t3);
      pts.push({ x: cr(p0.x, p1.x, p2.x, p3.x), y: cr(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  pts.push({ ...places.at(-1) });
  assert(pts.length <= MAX_SAMPLES, 'RESOURCE_LIMIT', 'This flight is too long. Use fewer places or a shorter route.');

  // 3. Push the path into open space, then smooth it, a few times over.
  const push = (p, strength) => {
    for (let k = 0; k < 8; k++) {
      const d = room.at(p.x, p.y, cruise);
      if (d >= keep) return;
      const e = room.cell * 2;
      const gx = room.at(p.x + e, p.y, cruise) - room.at(p.x - e, p.y, cruise),
        gy = room.at(p.x, p.y + e, cruise) - room.at(p.x, p.y - e, cruise),
        l = Math.hypot(gx, gy);
      if (l < 1e-6) return;
      const move = Math.min(1.5, keep - d) * strength;
      p.x += (gx / l) * move;
      p.y += (gy / l) * move;
    }
  };
  for (let pass = 0; pass < 4; pass++) {
    for (const p of pts) push(p, 1);
    // Smooth, keeping the two ends where they are.
    for (let s = 0; s < 6; s++)
      pts = pts.map((p, i) =>
        i === 0 || i === pts.length - 1
          ? p
          : { x: (pts[i - 1].x + 2 * p.x + pts[i + 1].x) / 4, y: (pts[i - 1].y + 2 * p.y + pts[i + 1].y) / 4 },
      );
  }
  for (const p of pts) push(p, 0.6);

  // 4. Where the path still cannot pass at cruising height, fly over the rooftops instead.
  const blocked = pts.map((p) => room.at(p.x, p.y, cruise) < keep * 0.55);
  const reach = Math.ceil(18 / step);
  let alt = pts.map((_, i) => {
    for (let k = Math.max(0, i - reach); k <= Math.min(pts.length - 1, i + reach); k++) if (blocked[k]) return top;
    return cruise;
  });
  const soften = Math.ceil(10 / step);
  for (let s = 0; s < 3; s++)
    alt = alt.map((_, i) => {
      let sum = 0,
        n = 0;
      for (let k = Math.max(0, i - soften); k <= Math.min(alt.length - 1, i + soften); k++) {
        sum += alt[k];
        n++;
      }
      return sum / n;
    });
  // A gentle rise and fall while cruising, so the flight breathes instead of running on rails.
  alt = alt.map((a, i) => a + 0.5 * Math.sin(i * step * 0.045 + seed) * Math.min(1, cruise / 3));
  let climbs = 0;
  for (let i = 1; i < blocked.length; i++) if (blocked[i] && !blocked[i - 1]) climbs++;

  // 5. Distance along the path, and what the flight achieved.
  const cum = [0];
  for (let i = 1; i < pts.length; i++)
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const length = cum.at(-1);
  assert(length > 1, 'INVALID_ROUTE', 'The places of this route are all in one spot.');
  let minClearance = Infinity;
  pts.forEach((p, i) => {
    if (alt[i] < top - 4) minClearance = Math.min(minClearance, room.at(p.x, p.y, alt[i]));
  });
  const duration = number(spec.duration ?? length / speed, 'duration', 0.1, 86400);
  const at = (s) => {
    const d = Math.min(length, Math.max(0, s));
    let lo = 0,
      hi = cum.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (cum[m] <= d) lo = m;
      else hi = m;
    }
    const t = (d - cum[lo]) / Math.max(1e-9, cum[hi] - cum[lo]);
    return {
      x: pts[lo].x + (pts[hi].x - pts[lo].x) * t,
      y: pts[lo].y + (pts[hi].y - pts[lo].y) * t,
      alt: alt[lo] + (alt[hi] - alt[lo]) * t,
    };
  };
  // Ease in and out over the first and last tenth; fly at a steady speed between.
  const ramp = 0.1;
  const along = (u) => {
    const v = Math.min(1, Math.max(0, u)),
      peak = 1 / (1 - ramp);
    if (v < ramp) return (peak * v * v) / (2 * ramp);
    if (v > 1 - ramp) return 1 - (peak * (1 - v) * (1 - v)) / (2 * ramp);
    return (peak * ramp) / 2 + peak * (v - ramp);
  };
  const heading = (s) => {
    const a = at(s - 3),
      c = at(s + 3);
    return Math.atan2(c.x - a.x, c.y - a.y);
  };

  return Object.freeze({
    duration,
    length,
    minClearance,
    climbs,
    /** The planned path as scene points, for drawing or checking. */
    points: Object.freeze(pts.map((p, i) => Object.freeze({ x: p.x, y: alt[i], z: -p.y }))),
    pose(time) {
      number(time, 'time', -1e7, 1e7);
      const u = time / duration,
        s = along(u) * length;
      const here = at(s),
        ahead = at(s + lookAhead);
      // Near the end the look-ahead point stops; keep looking along the last heading.
      const short = lookAhead - Math.hypot(ahead.x - here.x, ahead.y - here.y);
      const h = heading(Math.min(s, length - 3));
      const tx = ahead.x + (short > 0 ? Math.sin(h) * short : 0),
        ty = ahead.y + (short > 0 ? Math.cos(h) * short : 0);
      // Bank into the turn, as an aircraft does: more at speed and in tighter turns.
      const v = (length / duration) * (u < ramp || u > 1 - ramp ? 0.6 : 1),
        turn = Math.atan2(Math.sin(heading(s + 6) - heading(s - 6)), Math.cos(heading(s + 6) - heading(s - 6))) / 12;
      const roll = Math.max(-maxBank, Math.min(maxBank, Math.atan((v * v * turn) / 9.81) * 1.6));
      return Object.freeze({
        position: Object.freeze([here.x, here.alt, -here.y]),
        // Look a little below the horizon when high, so the streets stay in view.
        target: Object.freeze([tx, ahead.alt - Math.max(0, here.alt - cruise) * 0.35 - 0.2, -ty]),
        roll,
        fov,
        speed: v,
      });
    },
  });
}
