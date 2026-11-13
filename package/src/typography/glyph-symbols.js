import { assert } from '../core/validate.js';
import { pathCommands } from '../graphics/index.js';
export const isStrokeSymbol = (char) => ['=', '+', '−', '×'].includes(char);
export function strokeParts(char, length, size) {
  const cx = length / 2,
    cy = -size * 0.34,
    gap = size * 0.12,
    thickness = size * 0.065;
  if (char === '=')
    return [
      { cx, cy: cy - gap, length, thickness, angle: 0 },
      { cx, cy: cy + gap, length, thickness, angle: 0 },
    ];
  if (char === '×')
    return [
      { cx, cy, length, thickness, angle: Math.PI / 4 },
      { cx, cy, length, thickness, angle: (Math.PI * 3) / 4 },
    ];
  return [
    { cx, cy, length, thickness, angle: 0 },
    { cx, cy, length, thickness: char === '−' ? 0 : thickness, angle: Math.PI / 2 },
  ];
}
export function blendParts(from, to, k) {
  return from.map((p, i) => {
    const q = to[i],
      angle = p.angle + Math.atan2(Math.sin(q.angle - p.angle), Math.cos(q.angle - p.angle)) * k;
    return {
      ...Object.fromEntries(['cx', 'cy', 'length', 'thickness'].map((key) => [key, p[key] + (q[key] - p[key]) * k])),
      angle,
    };
  });
}
export function barCommands(p) {
  const c = Math.cos(p.angle),
    s = Math.sin(p.angle);
  return pathCommands(
    [
      [-p.length / 2, -p.thickness / 2],
      [p.length / 2, -p.thickness / 2],
      [p.length / 2, p.thickness / 2],
      [-p.length / 2, p.thickness / 2],
    ]
      .map(([x, y], i) => [i ? 'L' : 'M', p.cx + c * x - s * y, p.cy + s * x + c * y])
      .concat([['Z']]),
  );
}
export const partsCommands = (parts) => pathCommands(parts.flatMap(barCommands));
export function barParameters(commands) {
  assert(
    Array.isArray(commands) &&
      commands.length === 5 &&
      commands[0][0] === 'M' &&
      commands.slice(1, 4).every((c) => c[0] === 'L' && c.length === 3) &&
      commands[4][0] === 'Z',
    'GLYPH_PARTS_UNSUPPORTED',
    'Reattach an undeformed four-corner stroke bar.',
  );
  const p = commands.slice(0, 4).map((c) => ({ x: c[1], y: c[2] }));
  return {
    cx: p.reduce((n, q) => n + q.x, 0) / 4,
    cy: p.reduce((n, q) => n + q.y, 0) / 4,
    length: Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y),
    thickness: Math.hypot(p[2].x - p[1].x, p[2].y - p[1].y),
    angle: Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x),
  };
}
