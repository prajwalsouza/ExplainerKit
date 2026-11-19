import { assert, number, options, text } from '../core/validate.js';
import { randomAt, seedValue } from '../noise/vector.js';
import { gradientRaw2 } from '../noise/gradient.js';
import { hsla, toHSLA } from '../color/space.js';

// Seeded, index-addressed variation. Every value is a pure function of (seed, index, key),
// so changing one item never changes another and a scrubbed or replayed frame matches.

const PRESETS = Object.freeze({
  natural: Object.freeze({ amount: 1, rare: 0.04, dropout: 0.03 }),
  botanical: Object.freeze({ amount: 1.1, rare: 0.05, dropout: 0.05 }),
  handmade: Object.freeze({ amount: 0.8, rare: 0.06, dropout: 0.02 }),
  architectural: Object.freeze({ amount: 0.35, rare: 0.02, dropout: 0.01 }),
  weathered: Object.freeze({ amount: 1.4, rare: 0.1, dropout: 0.08 }),
});
export const variationPresets = Object.freeze(Object.keys(PRESETS));

function keyHash(key) {
  text(key, 'variation key', 128);
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
  return h >>> 0;
}
function index(i) {
  number(i, 'variation index', 0, 0x7fffffff);
  assert(Number.isInteger(i), 'INVALID_INDEX', 'A variation index must be a whole number from 0.');
  return i;
}
// Standard normal from two hashed uniforms (Box-Muller), clipped to +-clip standard deviations.
function normalAt(seed, i, channel, clip) {
  const u = Math.max(randomAt(seed, i, channel), 1e-12),
    v = randomAt(seed, i, channel + 1);
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.max(-clip, Math.min(clip, z));
}
// Abramowitz-Stegun 7.1.26 error function, accurate to about 1.5e-7.
function erf(x) {
  const s = Math.sign(x),
    a = Math.abs(x),
    t = 1 / (1 + 0.3275911 * a);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
}
const normalCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
// Bell-shaped value in [-1, 1]: the mean of three uniforms, so extremes are rare but possible.
const bell = (seed, i, channel) =>
  ((randomAt(seed, i, channel) + randomAt(seed, i, channel + 1) + randomAt(seed, i, channel + 2)) / 3 - 0.5) * 2;

function cholesky(matrix) {
  const n = matrix.length,
    L = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= i; j++) {
      let sum = matrix[i][j];
      for (let k = 0; k < j; k++) sum -= L[i][k] * L[j][k];
      if (i === j) {
        assert(
          sum > 1e-9,
          'INVALID_CORRELATION',
          'These trait correlations cannot all hold at once. Weaken one of them.',
        );
        L[i][i] = Math.sqrt(sum);
      } else L[i][j] = sum / L[j][j];
    }
  return L;
}

/**
 * Create a variation source. `seed` picks the family of values; `preset` names a style of
 * variation; `amount` scales every default spread (0 gives identical copies).
 */
