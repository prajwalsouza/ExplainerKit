import { assert, number, options, safeCopy } from '../core/validate.js';
import { points } from './points.js';
import { pointSet, stateOf } from './point-set.js';
import { instance } from './instance.js';
import { color, radialGradient } from '../graphics/index.js';
import { colorInterpolator } from '../color/interpolate.js';
function bounds(input) {
  const b = safeCopy(input);
  options(b, ['x', 'y', 'width', 'height'], 'mass bounds');
  return Object.freeze({
    x: number(b.x ?? 0, 'mass x'),
    y: number(b.y ?? 0, 'mass y'),
    width: number(b.width, 'mass width', 1e-6, 1e5),
    height: number(b.height, 'mass height', 1e-6, 1e5),
  });
}
function palette(input, fallback) {
  const colors = safeCopy(input ?? fallback);
  assert(Array.isArray(colors) && colors.length >= 1 && colors.length <= 8, 'INVALID_MASS', 'Use 1–8 mass colours.');
  return colors.map((c) => color(c, { stop: true }));
}
function windSpec(spec = {}) {
  options(spec, ['amplitude', 'period', 'ambient'], 'mass wind');
  return {
    amplitude: number(spec.amplitude ?? 0.2, 'wind amplitude', 0, 1),
    period: number(spec.period ?? 5, 'wind period', 0.1, 86400),
    ambient: spec.ambient,
  };
}
function mass(scene, box, input, kind) {
  const b = bounds(box);
  options(
    input,
    kind === 'grass'
      ? ['density', 'colors', 'wind', 'seed', 'tag']
      : ['leaves', 'colors', 'depth', 'wind', 'seed', 'tag'],
    `${kind} mass`,
  );
  const colors = palette(
      input.colors,
      kind === 'grass' ? ['#254c3f', '#527a46', '#a0b56c'] : ['#264f43', '#577a4c', '#91a66b'],
    ),
    wind = windSpec(input.wind),
    count =
      kind === 'grass'
        ? Math.floor(b.width * b.height * number(input.density ?? 0.001, 'grass density', 0, 0.1))
        : number(input.leaves ?? 200, 'leaf count', 0, 5000),
    depth = kind === 'foliage' ? number(input.depth ?? 0.5, 'foliage depth', 0, 1) : 0;
  assert(Number.isInteger(count) && count <= 5000, 'RESOURCE_LIMIT', 'A mass accepts at most 5000 blades/leaves.');
  assert(scene && typeof scene.ambient === 'function', 'INVALID_MASS', 'Mount a mass in an ExplainerKit scene.');
  assert(
    wind.ambient === undefined || scene._ownsInput(wind.ambient),
    'INVALID_BINDING',
    'Wind ambient must be owned by the same scene.',
  );
  const field = points({ seed: input.seed ?? 1, count, in: { rect: [b.x, b.y, b.width, b.height] } }),
    state = stateOf(field),
    order = Array.from({ length: count }, (_, i) => i).sort((a, z) => state.y[a] - state.y[z] || a - z),
    sorted = pointSet(
      state.seed,
      order.map((i) => state.x[i]),
      order.map((i) => state.y[i]),
      [],
      field.diagnostics,
    ),
    ambient = wind.ambient ?? scene.ambient();
  const output = instance(
    scene,
    sorted,
    (p, t) => {
      const tier = Math.min(colors.length - 1, Math.floor((p.i / Math.max(1, count)) * colors.length)),
        oscillation = Math.sin(((t % wind.period) / wind.period) * 2 * Math.PI + p.rand * 2 * Math.PI),
        size =
          kind === 'grass'
            ? 18 + 35 * p.rand2
            : (16 + 22 * p.rand2) * (1 - depth * 0.5 + (depth * p.i) / Math.max(1, count));
      return {
        type: kind === 'grass' ? 'blade' : 'tongue',
        r: 1,
        width: kind === 'grass' ? 3 + 4 * p.rand3 : size * 0.65,
        height: size,
        wobble: wind.amplitude * oscillation,
        rotation: kind === 'grass' ? 0 : (p.rand3 - 0.5) * Math.PI,
        fill: colors[tier],
        alpha: 1,
      };
    },
    { tag: input.tag ?? (kind === 'grass' ? 'grass-mass' : 'foliage-cluster'), time: ambient },
  );
  return Object.freeze({ ...output, ambient, bounds: b, period: wind.period });
}
/** Mount bounded seeded grass geometry; wind reads an existing or newly created scene ambient input. */
export function grassMass(scene, box, spec = {}) {
  return mass(scene, box, spec, 'grass');
}
/** Mount foliage in stable depth bands, with seeded local shape variation. */
export function foliageCluster(scene, box, spec = {}) {
  return mass(scene, box, spec, 'foliage');
}
/** Soft radial light using an existing gradient, without a filter/compositing scratch surface. */
export function glowLight(scene, box, spec = {}) {
  options(spec, ['color', 'opacity', 'tag'], 'glow light');
  const b = bounds(box),
    fill = color(spec.color ?? '#fff0a0', { stop: true }),
    opacity = number(spec.opacity ?? 0.6, 'light opacity', 0, 1),
    transparent = colorInterpolator(fill, 'transparent')(1),
    gradient = radialGradient({
      x: 0,
      y: 0,
      r: 1,
      stops: [
        { offset: 0, color: fill },
        { offset: 0.45, color: colorInterpolator(fill, transparent)(0.45) },
        { offset: 1, color: transparent },
      ],
    });
  if (spec.tag !== undefined)
    assert(
      typeof spec.tag === 'string' && /^[a-zA-Z][\w-]{0,63}$/.test(spec.tag),
      'INVALID_TAG',
      'Use a short light tag.',
    );
  assert(scene && typeof scene.circle === 'function', 'INVALID_MASS', 'Mount a light in an ExplainerKit scene.');
  const handle = scene.circle({
    x: b.x + b.width / 2,
    y: b.y + b.height / 2,
    r: 1,
    scaleX: b.width / 2,
    scaleY: b.height / 2,
    fill: gradient,
    stroke: 'none',
    opacity,
  });
  if (spec.tag !== undefined) {
    scene.defineTag(spec.tag);
    handle.tag(spec.tag);
  }
  return handle;
}
