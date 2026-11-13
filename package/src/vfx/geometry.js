import { assert, number, options, safeCopy } from '../core/validate.js';

export function point(value) {
  options(value, ['x', 'y'], 'image point');
  return Object.freeze({ x: number(value.x, 'image x', -32768, 32768), y: number(value.y, 'image y', -32768, 32768) });
}

export function orientation(quad) {
  const turns = quad.map((a, i) => {
    const b = quad[(i + 1) % 4],
      c = quad[(i + 2) % 4];
    return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
  });
  if (turns.every((turn) => turn > 0.01)) return 1;
  if (turns.every((turn) => turn < -0.01)) return -1;
  return 0;
}

export function corners(value) {
  assert(Array.isArray(value) && value.length === 4, 'INVALID_DATA', 'Use four ordered surface corners.');
  const quad = safeCopy(value, 0, { count: 0 }).map(point);
  assert(orientation(quad), 'INVALID_DATA', 'Surface corners must form a convex quadrilateral.');
  return Object.freeze(quad);
}

export function rect(value, name = 'tracking region') {
  options(value, ['x', 'y', 'width', 'height'], name);
  return {
    x: number(value.x, name + ' x', -32768, 32768),
    y: number(value.y, name + ' y', -32768, 32768),
    width: number(value.width, name + ' width', 1, 8192),
    height: number(value.height, name + ' height', 1, 8192),
  };
}

export function quadFor(r) {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y },
    { x: r.x + r.width, y: r.y + r.height },
    { x: r.x, y: r.y + r.height },
  ];
}

export function apply(matrix, x, y) {
  const w = matrix[6] * x + matrix[7] * y + 1;
  return {
    x: (matrix[0] * x + matrix[1] * y + matrix[2]) / w,
    y: (matrix[3] * x + matrix[4] * y + matrix[5]) / w,
  };
}

function solve(rows, size) {
  const normal = Array.from({ length: size }, () => Array(size + 1).fill(0));
  for (const row of rows) {
    for (let i = 0; i < size; i++) {
      for (let j = 0; j <= size; j++) normal[i][j] += row[i] * row[j];
    }
  }
  for (let i = 0; i < size; i++) {
    let pivot = i;
    for (let j = i + 1; j < size; j++) {
      if (Math.abs(normal[j][i]) > Math.abs(normal[pivot][i])) pivot = j;
    }
    if (Math.abs(normal[pivot][i]) < 1e-10) return null;
    [normal[i], normal[pivot]] = [normal[pivot], normal[i]];
    const divisor = normal[i][i];
    for (let k = i; k <= size; k++) normal[i][k] /= divisor;
    for (let j = 0; j < size; j++) {
      if (i === j) continue;
      const factor = normal[j][i];
      for (let k = i; k <= size; k++) normal[j][k] -= factor * normal[i][k];
    }
  }
  return normal.map((row) => row[size]);
}

export function fit(matches, motion, scale = 1) {
  if (motion === 'translation') {
    let x = 0,
      y = 0;
    for (const m of matches) {
      x += m.u - m.x;
      y += m.v - m.y;
    }
    return [1, 0, x / matches.length, 0, 1, y / matches.length, 0, 0];
  }
  const rows = [];
  for (const m of matches) {
    const x = m.x / scale,
      y = m.y / scale,
      u = m.u / scale,
      v = m.v / scale;
    if (motion === 'affine') {
      rows.push([x, y, 1, 0, 0, 0, u], [0, 0, 0, x, y, 1, v]);
    } else {
      rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u], [0, 0, 0, x, y, 1, -v * x, -v * y, v]);
    }
  }
  const m = solve(rows, motion === 'affine' ? 6 : 8);
  if (!m) return null;
  return [m[0], m[1], m[2] * scale, m[3], m[4], m[5] * scale, (m[6] ?? 0) / scale, (m[7] ?? 0) / scale];
}

/** Map a rectangle's local coordinates to its four image corners. */
export function surfaceTransform(surface, width = 1, height = 1) {
  const quad = corners(surface);
  number(width, 'surface width', 1, 8192);
  number(height, 'surface height', 1, 8192);
  const extent = Math.max(1, ...quad.map(({ x, y }) => Math.max(Math.abs(x), Math.abs(y))));
  const unit = quadFor({ x: 0, y: 0, width: 1, height: 1 });
  const matrix = fit(
    unit.map(({ x, y }, i) => ({ x, y, u: quad[i].x / extent, v: quad[i].y / extent })),
    'perspective',
  );
  assert(matrix, 'INVALID_DATA', 'Surface is too close to a degenerate projection.');
  const [a, b, c, d, e, f, g, h] = matrix;
  return Object.freeze([
    (a * extent) / width,
    (b * extent) / height,
    c * extent,
    (d * extent) / width,
    (e * extent) / height,
    f * extent,
    g / width,
    h / height,
  ]);
}

export function projectSurface(surface, u, v) {
  return Object.freeze(apply(surfaceTransform(surface), number(u, 'surface u', 0, 1), number(v, 'surface v', 0, 1)));
}

export function matteOutline(value) {
  assert(
    Array.isArray(value) && value.length >= 3 && value.length <= 96,
    'INVALID_DATA',
    'Use 3 to 96 ordered matte vertices.',
  );
  return Object.freeze(safeCopy(value).map(point));
}

/** Keep the image outside the supplied foreground outline. */
export function foregroundHoldout(outline, width, height) {
  const shape = matteOutline(outline);
  number(width, 'holdout width', 1, 8192);
  number(height, 'holdout height', 1, 8192);
  assert(
    shape.every(({ x, y }) => x >= 0 && x <= width && y >= 0 && y <= height),
    'INVALID_DATA',
    'Keep matte vertices within the holdout frame.',
  );
  const path = (vertices) => vertices.map(({ x, y }, i) => Object.freeze([i === 0 ? 'M' : 'L', x, y]));
  const close = Object.freeze(['Z']);
  const frame = quadFor({ x: 0, y: 0, width, height });
  return Object.freeze({
    type: 'path',
    units: 'user',
    fillRule: 'evenodd',
    commands: Object.freeze([...path(frame), close, ...path(shape), close]),
  });
}
