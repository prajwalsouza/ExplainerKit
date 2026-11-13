import { assert, number, options, safeCopy } from '../core/validate.js';
import { measurePath } from '../geometry/path.js';
import { randomAt } from '../noise/vector.js';
import { pointSet } from './point-set.js';
import { preflightNetwork } from './network-input.js';

/** Capture explicit graph edges or contour arrays; geometric crossings are not inferred. */
function paths(input, tolerance, budget) {
  preflightNetwork(input);
  const data = safeCopy(input),
    result = [];
  let flattened = 0;
  if (Array.isArray(data)) {
    const list = typeof data[0]?.[0] === 'string' ? [data] : data;
    assert(list.length > 0 && list.length <= 2048, 'RESOURCE_LIMIT', 'Use one to 2048 network paths.');
    for (const commands of list) {
      const path = measurePath(commands, { tolerance, maxPoints: 8192 });
      flattened += path.points.length;
      assert(flattened <= 65536, 'RESOURCE_LIMIT', 'Network flattening accepts at most 65536 points in total.');
      budget.tick(path.points.length);
      result.push(path);
    }
  } else {
    options(data, ['nodes', 'edges'], 'point network');
    assert(
      Array.isArray(data.nodes) && data.nodes.length <= 10000,
      'RESOURCE_LIMIT',
      'A point network accepts at most 10000 nodes.',
    );
    assert(
      Array.isArray(data.edges) && data.edges.length <= 10000,
      'RESOURCE_LIMIT',
      'Use at most 10000 network edges.',
    );
    const nodes = data.nodes.map((value) => {
      if (Array.isArray(value)) {
        assert(value.length === 2, 'PROCEDURAL_REGION', 'Network coordinate arrays need x and y.');
        return value.map((v) => Math.fround(number(v, 'network coordinate')));
      }
      options(value, ['x', 'y'], 'network node');
      return [Math.fround(number(value.x, 'network x')), Math.fround(number(value.y, 'network y'))];
    });
    const seen = new Set();
    for (const edge of data.edges) {
      assert(Array.isArray(edge) && edge.length === 2, 'PROCEDURAL_REGION', 'Edges need two node indices.');
      for (const index of edge)
        assert(
          Number.isInteger(index) && index >= 0 && index < nodes.length,
          'PROCEDURAL_REGION',
          'Network edge indices must identify nodes.',
        );
      const [a, b] = edge,
        key = a < b ? `${a}:${b}` : `${b}:${a}`;
      assert(a !== b && !seen.has(key), 'PROCEDURAL_REGION', 'Network edges must be unique and have distinct ends.');
      seen.add(key);
      const p = nodes[a],
        q = nodes[b];
      assert(
        p[0] !== q[0] || p[1] !== q[1],
        'DEGENERATE_PATH',
        'Network edges need positive length after Float32 capture.',
      );
      result.push(
        measurePath(
          [
            ['M', ...p],
            ['L', ...q],
          ],
          { tolerance, maxPoints: 2 },
        ),
      );
      budget.tick();
    }
  }
  return result;
}

export function networkPoints(spec, seed, budget) {
  assert(
    spec.in === undefined &&
      spec.density === undefined &&
      spec.method === undefined &&
      spec.minDistance === undefined &&
      spec.maxDistance === undefined,
    'PROCEDURAL_REGION',
    'Network sampling uses along and spacing, without region or density options.',
  );
  const spacing = number(spec.spacing, 'network spacing', 1e-6, 1e7),
    limit = spec.count ?? 100000;
  assert(
    Number.isInteger(limit) && limit >= 0 && limit <= 100000,
    'RESOURCE_LIMIT',
    'Network count is an integer ceiling up to 100000.',
  );
  const junctions = spec.junctions ?? true,
    alternate = spec.alternate ?? false;
  assert(
    typeof junctions === 'boolean' && typeof alternate === 'boolean',
    'INVALID_OPTIONS',
    'junctions and alternate must be boolean.',
  );
  const offset = number(spec.offset ?? 0, 'network normal offset');
  const jitter = number(spec.jitter ?? 0, 'network normal jitter', 0, 1e5);
  const contours = paths(spec.along, number(spec.tolerance ?? 0.1, 'network tolerance', 1e-5, 1000), budget);
  const x = [],
    y = [],
    rotations = [],
    edgeIds = [],
    junctionFlags = [],
    grid = new Map(),
    anchors = new Map();
  const clearance = spacing / 2,
    cell = clearance,
    key = (gx, gy) => `${gx}:${gy}`;
  function append(px, py, rotation, edge, junction) {
    number(px, 'network point x');
    number(py, 'network point y');
    px = Math.fround(px);
    py = Math.fround(py);
    const gx = Math.floor(px / cell),
      gy = Math.floor(py / cell);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        budget.tick();
        for (const i of grid.get(key(gx + dx, gy + dy)) ?? []) {
          budget.tick();
          if (Math.hypot(px - x[i], py - y[i]) < clearance) {
            assert(
              !junction,
              'PROCEDURAL_NETWORK_SPACING',
              'Distinct required network anchors are closer than spacing / 2; reduce spacing or disable junctions.',
            );
            return false;
          }
        }
      }
    assert(x.length < limit, 'RESOURCE_LIMIT', 'Network anchors exceed the requested count ceiling.');
    const i = x.length,
      k = key(gx, gy);
    x.push(px);
    y.push(py);
    rotations.push(rotation);
    edgeIds.push(edge);
    junctionFlags.push(junction);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
    return true;
  }
  if (junctions && limit)
    for (let edge = 0; edge < contours.length; edge++) {
      const path = contours[edge];
      for (const t of [0, 1]) {
        const p = path.at(t),
          px = Math.fround(p.x),
          py = Math.fround(p.y),
          k = `${px}:${py}`;
        if (!anchors.has(k)) {
          append(px, py, p.rotation, edge, true);
          anchors.set(k, true);
        }
      }
    }
  for (let edge = 0; edge < contours.length && x.length < limit; edge++) {
    const path = contours[edge],
      steps = Math.floor(path.length / spacing);
    let accepted = 0;
    assert(steps <= 2e7, 'RESOURCE_LIMIT', 'Network spacing creates too many candidates.');
    // Junction anchors are on the path. Offset/jitter apply only to interior edge samples.
    for (let i = junctions ? 1 : 0; i <= steps && x.length < limit; i++) {
      budget.tick();
      const distance = i * spacing;
      if (junctions && path.length - distance < clearance) continue;
      const p = path.at(Math.min(1, distance / path.length));
      const side = alternate && accepted % 2 ? -1 : 1;
      const normal = side * offset + (randomAt(seed, i, edge) * 2 - 1) * jitter;
      if (append(p.x - Math.sin(p.rotation) * normal, p.y + Math.cos(p.rotation) * normal, p.rotation, edge, false))
        accepted++;
    }
  }
  const columns = Object.freeze([
    Object.freeze(['rotation', Object.freeze(rotations)]),
    Object.freeze(['edge', Object.freeze(edgeIds)]),
    Object.freeze(['junction', Object.freeze(junctionFlags)]),
  ]);
  return pointSet(seed, x, y, [columns], {
    method: 'network',
    requested: limit,
    spacing,
    edges: contours.length,
    junctions: anchors.size,
    work: budget.used,
  });
}
