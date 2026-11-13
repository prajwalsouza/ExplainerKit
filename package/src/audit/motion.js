import { assert, number, options, safeCopy, text } from '../core/validate.js';

const MAX_SAMPLES = 10000;
const MAX_CONSTRAINTS = 128;
const MAX_WORK = 200000;
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
// A few coordinate ulps, propagated through finite differences. This is reported
// separately from authored tolerances and never subtracted from raw measurements.
const coordinateRoundoff = (a, b) => 16 * Number.EPSILON * Math.max(...a.map(Math.abs), ...b.map(Math.abs));

function point(value, dimensions) {
  if (value === null) return null;
  assert(
    Array.isArray(value) && value.length === dimensions,
    'INVALID_MOTION_AUDIT',
    `A motion point needs ${dimensions} coordinates, or null for an unavailable observation.`,
  );
  const captured = safeCopy(value);
  captured.forEach((v) => number(v, 'motion coordinate'));
  return captured;
}

function rows(input, capture) {
  assert(
    Array.isArray(input) && input.length <= MAX_CONSTRAINTS && Reflect.ownKeys(input).length === input.length + 1,
    'INVALID_MOTION_AUDIT',
    'Use at most 128 densely indexed motion constraints without extra properties.',
  );
  return Array.from({ length: input.length }, (_, i) => {
    const d = Object.getOwnPropertyDescriptor(input, i);
    assert(d && 'value' in d, 'INVALID_MOTION_AUDIT', 'Constraint arrays cannot contain accessors or gaps.');
    return capture(d.value, i);
  });
}

function maximum(unit) {
  return {
    value: null,
    at: null,
    from: null,
    to: null,
    unit,
    observations: 0,
    roundoffAllowance: 0,
    lowerBound: null,
    lowerBoundAt: null,
  };
}

function observe(peak, value, at, from = at, to = at, roundoff = 0) {
  number(value, 'motion measurement', 0, 1e100);
  number(roundoff, 'motion roundoff allowance', 0, 1e100);
  peak.observations++;
  const lowerBound = Math.max(0, value - roundoff);
  if (peak.lowerBound === null || lowerBound > peak.lowerBound) Object.assign(peak, { lowerBound, lowerBoundAt: at });
  if (peak.value === null || value > peak.value)
    Object.assign(peak, { value, at, from, to, roundoffAllowance: roundoff });
}

function verdict(lowerBound, tolerance, available, expected) {
  if (lowerBound !== null && lowerBound > tolerance) return 'fail';
  return !available || available < expected ? 'unknown' : 'pass';
}

/**
 * Measure a trusted pure point sampler against explicit author intent. No scene, rig,
 * renderer, reference data or clock is owned by this audit. Coordinates and targets
 * must already share the declared space and unit; null means unavailable.
 * Sampling detects errors at sampled times, not continuous-time collision or realism.
 * @param {(seconds:number)=>readonly number[]|null} sample
 * @param {import('./motion.js').MotionAuditOptions} spec
 */
