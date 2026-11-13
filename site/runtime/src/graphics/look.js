import { localMatrix } from '../core/transform.js';
import { assert, number, options, safeCopy } from '../core/validate.js';
import { color, validatePaint } from './index.js';

function filterPolicy(spec) {
  const space = spec.space ?? 'world';
  assert(['world', 'screen'].includes(space), 'INVALID_FILTER', 'Filter space must be world or screen.');
  assert(spec.strict === undefined || typeof spec.strict === 'boolean', 'INVALID_FILTER', 'strict must be boolean.');
  return {
    space,
    maxScreen: number(spec.maxScreen ?? 32, 'maximum screen sigma', 0, 128),
    strict: spec.strict ?? false,
  };
}
export const blurRadius = (value) => (typeof value === 'number' ? value : (value?.radius ?? 0));
export function validateBlur(value) {
  if (typeof value === 'number') return number(value, 'blur', 0, 64);
  const spec = safeCopy(value);
  options(spec, ['radius', 'space', 'maxScreen', 'strict'], 'blur');
  return Object.freeze({ radius: number(spec.radius ?? 0, 'blur radius', 0, 64), ...filterPolicy(spec) });
}
export function glow(spec = {}) {
  options(spec, ['color', 'blur', 'opacity', 'space', 'maxScreen', 'strict'], 'glow');
  return Object.freeze({
    color: color(spec.color ?? '#ffffff', { stop: true }),
    blur: number(spec.blur ?? 8, 'glow blur', 0, 64),
    opacity: number(spec.opacity ?? 0.8, 'glow opacity', 0, 1),
    ...filterPolicy(spec),
  });
}
export function validateGlow(value) {
  if (value === null) return null;
  const captured = safeCopy(value);
  return glow(captured);
}
export function blendMode(value) {
  assert(
    ['normal', 'add', 'multiply', 'screen'].includes(value),
    'INVALID_BLEND',
    'Use normal, add, multiply or screen.',
  );
  return value;
}
export function alphaMask(gradient, bounds) {
  const paint = validatePaint(gradient);
  assert(
    typeof paint === 'object' && ['linear', 'radial'].includes(paint.type),
    'INVALID_MASK',
    'An alpha mask requires a local linear/radial gradient.',
  );
  options(bounds, ['x', 'y', 'width', 'height'], 'mask bounds');
  return Object.freeze({
    type: 'alpha',
    gradient: paint,
    bounds: Object.freeze({
      x: number(bounds.x ?? 0, 'mask x'),
      y: number(bounds.y ?? 0, 'mask y'),
      width: number(bounds.width, 'mask width', 1e-6, 1e5),
      height: number(bounds.height, 'mask height', 1e-6, 1e5),
    }),
  });
}
export function validateMask(value) {
  if (value === null) return null;
  const captured = safeCopy(value);
  options(captured, ['type', 'gradient', 'bounds'], 'alpha mask');
  assert(captured.type === 'alpha', 'INVALID_MASK', 'Only gradient alpha masks are supported.');
  return alphaMask(captured.gradient, captured.bounds);
}
export const needsIsolation = (p) =>
  (p.opacity ?? 1) < 1 ||
  blurRadius(p.blur) > 0 ||
  !!p.glow ||
  !!p.mask ||
  !!p.shade ||
  !!p.texture ||
  (p.blend ?? 'normal') !== 'normal';
export const effectLayers = (p) =>
  needsIsolation(p)
    ? 1 + (blurRadius(p.blur) > 0 || p.glow ? 1 : 0) + (p.mask ? 1 : 0) + (p.shade ? 3 : p.texture ? 1 : 0)
    : 0;

function filterSupport(condition, message, props) {
  if (condition) return;
  try {
    assert(false, 'RENDER_UNSUPPORTED', message);
  } catch (error) {
    error.capability = props.shade ? 'shade' : props.texture ? 'texture' : props.glow ? 'filter.glow' : 'filter.blur';
    throw error;
  }
}

