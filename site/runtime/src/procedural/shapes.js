import { assert, number, options, KitError } from '../core/validate.js';
import { pathCommands } from '../graphics/index.js';
const TAU = Math.PI * 2;
function polygon(points) {
  return [...points.map(([x, y], i) => [i ? 'L' : 'M', x, y]), ['Z']];
}
function circle(radius, reverse = false) {
  return polygon(
    Array.from({ length: 24 }, (_, i) => {
      const a = ((reverse ? -1 : 1) * i * TAU) / 24;
      return [Math.cos(a) * radius, Math.sin(a) * radius];
    }),
  );
}
export function shape(input, point, time) {
  let raw;
  try {
    raw = typeof input === 'function' ? input(point, time) : input;
  } catch (cause) {
    const error = new KitError('PROCEDURAL_CALLBACK', `Instance callback failed at point ${point.i}.`);
    error.cause = cause;
    throw error;
  }
  if (Array.isArray(raw)) raw = { type: 'path', commands: raw };
  options(
    raw,
    ['type', 'r', 'size', 'width', 'height', 'wobble', 'fill', 'alpha', 'rotation', 'thickness', 'commands'],
    'procedural instance shape',
  );
  const type = raw.type ?? 'dot';
  assert(
    ['dot', 'square', 'glow', 'sparkle', 'ring', 'tongue', 'blade', 'path'].includes(type),
    'PROCEDURAL_SHAPE',
    'Use dot, square, glow, sparkle, ring, tongue, blade or path.',
  );
  const radius = number(raw.r ?? raw.size ?? point.size ?? 1, 'instance radius/half-size', 0, 1e4);
  const alpha = number(raw.alpha ?? point.alpha ?? 1, 'instance alpha', 0, 1);
  const rotation = number(raw.rotation ?? point.rotation ?? 0, 'instance rotation');
  return { raw, type, radius, alpha, rotation };
}
export function commandsFor(prepared) {
  const { raw, type, radius: r } = prepared;
  if (type === 'path') return pathCommands(raw.commands);
  if (type === 'dot' || type === 'glow') return circle(r);
  if (type === 'square')
    return polygon([
      [-r, -r],
      [r, -r],
      [r, r],
      [-r, r],
    ]);
  if (type === 'sparkle')
    return polygon(
      Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4,
          radius = i % 2 ? r * 0.22 : r;
        return [Math.cos(a) * radius, Math.sin(a) * radius];
      }),
    );
  if (type === 'ring') {
    const thickness = number(raw.thickness ?? r * 0.2, 'ring thickness', 0, r);
    return [...circle(r), ...circle(r - thickness, true)];
  }
  const height = number(raw.height ?? r * 4, 'flame tongue height', 0, 1e4),
    width = number(raw.width ?? r * 2, 'flame tongue width', 0, 1e4);
  const wobble = number(raw.wobble ?? 0, 'flame tongue wobble', -1, 1),
    tip = wobble * width * 0.6;
  if (type === 'blade')
    return [
      ['M', -width / 2, 0],
      ['Q', tip - width * 0.2, -height * 0.55, tip, -height],
      ['Q', tip + width * 0.2, -height * 0.45, width / 2, 0],
      ['Z'],
    ];
  return [
    ['M', -width / 2, 0],
    ['C', -width / 2, -height * 0.45, tip - width * 0.2, -height * 0.6, tip, -height],
    ['C', tip + width * 0.2, -height * 0.55, width / 2, -height * 0.4, width / 2, 0],
    ['Q', 0, width * 0.2, -width / 2, 0],
    ['Z'],
  ];
}
