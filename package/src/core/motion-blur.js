import { assert, number, options } from './validate.js';
import { localMatrix, localBounds, multiplyAffine } from './transform.js';
/** Configuration is validated before the scene adopts it; shutter inputs resolve per sample. */
export function motionBlurSpec(spec, owns, read) {
  options(spec, ['samples', 'shutter', 'fps', 'auto', 'threshold'], 'motion blur');
  const shutter = spec.shutter ?? 0.5;
  assert(
    typeof shutter === 'number' || owns(shutter),
    'INVALID_MOTION_BLUR',
    'Shutter must be a number or scalar input owned by this scene.',
  );
  number(typeof shutter === 'number' ? shutter : read(shutter), 'shutter fraction', 0, 1);
  const samples = number(spec.samples ?? 6, 'shutter samples', 1, 16),
    fps = number(spec.fps ?? 60, 'shutter fps', 1, 240);
  assert(Number.isInteger(samples), 'INVALID_MOTION_BLUR', 'Shutter samples must be an integer.');
  const auto = spec.auto ?? false;
  assert(
    typeof auto === 'boolean' || (auto && typeof auto === 'object'),
    'INVALID_MOTION_BLUR',
    'Use auto: true or {threshold}.',
  );
  if (typeof auto === 'object') options(auto, ['threshold'], 'automatic motion blur');
  assert(spec.threshold === undefined || auto !== false, 'INVALID_MOTION_BLUR', 'A threshold requires automatic blur.');
  const threshold = number(
    (typeof auto === 'object' ? auto.threshold : spec.threshold) ?? 40,
    'motion threshold',
    0,
    1e7,
  );
  return Object.freeze({ shutter, samples, fps, auto: auto !== false, threshold });
}
const identity = [1, 0, 0, 1, 0, 0];
function marks(frame) {
  const out = new Map();
  function visit(node, parent) {
    const matrix = multiplyAffine(parent, localMatrix(node.props, node));
    // Groups carry the camera transform; leaf probes include rotation/scale around their geometry.
    if (node.children?.length) {
      for (const child of node.children) visit(child, matrix);
      return;
    }
    const b = localBounds(node),
      points = b
        ? [
            [b.x, b.y],
            [b.x + b.width, b.y],
            [b.x, b.y + b.height],
            [b.x + b.width, b.y + b.height],
          ]
        : [[0, 0]];
    out.set(
      node.id,
      points.map(([x, y]) => [matrix[0] * x + matrix[2] * y + matrix[4], matrix[1] * x + matrix[3] * y + matrix[5]]),
    );
  }
  for (const node of frame.children) visit(node, identity);
  return out;
}
/** Largest projected probe displacement in CSS pixels over one nominal frame. */
export function projectedMotion(previous, current) {
  const before = marks(previous),
    after = marks(current);
  let peak = 0;
  for (const [id, points] of after) {
    const prior = before.get(id);
    if (!prior) continue;
    for (let i = 0; i < Math.min(points.length, prior.length); i++)
      peak = Math.max(peak, Math.hypot(points[i][0] - prior[i][0], points[i][1] - prior[i][1]));
  }
  return peak;
}
