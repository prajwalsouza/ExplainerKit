import { assert, number, options } from '../core/validate.js';
import { asShape, fracture, centroid, intersect } from '../geometry/shapes/index.js';
import { createMorph } from './contour.js';
import { properties } from '../core/geometry.js';

function pieces(input, label) {
  const descriptor =
    input && typeof input === 'object' && !Array.isArray(input)
      ? Object.getOwnPropertyDescriptor(input, 'pieces')
      : null;
  const values = descriptor && 'value' in descriptor ? descriptor.value : input;
  assert(
    Array.isArray(values) && values.length > 0 && values.length <= 64,
    'INVALID_SPLIT',
    `${label} needs 1–64 pieces.`,
  );
  const seen = new Set(),
    result = Array.from({ length: values.length }, (_, i) => {
      const itemDescriptor = Object.getOwnPropertyDescriptor(values, i);
      assert(
        itemDescriptor && 'value' in itemDescriptor,
        'INVALID_SPLIT',
        'Piece arrays must be dense values without accessors.',
      );
      const entry = itemDescriptor.value;
      const shapeDescriptor =
        entry && typeof entry === 'object' && !Array.isArray(entry)
          ? Object.getOwnPropertyDescriptor(entry, 'shape')
          : null;
      let id = `piece-${i}`,
        shape;
      if (shapeDescriptor) {
        options(entry, ['id', 'shape', 'commands', 'polygons', 'area', 'site'], 'morph piece');
        assert('value' in shapeDescriptor, 'INVALID_SPLIT', 'Piece shapes cannot be getters.');
        shape = asShape(shapeDescriptor.value);
        id = entry.id ?? id;
      } else shape = asShape(entry);
      assert(
        typeof id === 'string' && id.length && id.length <= 200 && !seen.has(id),
        'DUPLICATE_ID',
        'Piece IDs must be distinct nonempty names.',
      );
      seen.add(id);
      assert(
        shape.polygons.length === 1,
        'MORPH_TOPOLOGY',
        'Each morph piece must have one convex contour; disconnected cells need explicit separate pieces.',
      );
      return Object.freeze({ id, shape, center: centroid(shape) });
    });
  const vertices = result.reduce((n, p) => n + p.shape.polygons[0].length, 0);
  assert(vertices * vertices <= 8000000, 'RESOURCE_LIMIT', 'Piece overlap-validation work exceeds its budget.');
  for (let i = 0; i < result.length; i++)
    for (let j = i + 1; j < result.length; j++)
      assert(
        intersect(result[i].shape, result[j].shape).area <=
          1e-8 * Math.max(1, Math.min(result[i].shape.area, result[j].shape.area)),
        'OVERLAPPING_PIECES',
        'Endpoint pieces must have disjoint interiors.',
      );
  return result;
}
function assignment(left, right, policy) {
  assert(policy === 'nearest' || policy === 'index', 'INVALID_SPLIT', 'Use nearest or index assignment.');
  if (policy === 'index') return left.map((_, i) => i);
  const candidates = [];
  left.forEach((a, i) =>
    right.forEach((b, j) =>
      candidates.push({ i, j, d: (a.center.x - b.center.x) ** 2 + (a.center.y - b.center.y) ** 2 }),
    ),
  );
  candidates.sort((a, b) => a.d - b.d || a.i - b.i || a.j - b.j);
  const usedFrom = new Set(),
    usedTo = new Set(),
    result = Array(left.length);
  for (const c of candidates)
    if (!usedFrom.has(c.i) && !usedTo.has(c.j)) {
      result[c.i] = c.j;
      usedFrom.add(c.i);
      usedTo.add(c.j);
    }
  return result;
}
function prepare(left, right, spec, kind) {
  assert(left.length === right.length, 'MORPH_TOPOLOGY', 'Source and target partitions need the same piece count.');
  const stagger = number(spec.stagger ?? 0, 'piece stagger', 0, 1),
    mapping = assignment(left, right, spec.assign ?? 'nearest'),
    duration = 1 + stagger * (left.length - 1),
    defaults = Object.fromEntries(
      ['samples', 'tolerance', 'align', 'reverse'].filter((k) => spec[k] !== undefined).map((k) => [k, spec[k]]),
    );
  const plans = left.map((a, i) =>
    Object.freeze({
      id: a.id,
      from: a.id,
      to: right[mapping[i]].id,
      morph: createMorph(a.shape.commands, right[mapping[i]].shape.commands, defaults),
      rank: i,
    }),
  );
  const sample = (progress) => {
    number(progress, 'piece morph progress', 0, 1);
    return Object.freeze(
      plans.map((p) => {
        const t = Math.max(0, Math.min(1, progress * duration - p.rank * stagger));
        return Object.freeze({
          id: p.id,
          from: p.from,
          to: p.to,
          commands: p.morph.sample(t),
          progress: t,
          opacity: 1,
        });
      }),
    );
  };
  return Object.freeze({
    diagnostics: Object.freeze({
      kind,
      pieces: plans.length,
      assignment: Object.freeze(mapping),
      assign: spec.assign ?? 'nearest',
      stagger,
      partitionedEndpoints: true,
      semanticIdentityMerge: false,
    }),
    sample,
    frame(progress, frameSpec = {}) {
      options(frameSpec, ['width', 'height', 'fill', 'stroke', 'strokeWidth'], 'piece frame');
      const width = number(frameSpec.width ?? 960, 'frame width', 1, 8192),
        height = number(frameSpec.height ?? 540, 'frame height', 1, 8192),
        style = properties('path', {
          fill: frameSpec.fill ?? '#278b88',
          stroke: frameSpec.stroke ?? 'none',
          strokeWidth: frameSpec.strokeWidth ?? 1,
        });
      return Object.freeze({
        width,
        height,
        children: Object.freeze(
          sample(progress).map((p) =>
            Object.freeze({
              id: p.id,
              type: 'path',
              props: Object.freeze({ ...style, commands: p.commands }),
              children: Object.freeze([]),
            }),
          ),
        ),
      });
    },
  });
}
function validateSpec(spec) {
  options(spec, ['assign', 'stagger', 'seed', 'samples', 'tolerance', 'align', 'reverse'], 'piece morph');
}
/** Partition a convex source into real cells, then morph each cell toward one target. */
export function createSplitMorph(source, targets, spec = {}) {
  validateSpec(spec);
  const right = pieces(targets, 'Targets'),
    descriptor = source && typeof source === 'object' ? Object.getOwnPropertyDescriptor(source, 'pieces') : null;
  const left = descriptor
    ? pieces(source, 'Source')
    : pieces(fracture(asShape(source), { pieces: right.length, seed: spec.seed ?? 1 }), 'Source');
  return prepare(left, right, spec, 'split');
}
/** Bring separate real pieces into a partition of a target shape. */
export function createMergeMorph(sources, target, spec = {}) {
  validateSpec(spec);
  const left = pieces(sources, 'Sources'),
    descriptor = target && typeof target === 'object' ? Object.getOwnPropertyDescriptor(target, 'pieces') : null;
  const right = descriptor
    ? pieces(target, 'Target')
    : pieces(fracture(asShape(target), { pieces: left.length, seed: spec.seed ?? 1 }), 'Target');
  return prepare(left, right, spec, 'merge');
}