export function variation(spec = {}) {
  options(spec, ['seed', 'preset', 'amount'], 'variation');
  const seed = seedValue(spec.seed ?? 0);
  const presetName = spec.preset ?? 'natural';
  assert(
    Object.hasOwn(PRESETS, presetName),
    'INVALID_PRESET',
    `Use a variation preset: ${variationPresets.join(', ')}.`,
  );
  const preset = PRESETS[presetName];
  const amount = number(spec.amount ?? 1, 'variation amount', 0, 10) * preset.amount;
  const channel = (key, fallback) => (keyHash(key ?? fallback) * 8) >>> 0;
  const spreadOf = (value, fallback) =>
    value === undefined ? fallback * amount : number(value, 'variation spread', 0, 1e6);

  const api = {
    seed,
    preset: presetName,
    amount,
    /** A uniform number in [0, 1). Prefer the shaped helpers for visible attributes. */
    random(i, s = {}) {
      options(s, ['key'], 'variation random');
      return randomAt(seed, index(i), channel(s.key, 'random'));
    },
    /** A standard normal value clipped to +-clip (default 3). */
    normal(i, s = {}) {
      options(s, ['key', 'clip'], 'variation normal');
      return normalAt(seed, index(i), channel(s.key, 'normal'), number(s.clip ?? 3, 'normal clip', 0.1, 6));
    },
    /** Bounded normal around `center` with standard deviation `spread` in the value's units. */
    around(i, center, s = {}) {
      options(s, ['spread', 'clip', 'key'], 'variation around');
      number(center, 'variation center', -1e9, 1e9);
      const spread = spreadOf(s.spread, Math.abs(center) * 0.08 || 0.08);
      return center + spread * api.normal(i, { key: s.key ?? 'around', clip: s.clip ?? 3 });
    },
    /** Log-normal size around `typical`: positive, skewed toward a few larger items. */
    size(i, typical, s = {}) {
      options(s, ['spread', 'clip', 'key'], 'variation size');
      number(typical, 'typical size', 0, 1e9);
      const spread = Math.min(spreadOf(s.spread, 0.18), 3);
      return typical * Math.exp(spread * api.normal(i, { key: s.key ?? 'size', clip: s.clip ?? 3 }));
    },
    /** A direction near `base` radians, wrapped to (-pi, pi]. */
    angle(i, base = 0, s = {}) {
      options(s, ['spread', 'clip', 'key'], 'variation angle');
      number(base, 'base angle', -1e4, 1e4);
      let a = base + spreadOf(s.spread, 0.12) * api.normal(i, { key: s.key ?? 'angle', clip: s.clip ?? 3 });
      a = Math.atan2(Math.sin(a), Math.cos(a));
      return a === -Math.PI ? Math.PI : a;
    },
    /** A value in [low, high]; `shape:'bell'` (default) favours the middle, 'uniform' does not. */
    between(i, low, high, s = {}) {
      options(s, ['shape', 'key'], 'variation between');
      number(low, 'low bound', -1e9, 1e9);
      number(high, 'high bound', low, 1e9);
      const shape = s.shape ?? 'bell';
      assert(shape === 'bell' || shape === 'uniform', 'INVALID_SHAPE', "Use shape 'bell' or 'uniform'.");
      const c = channel(s.key, 'between');
      const u = shape === 'uniform' ? randomAt(seed, index(i), c) : (bell(seed, index(i), c) + 1) / 2;
      return low + (high - low) * u;
    },
    /** Weighted choice: pick(i, {ivory: 6, sage: 3, charcoal: 1}) returns one key. */
    pick(i, weights, s = {}) {
      options(s, ['key'], 'variation pick');
      assert(
        weights && typeof weights === 'object' && !Array.isArray(weights),
        'INVALID_WEIGHTS',
        'Give weights as {name: weight}.',
      );
      const entries = Object.entries(weights);
      assert(
        entries.length > 0 && entries.length <= 1000,
        'INVALID_WEIGHTS',
        'Give between 1 and 1000 weighted choices.',
      );
      let total = 0;
      for (const [, w] of entries) total += number(w, 'choice weight', 0, 1e9);
      assert(total > 0, 'INVALID_WEIGHTS', 'At least one choice needs a positive weight.');
      let r = randomAt(seed, index(i), channel(s.key, 'pick')) * total;
      for (const [name, w] of entries) if ((r -= w) < 0) return name;
      return entries.findLast(([, w]) => w > 0)[0];
    },
    /** True with probability `p`. */
    chance(i, p, s = {}) {
      options(s, ['key'], 'variation chance');
      return randomAt(seed, index(i), channel(s.key, 'chance')) < number(p, 'chance', 0, 1);
    },
    /** True for roughly `rate` of items (the preset's rate by default): a missing filament, a gap. */
    dropout(i, rate, s = {}) {
      options(s, ['key'], 'variation dropout');
      return api.chance(i, rate ?? preset.dropout, { key: s.key ?? 'dropout' });
    },
    /** Mostly a small offset; for about `rate` of items a larger one. Offsets are in the base's units. */
    misalign(i, base, s = {}) {
      options(s, ['usual', 'rare', 'rate', 'key'], 'variation misalign');
      number(base, 'misalign base', -1e9, 1e9);
      const usual = spreadOf(s.usual, 0.02),
        rare = spreadOf(s.rare, 0.25),
        rate = number(s.rate ?? preset.rare, 'rare rate', 0, 1);
      const key = s.key ?? 'misalign';
      const big = api.chance(i, rate, { key: key + ':rare' });
      return base + (big ? rare : usual) * api.normal(i, { key, clip: 3 });
    },
    /**
     * Several attributes from one hidden character, so they agree. `ranges` maps names to
     * [low, high]; `correlate` lists [a, b, r] pairs with r in (-1, 1). Each trait is spread
     * evenly over its range and pairs reach the requested rank correlation.
     */
    traits(i, ranges, s = {}) {
      options(s, ['correlate', 'key'], 'variation traits');
      assert(
        ranges && typeof ranges === 'object' && !Array.isArray(ranges),
        'INVALID_TRAITS',
        'Give traits as {name: [low, high]}.',
      );
      const names = Object.keys(ranges);
      assert(names.length > 0 && names.length <= 16, 'INVALID_TRAITS', 'Use between 1 and 16 traits.');
      for (const n of names) {
        const r = ranges[n];
        assert(Array.isArray(r) && r.length === 2, 'INVALID_TRAITS', `Trait ${n} needs [low, high].`);
        number(r[0], `${n} low`, -1e9, 1e9);
        number(r[1], `${n} high`, r[0], 1e9);
      }
      const matrix = names.map((_n, a) => names.map((_m, b) => (a === b ? 1 : 0)));
      const pairs = s.correlate ?? [];
      assert(
        Array.isArray(pairs) && pairs.length <= 120,
        'INVALID_CORRELATION',
        'Give correlate as a list of [a, b, r].',
      );
      for (const pair of pairs) {
        assert(Array.isArray(pair) && pair.length === 3, 'INVALID_CORRELATION', 'Each correlation is [a, b, r].');
        const a = names.indexOf(pair[0]),
          b = names.indexOf(pair[1]);
        assert(
          a >= 0 && b >= 0 && a !== b,
          'INVALID_CORRELATION',
          `Correlate two different named traits, not ${pair[0]} and ${pair[1]}.`,
        );
        const r = number(pair[2], 'correlation', -0.99, 0.99);
        // A Gaussian copula with correlation rho gives uniform marginals with rank correlation
        // (6/pi) asin(rho/2). Invert that so the author's r is what the reader sees.
        matrix[a][b] = matrix[b][a] = 2 * Math.sin((Math.PI * r) / 6);
      }
      const L = cholesky(matrix),
        base = s.key ?? 'traits';
      const z = names.map((n) => normalAt(seed, index(i), channel(base + ':' + n), 6));
      const out = {};
      names.forEach((n, row) => {
        let v = 0;
        for (let k = 0; k <= row; k++) v += L[row][k] * z[k];
        const [lo, hi] = ranges[n];
        out[n] = lo + (hi - lo) * normalCdf(v);
      });
      return Object.freeze(out);
    },
    /** A small bounded HSLA wobble around a swatch. Deltas are the largest change in degrees and percent. */
    tint(i, color, s = {}) {
      options(s, ['h', 's', 'l', 'key'], 'variation tint');
      const c = toHSLA(color),
        key = s.key ?? 'tint';
      const dh = spreadOf(s.h, 4),
        ds = spreadOf(s.s, 4),
        dl = spreadOf(s.l, 4);
      const ch = channel(key);
      return hsla(
        c.h + dh * bell(seed, index(i), ch),
        Math.max(0, Math.min(100, c.s + ds * bell(seed, i, ch + 3))),
        Math.max(0, Math.min(100, c.l + dl * bell(seed, i, ch + 6))),
        c.a,
      );
    },
    /** A tint that varies smoothly in space: neighbours within about `scale` units look alike. */
    tintAt(point, color, s = {}) {
      options(s, ['h', 's', 'l', 'scale', 'key'], 'variation tintAt');
      options(point, ['x', 'y'], 'tint point');
      const x = number(point.x, 'tint x'),
        y = number(point.y, 'tint y');
      const scale = number(s.scale ?? 200, 'tint scale', 1e-6, 1e7);
      const c = toHSLA(color),
        base = (seed ^ keyHash(s.key ?? 'tintAt')) >>> 0;
      const field = (k) => gradientRaw2(x / scale + k * 17.3, y / scale - k * 9.1, (base + k) >>> 0);
      return hsla(
        c.h + spreadOf(s.h, 3) * field(0),
        Math.max(0, Math.min(100, c.s + spreadOf(s.s, 3) * field(1))),
        Math.max(0, Math.min(100, c.l + spreadOf(s.l, 4) * field(2))),
        c.a,
      );
    },
    /** Coherent drift over time in [-amount, amount]: a flutter that wanders rather than jumps. */
    flutter(i, time, s = {}) {
      options(s, ['rate', 'amount', 'key'], 'variation flutter');
      number(time, 'flutter time', -1e7, 1e7);
      const rate = number(s.rate ?? 1, 'flutter rate', 0, 1e4),
        a = spreadOf(s.amount, 0.06);
      const base = (seed ^ keyHash(s.key ?? 'flutter')) >>> 0;
      return a * gradientRaw2(time * rate + 0.5, index(i) * 1.618 + 0.25, base);
    },
    /** A start time with a small bounded offset, so a sequence feels played rather than quantised. */
    humanize(i, time, s = {}) {
      options(s, ['ms', 'key'], 'variation humanize');
      number(time, 'humanize time', -1e7, 1e7);
      const ms = number(s.ms ?? 30, 'humanize milliseconds', 0, 10000) * Math.min(amount, 2);
      return time + (ms / 1000) * bell(seed, index(i), channel(s.key, 'humanize'));
    },
    /**
     * Clustered placement in a rectangle: `count` points around `clusters` centres, kept at least
     * `minDistance` apart where possible. Work is bounded by `attempts` per point.
     */
    cluster(s = {}) {
      options(s, ['count', 'region', 'clusters', 'spread', 'minDistance', 'attempts', 'key'], 'variation cluster');
      const count = number(s.count ?? 20, 'cluster count', 0, 20000);
      assert(Number.isInteger(count), 'INVALID_COUNT', 'Cluster count must be a whole number.');
      const r = s.region ?? { x: 0, y: 0, width: 1, height: 1 };
      options(r, ['x', 'y', 'width', 'height'], 'cluster region');
      const x0 = number(r.x ?? 0, 'region x'),
        y0 = number(r.y ?? 0, 'region y'),
        w = number(r.width, 'region width', 1e-9, 1e7),
        h = number(r.height, 'region height', 1e-9, 1e7);
      const k = number(s.clusters ?? Math.max(1, Math.round(Math.sqrt(count) / 2)), 'clusters', 1, 1000);
      assert(Number.isInteger(k), 'INVALID_COUNT', 'Cluster count must be a whole number.');
      const spread = number(s.spread ?? Math.min(w, h) / (k + 2), 'cluster spread', 0, 1e7);
      const minDistance = number(s.minDistance ?? 0, 'min distance', 0, 1e7);
      const attempts = number(s.attempts ?? 24, 'attempts', 1, 200);
      const ch = channel(s.key, 'cluster');
      const centres = Array.from({ length: k }, (_, c) => ({
        x: x0 + w * (0.1 + 0.8 * randomAt(seed, c, ch)),
        y: y0 + h * (0.1 + 0.8 * randomAt(seed, c, ch + 1)),
        weight: 0.4 + randomAt(seed, c, ch + 2),
      }));
      const totalWeight = centres.reduce((sum, c) => sum + c.weight, 0);
      const points = [],
        cell = minDistance > 0 ? minDistance : 1,
        grid = new Map();
      const keyOf = (x, y) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
      const fits = (x, y) => {
        if (minDistance <= 0) return true;
        const gx = Math.floor(x / cell),
          gy = Math.floor(y / cell);
        for (let dx = -1; dx <= 1; dx++)
          for (let dy = -1; dy <= 1; dy++)
            for (const p of grid.get(`${gx + dx},${gy + dy}`) ?? [])
              if ((p.x - x) ** 2 + (p.y - y) ** 2 < minDistance * minDistance) return false;
        return true;
      };
      let crowded = 0;
      for (let p = 0; p < count; p++) {
        let placed = null;
        for (let a = 0; a < attempts && !placed; a++) {
          const n = p * attempts + a;
          let pick = randomAt(seed, n, ch + 3) * totalWeight,
            c = centres[0];
          for (const centre of centres)
            if ((pick -= centre.weight) < 0) {
              c = centre;
              break;
            }
          const x = Math.min(x0 + w, Math.max(x0, c.x + spread * normalAt(seed, n, ch + 4, 3)));
          const y = Math.min(y0 + h, Math.max(y0, c.y + spread * normalAt(seed, n, ch + 6, 3)));
          if (fits(x, y)) placed = { x, y, cluster: centres.indexOf(c) };
        }
        if (!placed) {
          crowded++;
          continue;
        }
        points.push(Object.freeze(placed));
        const g = keyOf(placed.x, placed.y);
        grid.set(g, [...(grid.get(g) ?? []), placed]);
      }
      return Object.freeze({
        points: Object.freeze(points),
        centres: Object.freeze(centres.map((c) => Object.freeze({ x: c.x, y: c.y }))),
        crowded,
      });
    },
  };
  return Object.freeze(api);
}

