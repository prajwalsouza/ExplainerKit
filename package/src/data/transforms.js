import { assert, number, text, options, safeCopy } from '../core/validate.js';

const finite = (localValue1) =>
  typeof localValue1 === 'number' && Number.isFinite(localValue1) && Math.abs(localValue1) <= 1e100;
const reserved = new Set(['__proto__', 'constructor', 'prototype']);
export function fieldName(localValue2) {
  text(localValue2, 'field name', 200);
  assert(localValue2.length && !reserved.has(localValue2), 'INVALID_FIELD', 'Use a nonempty, nonreserved field name.');
  return localValue2;
}
export function rows(input) {
  const localValue3 = safeCopy(input);
  assert(Array.isArray(localValue3) && localValue3.length <= 10000, 'RESOURCE_LIMIT', 'Use at most 10000 records.');
  assert(
    localValue3.every((v) => v && typeof v === 'object' && !Array.isArray(v)),
    'INVALID_DATA',
    'Rows must be plain records.',
  );
  return localValue3;
}
function callback(fn, name) {
  assert(typeof fn === 'function', 'INVALID_MAPPING', `${name} needs a trusted callback.`);
  return fn;
}
function invoke(fn, args) {
  try {
    return fn(...args);
  } catch (cause) {
    const e = new Error('Trusted mapping callback failed.');
    e.code = 'MAPPING_FAILED';
    e.cause = cause;
    throw e;
  }
}
export function mapRows(input, map) {
  const data = rows(input);
  callback(map, 'mapRows');
  return rows(data.map((r, i) => invoke(map, [r, i])));
}
export function filterRows(input, predicate) {
  const data = rows(input);
  callback(predicate, 'filterRows');
  return Object.freeze(
    data.filter((r, i) => {
      const result = invoke(predicate, [r, i]);
      assert(typeof result === 'boolean', 'INVALID_MAPPING', 'A row predicate must return boolean.');
      return result;
    }),
  );
}
function missingPolicy(localValue4) {
  const policy = localValue4 ?? 'error';
  assert(['error', 'skip'].includes(policy), 'INVALID_MAPPING', 'missing must be error or skip.');
  return policy;
}
function value(row, field, missing) {
  const v = row[field];
  if (finite(v)) return v;
  assert(
    missing === 'skip' && (v === undefined || v === null),
    'MISSING_VALUE',
    `Field ${field} must contain a finite number; null/missing may be skipped explicitly.`,
  );
  return null;
}
function scalar(v) {
  return v === null || typeof v === 'string' || typeof v === 'boolean' || finite(v);
}
function sum(values) {
  let result = 0,
    correction = 0;
  for (const v of values) {
    const next = result + v;
    correction += Math.abs(result) >= Math.abs(v) ? result - next + v : v - next + result;
    result = next;
  }
  return number(result + correction, 'aggregate sum', -1e100, 1e100);
}
function reduce(values, op) {
  if (op === 'sum') return sum(values);
  if (op === 'valid') return values.length;
  if (!values.length) return null;
  if (op === 'mean') return sum(values.map((v) => v / values.length));
  if (op === 'min') return Math.min(...values);
  if (op === 'max') return Math.max(...values);
  const sorted = [...values].sort((a, b) => a - b),
    middle = sorted.length >> 1;
  if (sorted.length % 2) return sorted[middle];
  const a = sorted[middle - 1],
    b = sorted[middle];
  // Values are bounded far below Number.MAX_VALUE: sum first preserves subnormals.
  return (a + b) / 2;
}

/** Stable first-seen group order; an ungrouped empty summary retains one count/sum row. */
export function summarize(input, spec = {}) {
  options(spec, ['groupBy', 'measures', 'missing'], 'summary');
  const data = rows(input),
    groupBy = safeCopy(spec.groupBy ?? []),
    missing = missingPolicy(spec.missing);
  assert(
    Array.isArray(groupBy) && groupBy.length <= 16 && new Set(groupBy).size === groupBy.length,
    'INVALID_MAPPING',
    'groupBy needs at most 16 distinct fields.',
  );
  groupBy.forEach(fieldName);
  const measures = safeCopy(spec.measures ?? { count: { op: 'count' } });
  options(measures, Object.keys(measures), 'measures');
  assert(
    Object.keys(measures).length > 0 && Object.keys(measures).length <= 64,
    'RESOURCE_LIMIT',
    'Use 1–64 measures.',
  );
  for (const [name, m] of Object.entries(measures)) {
    fieldName(name);
    assert(!groupBy.includes(name), 'INVALID_MAPPING', 'A measure cannot overwrite a group field.');
    options(m, ['op', 'field'], 'measure');
    assert(
      ['count', 'valid', 'sum', 'mean', 'min', 'max', 'median'].includes(m.op),
      'INVALID_MAPPING',
      'Unsupported measure operation.',
    );
    if (m.op !== 'count') fieldName(m.field);
    else assert(m.field === undefined, 'INVALID_MAPPING', 'count counts rows and takes no field.');
  }
  const groups = new Map();
  if (!groupBy.length) groups.set('[]', { keys: [], members: [] });
  for (const row of data) {
    const keys = groupBy.map((field) => {
        assert(
          Object.hasOwn(row, field) && scalar(row[field]),
          'MISSING_VALUE',
          'Group values must be present scalar values.',
        );
        return row[field];
      }),
      key = JSON.stringify(keys);
    if (!groups.has(key)) groups.set(key, { keys, members: [] });
    groups.get(key).members.push(row);
  }
  return Object.freeze(
    [...groups.values()].map((g) => {
      const out = Object.create(null);
      groupBy.forEach((field, i) => {
        out[field] = g.keys[i];
      });
      for (const [name, m] of Object.entries(measures))
        out[name] =
          m.op === 'count'
            ? g.members.length
            : reduce(
                g.members.map((r) => value(r, m.field, missing)).filter((v) => v !== null),
                m.op,
              );
      return Object.freeze(out);
    }),
  );
}

