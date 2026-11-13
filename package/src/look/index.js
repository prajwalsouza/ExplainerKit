import { assert, number, options, safeCopy } from '../core/validate.js';
import { captureState } from '../core/transition.js';
import { color } from '../graphics/index.js';
import { colorInterpolator } from '../color/interpolate.js';
import { mapCloudColors } from '../graphics/cloud.js';
import { validateProperty } from '../core/geometry.js';
export { glow, alphaMask } from '../graphics/look.js';
export { filmGrain } from './grain.js';

const GRADE_KEYS = ['saturation', 'exposure', 'contrast', 'tint', 'tintAmount', 'shadows', 'highlights', 'duotone'];
/**
 * Pure palette grade: preserve geometry/identity/alpha, change supported paint and point colors.
 * Order: exposure (stops), contrast around mid-gray, saturation, tint mix, then an optional duotone map
 * from shadows to highlights by luminance. Every numeric control can be animated through scene.grade().
 */
export function gradeFrame(frame, spec = {}) {
  options(spec, GRADE_KEYS, 'scene grade');
  const saturation = number(spec.saturation ?? 1, 'grade saturation', 0, 4),
    exposure = number(spec.exposure ?? 0, 'grade exposure', -8, 8),
    contrast = number(spec.contrast ?? 1, 'grade contrast', 0, 4);
  const tint = spec.tint === undefined ? null : color(spec.tint, { stop: true }),
    tintAmount = number(spec.tintAmount ?? (tint ? 1 : 0), 'tint amount', 0, 1);
  const duotone = number(spec.duotone ?? (spec.shadows || spec.highlights ? 1 : 0), 'duotone amount', 0, 1),
    shadows = color(spec.shadows ?? '#000000', { stop: true }),
    highlights = color(spec.highlights ?? '#ffffff', { stop: true });
  const captured = captureState(frame);
  if (saturation === 1 && exposure === 0 && contrast === 1 && tintAmount === 0 && duotone === 0) return captured;
  const rgb = (value) => {
    const hex = colorInterpolator(color(value), color(value))(0.5);
    return [[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255), hex.slice(7)];
  };
  const [tintRGB] = tint ? rgb(tint) : [[1, 1, 1]],
    [low] = rgb(shadows),
    [high] = rgb(highlights),
    gain = 2 ** exposure;
  const luma = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2],
    clamp = (v) => Math.max(0, Math.min(1, v));
  function channels(c) {
    c = c.map((v) => clamp((v * gain - 0.5) * contrast + 0.5));
    const l = luma(c);
    c = c.map((v) => clamp(l + (v - l) * saturation));
    c = c.map((v, i) => v + ((tintRGB[i] * luma(c)) / Math.max(luma(tintRGB), 1e-6) - v) * tintAmount).map(clamp);
    const t = luma(c);
    return c.map((v, i) => clamp(v + (low[i] + (high[i] - low[i]) * t - v) * duotone));
  }
  const cache = new Map();
  function grade(value) {
    if (value === 'none') return value;
    if (cache.has(value)) return cache.get(value);
    const [c, alpha] = rgb(value),
      result =
        '#' +
        channels(c)
          .map((v) =>
            Math.round(v * 255)
              .toString(16)
              .padStart(2, '0'),
          )
          .join('') +
        alpha;
    cache.set(value, result);
    return result;
  }
  function paint(value) {
    if (value?.type === 'texture') return Object.freeze({ ...value, color: grade(value.color) });
    return typeof value === 'string'
      ? grade(value)
      : Object.freeze({
          ...value,
          stops: Object.freeze(value.stops.map((stop) => Object.freeze({ ...stop, color: grade(stop.color) }))),
        });
  }
  function node(n) {
    const props = { ...n.props, fill: paint(n.props.fill), stroke: paint(n.props.stroke) };
    if (props.glow) props.glow = Object.freeze({ ...props.glow, color: grade(props.glow.color) });
    if (props.texture) props.texture = paint(props.texture);
    if (props.shade)
      props.shade = Object.freeze(
        Object.fromEntries(
          Object.entries(props.shade).map(([k, v]) => [
            k,
            Object.freeze({ ...v, ...(v.color ? { color: grade(v.color) } : {}) }),
          ]),
        ),
      );
    if (n.type === 'cloud') props.points = mapCloudColors(props.points, (r, g, b, a) => [...channels([r, g, b]), a]);
    return Object.freeze({ ...n, props: Object.freeze(props), children: Object.freeze(n.children.map(node)) });
  }
  return Object.freeze({
    ...captured,
    ...(captured.light
      ? {
          light: Object.freeze({
            ...captured.light,
            color: grade(captured.light.color),
            ambient: grade(captured.light.ambient),
          }),
        }
      : {}),
    children: Object.freeze(captured.children.map(node)),
  });
}

