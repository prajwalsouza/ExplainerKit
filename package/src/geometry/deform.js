import { assert, number, options } from '../core/validate.js';
import { validateProperty } from '../core/geometry.js';

const basis = (t) => [
  (1 - t) ** 3 / 6,
  (3 * t ** 3 - 6 * t * t + 4) / 6,
  (-3 * t ** 3 + 3 * t * t + 3 * t + 1) / 6,
  t ** 3 / 6,
];

function tessellate(commands, subdivisions, maxPoints) {
  const points = [];
  let current = null,
    start = null;
  const push = (point) => {
    assert(points.length < maxPoints, 'RESOURCE_LIMIT', 'Lattice tessellation exceeds maxPoints.');
    points.push(point);
  };
  for (const command of commands) {
    const kind = command[0];
    if (kind === 'M') {
      current = [command[1], command[2]];
      start = current;
      push(['M', ...current]);
      continue;
    }
    assert(current, 'INVALID_PATH', 'Lattice paths must start each contour with M.');
    const a = current,
      b = kind === 'Z' ? start : command.slice(-2);
    for (let i = 1; i <= subdivisions; i++) {
      const t = i / subdivisions,
        u = 1 - t;
      let x, y;
      if (kind === 'C') {
        x = u ** 3 * a[0] + 3 * u * u * t * command[1] + 3 * u * t * t * command[3] + t ** 3 * b[0];
        y = u ** 3 * a[1] + 3 * u * u * t * command[2] + 3 * u * t * t * command[4] + t ** 3 * b[1];
      } else if (kind === 'Q') {
        x = u * u * a[0] + 2 * u * t * command[1] + t * t * b[0];
        y = u * u * a[1] + 2 * u * t * command[2] + t * t * b[1];
      } else {
        x = u * a[0] + t * b[0];
        y = u * a[1] + t * b[1];
      }
      push(['L', x, y]);
    }
    current = b;
    if (kind === 'Z') push(['Z']);
  }
  return points;
}

/** Local cubic B-spline displacement lattice; nonlinear curves are bounded polyline approximations. */
export function lattice(first, second = {}, third = {}) {
  const explicit = first && typeof first.derive === 'function',
    scene = explicit ? first : second.scene,
    input = explicit ? second : first,
    spec = explicit ? third : second;
  options(spec, ['scene', 'columns', 'rows', 'bounds', 'subdivisions', 'maxPoints'], 'lattice');
  assert(
    scene && typeof scene.parameter === 'function' && typeof scene.derive === 'function',
    'INVALID_BINDING',
    'Pass lattice(scene,commands,spec), or include {scene} in its options.',
  );
  const commands = validateProperty('path', 'commands', input);
  assert(commands.length > 0, 'INVALID_PATH', 'A lattice needs a nonempty path.');
  const columns = number(spec.columns ?? 4, 'lattice columns', 2, 32),
    rows = number(spec.rows ?? 4, 'lattice rows', 2, 32),
    subdivisions = number(spec.subdivisions ?? 8, 'lattice subdivisions', 1, 64),
    maxPoints = number(spec.maxPoints ?? 10000, 'lattice point cap', 2, 10000);
  assert(
    [columns, rows, subdivisions, maxPoints].every(Number.isInteger),
    'INVALID_DEFORMATION',
    'Lattice counts must be integers.',
  );
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const command of commands)
    for (let i = 1; i < command.length; i += 2) {
      minX = Math.min(minX, command[i]);
      maxX = Math.max(maxX, command[i]);
      minY = Math.min(minY, command[i + 1]);
      maxY = Math.max(maxY, command[i + 1]);
    }
  assert(Number.isFinite(minX), 'INVALID_PATH', 'A lattice needs path coordinates.');
  const bounds = spec.bounds ?? { x: minX, y: minY, width: maxX - minX || 1, height: maxY - minY || 1 };
  options(bounds, ['x', 'y', 'width', 'height'], 'lattice bounds');
  const x = number(bounds.x, 'lattice x'),
    y = number(bounds.y, 'lattice y'),
    width = number(bounds.width, 'lattice width', 1e-6, 1e7),
    height = number(bounds.height, 'lattice height', 1e-6, 1e7);
  number(x + width, 'lattice right');
  number(y + height, 'lattice bottom');
  assert(
    minX >= x && maxX <= x + width && minY >= y && maxY <= y + height,
    'INVALID_DEFORMATION',
    'Lattice bounds must contain all path control coordinates.',
  );
  // Complete all potentially failing preparation before registering scene parameters.
  const dense = tessellate(commands, subdivisions, maxPoints);
  const prepared = dense.map((command) => {
    if (command[0] === 'Z') return { command, weights: [] };
    const u = ((command[1] - x) / width) * (columns - 1),
      v = ((command[2] - y) / height) * (rows - 1),
      i = Math.floor(u),
      j = Math.floor(v),
      bu = basis(u - i),
      bv = basis(v - j),
      weights = [];
    for (let a = 0; a < 4; a++)
      for (let b = 0; b < 4; b++) {
        const column = Math.max(0, Math.min(columns - 1, i + a - 1)),
          row = Math.max(0, Math.min(rows - 1, j + b - 1));
        weights.push([row * columns + column, bu[a] * bv[b]]);
      }
    return { command, weights };
  });
  const originals = Array.from({ length: columns * rows }, (_, i) =>
    Object.freeze({
      x: x + ((i % columns) * width) / (columns - 1),
      y: y + (Math.floor(i / columns) * height) / (rows - 1),
    }),
  );
  const controls = Object.freeze(
    originals.map((original) =>
      Object.freeze({
        original,
        x: scene.parameter(original.x, { min: -1e7, max: 1e7 }),
        y: scene.parameter(original.y, { min: -1e7, max: 1e7 }),
      }),
    ),
  );
  const output = scene.derive(
    controls.flatMap((point) => [point.x, point.y]),
    (...values) => {
      const delta = originals.map((point, i) => [values[2 * i] - point.x, values[2 * i + 1] - point.y]);
      if (delta.every(([dx, dy]) => dx === 0 && dy === 0)) return commands;
      return Object.freeze(
        prepared.map(({ command, weights }) => {
          if (command[0] === 'Z') return Object.freeze(['Z']);
          let dx = 0,
            dy = 0;
          for (const [index, weight] of weights) {
            dx += weight * delta[index][0];
            dy += weight * delta[index][1];
          }
          return Object.freeze([command[0], number(command[1] + dx, 'warped x'), number(command[2] + dy, 'warped y')]);
        }),
      );
    },
  );
  return Object.freeze({
    columns,
    rows,
    controls,
    commands: output,
    bounds: Object.freeze({ x, y, width, height }),
    pointCount: dense.length,
    point(column, row) {
      number(column, 'control column', 0, columns - 1);
      number(row, 'control row', 0, rows - 1);
      assert(
        Number.isInteger(column) && Number.isInteger(row),
        'INVALID_DEFORMATION',
        'Control indices must be integers.',
      );
      return controls[row * columns + column];
    },
    sample(context = {}) {
      return output.sample(scene._sampleContext(context));
    },
  });
}