/** Exact declared bin boundaries. Interior thresholds go to the bin on their right. */
export function bin(input, spec = {}) {
  options(spec, ['field', 'domain', 'thresholds', 'missing'], 'bin');
  const data = rows(input),
    field = fieldName(spec.field),
    missing = missingPolicy(spec.missing),
    domain = safeCopy(spec.domain);
  assert(
    Array.isArray(domain) && domain.length === 2,
    'INVALID_MAPPING',
    'A bin needs an explicit [minimum, maximum] domain.',
  );
  const [low, high] = domain;
  number(low, 'bin minimum', -1e100, 1e100);
  number(high, 'bin maximum', -1e100, 1e100);
  assert(high > low, 'INVALID_MAPPING', 'Bin domain must increase.');
  let thresholds;
  if (spec.thresholds === undefined || typeof spec.thresholds === 'number') {
    const count = number(spec.thresholds ?? 10, 'bin count', 1, 1000);
    assert(Number.isInteger(count), 'INVALID_MAPPING', 'Bin count must be an integer.');
    thresholds = Array.from({ length: count - 1 }, (_, i) => low * (1 - (i + 1) / count) + (high * (i + 1)) / count);
  } else thresholds = safeCopy(spec.thresholds);
  assert(
    Array.isArray(thresholds) && thresholds.length <= 999,
    'RESOURCE_LIMIT',
    'Use at most 999 interior thresholds.',
  );
  let previous = low;
  for (const threshold of thresholds) {
    number(threshold, 'threshold', -1e100, 1e100);
    assert(
      threshold > previous && threshold < high,
      'INVALID_MAPPING',
      'Thresholds must strictly increase inside the domain.',
    );
    previous = threshold;
  }
  const edges = [low, ...thresholds, high],
    buckets = edges.slice(1).map((x1, i) => ({ x0: edges[i], x1, count: 0, rows: [] }));
  let missingCount = 0,
    outsideCount = 0;
  for (const row of data) {
    const v = value(row, field, missing);
    if (v === null) {
      missingCount++;
      continue;
    }
    if (v < low || v > high) {
      outsideCount++;
      continue;
    }
    let lo = 0,
      hi = thresholds.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (v >= thresholds[mid]) lo = mid + 1;
      else hi = mid;
    }
    buckets[lo].rows.push(row);
    buckets[lo].count++;
  }
  return Object.freeze({
    bins: Object.freeze(buckets.map((b) => Object.freeze({ ...b, rows: Object.freeze(b.rows) }))),
    missingCount,
    outsideCount,
  });
}

/** Independent positive and negative stacks, retaining source row and field identities. */
export function stack(input, spec = {}) {
  options(spec, ['key', 'fields', 'offset', 'missing'], 'stack');
  const data = rows(input),
    key = fieldName(spec.key),
    fields = safeCopy(spec.fields),
    missing = missingPolicy(spec.missing),
    offset = spec.offset ?? 'zero';
  assert(
    Array.isArray(fields) && fields.length > 0 && fields.length <= 64 && new Set(fields).size === fields.length,
    'INVALID_MAPPING',
    'Use 1–64 distinct stack fields.',
  );
  fields.forEach(fieldName);
  assert(['zero', 'expand'].includes(offset), 'INVALID_MAPPING', 'Stack offset must be zero or expand.');
  assert(data.length * fields.length <= 100000, 'RESOURCE_LIMIT', 'Stack output exceeds 100000 cells.');
  const seen = new Set(),
    series = fields.map((field) => ({ field, values: [] }));
  for (const row of data) {
    const id = row[key];
    assert(
      (typeof id === 'string' && id.length > 0) || finite(id),
      'INVALID_KEY',
      'Stack keys must be nonempty strings or finite numbers.',
    );
    assert(!seen.has(id), 'DUPLICATE_KEY', 'Stack row keys must be unique.');
    seen.add(id);
    const values = fields.map((f) => value(row, f, missing) ?? 0);
    assert(
      offset !== 'expand' || values.every((v) => v >= 0),
      'INVALID_MAPPING',
      'Expanded stacks require nonnegative values.',
    );
    const total = offset === 'expand' ? sum(values) : 1;
    let positive = 0,
      negative = 0;
    values.forEach((v, i) => {
      const size = offset === 'expand' ? (total === 0 ? 0 : v / total) : v,
        start = size >= 0 ? positive : negative,
        end = number(start + size, 'stack extent', -1e100, 1e100);
      if (size >= 0) positive = end;
      else negative = end;
      series[i].values.push(Object.freeze({ key: id, value: v, y0: start, y1: end, row }));
    });
  }
  return Object.freeze(series.map((s) => Object.freeze({ ...s, values: Object.freeze(s.values) })));
}

/** Map a complete candidate table, validate the target, then replace exactly once. */
export function replaceMapped(target, input, map) {
  assert(
    target && typeof target.replace === 'function',
    'INVALID_MAPPING',
    'Use a target data source with replace(rows).',
  );
  const candidate = mapRows(input, map);
  target.replace(candidate);
  return candidate;
}
