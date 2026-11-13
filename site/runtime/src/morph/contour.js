import { assert, number, options, safeCopy } from '../core/validate.js';
import { validateProperty } from '../core/geometry.js';

const point = (x, y) => Object.freeze({ x, y });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function toSegment(p, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    d = dx * dx + dy * dy,
    t = d === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / d));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
function area(points) {
  let sum = 0;
  for (let i = 0; i < points.length - 1; i++) sum += points[i].x * points[i + 1].y - points[i + 1].x * points[i].y;
  return sum / 2;
}
function contour(points, closed) {
  const p = [];
  for (const v of points) if (!p.length || distance(p.at(-1), v) > 0) p.push(v);
  if (closed && p.length && distance(p[0], p.at(-1)) > 0) p.push(p[0]);
  const cumulative = [0];
  for (let i = 1; i < p.length; i++) cumulative.push(cumulative.at(-1) + distance(p[i - 1], p[i]));
  assert(cumulative.at(-1) > 0, 'DEGENERATE_PATH', 'A morph contour must have positive length.');
  return Object.freeze({
    points: Object.freeze(p),
    cumulative: Object.freeze(cumulative),
    length: cumulative.at(-1),
    closed,
    area: closed ? area(p) : 0,
  });
}

/** Flatten one M/L/Q/C/Z contour; the chord error is explicitly bounded. */
export function flattenPath(commands, spec = {}) {
  options(spec, ['tolerance', 'maxPoints'], 'flatten path');
  const tolerance = number(spec.tolerance ?? 0.25, 'curve tolerance', 1e-5, 1e4),
    maxPoints = number(spec.maxPoints ?? 8192, 'curve point budget', 2, 32768);
  assert(Number.isInteger(maxPoints), 'INVALID_MORPH', 'Point budget must be an integer.');
  const path = validateProperty('path', 'commands', safeCopy(commands));
  assert(path.length >= 2, 'INVALID_MORPH', 'A contour needs a move and drawing commands.');
  const points = [];
  let current,
    closed = false;
  function add(p) {
    assert(points.length < maxPoints, 'RESOURCE_LIMIT', 'Curve subdivision exceeded the point budget.');
    points.push(p);
    current = p;
  }
  function bezier(p, depth = 0) {
    if (p.slice(1, -1).every((q) => toSegment(q, p[0], p.at(-1)) <= tolerance)) {
      add(p.at(-1));
      return;
    }
    assert(depth < 20, 'RESOURCE_LIMIT', 'Curve tolerance requires excessive subdivision.');
    const left = [p[0]],
      right = [p.at(-1)];
    let row = p;
    while (row.length > 1) {
      row = row.slice(1).map((q, i) => point((q.x + row[i].x) / 2, (q.y + row[i].y) / 2));
      left.push(row[0]);
      right.push(row.at(-1));
    }
    bezier(left, depth + 1);
    bezier(right.reverse(), depth + 1);
  }
  path.forEach((c, i) => {
    assert(!closed, 'INVALID_MORPH', 'Z must finish a single contour.');
    if (c[0] === 'M') {
      assert(i === 0, 'MORPH_TOPOLOGY', 'Separate contours and holes require explicit correspondence.');
      add(point(c[1], c[2]));
    } else if (c[0] === 'Z') {
      closed = true;
      add(points[0]);
    } else if (c[0] === 'L') add(point(c[1], c[2]));
    else if (c[0] === 'Q') bezier([current, point(c[1], c[2]), point(c[3], c[4])]);
    else bezier([current, point(c[1], c[2]), point(c[3], c[4]), point(c[5], c[6])]);
  });
  return contour(points, closed);
}
function atLength(c, fraction) {
  const d = fraction * c.length;
  if (d <= 0) return c.points[0];
  if (d >= c.length) return c.points.at(-1);
  let lo = 1,
    hi = c.cumulative.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (c.cumulative[mid] < d) lo = mid + 1;
    else hi = mid;
  }
  const a = c.points[lo - 1],
    b = c.points[lo],
    t = (d - c.cumulative[lo - 1]) / (c.cumulative[lo] - c.cumulative[lo - 1]);
  return point(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
}
function samples(a, b, count, landmarks) {
  const boundaries = [{ from: 0, to: 0 }, ...landmarks, { from: 1, to: 1 }],
    intervals = a.closed ? count : count - 1,
    spans = boundaries.length - 1;
  assert(intervals >= spans, 'INVALID_MORPH', 'Use enough samples to include every landmark.');
  const weights = boundaries.slice(1).map((q, i) => (q.from - boundaries[i].from + (q.to - boundaries[i].to)) / 2);
  const allocation = weights.map((w) => 1 + Math.floor((intervals - spans) * w));
  let remaining = intervals - allocation.reduce((s, v) => s + v, 0);
  const remainder = weights
    .map((w, i) => ({ i, r: (intervals - spans) * w - Math.floor((intervals - spans) * w) }))
    .sort((left, right) => right.r - left.r || left.i - right.i);
  for (let i = 0; i < remaining; i++) allocation[remainder[i].i]++;
  const from = [],
    to = [];
  let maximumA = 0,
    maximumB = 0;
  allocation.forEach((n, i) => {
    const p = boundaries[i],
      q = boundaries[i + 1];
    maximumA = Math.max(maximumA, ((q.from - p.from) * a.length) / n);
    maximumB = Math.max(maximumB, ((q.to - p.to) * b.length) / n);
    for (let j = 0; j < n; j++) {
      from.push(atLength(a, p.from + ((q.from - p.from) * j) / n));
      to.push(atLength(b, p.to + ((q.to - p.to) * j) / n));
    }
  });
  if (!a.closed) {
    from.push(a.points.at(-1));
    to.push(b.points.at(-1));
  }
  return { from, to, maximumA, maximumB };
}
function intersections(p, closed) {
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x),
    n = closed ? p.length : p.length - 1;
  let count = 0;
  for (let i = 0; i < n; i++)
    for (let j = i + 2; j < n; j++) {
      if (closed && i === 0 && j === n - 1) continue;
      const a = p[i],
        b = p[(i + 1) % p.length],
        c = p[j],
        d = p[(j + 1) % p.length];
      if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) count++;
    }
  return count;
}

