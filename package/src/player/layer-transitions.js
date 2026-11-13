import { assert, number, options } from '../core/validate.js';
import { validateClip, pathCommands } from '../graphics/index.js';
import { ellipsePath, roundedRectPath } from '../geometry/index.js';
import { flattenPath } from '../morph/contour.js';
import { localMatrix, multiplyAffine } from '../core/transform.js';

function captureShape(value) {
  if (Array.isArray(value)) return { commands: pathCommands(value) };
  const record = value && Object.getOwnPropertyDescriptor(value, '_record')?.value,
    scene = value && Object.getOwnPropertyDescriptor(value, '_scene')?.value;
  if (record && scene) {
    assert(
      typeof scene._pathTo === 'function' && scene._pathTo(record) && !record.detached,
      'INVALID_LAYER_TRANSITION',
      'Use an attached transition shape.',
    );
    assert(
      ['circle', 'rect', 'path'].includes(record.type),
      'INVALID_LAYER_TRANSITION',
      'Transition handles are circles, rectangles or closed paths.',
    );
    return { handle: value, scene, id: record.id };
  }
  const clip = validateClip(value);
  assert(clip, 'INVALID_LAYER_TRANSITION', 'A shaped transition requires an outline.');
  return {
    commands:
      clip.type === 'path'
        ? clip.commands
        : clip.type === 'circle'
          ? ellipsePath({ x: clip.x, y: clip.y, rx: clip.r, ry: clip.r })
          : roundedRectPath({ x: clip.x, y: clip.y, width: clip.width, height: clip.height, radius: clip.rx }),
  };
}
/** Captures options, not a live handle's sampled geometry. */
export function captureLayerTransition(spec, span) {
  if (spec === undefined) return null;
  options(spec, ['kind', 'duration', 'direction', 'shape', 'through'], 'layer transition');
  const kind = spec.kind ?? 'fade',
    duration = number(spec.duration ?? 0.4, 'transition duration', 0.000001, span);
  assert(
    ['fade', 'opening', 'wipe', 'flyThrough'].includes(kind),
    'INVALID_LAYER_TRANSITION',
    'Use fade, opening, wipe or flyThrough.',
  );
  const direction = spec.direction ?? 'left';
  assert(
    ['left', 'right', 'up', 'down'].includes(direction),
    'INVALID_LAYER_TRANSITION',
    'Wipe direction is left, right, up or down.',
  );
  assert(spec.direction === undefined || kind === 'wipe', 'INVALID_LAYER_TRANSITION', 'direction belongs to a wipe.');
  assert(spec.shape === undefined || kind === 'opening', 'INVALID_LAYER_TRANSITION', 'shape belongs to an opening.');
  assert(
    spec.through === undefined || kind === 'flyThrough',
    'INVALID_LAYER_TRANSITION',
    'through belongs to a flyThrough.',
  );
  const shape =
    kind === 'opening' || kind === 'flyThrough' ? captureShape(kind === 'opening' ? spec.shape : spec.through) : null;
  return Object.freeze({ kind, duration, direction, shape });
}
function sampledOutline(shape, context, resolveTime) {
  if (shape.commands) return shape.commands;
  assert(!shape.handle._record.detached, 'DETACHED_HANDLE', 'The transition shape was removed.');
  const frame = shape.scene.sample({
    time: resolveTime(shape.scene),
    ambient: context.ambient,
    width: context.width,
    height: context.height,
  });
  let selected = null;
  const visit = (node, parent) => {
    const matrix = multiplyAffine(parent, localMatrix(node.props, node));
    if (node.id === shape.id) selected = { node, matrix };
    for (const child of node.children ?? []) visit(child, matrix);
  };
  for (const node of frame.children) visit(node, [1, 0, 0, 1, 0, 0]);
  assert(selected, 'INVALID_LAYER_TRANSITION', 'The projected transition shape is absent.');
  const { node, matrix } = selected,
    p = node.props;
  const commands =
    node.type === 'path'
      ? p.commands
      : node.type === 'circle'
        ? ellipsePath({ rx: p.r, ry: p.r })
        : roundedRectPath({ width: p.width, height: p.height, radius: p.rx });
  return commands.map((command) => {
    const next = [command[0]];
    for (let i = 1; i < command.length; i += 2)
      next.push(
        matrix[0] * command[i] + matrix[2] * command[i + 1] + matrix[4],
        matrix[1] * command[i] + matrix[3] * command[i + 1] + matrix[5],
      );
    return next;
  });
}
const fmt = (value) => `${Number(value.toFixed(7))}%`;
function growingPolygon(shape, progress, context, resolveTime) {
  const contour = flattenPath(sampledOutline(shape, context, resolveTime), { tolerance: 0.25, maxPoints: 512 });
  assert(
    contour.closed && contour.points.length >= 4,
    'INVALID_LAYER_TRANSITION',
    'Opening outlines must be nondegenerate closed contours.',
  );
  const points = contour.points.slice(0, -1),
    center = points.reduce((c, p) => ({ x: c.x + p.x / points.length, y: c.y + p.y / points.length }), { x: 0, y: 0 });
  let orientation = 0,
    inradius = Infinity;
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length],
      c = points[(i + 2) % points.length],
      cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) > 1e-8) {
      if (!orientation) orientation = Math.sign(cross);
      assert(
        Math.sign(cross) === orientation,
        'INVALID_LAYER_TRANSITION',
        'Opening outlines must be convex; prepare a convex reveal silhouette.',
      );
    }
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length > 1e-9)
      inradius = Math.min(inradius, Math.abs((b.x - a.x) * (center.y - a.y) - (b.y - a.y) * (center.x - a.x)) / length);
  }
  assert(
    orientation && inradius > 1e-6 && Number.isFinite(inradius),
    'INVALID_LAYER_TRANSITION',
    'Opening outline has no positive interior.',
  );
  const cover =
    Math.max(
      ...[
        [0, 0],
        [context.width, 0],
        [0, context.height],
        [context.width, context.height],
      ].map(([x, y]) => Math.hypot(x - center.x, y - center.y)),
    ) /
      inradius +
    1;
  const scale = progress * cover;
  return `polygon(${points.map((p) => `${fmt(((center.x + (p.x - center.x) * scale) / context.width) * 100)} ${fmt(((center.y + (p.y - center.y) * scale) / context.height) * 100)}`).join(',')})`;
}
/** Pure transition sample. CSS percentages make the sampled mask independent of backing-store DPR. */
export function layerTransitionAt(transition, progress, context, resolveTime) {
  if (!transition) return { opacity: 1, clip: 'none' };
  const p = Math.max(0, Math.min(1, progress));
  if (transition.kind === 'fade') return { opacity: p, clip: 'none' };
  if (p <= 0) return { opacity: 1, clip: 'polygon(0% 0%,0% 0%,0% 0%)' };
  if (p >= 1) return { opacity: 1, clip: 'none' };
  if (transition.kind === 'wipe') {
    const rest = fmt((1 - p) * 100),
      sides = { left: `0% 0% 0% ${rest}`, right: `0% ${rest} 0% 0%`, up: `${rest} 0% 0% 0%`, down: `0% 0% ${rest} 0%` };
    return { opacity: 1, clip: `inset(${sides[transition.direction]})` };
  }
  return { opacity: 1, clip: growingPolygon(transition.shape, p, context, resolveTime) };
}