/** Uniform world transforms make native SVG/Canvas blur radii agree. */
export function effectPlan(frame) {
  const plans = new Map();
  let lookNodes = 0,
    workPixels = 0,
    maxSigma = 0,
    passes = 0,
    clampedFilters = 0;
  function visit(node, parent, parentSigma = 0) {
    const p = node.props,
      m = localMatrix(p, node),
      a = parent;
    if (blurRadius(p.blur) > 0 || p.glow || p.mask || p.shade || p.texture || (p.blend ?? 'normal') !== 'normal') {
      lookNodes++;
      workPixels += frame.width * frame.height * effectLayers(p);
      passes += effectLayers(p);
      assert(
        lookNodes <= 64 && workPixels <= 64000000,
        'RESOURCE_LIMIT',
        'Look processing exceeds 64 effect nodes or 64 million conservative viewport-pass pixels.',
      );
    }
    const w = [
      a[0] * m[0] + a[2] * m[1],
      a[1] * m[0] + a[3] * m[1],
      a[0] * m[2] + a[2] * m[3],
      a[1] * m[2] + a[3] * m[3],
      a[0] * m[4] + a[2] * m[5] + a[4],
      a[1] * m[4] + a[3] * m[5] + a[5],
    ];
    let sigma = parentSigma;
    if (blurRadius(p.blur) > 0 || p.glow || p.shade || p.texture) {
      const x = Math.hypot(w[0], w[1]),
        y = Math.hypot(w[2], w[3]),
        dot = w[0] * w[2] + w[1] * w[3],
        det = w[0] * w[3] - w[1] * w[2];
      filterSupport(
        Number.isFinite(x) &&
          Number.isFinite(y) &&
          x > 1e-6 &&
          Math.abs(x - y) <= 1e-8 * Math.max(1, x, y) &&
          Math.abs(dot) <= 1e-8 * Math.max(1, x * y),
        'Filtered effects require a nonsingular uniform world scale; anisotropic/sheared filter transforms are unsupported.',
        p,
      );
      const scale = (x + y) / 2,
        shadeSigma = Math.max(
          0,
          ...['shadow', 'light'].map((k) =>
            p.shade?.[k] ? (p.shade[k].distance ?? 8) * (1 / 3 + (p.shade[k].softness ?? 0.35)) : 0,
          ),
          (p.shade?.rim?.width ?? 0) / 3,
        );
      const resolve = (radius, policy) => {
        if (!radius) return 0;
        const cap = Math.min(policy?.maxScreen ?? 32, Math.max(0, 128 - parentSigma - scale * shadeSigma)),
          requested = policy?.space === 'screen' ? radius : radius * scale;
        if (requested > cap) {
          filterSupport(!policy?.strict, 'Strict filter exceeds its screen sigma cap.', p);
          clampedFilters++;
        }
        return Math.min(requested, cap) / scale;
      };
      const blur = resolve(blurRadius(p.blur), typeof p.blur === 'object' ? p.blur : null),
        resolvedGlow = p.glow ? { ...p.glow, blur: resolve(p.glow.blur, p.glow) } : null;
      // Both passes share the remaining nested path budget.
      const combined = scale * (blur + (resolvedGlow?.blur ?? 0)),
        available = Math.max(0, 128 - parentSigma - scale * shadeSigma),
        ratio = combined > available && combined > 0 ? available / combined : 1;
      if (ratio < 1) {
        filterSupport(!(p.glow?.strict || p.blur?.strict), 'Strict combined filter exceeds nested sigma cap.', p);
        clampedFilters++;
      }
      const effectiveBlur = blur * ratio,
        effectiveGlow = resolvedGlow ? { ...resolvedGlow, blur: resolvedGlow.blur * ratio } : null;
      sigma += scale * (effectiveBlur + (effectiveGlow?.blur ?? 0) + shadeSigma);
      maxSigma = Math.max(maxSigma, sigma);
      filterSupport(maxSigma <= 128 + 1e-8, 'Nested inner-edge sampling exceeds the 128-pixel path sigma budget.', p);
      const inverse = [
        w[3] / det,
        -w[1] / det,
        -w[2] / det,
        w[0] / det,
        (w[2] * w[5] - w[3] * w[4]) / det,
        (w[1] * w[4] - w[0] * w[5]) / det,
      ];
      plans.set(node.id, { scale, inverse, blur: effectiveBlur, glow: effectiveGlow });
    }
    for (const child of node.children ?? []) visit(child, w, sigma);
  }
  for (const node of frame.children) visit(node, [1, 0, 0, 1, 0, 0]);
  const padding = maxSigma > 0 ? Math.ceil(3 * maxSigma + 2) : 0;
  assert(
    (frame.width + 2 * padding) * (frame.height + 2 * padding) * passes <= 64000000,
    'RESOURCE_LIMIT',
    'Padded look processing exceeds 64 million pass pixels.',
  );
  for (const [id, plan] of plans) {
    const inverse = plan.inverse,
      corners = [
        [-padding, -padding],
        [frame.width + padding, -padding],
        [-padding, frame.height + padding],
        [frame.width + padding, frame.height + padding],
      ].map(([u, v]) => ({
        x: inverse[0] * u + inverse[2] * v + inverse[4],
        y: inverse[1] * u + inverse[3] * v + inverse[5],
      }));
    const bounds = {
      x: Math.min(...corners.map((p) => p.x)),
      y: Math.min(...corners.map((p) => p.y)),
      width: Math.max(...corners.map((p) => p.x)) - Math.min(...corners.map((p) => p.x)),
      height: Math.max(...corners.map((p) => p.y)) - Math.min(...corners.map((p) => p.y)),
    };
    for (const value of Object.values(bounds))
      assert(
        Number.isFinite(value) && Math.abs(value) <= 1e7,
        'RENDER_UNSUPPORTED',
        'Filter region exceeds its coordinate budget.',
      );
    plans.set(
      id,
      Object.freeze({ scale: plan.scale, blur: plan.blur, glow: plan.glow, bounds: Object.freeze(bounds) }),
    );
  }
  Object.defineProperty(plans, 'clampedFilters', { value: clampedFilters });
  Object.defineProperty(plans, 'padding', { value: padding });
  Object.defineProperty(plans, 'workPixels', {
    value: (frame.width + 2 * padding) * (frame.height + 2 * padding) * passes,
  });
  return plans;
}
