import { assert, number } from '../core/validate.js';
const RATE = 120,
  MAX = 200000,
  clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
  smooth = (t) => t * t * (3 - 2 * t);
/** Existing follow planner extended to authored root levels; a down foot is a fixed world point. */
export function planRootFollow2D({ sample, sampleY, end, layout, rest, sizeAt, facingAt, config }) {
  const count = Math.ceil(end * RATE) + 1;
  assert(count > 0 && count <= MAX, 'RESOURCE_LIMIT', 'Root-follow plans support at most200000 samples at120Hz.');
  const xs = new Float64Array(count),
    ys = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    const t = Math.min(end, i / RATE);
    xs[i] = number(sample(t), 'root x');
    ys[i] = number(sampleY(t), 'root y');
  }
  const at = (data, time) => {
      const f = clamp(time * RATE, 0, count - 1),
        i = Math.floor(f),
        j = Math.min(i + 1, count - 1);
      return data[i] + (data[j] - data[i]) * (f - i);
    },
    root = (t) => ({ x: at(xs, t), y: at(ys, t) });
  if (config.feet === 'none')
    return Object.freeze({
      duration: end,
      rate: RATE,
      samples: count,
      steps: Object.freeze([]),
      sample: (t) => {
        const p = root(t),
          before = root(Math.max(0, t - 1 / RATE)),
          after = root(Math.min(end, t + 1 / RATE)),
          dt = Math.min(end, t + 1 / RATE) - Math.max(0, t - 1 / RATE);
        return { ...p, velocity: dt ? (after.x - before.x) / dt : 0, velocityY: dt ? (after.y - before.y) / dt : 0 };
      },
    });
  const initial = Object.fromEntries(
      ['F', 'B'].map((side) => [
        side,
        {
          x: xs[0] + rest['foot' + side + '.x'] * sizeAt(0) * facingAt(0),
          y: ys[0] + rest['foot' + side + '.y'] * sizeAt(0),
        },
      ]),
    ),
    position = { F: { ...initial.F }, B: { ...initial.B } },
    steps = [];
  let active = null,
    lastSide = 'B',
    work = 0;
  const footDuring = (step, time) => {
    const u = clamp((time - step.at) / (step.end - step.at), 0, 1),
      k = smooth(u);
    return {
      x: step.from.x + (step.to.x - step.from.x) * k,
      y: step.from.y + (step.to.y - step.from.y) * k - step.lift * Math.sin(Math.PI * u),
      down: time >= step.end,
    };
  };
  const feasible = (feet, t) => {
    const r = root(t),
      s = sizeAt(t),
      f = facingAt(t),
      reach = layout.leg * 0.97 * s;
    let lower = -Infinity,
      upper = Infinity;
    for (const side of ['F', 'B']) {
      const dx = feet[side].x - r.x - (layout.hipX?.[side] ?? 0) * s * f;
      if (Math.abs(dx) > reach) return false;
      const vertical = Math.sqrt(Math.max(0, reach * reach - dx * dx)),
        targetY = feet[side].y - (layout.ankle ?? 0) * s;
      lower = Math.max(lower, targetY - vertical);
      upper = Math.min(upper, targetY + vertical);
    }
    return Math.max(lower, r.y + layout.HIP[1] * s) <= upper + 1e-6;
  };
  for (let i = 0; i < count; i++) {
    const t = Math.min(end, i / RATE),
      r = root(t),
      s = sizeAt(t),
      f = facingAt(t),
      future = root(Math.min(end, t + 1 / RATE)),
      vx = (future.x - r.x) * RATE,
      vy = (future.y - r.y) * RATE;
    if (active && t >= active.end - 1e-10) {
      position[active.side] = { ...active.to };
      active = null;
    }
    if (!active && t < end) {
      let candidate = null,
        error = 0;
      for (const side of [lastSide === 'F' ? 'B' : 'F', lastSide]) {
        const want = { x: r.x + rest['foot' + side + '.x'] * s * f, y: r.y + rest['foot' + side + '.y'] * s },
          e = Math.hypot(want.x - position[side].x, want.y - position[side].y),
          settling = Math.abs(vx) + Math.abs(vy) < 1e-6 && e > 1e-5;
        if ((e > config.threshold * s || settling) && e > error) {
          candidate = side;
          error = e;
        }
      }
      if (candidate) {
        const other = candidate === 'F' ? 'B' : 'F';
        let chosen = null;
        for (let frames = Math.max(1, Math.floor(config.duration * RATE)); frames >= 1; frames--) {
          const finish = Math.min(end, t + frames / RATE);
          if (finish <= t) continue;
          const destination = root(Math.min(end, finish + config.lead)),
            landing = root(finish),
            ls = sizeAt(finish),
            lf = facingAt(finish),
            limit = Math.min(config.maxLead * ls, layout.leg * 0.35 * ls),
            to = {
              x:
                landing.x + rest['foot' + candidate + '.x'] * ls * lf + clamp(destination.x - landing.x, -limit, limit),
              y: landing.y + rest['foot' + candidate + '.y'] * ls + clamp(destination.y - landing.y, -limit, limit),
            },
            step = {
              side: candidate,
              at: t,
              end: finish,
              from: { ...position[candidate] },
              to,
              lift: Math.min(config.lift, layout.leg * 0.2) * s,
            };
          let ok = true;
          const checks = Math.max(2, Math.ceil((finish - t) * RATE * 2));
          for (let k = 0; k <= checks; k++) {
            assert(++work <= 4000000, 'RESOURCE_LIMIT', '2D foot planning exceeds four million reach checks.');
            const time = t + ((finish - t) * k) / checks,
              moving = footDuring(step, time);
            if (!feasible({ [candidate]: moving, [other]: position[other] }, time)) {
              ok = false;
              break;
            }
          }
          if (ok) {
            chosen = step;
            break;
          }
        }
        assert(
          chosen,
          'FOLLOW_REACH',
          'The authored level change cannot retain one planted support foot; slow the track or enlarge the rig.',
        );
        active = chosen;
        steps.push(Object.freeze({ ...chosen, from: Object.freeze(chosen.from), to: Object.freeze(chosen.to) }));
        lastSide = candidate;
      }
    }
    const feet = {
      F: active?.side === 'F' ? footDuring(active, t) : position.F,
      B: active?.side === 'B' ? footDuring(active, t) : position.B,
    };
    assert(feasible(feet, t), 'FOLLOW_REACH', 'The authored root level outruns planted foot reach.');
  }
  const latest = (list, t, key) => {
      let lo = 0,
        hi = list.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (list[mid][key] <= t + 1e-10) lo = mid + 1;
        else hi = mid;
      }
      return list[lo - 1];
    },
    bySide = { F: steps.filter((s) => s.side === 'F'), B: steps.filter((s) => s.side === 'B') };
  return Object.freeze({
    duration: end,
    rate: RATE,
    samples: count,
    steps: Object.freeze(steps),
    sample: (time) => {
      const t = clamp(time, 0, end),
        p = root(t),
        before = root(Math.max(0, t - 1 / RATE)),
        after = root(Math.min(end, t + 1 / RATE)),
        dt = Math.min(end, t + 1 / RATE) - Math.max(0, t - 1 / RATE),
        step = latest(steps, t, 'at'),
        foot = (side) => {
          if (step?.side === side && t < step.end - 1e-10) return { ...footDuring(step, t), down: false };
          const landed = latest(bySide[side], t, 'end');
          return { ...(landed?.to ?? initial[side]), down: true };
        };
      return {
        ...p,
        velocity: dt ? (after.x - before.x) / dt : 0,
        velocityY: dt ? (after.y - before.y) / dt : 0,
        F: foot('F'),
        B: foot('B'),
      };
    },
  });
}
