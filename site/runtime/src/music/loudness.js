// Loudness after ITU-R BS.1770-4: a K-weighting pre-filter, mean square over
// sliding blocks, channel summation and the two-stage gate for integrated
// loudness. The filter is designed for the input sample rate, so it is only
// an approximation of the published 48 kHz coefficients at other rates.

function biquad(kind, gainDb, q, frequency, rate) {
  const a = 10 ** (gainDb / 40),
    w = (2 * Math.PI * frequency) / rate,
    cos = Math.cos(w),
    alpha = Math.sin(w) / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  if (kind === 'shelf') {
    const root = 2 * Math.sqrt(a) * alpha;
    b0 = a * (a + 1 + (a - 1) * cos + root);
    b1 = -2 * a * (a - 1 + (a + 1) * cos);
    b2 = a * (a + 1 + (a - 1) * cos - root);
    a0 = a + 1 - (a - 1) * cos + root;
    a1 = 2 * (a - 1 - (a + 1) * cos);
    a2 = a + 1 - (a - 1) * cos - root;
  } else {
    b0 = (1 + cos) / 2;
    b1 = -(1 + cos);
    b2 = (1 + cos) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cos;
    a2 = 1 - alpha;
  }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}

const toLufs = (power) => (power > 0 ? -0.691 + 10 * Math.log10(power) : -Infinity);

/**
 * Loudness measured every `step` seconds. `momentary` uses 400 ms blocks and
 * `shortTerm` uses 3 s blocks, both ending at the sample time, and `level`
 * is each step on its own. Values are in
 * LUFS, with -70 standing in for silence so the series stay finite.
 */
export function measureLoudness(pcm, step = 0.1) {
  const rate = pcm.sampleRate,
    shelf = biquad('shelf', 4, Math.SQRT1_2, 1500, rate),
    pass = biquad('pass', 0, 0.5, 38, rate),
    hop = Math.max(1, Math.round(step * rate)),
    steps = Math.ceil(pcm.length / hop),
    power = new Float64Array(steps);
  for (const channel of pcm.channels) {
    let x1 = 0,
      x2 = 0,
      y1 = 0,
      y2 = 0,
      z1 = 0,
      z2 = 0,
      w1 = 0,
      w2 = 0;
    for (let i = 0; i < pcm.length; i++) {
      const x = channel[i],
        y = shelf[0] * x + shelf[1] * x1 + shelf[2] * x2 - shelf[3] * y1 - shelf[4] * y2;
      x2 = x1;
      x1 = x;
      y2 = y1;
      y1 = y;
      const z = pass[0] * y + pass[1] * w1 + pass[2] * w2 - pass[3] * z1 - pass[4] * z2;
      w2 = w1;
      w1 = y;
      z2 = z1;
      z1 = z;
      power[Math.floor(i / hop)] += z * z;
    }
  }
  const prefix = new Float64Array(steps + 1);
  for (let i = 0; i < steps; i++) prefix[i + 1] = prefix[i] + power[i];
  const block = (seconds) => {
    const width = Math.max(1, Math.round(seconds / step)),
      out = new Float64Array(steps);
    for (let i = 0; i < steps; i++) {
      const a = Math.max(0, i + 1 - width),
        samples = Math.min(pcm.length, (i + 1) * hop) - a * hop;
      out[i] = Math.max(-70, toLufs((prefix[i + 1] - prefix[a]) / Math.max(1, samples)));
    }
    return out;
  };
  const momentary = block(0.4),
    shortTerm = block(3);
  // Gated integration over 400 ms blocks with 75 % overlap.
  const blockSteps = Math.max(1, Math.round(0.4 / step)),
    hopSteps = Math.max(1, Math.round(0.1 / step)),
    blocks = [];
  for (let end = blockSteps; end <= steps; end += hopSteps) {
    const p = (prefix[end] - prefix[end - blockSteps]) / (blockSteps * hop);
    if (toLufs(p) > -70) blocks.push(p);
  }
  let integrated = -70;
  if (blocks.length) {
    const relative = toLufs(blocks.reduce((n, p) => n + p, 0) / blocks.length) - 10,
      gated = blocks.filter((p) => toLufs(p) > relative);
    if (gated.length) integrated = Math.max(-70, toLufs(gated.reduce((n, p) => n + p, 0) / gated.length));
  }
  // The unsmoothed level of each step, for finding short gaps.
  const level = Float64Array.from(power, (p, i) =>
    Math.max(-70, toLufs(p / Math.max(1, Math.min(pcm.length, (i + 1) * hop) - i * hop))),
  );
  return { step: hop / rate, momentary, shortTerm, level, integrated };
}