/**
 * Front-view shadow on a wall behind a figure, as in shadows thrown by a campfire. The light sits at depth
 * light.z in front of the figure (depth), the wall is farther back (wall). Each point moves along its ray
 * from the light, so the silhouette grows by (wall - light.z)/(depth - light.z) about the light. The
 * mapping is affine, so curves stay exact. scale is returned for choosing a softness blur.
 */
export function shadowOnWall(commands, spec = {}) {
  options(spec, ['light', 'depth', 'wall'], 'wall shadow');
  const light = safeCopy(spec.light);
  options(light, ['x', 'y', 'z'], 'point light');
  const lx = number(light.x, 'light x'),
    ly = number(light.y, 'light y'),
    lz = number(light.z ?? 0, 'light z'),
    depth = number(spec.depth ?? 1, 'figure depth'),
    wall = number(spec.wall ?? 2, 'wall depth');
  assert(depth > lz && wall > depth, 'INVALID_SHADOW', 'Order the depths light < figure < wall.');
  const scale = (wall - lz) / (depth - lz);
  assert(scale <= 1e4, 'RESOURCE_LIMIT', 'Shadow magnification exceeds 10000.');
  const path = validateProperty('path', 'commands', commands);
  const out = path.map(([c, ...v]) =>
    Object.freeze([
      c,
      ...v.map((value, i) =>
        number(i % 2 ? ly + (value - ly) * scale : lx + (value - lx) * scale, 'shadow coordinate'),
      ),
    ]),
  );
  return Object.freeze({ commands: Object.freeze(out), scale });
}

/** Project supplied 3D vertices from a point light onto a horizontal plane. No occlusion inference. */
export function shadowOnPlane(points, spec = {}) {
  options(spec, ['light', 'planeZ'], 'plane shadow');
  const source = safeCopy(points),
    light = safeCopy(spec.light);
  options(light, ['x', 'y', 'z'], 'point light');
  const x = number(light.x, 'light x'),
    y = number(light.y, 'light y'),
    z = number(light.z, 'light z'),
    plane = number(spec.planeZ ?? 0, 'shadow plane z');
  assert(z > plane, 'INVALID_SHADOW', 'The point light must be above the horizontal plane.');
  assert(
    Array.isArray(source) && source.length > 0 && source.length <= 10000,
    'RESOURCE_LIMIT',
    'Project 1–10000 shadow vertices.',
  );
  return Object.freeze(
    source.map((p) => {
      options(p, ['x', 'y', 'z'], 'shadow vertex');
      const px = number(p.x, 'vertex x'),
        py = number(p.y, 'vertex y'),
        pz = number(p.z, 'vertex z');
      assert(
        pz >= plane && pz < z,
        'INVALID_SHADOW',
        'Shadow vertices must be on/above the plane and strictly below the light.',
      );
      const t = (plane - z) / (pz - z);
      assert(t <= 1e4, 'RESOURCE_LIMIT', 'Shadow magnification exceeds 10000.');
      return Object.freeze({
        x: number(x + (px - x) * t, 'shadow x'),
        y: number(y + (py - y) * t, 'shadow y'),
        z: plane,
      });
    }),
  );
}
