import { createMorph } from './contour.js';
import { assert, number, options, safeCopy } from '../core/validate.js';
import { validateProperty } from '../core/geometry.js';

function simplePolygon(commands) {
  assert(
    commands.length >= 4 &&
      commands[0][0] === 'M' &&
      commands.at(-1)[0] === 'Z' &&
      commands.slice(1, -1).every((c) => c[0] === 'L'),
    'MORPH_SAFETY_UNSUPPORTED',
    'Safe morph currently accepts a single closed straight-edged polygon.',
  );
  const points = commands.slice(0, -1).map((c) => ({ x: c[1], y: c[2] }));
  assert(points.length <= 512, 'RESOURCE_LIMIT', 'Safe morph polygons support at most 512 vertices.');
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y),
    span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1e-6);
  const epsilon = span * 1e-9,
    orientEpsilon = span * epsilon;
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const onSegment = (a, b, c) =>
    Math.abs(cross(a, b, c)) <= orientEpsilon &&
    c.x >= Math.min(a.x, b.x) - epsilon &&
    c.x <= Math.max(a.x, b.x) + epsilon &&
    c.y >= Math.min(a.y, b.y) - epsilon &&
    c.y <= Math.max(a.y, b.y) + epsilon;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length],
      previous = points[(i + points.length - 1) % points.length];
    assert(
      Math.hypot(a.x - b.x, a.y - b.y) > epsilon,
      'MORPH_UNSAFE_SAMPLE',
      'Morph has a collapsed polygon edge at this time.',
    );
    assert(
      !(
        Math.abs(cross(previous, a, b)) <= orientEpsilon &&
        (a.x - previous.x) * (b.x - a.x) + (a.y - previous.y) * (b.y - a.y) < 0
      ),
      'MORPH_UNSAFE_SAMPLE',
      'Morph has an overlapping backtracking edge.',
    );
    area += a.x * b.y - a.y * b.x;
    for (let j = i + 2; j < points.length; j++) {
      if (i === 0 && j === points.length - 1) continue;
      const c = points[j],
        d = points[(j + 1) % points.length];
      const proper = cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
      assert(
        !(proper || onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b)),
        'MORPH_UNSAFE_SAMPLE',
        'Morph has a polygon intersection or nonadjacent touching edge at this time.',
      );
    }
  }
  assert(Math.abs(area) > span * span * 1e-12, 'MORPH_UNSAFE_SAMPLE', 'Morph polygon area collapses at this time.');
}

/** Reject invalid emitted polygons; does not certify every instant between samples. */
export function createSafeMorph(from, to, spec = {}) {
  const a = validateProperty('path', 'commands', safeCopy(from)),
    b = validateProperty('path', 'commands', safeCopy(to));
  simplePolygon(a);
  simplePolygon(b);
  const plan = createMorph(a, b, spec);
  return Object.freeze({
    diagnostics: Object.freeze({
      ...plan.diagnostics,
      safety: 'perSamplePolygon',
      continuousTopologyGuaranteed: false,
    }),
    sample(time) {
      const commands = plan.sample(time);
      simplePolygon(commands);
      return commands;
    },
    inspect: plan.inspect,
  });
}

/** Fixed-command-topology keys, blended in rest space before optional skinning. */
export function createShapeKeys(input, targets) {
  const base = validateProperty('path', 'commands', safeCopy(input)),
    raw = safeCopy(targets);
  assert(raw && !Array.isArray(raw) && typeof raw === 'object', 'SHAPE_KEYS', 'Supply named shape-key paths.');
  const names = Object.keys(raw);
  assert(names.length <= 64, 'RESOURCE_LIMIT', 'Use at most 64 shape keys.');
  assert(
    base.length * Math.max(1, names.length) <= 100000,
    'RESOURCE_LIMIT',
    'Shape-key work exceeds the bounded command budget.',
  );
  const keys = Object.fromEntries(
    names.map((name) => {
      const commands = validateProperty('path', 'commands', raw[name]);
      assert(
        commands.length === base.length && commands.every((c, i) => c.length === base[i].length && c[0] === base[i][0]),
        'SHAPE_KEY_TOPOLOGY',
        'Shape keys need identical command and coordinate topology.',
      );
      return [name, commands];
    }),
  );
  return Object.freeze({
    names: Object.freeze(names),
    sample(weights = {}) {
      options(weights, names, 'shape-key weights');
      let total = 0;
      for (const value of Object.values(weights)) total += number(value, 'shape-key weight', 0, 1);
      assert(total <= 1 + 1e-12, 'SHAPE_KEYS', 'Shape-key weights must sum to at most one.');
      return validateProperty(
        'path',
        'commands',
        base.map((command, i) =>
          command.map((value, j) =>
            j === 0
              ? value
              : value + names.reduce((delta, name) => delta + (keys[name][i][j] - value) * (weights[name] ?? 0), 0),
          ),
        ),
      );
    },
  });
}
