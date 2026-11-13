import { assert, number, options } from '../core/validate.js';
import { seedValue, noiseRaw } from './vector.js';

/** Scalar coherent noise in [-1,1]; scale is spatial frequency in inverse scene units. */
export function noiseField(spec = {}) {
  options(spec, ['seed', 'scale', 'speed'], 'procedural noise');
  const seed = seedValue(spec.seed),
    scale = number(spec.scale ?? 1, 'noise scale', 1e-8, 1e4),
    speed = number(spec.speed ?? 1, 'noise speed', 0, 1e4);
  return Object.freeze((x, y, time = 0) =>
    noiseRaw(
      number(number(x, 'noise x') * scale, 'noise lattice x'),
      number(number(y, 'noise y') * scale, 'noise lattice y'),
      number(number(time, 'noise time') * speed, 'noise lattice time'),
      seed,
    ),
  );
}

/** Row-major scalar grid; validation precedes the coherent-noise hot loop.
 * @param {{columns:number,rows:number,x?:number,y?:number,stepX?:number,stepY?:number,scale?:number,time?:number,seed?:number}} spec
 */
export function noiseGrid(spec) {
  options(spec, ['columns', 'rows', 'x', 'y', 'stepX', 'stepY', 'scale', 'time', 'seed'], 'noise grid');
  const columns = number(spec.columns, 'grid columns', 1, 1e6),
    rows = number(spec.rows, 'grid rows', 1, 1e6);
  assert(
    Number.isInteger(columns) && Number.isInteger(rows) && columns * rows <= 1e6,
    'RESOURCE_LIMIT',
    'A noise grid needs integer dimensions and at most one million samples.',
  );
  const x = number(spec.x ?? 0, 'grid x'),
    y = number(spec.y ?? 0, 'grid y'),
    dx = number(spec.stepX ?? 1, 'grid step x'),
    dy = number(spec.stepY ?? 1, 'grid step y'),
    scale = number(spec.scale ?? 1, 'grid scale', 1e-8, 1e4),
    time = number(spec.time ?? 0, 'grid time'),
    seed = seedValue(spec.seed);
  for (const c of [x * scale, (x + (columns - 1) * dx) * scale, y * scale, (y + (rows - 1) * dy) * scale])
    number(c, 'grid lattice coordinate');
  const values = new Float64Array(columns * rows);
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < columns; i++)
      values[j * columns + i] = noiseRaw((x + i * dx) * scale, (y + j * dy) * scale, time, seed);
  return values;
}
