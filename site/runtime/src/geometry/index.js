import { assert, number, options, safeCopy } from '../core/validate.js';
import { validateProperty } from '../core/geometry.js';
export { measurePath, pathPlacements } from './path.js';
export { motionPath, bindMotionPath } from './motion-path.js';
export { lattice } from './deform.js';

const frozen = (commands) => validateProperty('path', 'commands', commands);
function count(value, name, min = 0, max = 10000) {
  number(value, name, min, max);
  assert(Number.isInteger(value), 'INVALID_DISTRIBUTION', `${name} must be an integer.`);
  return value;
}

export function polygonPath(input, spec = {}) {
  options(spec, ['closed'], 'polygon');
  const points = safeCopy(input),
    closed = spec.closed ?? true;
  assert(typeof closed === 'boolean', 'INVALID_PATH', 'closed must be boolean.');
  assert(
    Array.isArray(points) && points.length >= (closed ? 3 : 2) && points.length <= 9999,
    'RESOURCE_LIMIT',
    'A polygon needs 3–9999 points (2 for an open line).',
  );
  const commands = points.map((p, i) => {
    options(p, ['x', 'y'], 'polygon point');
    return [i ? 'L' : 'M', number(p.x, 'point x'), number(p.y, 'point y')];
  });
  if (closed) commands.push(['Z']);
  return frozen(commands);
}
export function regularPolygon(spec = {}) {
  options(spec, ['sides', 'radius', 'x', 'y', 'rotation'], 'regular polygon');
  const sides = count(spec.sides ?? 6, 'polygon sides', 3, 4096),
    radius = number(spec.radius ?? 50, 'polygon radius', 1e-6, 1e5),
    x = number(spec.x ?? 0, 'polygon x'),
    y = number(spec.y ?? 0, 'polygon y'),
    angle = number(spec.rotation ?? -Math.PI / 2, 'polygon rotation');
  return polygonPath(
    Array.from({ length: sides }, (_, i) => ({
      x: x + radius * Math.cos(angle + (2 * Math.PI * i) / sides),
      y: y + radius * Math.sin(angle + (2 * Math.PI * i) / sides),
    })),
  );
}
export function starPath(spec = {}) {
  options(spec, ['points', 'outerRadius', 'innerRadius', 'x', 'y', 'rotation'], 'star');
  const n = count(spec.points ?? 5, 'star points', 2, 2048),
    outer = number(spec.outerRadius ?? 60, 'outer radius', 1e-6, 1e5),
    inner = number(spec.innerRadius ?? outer * 0.5, 'inner radius', 1e-6, outer),
    x = number(spec.x ?? 0, 'star x'),
    y = number(spec.y ?? 0, 'star y'),
    rotation = number(spec.rotation ?? -Math.PI / 2, 'star rotation');
  return polygonPath(
    Array.from({ length: n * 2 }, (_, i) => {
      const r = i % 2 ? inner : outer,
        a = rotation + (Math.PI * i) / n;
      return { x: x + r * Math.cos(a), y: y + r * Math.sin(a) };
    }),
  );
}
/** Four cubic arcs; a bounded approximation to an ellipse, with stable topology. */
export function ellipsePath(spec = {}) {
  options(spec, ['x', 'y', 'rx', 'ry', 'rotation'], 'ellipse');
  const x = number(spec.x ?? 0, 'ellipse x'),
    y = number(spec.y ?? 0, 'ellipse y'),
    rx = number(spec.rx ?? 50, 'ellipse rx', 1e-6, 1e5),
    ry = number(spec.ry ?? rx, 'ellipse ry', 1e-6, 1e5),
    angle = number(spec.rotation ?? 0, 'ellipse rotation'),
    k = (4 * (Math.SQRT2 - 1)) / 3;
  const local = [
    ['M', rx, 0],
    ['C', rx, k * ry, k * rx, ry, 0, ry],
    ['C', -k * rx, ry, -rx, k * ry, -rx, 0],
    ['C', -rx, -k * ry, -k * rx, -ry, 0, -ry],
    ['C', k * rx, -ry, rx, -k * ry, rx, 0],
    ['Z'],
  ];
  return transformPath(local, { x, y, rotation: angle });
}
export function roundedRectPath(spec = {}) {
  options(spec, ['x', 'y', 'width', 'height', 'radius'], 'rounded rectangle');
  const x = number(spec.x ?? 0, 'rectangle x'),
    y = number(spec.y ?? 0, 'rectangle y'),
    w = number(spec.width ?? 100, 'rectangle width', 1e-6, 1e5),
    h = number(spec.height ?? 60, 'rectangle height', 1e-6, 1e5),
    r = Math.min(number(spec.radius ?? 12, 'corner radius', 0, 1e5), w / 2, h / 2),
    k = (4 * (Math.SQRT2 - 1)) / 3;
  return transformPath(
    [
      ['M', r, 0],
      ['L', w - r, 0],
      ['C', w - r + k * r, 0, w, r - k * r, w, r],
      ['L', w, h - r],
      ['C', w, h - r + k * r, w - r + k * r, h, w - r, h],
      ['L', r, h],
      ['C', r - k * r, h, 0, h - r + k * r, 0, h - r],
      ['L', 0, r],
      ['C', 0, r - k * r, r - k * r, 0, r, 0],
      ['Z'],
    ],
    { x, y },
  );
}
export function transformPath(input, spec = {}) {
  options(spec, ['x', 'y', 'rotation', 'scaleX', 'scaleY'], 'path transform');
  const commands = validateProperty('path', 'commands', safeCopy(input)),
    x = number(spec.x ?? 0, 'translation x'),
    y = number(spec.y ?? 0, 'translation y'),
    a = number(spec.rotation ?? 0, 'rotation'),
    sx = number(spec.scaleX ?? 1, 'scale x'),
    sy = number(spec.scaleY ?? 1, 'scale y'),
    c = Math.cos(a),
    s = Math.sin(a);
  return frozen(
    commands.map((command) => {
      const next = [command[0]];
      for (let i = 1; i < command.length; i += 2) {
        const u = command[i] * sx,
          v = command[i + 1] * sy;
        next.push(x + c * u - s * v, y + s * u + c * v);
      }
      return next;
    }),
  );
}
/** Placement data can feed keyed repeat bindings, or ordinary instance.set calls. */
export function gridPlacements(spec = {}) {
  options(spec, ['count', 'columns', 'cellWidth', 'cellHeight', 'gap', 'x', 'y'], 'grid placements');
  const n = count(spec.count, 'grid count'),
    cols = count(spec.columns ?? Math.max(1, n), 'grid columns', 1, 10000),
    w = number(spec.cellWidth ?? 20, 'cell width', 0, 1e5),
    h = number(spec.cellHeight ?? 20, 'cell height', 0, 1e5),
    gap = number(spec.gap ?? 0, 'grid gap', 0, 1e5),
    x = number(spec.x ?? 0, 'grid x'),
    y = number(spec.y ?? 0, 'grid y');
  return Object.freeze(
    Array.from({ length: n }, (_, i) =>
      Object.freeze({
        index: i,
        x: number(x + (i % cols) * (w + gap), 'placement x'),
        y: number(y + Math.floor(i / cols) * (h + gap), 'placement y'),
        rotation: 0,
      }),
    ),
  );
}
export function radialPlacements(spec = {}) {
  options(spec, ['count', 'radius', 'x', 'y', 'start', 'sweep', 'orient'], 'radial placements');
  const n = count(spec.count, 'radial count'),
    r = number(spec.radius ?? 100, 'radial radius', 0, 1e5),
    x = number(spec.x ?? 0, 'radial x'),
    y = number(spec.y ?? 0, 'radial y'),
    start = number(spec.start ?? 0, 'start angle'),
    sweep = number(spec.sweep ?? Math.PI * 2, 'angle sweep', -Math.PI * 2, Math.PI * 2),
    orient = spec.orient ?? 'tangent';
  assert(
    ['tangent', 'radial', 'none'].includes(orient),
    'INVALID_DISTRIBUTION',
    'Use tangent, radial or none orientation.',
  );
  const complete = Math.abs(Math.abs(sweep) - 2 * Math.PI) < 1e-12;
  return Object.freeze(
    Array.from({ length: n }, (_, i) => {
      const a = start + sweep * (n <= 1 ? 0 : i / (complete ? n : n - 1));
      return Object.freeze({
        index: i,
        x: number(x + r * Math.cos(a), 'placement x'),
        y: number(y + r * Math.sin(a), 'placement y'),
        rotation: orient === 'none' ? 0 : a + (orient === 'tangent' ? (sweep < 0 ? -Math.PI / 2 : Math.PI / 2) : 0),
      });
    }),
  );
}

export { polyhedron, split } from './polyhedra.js';
export { Line, outlineDraw, samplePath, pairPoints, inkStroke } from './drawing.js';
