import { assert, number, options, safeCopy } from '../core/validate.js';

const finite = (value) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e100;
const numeric = (v, label) => number(v, label, -1e100, 1e100);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
function vector(value, label, min = 2, max = 64) {
  const input = safeCopy(value);
  assert(
    Array.isArray(input) && input.length >= min && input.length <= max,
    'INVALID_SCALE',
    `${label} needs ${min}–${max} entries.`,
  );
  return Object.freeze(input.map((v) => numeric(v, label)));
}
function direction(values) {
  let sign = 0;
  for (let i = 1; i < values.length; i++) {
    const delta = Math.sign(values[i] - values[i - 1]);
    if (!delta || (sign && delta !== sign)) return 0;
    sign = delta;
  }
  return sign;
}
function segment(values, value, sign) {
  let lo = 0,
    hi = values.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((value - values[mid]) * sign >= 0) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Ordered, inclusive, 1/2/5 decimal ticks. The requested count is approximate. */
export function ticks(domain, count = 6) {
  const input = vector(domain, 'tick domain', 2, 2);
  number(count, 'tick count', 1, 1000);
  assert(Number.isInteger(count), 'INVALID_SCALE', 'Tick count must be an integer.');
  const [a, b] = input;
  if (a === b) return Object.freeze([a]);
  const low = Math.min(a, b),
    high = Math.max(a, b),
    raw = (high - low) / count;
  assert(Number.isFinite(raw) && raw > 0, 'INVALID_SCALE', 'Tick domain cannot be resolved at this precision.');
  const power = 10 ** Math.floor(Math.log10(raw)),
    ratio = raw / power,
    factor = ratio >= Math.sqrt(50) ? 10 : ratio >= Math.sqrt(10) ? 5 : ratio >= Math.sqrt(2) ? 2 : 1,
    step = factor * power;
  const first = Math.ceil(low / step - 1e-12),
    last = Math.floor(high / step + 1e-12),
    length = last - first + 1;
  assert(
    Number.isSafeInteger(first) && Number.isSafeInteger(last) && length <= 2000,
    'RESOURCE_LIMIT',
    'Tick indices exceed supported precision or count.',
  );
  const output = Array.from({ length: Math.max(0, length) }, (_, i) => {
    const v = (first + i) * step;
    return Object.is(v, -0) ? 0 : v;
  });
  return Object.freeze(a > b ? output.reverse() : output);
}

/** Numeric mapping with explicit unknown input, clamping and inverse semantics. */
export function scale(spec = {}) {
  options(spec, ['type', 'domain', 'range', 'clamp', 'unknown', 'exponent', 'constant'], 'scale');
  const type = spec.type ?? 'linear';
  assert(
    ['linear', 'log', 'pow', 'sqrt', 'symlog', 'diverging'].includes(type),
    'INVALID_SCALE',
    'Use linear, log, pow, sqrt, symlog or diverging.',
  );
  const domain = vector(spec.domain ?? [0, 1], 'scale domain'),
    range = vector(spec.range ?? [0, 1], 'scale range');
  assert(domain.length === range.length, 'INVALID_SCALE', 'Domain and range must have equal lengths.');
  assert(
    type !== 'diverging' || domain.length === 3,
    'INVALID_SCALE',
    'A diverging scale needs three domain/range stops.',
  );
  const constantDomain = domain.every((v) => v === domain[0]);
  assert(
    (constantDomain && domain.length === 2) || direction(domain) !== 0,
    'INVALID_SCALE',
    'Domain stops must be strictly monotonic, or one constant pair.',
  );
  const clamped = spec.clamp ?? false;
  assert(typeof clamped === 'boolean', 'INVALID_SCALE', 'clamp must be boolean.');
  const unknown = spec.unknown === undefined ? null : safeCopy(spec.unknown),
    exponent = number(spec.exponent ?? (type === 'sqrt' ? 0.5 : 1), 'power exponent', 0.000001, 100),
    constant = number(spec.constant ?? 1, 'symlog constant', 1e-100, 1e100);
  assert(
    spec.exponent === undefined || type === 'pow',
    'INVALID_SCALE',
    'exponent applies only to pow; sqrt has a fixed exponent of .5.',
  );
  assert(spec.constant === undefined || type === 'symlog', 'INVALID_SCALE', 'constant applies only to symlog.');
  const logSign = Math.sign(domain[0]);
  if (type === 'log')
    assert(
      logSign !== 0 && domain.every((v) => Math.sign(v) === logSign),
      'INVALID_SCALE',
      'A log domain cannot contain or cross zero.',
    );
  const transform = (v) =>
    type === 'log'
      ? logSign * Math.log(Math.abs(v))
      : type === 'pow' || type === 'sqrt'
        ? Math.sign(v) * Math.abs(v) ** exponent
        : type === 'symlog'
          ? Math.sign(v) * Math.log1p(Math.abs(v) / constant)
          : v;
  const untransform = (v) =>
    type === 'log'
      ? logSign * Math.exp(logSign * v)
      : type === 'pow' || type === 'sqrt'
        ? Math.sign(v) * Math.abs(v) ** (1 / exponent)
        : type === 'symlog'
          ? Math.sign(v) * Math.expm1(Math.abs(v)) * constant
          : v;
  const transformed = domain.map(transform);
  assert(transformed.every(Number.isFinite), 'INVALID_SCALE', 'Transformed domain exceeds numeric range.');
  assert(
    constantDomain || direction(transformed) !== 0,
    'INVALID_SCALE',
    'Transformed domain cannot be resolved at this precision.',
  );
  const domainDirection = direction(transformed),
    rangeDirection = direction(range);
  function map(value) {
    if (!finite(value) || (type === 'log' && Math.sign(value) !== logSign)) return unknown;
    if (constantDomain) return numeric(range[0] + (range[1] - range[0]) / 2, 'constant scale result');
    const v = transform(value);
    if (!Number.isFinite(v)) return unknown;
    const i = segment(transformed, v, domainDirection),
      t = (v - transformed[i]) / (transformed[i + 1] - transformed[i]);
    const result = range[i] + (range[i + 1] - range[i]) * (clamped ? clamp01(t) : t);
    return numeric(result, 'scale result');
  }
  function invert(value) {
    if (!finite(value)) return unknown;
    if (constantDomain) return domain[0];
    assert(rangeDirection !== 0, 'SCALE_NOT_INVERTIBLE', 'An inverse needs a strictly monotonic numeric range.');
    const i = segment(range, value, rangeDirection),
      t = (value - range[i]) / (range[i + 1] - range[i]),
      v = transformed[i] + (transformed[i + 1] - transformed[i]) * (clamped ? clamp01(t) : t);
    return numeric(untransform(v), 'inverse scale result');
  }
  function tickValues(count = 6) {
    number(count, 'tick count', 1, 1000);
    assert(Number.isInteger(count), 'INVALID_SCALE', 'Tick count must be an integer.');
    if (type !== 'log' || constantDomain) return ticks([domain[0], domain.at(-1)], count);
    const low = Math.min(...domain.map((v) => Math.abs(v))),
      high = Math.max(...domain.map((v) => Math.abs(v))),
      out = [];
    for (let e = Math.ceil(Math.log10(low) - 1e-12); e <= Math.floor(Math.log10(high) + 1e-12); e++) {
      const v = 10 ** e;
      if (v >= low * (1 - 1e-12) && v <= high * (1 + 1e-12)) out.push(logSign * v);
    }
    out.sort((a, b) => (domain[0] < domain.at(-1) ? a - b : b - a));
    return Object.freeze(out);
  }
  Object.defineProperties(map, {
    map: { value: map },
    invert: { value: invert },
    ticks: { value: tickValues },
    domain: { value: domain },
    range: { value: range },
    type: { value: type },
    clamp: { value: clamped },
    unknown: { value: unknown },
  });
  return Object.freeze(map);
}

function categories(input) {
  const domain = safeCopy(input);
  assert(
    Array.isArray(domain) && domain.length <= 10000,
    'RESOURCE_LIMIT',
    'A category domain accepts at most 10000 values.',
  );
  assert(
    domain.every((v) => typeof v === 'string' || finite(v) || typeof v === 'boolean') &&
      new Set(domain).size === domain.length,
    'INVALID_SCALE',
    'Categories need unique strings, finite numbers or booleans.',
  );
  return domain;
}
/** Fixed category lookup; unknown values never extend the domain or recycle colors. */
export function ordinalScale(spec = {}) {
  options(spec, ['domain', 'range', 'unknown'], 'ordinal scale');
  const domain = categories(spec.domain ?? []),
    range = safeCopy(spec.range ?? []),
    unknown = spec.unknown === undefined ? null : safeCopy(spec.unknown);
  assert(
    Array.isArray(range) && range.length === domain.length,
    'INVALID_SCALE',
    'Ordinal range must match the category count.',
  );
  const lookup = new Map(domain.map((v, i) => [v, range[i]])),
    map = (value) => (lookup.has(value) ? lookup.get(value) : unknown);
  Object.defineProperties(map, {
    map: { value: map },
    domain: { value: domain },
    range: { value: range },
    unknown: { value: unknown },
    type: { value: 'ordinal' },
  });
  return Object.freeze(map);
}

/** Equal-width categorical bands in a fixed numeric range, including reversed ranges. */
export function bandScale(spec = {}) {
  options(spec, ['domain', 'range', 'paddingInner', 'paddingOuter', 'align', 'unknown'], 'band scale');
  const domain = categories(spec.domain ?? []),
    range = vector(spec.range ?? [0, 1], 'band range', 2, 2),
    inner = number(spec.paddingInner ?? 0, 'inner padding', 0, 1),
    outer = number(spec.paddingOuter ?? 0, 'outer padding', 0, 10),
    align = number(spec.align ?? 0.5, 'band alignment', 0, 1),
    unknown = spec.unknown === undefined ? null : safeCopy(spec.unknown);
  const n = domain.length,
    low = Math.min(...range),
    high = Math.max(...range),
    span = high - low,
    step = n ? span / Math.max(1, n - inner + 2 * outer) : 0,
    bandwidth = step * (1 - inner),
    start = low + (span - step * (n - inner)) * align;
  const lookup = new Map(domain.map((v, i) => [v, start + (range[0] > range[1] ? n - 1 - i : i) * step]));
  const map = (value) => (lookup.has(value) ? lookup.get(value) : unknown);
  function invert(position) {
    if (!finite(position) || !n || bandwidth === 0) return unknown;
    for (const value of domain) {
      const x = lookup.get(value);
      if (position >= x && position < x + bandwidth) return value;
    }
    return unknown;
  }
  Object.defineProperties(map, {
    map: { value: map },
    invert: { value: invert },
    center: { value: (value) => (lookup.has(value) ? lookup.get(value) + bandwidth / 2 : unknown) },
    domain: { value: domain },
    range: { value: range },
    bandwidth: { value: bandwidth },
    step: { value: step },
    type: { value: 'band' },
    unknown: { value: unknown },
  });
  return Object.freeze(map);
}