/** Arc-length correspondence for one contour. Pure samples preserve exact endpoints. */
export function createMorph(from, to, spec = {}) {
  options(spec, ['samples', 'tolerance', 'align', 'reverse', 'offset', 'landmarks'], 'morph');
  const aCommands = validateProperty('path', 'commands', safeCopy(from)),
    bCommands = validateProperty('path', 'commands', safeCopy(to));
  const tolerance = number(spec.tolerance ?? 0.25, 'curve tolerance', 1e-5, 1e4),
    a = flattenPath(aCommands, { tolerance });
  let b = flattenPath(bCommands, { tolerance });
  assert(a.closed === b.closed, 'MORPH_TOPOLOGY', 'Open and closed contours cannot silently change topology.');
  const count = number(spec.samples ?? 128, 'morph samples', a.closed ? 3 : 2, 512);
  assert(Number.isInteger(count), 'INVALID_MORPH', 'Samples must be an integer.');
  const landmarks = safeCopy(spec.landmarks ?? []);
  assert(Array.isArray(landmarks) && landmarks.length <= 64, 'RESOURCE_LIMIT', 'Use at most 64 landmarks.');
  let lastA = 0,
    lastB = 0;
  for (const l of landmarks) {
    options(l, ['from', 'to'], 'landmark');
    number(l.from, 'from landmark', 0, 1);
    number(l.to, 'to landmark', 0, 1);
    assert(
      l.from > lastA && l.to > lastB && l.from < 1 && l.to < 1,
      'INVALID_MORPH',
      'Landmarks must be strictly ordered inside (0,1).',
    );
    lastA = l.from;
    lastB = l.to;
  }
  const align = spec.align ?? (landmarks.length ? 'none' : 'auto'),
    reverse = spec.reverse ?? 'auto';
  assert(
    ['auto', 'none'].includes(align) && [true, false, 'auto'].includes(reverse),
    'INVALID_MORPH',
    'Use auto/none alignment and auto/boolean reversal.',
  );
  assert(
    !landmarks.length || (align === 'none' && reverse !== true && (spec.offset ?? 0) === 0),
    'INVALID_MORPH',
    'Landmarks use authored direction and start; disable automatic alignment.',
  );
  const reversed =
    !landmarks.length &&
    (reverse === true || (reverse === 'auto' && align === 'auto' && a.closed && a.area * b.area < 0));
  if (reversed) b = contour([...b.points].reverse(), b.closed);
  const paired = samples(a, b, count, landmarks);
  let target = paired.to,
    offset = spec.offset ?? 0;
  number(offset, 'morph offset', 0, count - 1);
  assert(
    Number.isInteger(offset) && (a.closed || offset === 0),
    'INVALID_MORPH',
    'Only closed contours accept an integer start offset.',
  );
  if (align === 'auto' && a.closed && spec.offset === undefined) {
    let best = Infinity;
    for (let shift = 0; shift < count; shift++) {
      let cost = 0;
      for (let i = 0; i < count; i++) {
        const p = paired.from[i],
          q = target[(i + shift) % count];
        cost += (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
      }
      if (cost < best) {
        best = cost;
        offset = shift;
      }
    }
  }
  target = target.map((_, i) => target[(i + offset) % count]);
  const points = (t) => paired.from.map((p, i) => point(p.x + (target[i].x - p.x) * t, p.y + (target[i].y - p.y) * t));
  const diagnostics = Object.freeze({
    closed: a.closed,
    samples: count,
    offset,
    reversed,
    landmarks: landmarks.length,
    approximationBound: Object.freeze({ from: tolerance + paired.maximumA / 2, to: tolerance + paired.maximumB / 2 }),
    topologyGuaranteed: false,
  });
  return Object.freeze({
    diagnostics,
    sample(t) {
      number(t, 'morph progress', 0, 1);
      if (t === 0) return aCommands;
      if (t === 1) return bCommands;
      const p = points(t),
        commands = p.map((v, i) => Object.freeze([i ? 'L' : 'M', v.x, v.y]));
      if (a.closed) commands.push(Object.freeze(['Z']));
      return Object.freeze(commands);
    },
    inspect(t) {
      number(t, 'morph progress', 0, 1);
      const p = points(t);
      return Object.freeze({
        properCrossings: intersections(p, a.closed),
        sampledArea: a.closed ? area([...p, p[0]]) : null,
        ...diagnostics,
      });
    },
  });
}
