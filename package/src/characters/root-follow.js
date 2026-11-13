import { planRootFollow2D } from './root-follow-2d.js';
import { assert, number, options, safeCopy } from '../core/validate.js';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
  smooth = (t) => t * t * (3 - 2 * t),
  RATE = 120,
  MAX_SAMPLES = 200000;
/** Capture an absolute scene-x track, holding its ends. Functions are trusted pure curves of seconds. */
export function captureRootTrack(scene, track, read) {
  if (typeof track === 'number') {
    number(track, 'root coordinate');
    return { end: 0, sample: () => track };
  }
  if (Array.isArray(track)) {
    const keys = safeCopy(track);
    assert(keys.length >= 2 && keys.length <= 10000, 'INVALID_FOLLOW', 'Use2–10000 [time,x] or [time,x,y] samples.');
    const columns = keys[0]?.length;
    assert(columns === 2 || columns === 3, 'INVALID_FOLLOW', 'Root samples need [time,x] or [time,x,y].');
    for (let i = 0; i < keys.length; i++) {
      assert(
        Array.isArray(keys[i]) && keys[i].length === columns,
        'INVALID_FOLLOW',
        'Root samples must use consistent coordinates.',
      );
      number(keys[i][0], 'root time', 0, 86400);
      number(keys[i][1], 'root x');
      if (columns === 3) number(keys[i][2], 'root y');
      assert(!i || keys[i][0] > keys[i - 1][0], 'INVALID_FOLLOW', 'Root sample times must increase.');
    }
    const coordinate = (t, column) => {
      if (t <= keys[0][0]) return keys[0][column];
      let lo = 0,
        hi = keys.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (keys[mid][0] <= t) lo = mid;
        else hi = mid;
      }
      if (t >= keys[hi][0]) return keys[hi][column];
      return (
        keys[lo][column] + ((keys[hi][column] - keys[lo][column]) * (t - keys[lo][0])) / (keys[hi][0] - keys[lo][0])
      );
    };
    return {
      end: keys.at(-1)[0],
      sample: (t) => coordinate(t, 1),
      ...(columns === 3 ? { hasY: true, sampleY: (t) => coordinate(t, 2) } : {}),
    };
  }
  if (scene._ownsInput(track))
    return { end: 0, sample: (t) => number(read(track, scene._sampleContext({ time: t })), 'root input') };
  if (track && typeof track === 'object' && Object.hasOwn(track, 'x')) {
    options(track, ['x', 'y'], 'root coordinate tracks');
    const x = captureRootTrack(scene, track.x, read),
      y = track.y === undefined ? null : captureRootTrack(scene, track.y, read);
    return { end: Math.max(x.end, y?.end ?? 0), sample: x.sample, ...(y ? { hasY: true, sampleY: y.sample } : {}) };
  }
  assert(
    typeof track === 'function' || (track && typeof track.sample === 'function'),
    'INVALID_FOLLOW',
    'Use a root track, pure function, curve.sample(seconds), or scene input.',
  );
  const call = (t) => (typeof track === 'function' ? track(t) : track.sample(t)),
    initial = call(0);
  if (initial && typeof initial === 'object') {
    const capture = (t) => {
      const point = call(t);
      options(point, ['x', 'y'], 'root point');
      return { x: number(point.x, 'root x'), y: number(point.y, 'root y') };
    };
    capture(0);
    return { end: 0, hasY: true, sample: (t) => capture(t).x, sampleY: (t) => capture(t).y };
  }
  number(initial, 'root curve');
  return { end: 0, sample: (t) => number(call(t), 'root curve') };
}
export function followOptions(spec = {}) {
  options(spec, ['feet', 'step', 'lean', 'weight'], 'follow');
  const feet = spec.feet ?? 'auto';
  assert(['auto', 'none'].includes(feet), 'INVALID_FOLLOW', 'Feet must be auto or none.');
  const step = spec.step ?? {};
  options(step, ['threshold', 'duration', 'lift', 'lead', 'maxLead'], 'follow step');
  assert(
    spec.lean === undefined || typeof spec.lean === 'function' || typeof spec.lean === 'number',
    'INVALID_FOLLOW',
    'Lean must be radians or a trusted velocity function.',
  );
  return Object.freeze({
    feet,
    threshold: number(step.threshold ?? 20, 'step threshold', 0.01, 10000),
    duration: number(step.duration ?? 0.13, 'step duration', 1 / 120, 10),
    lift: number(step.lift ?? 16, 'step lift', 0, 10000),
    lead: number(step.lead ?? 0.1, 'velocity lead', 0, 2),
    maxLead: number(step.maxLead ?? 30, 'maximum velocity lead', 0, 10000),
    weight: number(spec.weight ?? 1, 'follow weight', 0, 1),
    lean: spec.lean ?? ((v) => clamp(v / 700, -0.35, 0.35)),
  });
}
/** Fixed-rate plan with at most one swinging foot. Planted x is an anchor, never an interpolated local offset. */
export function planRootFollow({ sample, sampleY, end, layout, rest, sizeAt, facingAt, config }) {
  if (sampleY) return planRootFollow2D({ sample, sampleY, end, layout, rest, sizeAt, facingAt, config });
  const count = Math.ceil(end * RATE) + 1;
  assert(
    count >= 1 && count <= MAX_SAMPLES,
    'RESOURCE_LIMIT',
    'Root-follow plans are limited to 200000 samples at120Hz.',
  );
  const root = new Float64Array(count),
    steps = [];
  for (let i = 0; i < count; i++) root[i] = number(sample(Math.min(end, i / RATE)), 'planned root');
  const rootAt = (t) => {
    const f = clamp(t * RATE, 0, count - 1),
      i = Math.floor(f),
      j = Math.min(i + 1, count - 1);
    return root[i] + (root[j] - root[i]) * (f - i);
  };
  if (config.feet === 'none')
    return Object.freeze({
      sample: (time) => {
        const f = clamp(time * RATE, 0, count - 1),
          i = Math.floor(f),
          j = Math.min(i + 1, count - 1);
        return { x: rootAt(time), velocity: j === i ? 0 : (root[j] - root[i]) * RATE };
      },
      steps: Object.freeze([]),
      rate: RATE,
      samples: count,
      duration: end,
    });
  const initial = {
      F: root[0] + rest['footF.x'] * sizeAt(0) * facingAt(0),
      B: root[0] + rest['footB.x'] * sizeAt(0) * facingAt(0),
    },
    position = { ...initial };
  let active = null,
    lastSide = 'B',
    planningWork = 0;
  for (let i = 0; i < count; i++) {
    const t = Math.min(end, i / RATE),
      size = sizeAt(t),
      face = facingAt(t),
      v = i + 1 < count ? (root[i + 1] - root[i]) * RATE : i ? (root[i] - root[i - 1]) * RATE : 0,
      reach = layout.leg * 0.985 * size;
    assert(Number.isFinite(reach) && reach > 0, 'FOLLOW_REACH', 'Automatic feet require positive leg reach.');
    if (active && t >= active.end - 1e-10) {
      position[active.side] = active.to;
      active = null;
    }
    if (!active && config.feet === 'auto' && t < end) {
      let candidate = null,
        error = 0;
      for (const side of [lastSide === 'F' ? 'B' : 'F', lastSide]) {
        const want = root[i] + rest[`foot${side}.x`] * size * face,
          e = Math.abs(want - position[side]);
        if (e > config.threshold * size && e > error) {
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
          const landingSize = sizeAt(finish),
            lead = clamp(
              v * config.lead,
              -Math.min(config.maxLead * size, 0.4 * reach),
              Math.min(config.maxLead * size, 0.4 * reach),
            ),
            to = rootAt(finish) + rest[`foot${candidate}.x`] * landingSize * facingAt(finish) + lead;
          let feasible = true;
          const checks = Math.max(2, Math.ceil((finish - t) * RATE * 2));
          for (let k = 0; k <= checks; k++) {
            assert(
              ++planningWork <= 4000000,
              'RESOURCE_LIMIT',
              'Footstep lookahead exceeds four million reach checks.',
            );
            const u = k / checks,
              at = t + (finish - t) * u,
              s = sizeAt(at),
              rootX = rootAt(at),
              limit = layout.leg * 0.97 * s,
              fc = facingAt(at),
              moving = position[candidate] + (to - position[candidate]) * smooth(u);
            if (
              Math.abs(moving - rootX - (layout.hipX?.[candidate] ?? 0) * s * fc) > limit ||
              Math.abs(position[other] - rootX - (layout.hipX?.[other] ?? 0) * s * fc) > limit
            ) {
              feasible = false;
              break;
            }
          }
          if (feasible) {
            chosen = {
              side: candidate,
              at: t,
              end: finish,
              from: position[candidate],
              to,
              lift: Math.min(config.lift, layout.leg * 0.25) * size,
            };
            break;
          }
        }
        assert(
          chosen,
          'FOLLOW_REACH',
          'Root track cannot be followed with one planted support foot at120Hz; enlarge the figure or slow the track.',
        );
        active = chosen;
        steps.push(Object.freeze({ ...active }));
        lastSide = candidate;
      }
    }
    for (const side of ['F', 'B']) {
      let x = position[side],
        y = 0;
      if (active?.side === side) {
        const u = clamp((t - active.at) / (active.end - active.at), 0, 1);
        x = active.from + (active.to - active.from) * smooth(u);
        y = -active.lift * Math.sin(Math.PI * u);
      }
      const hip = (layout.hipX?.[side] ?? 0) * size * face + root[i];
      assert(
        Math.abs(x - hip) <= reach + 0.00001,
        'FOLLOW_REACH',
        `Root motion outruns ${side} leg reach; use a larger figure, slower track or shorter threshold.`,
      );
      assert(Number.isFinite(y), 'FOLLOW_REACH', 'Invalid swing height.');
    }
  }
  const sideSteps = { F: steps.filter((s) => s.side === 'F'), B: steps.filter((s) => s.side === 'B') };
  const latest = (list, t, key) => {
    let lo = 0,
      hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid][key] <= t + 1e-10) lo = mid + 1;
      else hi = mid;
    }
    return list[lo - 1];
  };
  const sampleAt = (time) => {
    const f = clamp(time * RATE, 0, count - 1),
      i = Math.floor(f),
      j = Math.min(i + 1, count - 1),
      t = clamp(time, 0, end),
      step = latest(steps, t, 'at'),
      foot = (side) => {
        if (step?.side === side && t < step.end - 1e-10) {
          const k = clamp((t - step.at) / (step.end - step.at), 0, 1);
          return {
            x: step.from + (step.to - step.from) * smooth(k),
            y: -step.lift * Math.sin(Math.PI * k),
            down: false,
          };
        }
        const landed = latest(sideSteps[side], t, 'end');
        return { x: landed?.to ?? initial[side], y: 0, down: true };
      };
    return { x: rootAt(time), velocity: j === i ? 0 : (root[j] - root[i]) * RATE, F: foot('F'), B: foot('B') };
  };
  return Object.freeze({ sample: sampleAt, steps: Object.freeze(steps), rate: RATE, samples: count, duration: end });
}
