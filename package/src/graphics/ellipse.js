import { assert, number, options } from '../core/validate.js';
/** Cubic ellipse/arc convenience. Error convention: at most .01 local units; no SVG A grammar added. */
export function ellipsePathProps(input = {}) {
  options(input, Object.keys(input), 'ellipse');
  assert(input.commands === undefined, 'INVALID_ELLIPSE', 'Ellipse derives commands from its radii and angles.');
  const { rx = 10, ry = rx, startAngle = 0, endAngle = Math.PI * 2, closed, ...props } = input;
  number(rx, 'ellipse rx', 0, 1e5);
  number(ry, 'ellipse ry', 0, 1e5);
  number(startAngle, 'ellipse start angle');
  number(endAngle, 'ellipse end angle');
  assert(closed === undefined || typeof closed === 'boolean', 'INVALID_ELLIPSE', 'closed must be boolean.');
  const span = endAngle - startAngle;
  assert(Math.abs(span) <= Math.PI * 2 + 1e-12, 'INVALID_ELLIPSE', 'Ellipse arcs span at most one turn.');
  let n = Math.max(1, Math.ceil(Math.abs(span) / (Math.PI / 4)));
  while ((Math.max(rx, ry) * (Math.abs(span) / n) ** 6) / 1000 > 0.01) n *= 2;
  const step = span / n,
    k = (4 / 3) * Math.tan(step / 4),
    commands = [['M', rx * Math.cos(startAngle), ry * Math.sin(startAngle)]];
  for (let i = 0; i < n; i++) {
    const a = startAngle + i * step,
      b = a + step;
    commands.push([
      'C',
      rx * (Math.cos(a) - k * Math.sin(a)),
      ry * (Math.sin(a) + k * Math.cos(a)),
      rx * (Math.cos(b) + k * Math.sin(b)),
      ry * (Math.sin(b) - k * Math.cos(b)),
      rx * Math.cos(b),
      ry * Math.sin(b),
    ]);
  }
  if (closed ?? Math.abs(Math.abs(span) - Math.PI * 2) < 1e-10) commands.push(['Z']);
  return { ...props, commands };
}
