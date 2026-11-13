import { assert, number, safeCopy } from './validate.js';

/** Shape-preserving piecewise cubic Hermite interpolation (PCHIP).
 * Local extrema get zero slope; monotone spans never invent an extra overshoot.
 * Reference: Fritsch & Butland, SIAM J Sci Stat Comput 5(2), 1984, 300–304.
 * @param {number[]|{times:number[],values:number[]}} times
 * @param {number[]} [values]
 * @returns {(progress:number)=>number}
 */
export function sampledEasing(times, values = undefined) {
  if (values === undefined) {
    const input = safeCopy(times);
    if (Array.isArray(input)) {
      values = input;
      times = input.map((_, i) => i);
    } else {
      assert(
        input && Array.isArray(input.times) && Array.isArray(input.values),
        'INVALID_EASING_SAMPLES',
        'Supply times and values, or an evenly timed progress array.',
      );
      times = input.times;
      values = input.values;
    }
  }
  const xs = safeCopy(times),
    ys = safeCopy(values);
  assert(
    Array.isArray(xs) && Array.isArray(ys) && xs.length === ys.length && xs.length >= 2 && xs.length <= 10000,
    'INVALID_EASING_SAMPLES',
    'Use 2–10000 paired samples.',
  );
  for (let i = 0; i < xs.length; i++) {
    number(xs[i], 'sample time');
    number(ys[i], 'sample value');
    assert(!i || xs[i] > xs[i - 1], 'INVALID_EASING_SAMPLES', 'Sample times must be strictly increasing.');
  }
  const duration = xs.at(-1) - xs[0],
    change = ys.at(-1) - ys[0];
  assert(
    Math.abs(change) > 1e-12 && duration > 1e-12,
    'INVALID_EASING_SAMPLES',
    'An easing needs distinct endpoint times and values.',
  );
  const x = xs.map((v) => (v - xs[0]) / duration),
    y = ys.map((v) => (v - ys[0]) / change);
  assert(
    x.every(Number.isFinite) && y.every((v) => Number.isFinite(v) && Math.abs(v) <= 1e7),
    'INVALID_EASING_SAMPLES',
    'Normalized samples must remain finite within the easing output range.',
  );
  const h = x.slice(1).map((v, i) => v - x[i]),
    delta = h.map((v, i) => (y[i + 1] - y[i]) / v),
    slopes = new Array(x.length);
  assert(
    h.every((v) => v > 0 && Number.isFinite(v)) && delta.every(Number.isFinite),
    'INVALID_EASING_SAMPLES',
    'Sample spacing must support finite interpolation derivatives.',
  );
  for (let i = 1; i < x.length - 1; i++) {
    const before = delta[i - 1],
      after = delta[i],
      w1 = 2 * h[i] + h[i - 1],
      w2 = h[i] + 2 * h[i - 1];
    slopes[i] = before * after <= 0 ? 0 : (w1 + w2) / (w1 / before + w2 / after);
  }
  const endSlope = (h0, h1, d0, d1) => {
    const value = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
    return Math.sign(value) !== Math.sign(d0)
      ? 0
      : Math.sign(d0) !== Math.sign(d1) && Math.abs(value) > Math.abs(3 * d0)
        ? 3 * d0
        : value;
  };
  slopes[0] = x.length === 2 ? delta[0] : endSlope(h[0], h[1], delta[0], delta[1]);
  slopes[x.length - 1] = x.length === 2 ? delta[0] : endSlope(h.at(-1), h.at(-2), delta.at(-1), delta.at(-2));
  assert(
    slopes.every(Number.isFinite),
    'INVALID_EASING_SAMPLES',
    'Sample spacing produces unrepresentable interpolation slopes.',
  );
  return Object.freeze((progress) => {
    number(progress, 'easing progress');
    if (progress <= 0) return 0;
    if (progress >= 1) return 1;
    let low = 0,
      high = x.length - 1;
    while (high - low > 1) {
      const middle = (low + high) >>> 1;
      if (x[middle] > progress) high = middle;
      else low = middle;
    }
    if (progress === x[low]) return y[low];
    const u = (progress - x[low]) / h[low],
      u2 = u * u,
      u3 = u2 * u;
    return number(
      (2 * u3 - 3 * u2 + 1) * y[low] +
        (u3 - 2 * u2 + u) * h[low] * slopes[low] +
        (-2 * u3 + 3 * u2) * y[high] +
        (u3 - u2) * h[low] * slopes[high],
      'sampled easing output',
    );
  });
}

/** Adapter for local track.py JSON. Reference sample data remains outside the repository. */
export function easingFromTrack(input) {
  const track = safeCopy(input);
  if (track?.progress && !Array.isArray(track.progress)) return sampledEasing(track.progress);
  if (Array.isArray(track?.progress))
    return sampledEasing(track.times ?? track.progress.map((_, i) => i), track.progress);
  if (Array.isArray(track?.times) && Array.isArray(track?.values)) return sampledEasing(track.times, track.values);
  assert(
    track && typeof track.measure === 'string' && Array.isArray(track.samples),
    'INVALID_EASING_SAMPLES',
    'Use track.py samples plus a measure, or progress/times arrays.',
  );
  const rows = track.samples.filter((row) => row && row.present && typeof row[track.measure] === 'number');
  return sampledEasing(
    rows.map((row) => row.t),
    rows.map((row) => row[track.measure]),
  );
}
