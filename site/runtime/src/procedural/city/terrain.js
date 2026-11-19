import { assert, number, options, text } from '../../core/validate.js';
import { underpassSurfaceHeight } from './underpasses.js';
import { bridgeSurfaceHeight } from './water-bridges.js';

// A transferable rectangular grid of orthometric elevations. Row zero is north, like the
// geographic heightfield. The scene uses X east, Y up and Z south.
export function cityTerrain(spec) {
  if (spec == null) return null;
  options(spec, ['columns', 'rows', 'bounds', 'values', 'source'], 'city terrain');
  const columns = number(spec.columns, 'terrain columns', 2, 513);
  const rows = number(spec.rows, 'terrain rows', 2, 513);
  assert(
    Number.isInteger(columns) && Number.isInteger(rows),
    'INVALID_HEIGHTFIELD',
    'Terrain dimensions are whole numbers.',
  );
  const b = spec.bounds;
  options(b, ['x0', 'y0', 'x1', 'y1'], 'terrain bounds');
  const x0 = number(b.x0, 'terrain x0', -2e7, 2e7);
  const y0 = number(b.y0, 'terrain y0', -2e7, 2e7);
  const x1 = number(b.x1, 'terrain x1', x0 + 1e-6, 2e7);
  const y1 = number(b.y1, 'terrain y1', y0 + 1e-6, 2e7);
  const input = spec.values;
  assert(
    (input instanceof Float32Array || input instanceof Float64Array) && input.length === columns * rows,
    'INVALID_HEIGHTFIELD',
    'Terrain values must be a Float32Array or Float64Array of columns × rows samples.',
  );
  const values = Float32Array.from(input);
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    assert(
      Number.isFinite(value) && value >= -12000 && value <= 12000,
      'INVALID_HEIGHTFIELD',
      'Terrain heights must be finite metres.',
    );
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  let source;
  if (spec.source != null) {
    options(spec.source, ['name', 'url', 'attribution'], 'terrain source');
    source = Object.freeze({
      name: text(spec.source.name, 'terrain source name', 120),
      url: text(spec.source.url, 'terrain source URL', 500),
      attribution: text(spec.source.attribution, 'terrain attribution', 500),
    });
    assert(source.url.startsWith('https://'), 'INVALID_HEIGHTFIELD', 'Terrain attribution needs an HTTPS source URL.');
  }
  return Object.freeze({
    columns,
    rows,
    bounds: Object.freeze({ x0, y0, x1, y1 }),
    values,
    min,
    max,
    ...(source ? { source } : {}),
  });
}

export function terrainHeight(terrain, x, z) {
  if (!terrain) return 0;
  const { columns, rows, bounds, values } = terrain;
  const u = Math.min(columns - 1, Math.max(0, ((x - bounds.x0) / (bounds.x1 - bounds.x0)) * (columns - 1)));
  const v = Math.min(rows - 1, Math.max(0, ((bounds.y1 + z) / (bounds.y1 - bounds.y0)) * (rows - 1)));
  const i = Math.min(Math.floor(u), columns - 2);
  const j = Math.min(Math.floor(v), rows - 2);
  const a = u - i;
  const b = v - j;
  const k = j * columns + i;
  // Match the two triangles the renderer draws in a cell, so feet and wheels rest on it.
  if (a + b <= 1) return values[k] + (values[k + 1] - values[k]) * a + (values[k + columns] - values[k]) * b;
  const southeast = values[k + columns + 1];
  return southeast + (values[k + columns] - southeast) * (1 - a) + (values[k + 1] - southeast) * (1 - b);
}

export function cityGroundHeight(city, x, z) {
  return terrainHeight(city?.terrain, x, z);
}

// Keep route identities at stacked crossings. Without a route, resolve the lower
// passage only when the viewer is already entering or moving below its roof.
export function citySurfaceHeight(city, x, z, roadId, altitude) {
  const ground = cityGroundHeight(city, x, z);
  if (!city?.bridgeProfiles && !city?.underpass) return ground;
  const lower = underpassSurfaceHeight(city.underpass?.profiles, x, z, roadId);
  if (roadId !== undefined && lower !== undefined) return lower;
  const upper = bridgeSurfaceHeight(city.bridgeProfiles, x, z, roadId);
  if (lower !== undefined && Number.isFinite(altitude) && altitude < (upper ?? lower + 2.4) + 0.25) return lower;
  return upper ?? ground;
}
