import { assert, number, options } from '../core/validate.js';
import { cameraMatrix, invertMatrix, multiplyMatrices } from './math.js';

/** Authored 2.5D: inverse-depth pan, exponential zoom, common view rotation. */
export function layerPose(pose, depth, size) {
  number(depth, 'layer depth', 0.05, 1000);
  return Object.freeze({
    ...pose,
    x: size.width / 2 + (pose.x - size.width / 2) / depth,
    y: size.height / 2 + (pose.y - size.height / 2) / depth,
    zoom: number(pose.zoom ** (1 / depth), 'layer zoom', 1e-4, 1e4),
  });
}
export function focusBlur(depth, focus) {
  number(depth, 'layer depth', 0.05, 1000);
  options(focus, ['depth', 'aperture'], 'focus');
  const focal = number(focus.depth ?? 1, 'focus depth', 0.05, 1000),
    aperture = number(focus.aperture ?? 0, 'focus aperture', 0, 8);
  // 12 authored pixels is an exposed illustrative convention, not lens calibration.
  return number(12 * aperture * Math.abs(1 / depth - 1 / focal), 'focus blur', 0, 64);
}
export function projectLayer(node, pose, size) {
  if (!node.layerCache) return node;
  const base = cameraMatrix(pose, size),
    target = cameraMatrix(layerPose(pose, node.layerCache.depth, size), size),
    m = multiplyMatrices(invertMatrix(base), target);
  const scale = Math.hypot(m[0], m[1]);
  assert(Number.isFinite(scale), 'INVALID_LAYER', 'Layer projection must remain finite.');
  return {
    id: `layer-view:${node.id}`,
    type: 'group',
    props: { x: m[4], y: m[5], rotation: Math.atan2(m[1], m[0]), scaleX: scale, scaleY: scale, opacity: 1 },
    children: [node],
  };
}
export function shutterTimes(time, spec) {
  options(spec, ['samples', 'shutter', 'fps'], 'motion blur');
  number(time, 'shutter time', 0, 86400);
  const samples = number(spec.samples ?? 6, 'shutter samples', 1, 16),
    shutter = number(spec.shutter ?? 0.5, 'shutter fraction', 0, 1),
    fps = number(spec.fps ?? 60, 'shutter fps', 1, 240);
  assert(Number.isInteger(samples), 'INVALID_MOTION_BLUR', 'Shutter samples must be an integer.');
  return Object.freeze(
    Array.from({ length: shutter === 0 ? 1 : samples }, (_, i) =>
      Math.max(0, time - (shutter / fps) * (1 - (i + 0.5) / samples)),
    ),
  );
}
