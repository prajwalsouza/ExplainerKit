import { localMatrix } from '../core/transform.js';
import { sceneLight, shadePasses } from '../graphics/lighting.js';
import { textureTile } from '../graphics/texture.js';
import { rendererError } from './shared.js';
export function filmPlan(frame) {
  const result = new Map(),
    light = sceneLight(frame.light);
  const visit = (node, a) => {
    const p = node.props,
      b = localMatrix(p, node);
    const w = [
        a[0] * b[0] + a[2] * b[1],
        a[1] * b[0] + a[3] * b[1],
        a[0] * b[2] + a[2] * b[3],
        a[1] * b[2] + a[3] * b[3],
        a[0] * b[4] + a[2] * b[5] + a[4],
        a[1] * b[4] + a[3] * b[5] + a[5],
      ],
      d = w[0] * w[3] - w[1] * w[2];
    if (p.shade || p.texture || p.fill?.type === 'texture' || p.stroke?.type === 'texture') {
      if (Math.abs(d) < 1e-10) {
        const e = rendererError('Film paints require a nonsingular transform.', 'RENDER_UNSUPPORTED');
        e.capability = p.shade ? 'shade' : 'texture';
        throw e;
      }
      const inverse = [
          w[3] / d,
          -w[1] / d,
          -w[2] / d,
          w[0] / d,
          (w[2] * w[5] - w[3] * w[4]) / d,
          (w[1] * w[4] - w[0] * w[5]) / d,
        ],
        u = Math.cos(light.angle),
        v = Math.sin(light.angle),
        angle = Math.atan2(inverse[1] * u + inverse[3] * v, inverse[0] * u + inverse[2] * v);
      result.set(node.id, { world: w, inverse, angle, light, passes: shadePasses(p.shade, light, angle) });
    }
    for (const child of node.children ?? []) visit(child, w);
  };
  frame.children.forEach((n) => visit(n, [1, 0, 0, 1, 0, 0]));
  return result;
}
export function tileSVG(t) {
  const tile = textureTile(t);
  return tile.cells
    .map(
      (c) =>
        `<rect x="${c.x}" y="${c.y}" width="1" height="1" fill="${c.color ?? t.color}" fill-opacity="${c.alpha}"/>`,
    )
    .join('');
}
export function motionFrames(frame) {
  if (!frame.motionBlur) return [{ frame, weight: 1 }];
  const m = frame.motionBlur,
    frames = m.frames,
    weights = m.weights ?? frames?.map(() => 1);
  if (
    !Array.isArray(frames) ||
    frames.length < 1 ||
    frames.length > 16 ||
    !Array.isArray(weights) ||
    weights.length !== frames.length ||
    weights.some((w) => !Number.isFinite(w) || w < 0) ||
    !weights.some((w) => w > 0)
  )
    throw rendererError('Motion blur needs 1–16 frames and finite nonnegative weights.');
  if (frames.some((f) => f.motionBlur || f.width !== frame.width || f.height !== frame.height))
    throw rendererError('Motion blur frames must share dimensions and cannot nest.');
  const total = weights.reduce((a, b) => a + b, 0);
  return frames.map((f, i) => ({ frame: f, weight: weights[i] / total }));
}