const mean = (v) => v.reduce((s, x) => s + x, 0) / v.length;
const sd = (v) => {
  const m = mean(v);
  return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length);
};
const median = (v) => {
  const s = [...v].sort((a, b) => a - b),
    m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Report repeated things that look machine-made. Give `numbers` (sizes, angles, times),
 * `points` ({x, y}) or `colors`. Findings name robotic uniformity, even spacing, grid-like
 * placement, identical colours and outliers. It never changes the input.
 */
export function auditVariation(input = {}) {
  options(input, ['numbers', 'points', 'colors', 'name'], 'auditVariation');
  const name = input.name === undefined ? 'values' : text(input.name, 'audit name', 200);
  const findings = [],
    stats = {};
  const list = (v, label) => {
    assert(
      Array.isArray(v) && v.length <= 100000,
      'INVALID_DATA',
      `${label} must be an array of at most 100000 items.`,
    );
    return v;
  };
  if (input.numbers !== undefined) {
    const v = list(input.numbers, 'numbers').map((x) => number(x, 'audited number', -1e12, 1e12));
    if (v.length >= 3) {
      const m = mean(v),
        cv = sd(v) / (Math.abs(m) || 1);
      stats.coefficientOfVariation = cv;
      if (cv < 0.02)
        findings.push({
          code: 'UNIFORM_VALUES',
          message: `${name} are nearly identical. Real copies differ a little; try variation().size or around.`,
        });
      const sorted = [...v].sort((a, b) => a - b),
        gaps = sorted.slice(1).map((x, k) => x - sorted[k]);
      const gapMean = mean(gaps);
      if (cv >= 0.02 && gapMean > 0 && sd(gaps) / gapMean < 0.05 && v.length >= 5)
        findings.push({
          code: 'EVEN_SPACING',
          message: `${name} are evenly spaced, which reads as generated. Shape them with a bell or log-normal spread.`,
        });
      const med = median(v),
        mad = median(v.map((x) => Math.abs(x - med))) || 1e-12;
      const outliers = v.filter((x) => Math.abs(x - med) / (1.4826 * mad) > 5).length;
      stats.outliers = outliers;
      if (outliers && cv >= 0.02)
        findings.push({
          code: 'OUTLIERS',
          count: outliers,
          message: `${outliers} of ${name} sit far from the rest. Clip the spread so nothing looks absurd.`,
        });
    }
  }
  if (input.points !== undefined) {
    const p = list(input.points, 'points');
    assert(p.length <= 5000, 'RESOURCE_LIMIT', 'Audit at most 5000 points at once.');
    const pts = p.map((q) => ({ x: number(q?.x, 'point x', -1e9, 1e9), y: number(q?.y, 'point y', -1e9, 1e9) }));
    if (pts.length >= 4) {
      const nearest = pts.map((a, i) => {
        let best = Infinity;
        for (let j = 0; j < pts.length; j++)
          if (j !== i) best = Math.min(best, Math.hypot(a.x - pts[j].x, a.y - pts[j].y));
        return best;
      });
      const cv = sd(nearest) / (mean(nearest) || 1);
      stats.nearestNeighbourVariation = cv;
      if (cv < 0.08)
        findings.push({
          code: 'GRID_LIKE',
          message: `${name} sit at nearly equal distances, like a grid. Use variation().cluster or jitter placement.`,
        });
      const xs = new Set(pts.map((q) => Math.round(q.x * 1000))).size,
        ys = new Set(pts.map((q) => Math.round(q.y * 1000))).size;
      if (pts.length >= 9 && xs * ys <= pts.length * 1.05 && xs < pts.length && ys < pts.length)
        findings.push({
          code: 'ALIGNED_ROWS',
          message: `${name} share rows and columns exactly. Misalign a few so the layout feels placed by hand.`,
        });
    }
  }
  if (input.colors !== undefined) {
    const c = list(input.colors, 'colors').map((x) => toHSLA(x));
    if (c.length >= 3) {
      const unique = new Set(c.map((x) => `${Math.round(x.h)},${Math.round(x.s)},${Math.round(x.l)}`)).size;
      stats.distinctColors = unique;
      if (unique === 1)
        findings.push({
          code: 'IDENTICAL_COLORS',
          message: `Every one of ${name} has the same colour. A small tint wobble makes copies feel real.`,
        });
    }
  }
  return Object.freeze({
    ok: findings.length === 0,
    findings: Object.freeze(findings.map(Object.freeze)),
    stats: Object.freeze(stats),
  });
}