export function auditMotion(sample, spec) {
  options(
    spec,
    [
      'from',
      'to',
      'fps',
      'space',
      'unit',
      'dimensions',
      'holds',
      'contacts',
      'arrivals',
      'maxSpeed',
      'maxAcceleration',
      'maxSamples',
      'includeSamples',
    ],
    'motion audit',
  );
  assert(typeof sample === 'function', 'INVALID_MOTION_AUDIT', 'Supply a trusted pure point sampler.');
  const from = number(spec.from ?? 0, 'audit start', 0, 86400),
    to = number(spec.to, 'audit end', from, 86400),
    fps = number(spec.fps ?? 60, 'motion audit rate', 0.1, 240),
    space = spec.space,
    dimensions = spec.dimensions ?? 2,
    unit = text(spec.unit ?? 'scene units', 'motion unit', 80),
    maxSamples = number(spec.maxSamples ?? MAX_SAMPLES, 'motion sample budget', 1, MAX_SAMPLES),
    includeSamples = spec.includeSamples ?? false;
  assert(
    [2, 3].includes(dimensions) && ['world', 'screen', 'local'].includes(space) && unit.trim().length > 0,
    'INVALID_MOTION_AUDIT',
    'Declare world, screen or local space, a nonempty unit and 2 or 3 dimensions.',
  );
  assert(
    Number.isInteger(maxSamples) && typeof includeSamples === 'boolean',
    'INVALID_MOTION_AUDIT',
    'Use an integer sample budget and boolean includeSamples.',
  );
  const ids = new Set();
  const capture = (kind) => (row, index) => {
    options(
      row,
      kind === 'arrival'
        ? ['id', 'at', 'target', 'tolerance']
        : kind === 'contact'
          ? ['id', 'from', 'to', 'target', 'tolerance']
          : ['id', 'from', 'to', 'tolerance'],
      'motion constraint',
    );
    const id = text(row.id ?? `${kind}-${index}`, 'motion constraint id', 128),
      start = number(kind === 'arrival' ? row.at : row.from, 'constraint start', from, to),
      end = kind === 'arrival' ? start : number(row.to, 'constraint end', start, to),
      tolerance = number(row.tolerance, 'motion tolerance', 0, 1e7);
    assert(id.length > 0 && !ids.has(id), 'INVALID_MOTION_AUDIT', 'Motion constraint IDs must be nonempty and unique.');
    ids.add(id);
    assert(
      kind === 'arrival' || end > start,
      'INVALID_MOTION_AUDIT',
      'A hold or contact needs a positive time interval.',
    );
    let target = null;
    if (kind !== 'hold') {
      target = typeof row.target === 'function' ? row.target : point(row.target, dimensions);
      assert(target !== null, 'INVALID_MOTION_AUDIT', 'Supply a target point or a trusted pure target sampler.');
    }
    return { id, kind, from: start, to: end, tolerance, target };
  };
  const constraints = [
    ...rows(spec.holds ?? [], capture('hold')),
    ...rows(spec.contacts ?? [], capture('contact')),
    ...rows(spec.arrivals ?? [], capture('arrival')),
  ];
  assert(constraints.length <= MAX_CONSTRAINTS, 'RESOURCE_LIMIT', 'Use at most 128 total motion constraints.');
  const limits = [];
  for (const [field, metric] of [
    ['maxSpeed', 'speed'],
    ['maxAcceleration', 'acceleration'],
  ])
    if (spec[field] !== undefined) limits.push({ metric, tolerance: number(spec[field], field, 0, 1e100) });
  const intervals = Math.ceil((to - from) * fps);
  assert(intervals + 1 <= maxSamples, 'RESOURCE_LIMIT', 'Motion audit exceeds the sample budget.');
  if (intervals) number(1e8 / ((to - from) / intervals) ** 2, 'motion derivative grid range', 0, 1e100);
  // Include exact authored boundaries/arrivals, rather than snapping intent to a grid.
  const grid = Array.from({ length: intervals + 1 }, (_, i) =>
    i === intervals ? to : from + ((to - from) * i) / intervals,
  );
  const times = [...new Set([...grid, ...constraints.flatMap((c) => [c.from, c.to])])].sort((a, b) => a - b);
  assert(
    times.length <= maxSamples && times.length * (constraints.length + 1) <= MAX_WORK,
    'RESOURCE_LIMIT',
    'Motion audit sample/constraint work budget exceeded.',
  );
  // All input and aggregate budgets are checked before invoking any caller sampler.
  const samples = times.map((at) => ({ at, point: point(sample(at), dimensions) }));
  const byTime = new Map(samples.map((s) => [s.at, s.point]));
  // Derivatives use only the regular grid. An off-grid intent boundary must not
  // create a tiny finite-difference interval or change the motion measurement.
  const gridSamples = grid.map((at) => ({ at, point: byTime.get(at) }));
  const speed = maximum(`${unit}/s`),
    acceleration = maximum(`${unit}/s²`);
  let observedPathLength = 0,
    previousVelocity = null,
    previousDt = null,
    previousRoundoff = 0;
  for (let i = 1; i < gridSamples.length; i++) {
    const a = gridSamples[i - 1],
      b = gridSamples[i];
    if (!a.point || !b.point) {
      previousVelocity = null;
      previousDt = null;
      continue;
    }
    const dt = b.at - a.at,
      midpoint = a.at + dt / 2;
    const velocity = b.point.map((v, j) => (v - a.point[j]) / dt);
    const speedValue = Math.hypot(...velocity),
      speedRoundoff = coordinateRoundoff(a.point, b.point) / dt + 8 * Number.EPSILON * speedValue;
    observedPathLength += distance(a.point, b.point);
    observe(speed, speedValue, midpoint, a.at, b.at, speedRoundoff);
    if (previousVelocity) {
      const value = Math.hypot(...velocity.map((v, j) => (v - previousVelocity[j]) / ((dt + previousDt) / 2)));
      observe(
        acceleration,
        value,
        a.at,
        gridSamples[i - 2].at,
        b.at,
        (speedRoundoff + previousRoundoff) / ((dt + previousDt) / 2) + 8 * Number.EPSILON * value,
      );
    }
    previousVelocity = velocity;
    previousDt = dt;
    previousRoundoff = speedRoundoff;
  }
  const checks = constraints.map((c) => {
    const selected = samples.filter((s) => s.at >= c.from && s.at <= c.to),
      error = maximum(unit),
      anchor = c.kind === 'hold' ? byTime.get(c.from) : null;
    for (const s of selected) {
      if (!s.point) continue;
      const target =
        c.kind === 'hold' ? anchor : typeof c.target === 'function' ? point(c.target(s.at), dimensions) : c.target;
      if (target) observe(error, distance(s.point, target), s.at, s.at, s.at, coordinateRoundoff(s.point, target));
    }
    return {
      id: c.id,
      kind: c.kind,
      from: c.from,
      to: c.to,
      tolerance: c.tolerance,
      status: verdict(error.lowerBound, c.tolerance, error.observations, selected.length),
      error,
      coverage: { available: error.observations, expected: selected.length },
    };
  });
  const metrics = { observedPathLength, pathUnit: unit, speed, acceleration };
  const rateChecks = limits.map(({ metric, tolerance }) => {
    const measured = metrics[metric],
      expected = Math.max(0, gridSamples.length - (metric === 'speed' ? 1 : 2));
    return {
      metric,
      tolerance,
      status: verdict(measured.lowerBound, tolerance, measured.observations, expected),
      coverage: { available: measured.observations, expected },
    };
  });
  const statuses = [...checks, ...rateChecks].map((c) => c.status),
    available = samples.filter((s) => s.point !== null).length;
  return safeCopy({
    protocol: 'explainerkit.motion-audit/1',
    status: statuses.includes('fail')
      ? 'fail'
      : statuses.includes('unknown') || !available
        ? 'unknown'
        : statuses.length
          ? 'pass'
          : 'measured',
    space,
    dimensions,
    unit,
    from,
    to,
    fps,
    coverage: { available, expected: samples.length },
    metrics,
    checks,
    limits: rateChecks,
    ...(includeSamples ? { samples } : {}),
  });
}
