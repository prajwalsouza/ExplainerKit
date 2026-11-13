import { assert, number, options, text } from '../core/validate.js';

const records = new WeakMap();
const finite = (value, label) => number(value, label, -1e150, 1e150);
const coordinate = (value, label) => number(value, label, -1e12, 1e12);
function point(value, label = 'point') {
  options(value, ['x', 'y'], label);
  return { x: finite(value.x, `${label} x`), y: finite(value.y, `${label} y`) };
}
export function frameRecord(value) {
  const record = records.get(value);
  assert(record, 'INVALID_REFERENCE_FRAME', 'Use a reference frame from this module.');
  return record;
}
function common(a, b) {
  const ra = frameRecord(a),
    rb = frameRecord(b);
  assert(ra.tree === rb.tree, 'FOREIGN_REFERENCE_FRAME', 'Reference frames must belong to one tree.');
  const ancestors = new Set();
  for (let n = a; n; n = frameRecord(n).parent) ancestors.add(n);
  for (let n = b; n; n = frameRecord(n).parent) if (ancestors.has(n)) return n;
}
function checkedProduct(a, b) {
  const value = a * b;
  assert(
    Number.isFinite(value) && value >= 1e-150 && value <= 1e150,
    'ZOOM_PRECISION_LIMIT',
    'Relative units exceed [1e-150,1e150]; shorten the frame path or rebase the construction.',
  );
  return value;
}
function path(frame, ancestor) {
  const values = [];
  for (let n = frame; n !== ancestor; n = frameRecord(n).parent) values.push(frameRecord(n));
  return values;
}

/** Convert without materializing either frame's absolute root/world origin. */
export function convertFramePoint(value, from, to) {
  let p = point(value);
  const ancestor = common(from, to),
    up = path(from, ancestor),
    down = path(to, ancestor);
  relativeUnits(from, to);
  for (const r of up) {
    const c = Math.cos(r.rotation),
      s = Math.sin(r.rotation),
      x = p.x * r.unit,
      y = p.y * r.unit;
    p = { x: finite(r.x + c * x - s * y, 'converted x'), y: finite(r.y + s * x + c * y, 'converted y') };
  }
  for (const r of down.toReversed()) {
    const c = Math.cos(r.rotation),
      s = Math.sin(r.rotation),
      x = p.x - r.x,
      y = p.y - r.y;
    p = { x: finite((c * x + s * y) / r.unit, 'converted x'), y: finite((-s * x + c * y) / r.unit, 'converted y') };
  }
  return Object.freeze(p);
}
export function relativeUnits(from, to) {
  const ancestor = common(from, to);
  let scale = 1;
  for (const r of path(from, ancestor)) scale = checkedProduct(scale, r.unit);
  for (const r of path(to, ancestor).toReversed()) scale = checkedProduct(scale, 1 / r.unit);
  return scale;
}
export function relativeRotation(from, to) {
  const ancestor = common(from, to);
  let rotation = 0;
  for (const r of path(from, ancestor)) rotation += r.rotation;
  for (const r of path(to, ancestor)) rotation -= r.rotation;
  return finite(rotation, 'relative rotation');
}
export function convertFrameVector(value, from, to) {
  const p = point(value, 'vector'),
    scale = relativeUnits(from, to),
    a = relativeRotation(from, to),
    c = Math.cos(a),
    s = Math.sin(a);
  return Object.freeze({
    x: finite(scale * (c * p.x - s * p.y), 'vector x'),
    y: finite(scale * (s * p.x + c * p.y), 'vector y'),
  });
}

/** A bounded tree of 2D similarity frames; units are relative to the parent. */
export function referenceFrame(spec = {}) {
  options(spec, ['id', 'unit', 'x', 'y', 'rotation'], 'root reference frame');
  const tree = { ids: new Map(), count: 0 };
  function create(value, parent = null) {
    options(value, ['id', 'unit', 'x', 'y', 'rotation'], 'reference frame');
    const id = text(value.id ?? `frame-${tree.count + 1}`, 'reference frame id', 200);
    assert(id.length && !tree.ids.has(id), 'DUPLICATE_FRAME', 'Frame IDs must be nonempty and unique within the tree.');
    const unit = number(value.unit ?? 1, 'relative unit', 1e-150, 1e150),
      x = coordinate(value.x ?? 0, 'frame x'),
      y = coordinate(value.y ?? 0, 'frame y'),
      rotation = number(value.rotation ?? 0, 'frame rotation', -1e6, 1e6),
      depth = parent ? frameRecord(parent).depth + 1 : 0;
    assert(
      depth <= 64 && tree.count < 2048,
      'RESOURCE_LIMIT',
      'A frame tree accepts at most 2048 frames and 64 parent levels.',
    );
    const result = {
      id,
      unit,
      x,
      y,
      rotation,
      parent,
      frame(child) {
        return create(child, result);
      },
      pointTo(localValue1, target) {
        return convertFramePoint(localValue1, result, target);
      },
      vectorTo(localValue2, target) {
        return convertFrameVector(localValue2, result, target);
      },
      scaleTo(target) {
        return relativeUnits(result, target);
      },
      rotationTo(target) {
        return relativeRotation(result, target);
      },
      find(localId3) {
        const frame = tree.ids.get(localId3);
        assert(frame, 'UNKNOWN_FRAME', `No reference frame named ${localId3}.`);
        return frame;
      },
    };
    records.set(result, { id, unit, x, y, rotation, parent, tree, depth });
    tree.ids.set(id, result);
    tree.count++;
    return Object.freeze(result);
  }
  // A root establishes an external unit label/scale. Tree-relative conversions
  // cancel that shared unit; root x/y/rotation describe no hidden global frame.
  return create(spec);
}

export function frameCandidates(from, to) {
  common(from, to);
  const frames = new Set();
  for (const endpoint of [from, to]) for (let n = endpoint; n; n = frameRecord(n).parent) frames.add(n);
  return [...frames];
}
