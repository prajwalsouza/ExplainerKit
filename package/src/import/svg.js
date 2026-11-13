import { assert, options, text } from '../core/validate.js';
import { properties } from '../core/geometry.js';
import { color } from '../graphics/index.js';
import { colorInterpolator } from '../color/interpolate.js';
import { parseInertSVG } from './xml.js';

const SVG_NS = 'http://www.w3.org/2000/svg',
  XMLNS_NS = 'http://www.w3.org/2000/xmlns/';
const NUM = /^[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][+-]?\d+)?/;
const IDENTITY = Object.freeze([1, 0, 0, 1, 0, 0]),
  MAX_SOURCE = 4_000_000;
const fail = (condition, message, code = 'SVG_INVALID') => assert(condition, code, message);
function numeric(v, label, min = -1e7, max = 1e7) {
  fail(
    typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max,
    `${label} must be finite in [${min}, ${max}].`,
  );
  return v;
}
function cap(v, label, max) {
  numeric(v, label, 1, max);
  fail(Number.isInteger(v), `${label} must be an integer.`);
  return v;
}
function freeze(commands) {
  return Object.freeze(commands.map((c) => Object.freeze(c)));
}
function inputText(value, label = 'SVG source') {
  text(value, label, MAX_SOURCE);
  fail(
    new TextEncoder().encode(value).length <= MAX_SOURCE,
    `${label} exceeds the source byte limit.`,
    'RESOURCE_LIMIT',
  );
  return value;
}
class Numbers {
  constructor(value) {
    this.value = value;
    this.index = 0;
  }
  whitespace() {
    while (/\s/.test(this.value[this.index] ?? '') && this.index < this.value.length) this.index++;
  }
  read(first = false, flag = false) {
    this.whitespace();
    if (this.value[this.index] === ',') {
      fail(!first, 'A numeric list cannot start with a comma.');
      this.index++;
      this.whitespace();
    }
    if (flag) {
      const c = this.value[this.index++];
      fail(c === '0' || c === '1', 'Arc flags must be single 0 or 1 digits.');
      return Number(c);
    }
    const match = this.value.slice(this.index).match(NUM);
    fail(match, 'Expected an SVG number.');
    this.index += match[0].length;
    return numeric(Number(match[0]), 'SVG number');
  }
}
function numbers(value, maximum = 100000) {
  const reader = new Numbers(value),
    result = [];
  reader.whitespace();
  while (reader.index < value.length) {
    fail(result.length < maximum, 'Numeric list exceeds its value budget.', 'RESOURCE_LIMIT');
    result.push(reader.read(result.length === 0));
    reader.whitespace();
  }
  return result;
}
function multiply(a, b) {
  const result = [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
  result.forEach((v) => numeric(v, 'Composed SVG transform'));
  return result;
}
function rotation(angle) {
  const a = (angle * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a);
  return [c, s, -s, c, 0, 0];
}

/** SVG transform-list semantics: matrices compose left to right, rightmost acts first. */
export function parseSVGTransform(source = '') {
  inputText(source, 'SVG transform');
  let rest = source.trim(),
    result = [...IDENTITY],
    count = 0;
  while (rest) {
    fail(++count <= 64, 'An SVG transform list accepts at most 64 operations.', 'RESOURCE_LIMIT');
    const match = rest.match(/^([A-Za-z]+)\s*\(([^()]*)\)/);
    fail(match, 'Malformed SVG transform list.');
    const values = numbers(match[2], 6),
      name = match[1];
    let next;
    if (name === 'matrix') {
      fail(values.length === 6, 'matrix() requires six values.');
      next = values;
    } else if (name === 'translate') {
      fail(values.length === 1 || values.length === 2, 'translate() requires one or two values.');
      next = [1, 0, 0, 1, values[0], values[1] ?? 0];
    } else if (name === 'scale') {
      fail(values.length === 1 || values.length === 2, 'scale() requires one or two values.');
      next = [values[0], 0, 0, values[1] ?? values[0], 0, 0];
    } else if (name === 'rotate') {
      fail(values.length === 1 || values.length === 3, 'rotate() requires an angle, optionally a center.');
      next = rotation(values[0]);
      if (values.length === 3)
        next = multiply(multiply([1, 0, 0, 1, values[1], values[2]], next), [1, 0, 0, 1, -values[1], -values[2]]);
    } else if (name === 'skewX' || name === 'skewY') {
      fail(values.length === 1, 'A skew transform requires one angle.');
      const tangent = Math.tan((values[0] * Math.PI) / 180);
      numeric(tangent, 'Skew tangent');
      next = name === 'skewX' ? [1, 0, tangent, 1, 0, 0] : [1, tangent, 0, 1, 0, 0];
    } else fail(false, `Unsupported SVG transform ${name}.`, 'SVG_UNSUPPORTED');
    result = multiply(result, next);
    rest = rest.slice(match[0].length).trimStart();
    if (rest.startsWith(',')) {
      rest = rest.slice(1).trimStart();
      fail(rest.length > 0, 'Transform list cannot end with a comma.');
    }
  }
  return Object.freeze(result);
}

function arc(x0, y0, rx, ry, degrees, large, sweep, x, y, emit, maxAngle = Math.PI / 2) {
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  if (x === x0 && y === y0) return;
  if (rx === 0 || ry === 0) {
    emit(['L', x, y]);
    return;
  }
  const phi = ((degrees % 360) * Math.PI) / 180,
    c = Math.cos(phi),
    s = Math.sin(phi),
    dx = (x0 - x) / 2,
    dy = (y0 - y) / 2,
    u = c * dx + s * dy,
    v = -s * dx + c * dy;
  const lambda = (u / rx) ** 2 + (v / ry) ** 2;
  if (lambda > 1) {
    const correction = Math.sqrt(lambda);
    rx *= correction;
    ry *= correction;
  }
  const denominator = rx * rx * v * v + ry * ry * u * u;
  const factor = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, (rx * rx * ry * ry - denominator) / denominator));
  const cu = (factor * rx * v) / ry,
    cv = (-factor * ry * u) / rx,
    cx = c * cu - s * cv + (x0 + x) / 2,
    cy = s * cu + c * cv + (y0 + y) / 2;
  const ax = (u - cu) / rx,
    ay = (v - cv) / ry,
    bx = (-u - cu) / rx,
    by = (-v - cv) / ry;
  const start = Math.atan2(ay, ax);
  let delta = Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
  if (!sweep && delta > 0) delta -= Math.PI * 2;
  if (sweep && delta < 0) delta += Math.PI * 2;
  const steps = Math.max(1, Math.ceil(Math.abs(delta) / maxAngle)),
    step = delta / steps;
  const position = (t) => [
    cx + c * rx * Math.cos(t) - s * ry * Math.sin(t),
    cy + s * rx * Math.cos(t) + c * ry * Math.sin(t),
  ];
  const tangent = (t) => [-c * rx * Math.sin(t) - s * ry * Math.cos(t), -s * rx * Math.sin(t) + c * ry * Math.cos(t)];
  for (let i = 0; i < steps; i++) {
    const a = start + i * step,
      b = a + step,
      k = (4 / 3) * Math.tan(step / 4),
      p = position(a),
      q = position(b),
      localU1 = tangent(a),
      localV2 = tangent(b);
    emit([
      'C',
      p[0] + k * localU1[0],
      p[1] + k * localU1[1],
      q[0] - k * localV2[0],
      q[1] - k * localV2[1],
      i === steps - 1 ? x : q[0],
      i === steps - 1 ? y : q[1],
    ]);
  }
}

/** Normalize SVG M/L/H/V/C/S/Q/T/A/Z (relative or absolute) into core M/L/C/Q/Z. */
export function parseSVGPath(source, spec = {}) {
  options(spec, ['maxCommands'], 'SVG path');
  inputText(source, 'SVG path data');
  const max = cap(spec.maxCommands ?? 10000, 'Path command budget', 10000),
    reader = new Numbers(source),
    output = [];
  let x = 0,
    y = 0,
    sx = 0,
    sy = 0,
    command = null,
    previous = null,
    cubic = null,
    quadratic = null,
    groups = 0;
  const emit = (c) => {
    fail(output.length < max, 'SVG path exceeds its normalized command budget.', 'RESOURCE_LIMIT');
    for (const v of c.slice(1)) numeric(v, 'Normalized path coordinate');
    output.push(c);
  };
  reader.whitespace();
  while (reader.index < source.length) {
    const ch = source[reader.index],
      explicit = /[A-Za-z]/.test(ch);
    if (explicit) {
      command = ch;
      reader.index++;
      fail(/[MmLlHhVvCcSsQqTtAaZz]/.test(command), 'Unknown SVG path command.');
    } else fail(command && command.toUpperCase() !== 'Z', 'Path data requires a drawing command.');
    const op = command.toUpperCase(),
      relative = command !== op;
    fail(output.length > 0 || op === 'M', 'An SVG path must begin with moveto.');
    if (op === 'Z') {
      emit(['Z']);
      x = sx;
      y = sy;
      previous = 'Z';
      cubic = quadratic = null;
      command = null;
      reader.whitespace();
      continue;
    }
    fail(++groups <= 50000, 'SVG path numeric work budget exceeded.', 'RESOURCE_LIMIT');
    let first = explicit;
    const read = (flag = false) => {
      const v = reader.read(first, flag);
      first = false;
      return v;
    };
    const point = () => {
      const a = read(),
        b = read();
      return [a + (relative ? x : 0), b + (relative ? y : 0)];
    };
    let nextCubic = null,
      nextQuadratic = null;
    if (op === 'M' || op === 'L') {
      const p = point();
      emit([op, ...p]);
      [x, y] = p;
      if (op === 'M') {
        sx = x;
        sy = y;
        command = relative ? 'l' : 'L';
      }
    } else if (op === 'H') {
      x = read() + (relative ? x : 0);
      emit(['L', x, y]);
    } else if (op === 'V') {
      y = read() + (relative ? y : 0);
      emit(['L', x, y]);
    } else if (op === 'C') {
      const a = point(),
        b = point(),
        p = point();
      emit(['C', ...a, ...b, ...p]);
      [x, y] = p;
      nextCubic = b;
    } else if (op === 'S') {
      const a = previous === 'C' || previous === 'S' ? [2 * x - cubic[0], 2 * y - cubic[1]] : [x, y],
        b = point(),
        p = point();
      emit(['C', ...a, ...b, ...p]);
      [x, y] = p;
      nextCubic = b;
    } else if (op === 'Q') {
      const a = point(),
        p = point();
      emit(['Q', ...a, ...p]);
      [x, y] = p;
      nextQuadratic = a;
    } else if (op === 'T') {
      const a = previous === 'Q' || previous === 'T' ? [2 * x - quadratic[0], 2 * y - quadratic[1]] : [x, y],
        p = point();
      emit(['Q', ...a, ...p]);
      [x, y] = p;
      nextQuadratic = a;
    } else {
      const rx = read(),
        ry = read(),
        angle = read(),
        large = read(true),
        sweep = read(true),
        p = point();
      arc(x, y, rx, ry, angle, large, sweep, p[0], p[1], emit);
      [x, y] = p;
    }
    cubic = nextCubic;
    quadratic = nextQuadratic;
    previous = op;
    reader.whitespace();
  }
  return freeze(output);
}

function affine(node, matrix) {
  const [a, b, c, d, x, y] = matrix,
    dot = a * c + b * d,
    sx = Math.hypot(a, b),
    sy = Math.hypot(c, d);
  let outer,
    inner = 0;
  if (Math.abs(dot) <= 1e-12 * Math.max(1, sx, sy)) {
    if (sx > 0) outer = { x, y, rotation: Math.atan2(b, a), scaleX: sx, scaleY: (a * d - b * c) / sx };
    else outer = { x, y, rotation: sy > 0 ? Math.atan2(-c, d) : 0, scaleX: 0, scaleY: sy };
  } else {
    const theta = 0.5 * Math.atan2(2 * dot, a * a + b * b - c * c - d * d),
      ct = Math.cos(theta),
      st = Math.sin(theta),
      ux = a * ct + c * st,
      uy = b * ct + d * st,
      localLength3 = Math.hypot(ux, uy);
    outer = { x, y, rotation: Math.atan2(uy, ux), scaleX: localLength3, scaleY: (a * d - b * c) / localLength3 };
    inner = -theta;
  }
  for (const [k, v] of Object.entries(outer)) numeric(v, `Imported transform ${k}`);
  if (inner === 0) return { blueprint: { ...node, props: { ...node.props, ...outer } }, prefix: [] };
  return {
    blueprint: {
      type: 'group',
      props: outer,
      children: { basis: { type: 'group', props: { rotation: inner }, children: { artwork: node } } },
    },
    prefix: ['basis', 'artwork'],
  };
}
function length(value, label, fallback = 0) {
  if (value === undefined) return fallback;
  fail(value.length <= 128, 'SVG length exceeds the numeric token budget.', 'RESOURCE_LIMIT');
  const match = value.trim().match(/^([+-]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][+-]?\d+)?)\s*(px|in|cm|mm|q|pt|pc)?$/i);
  fail(
    match,
    `${label} needs an absolute SVG length; percentages and context-relative units are unsupported.`,
    'SVG_UNSUPPORTED',
  );
  const factors = { px: 1, in: 96, cm: 96 / 2.54, mm: 96 / 25.4, q: 96 / 101.6, pt: 96 / 72, pc: 16 };
  return numeric(Number(match[1]) * (factors[match[2]?.toLowerCase()] ?? 1), label);
}
function opacity(value, label) {
  if (value === undefined) return 1;
  const s = value.trim(),
    v = s.endsWith('%') ? Number(s.slice(0, -1)) / 100 : Number(s);
  return numeric(v, label, 0, 1);
}
const INHERITED = [
  'fill',
  'stroke',
  'fill-rule',
  'fill-opacity',
  'stroke-opacity',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'visibility',
  'color',
  'clip-rule',
  'color-interpolation',
  'color-interpolation-filters',
];
const STYLE_KEYS = [
  ...INHERITED,
  'opacity',
  'display',
  'mix-blend-mode',
  'clip-path',
  'mask',
  'mask-type',
  'filter',
  'flood-color',
  'flood-opacity',
  'stop-color',
  'stop-opacity',
];
const SAFE_COMMON = ['id', 'class', 'transform', 'style', 'role', 'version', 'tabindex'];
const SHAPE_ATTRS = {
  svg: ['width', 'height', 'viewBox', 'preserveAspectRatio', 'x', 'y'],
  g: [],
  path: ['d'],
  rect: ['x', 'y', 'width', 'height', 'rx', 'ry'],
  circle: ['cx', 'cy', 'r'],
  ellipse: ['cx', 'cy', 'rx', 'ry'],
  line: ['x1', 'y1', 'x2', 'y2'],
  polyline: ['points'],
  polygon: ['points'],
  title: [],
  desc: [],
  metadata: [],
  defs: [],
  linearGradient: ['x1', 'y1', 'x2', 'y2', 'gradientTransform', 'gradientUnits', 'spreadMethod', 'href'],
  radialGradient: ['cx', 'cy', 'r', 'fx', 'fy', 'fr', 'gradientTransform', 'gradientUnits', 'spreadMethod', 'href'],
  stop: ['offset'],
  clipPath: ['clipPathUnits'],
  mask: ['x', 'y', 'width', 'height', 'maskUnits', 'maskContentUnits'],
  filter: ['x', 'y', 'width', 'height', 'filterUnits', 'primitiveUnits'],
  feGaussianBlur: ['stdDeviation', 'in', 'edgeMode', 'result'],
  feDropShadow: ['dx', 'dy', 'stdDeviation', 'in', 'result'],
};
const RESOURCE_TAGS = new Set([
  'defs',
  'linearGradient',
  'radialGradient',
  'stop',
  'clipPath',
  'mask',
  'filter',
  'feGaussianBlur',
  'feDropShadow',
]);
const DEFAULT_STYLE = Object.freeze({
  fill: 'black',
  stroke: 'none',
  'fill-rule': 'nonzero',
  'fill-opacity': '1',
  'stroke-opacity': '1',
  'stroke-width': '1',
  'stroke-linecap': 'butt',
  'stroke-linejoin': 'miter',
  'stroke-miterlimit': '4',
  color: 'black',
  visibility: 'visible',
  'clip-rule': 'nonzero',
  'stop-color': 'black',
  'stop-opacity': '1',
  'color-interpolation': 'sRGB',
  'color-interpolation-filters': 'linearRGB',
});
function styleFor(attrs, inherited) {
  const style = { ...inherited },
    own = {};
  for (const k of STYLE_KEYS) if (attrs[k] !== undefined) own[k] = attrs[k];
  if (attrs.style !== undefined)
    for (const declaration of attrs.style.split(';')) {
      if (!declaration.trim()) continue;
      const colon = declaration.indexOf(':');
      fail(colon > 0, 'Malformed inline SVG style.');
      const key = declaration.slice(0, colon).trim().toLowerCase(),
        value = declaration.slice(colon + 1).trim();
      fail(STYLE_KEYS.includes(key) && !/[!{}]/.test(value), `Unsupported SVG style ${key}.`, 'SVG_UNSUPPORTED');
      own[key] = value;
    }
  for (const [key, value] of Object.entries(own))
    if (INHERITED.includes(key) && value !== 'inherit') style[key] = value;
  fail(
    own.display === undefined || own.display === 'none' || own.display === 'inline',
    'Only inline/none SVG display is supported.',
    'SVG_UNSUPPORTED',
  );
  fail(['visible', 'hidden', 'collapse'].includes(style.visibility), 'Unsupported SVG visibility.', 'SVG_UNSUPPORTED');
  fail(
    !Object.entries(own).some(([k, v]) => v === 'inherit' && !INHERITED.includes(k)),
    'Explicit inheritance of compositing properties is unsupported.',
    'SVG_UNSUPPORTED',
  );
  return { style, own };
}
function localReference(value) {
  const match = value.trim().match(/^url\(\s*(['"]?)#([^\s'"()]+)\1\s*\)$/);
  fail(match, 'Only a single local fragment resource reference is supported.', 'SVG_UNSAFE');
  return match[2];
}
function transformCommands(commands, m) {
  return commands.map((c) =>
    c.length === 1
      ? [...c]
      : [
          c[0],
          ...c
            .slice(1)
            .map((v, i, a) => (i % 2 === 0 ? m[0] * v + m[2] * a[i + 1] + m[4] : m[1] * a[i - 1] + m[3] * v + m[5])),
        ],
  );
}
function boundsOf(commands) {
  let x = 0,
    y = 0,
    sx = 0,
    sy = 0,
    xmin = Infinity,
    ymin = Infinity,
    xmax = -Infinity,
    ymax = -Infinity;
  const add = (a, b) => {
    xmin = Math.min(xmin, a);
    ymin = Math.min(ymin, b);
    xmax = Math.max(xmax, a);
    ymax = Math.max(ymax, b);
  };
  for (const c of commands) {
    const op = c[0];
    if (op === 'M') {
      x = sx = c[1];
      y = sy = c[2];
      add(x, y);
      continue;
    }
    if (op === 'Z') {
      x = sx;
      y = sy;
      continue;
    }
    const xs = [x],
      ys = [y];
    for (let i = 1; i < c.length; i += 2) {
      xs.push(c[i]);
      ys.push(c[i + 1]);
    }
    const n = xs.length - 1,
      at = (p, t) =>
        n === 1
          ? p[0] * (1 - t) + p[1] * t
          : n === 2
            ? p[0] * (1 - t) ** 2 + 2 * p[1] * t * (1 - t) + p[2] * t * t
            : p[0] * (1 - t) ** 3 + 3 * p[1] * t * (1 - t) ** 2 + 3 * p[2] * t * t * (1 - t) + p[3] * t ** 3;
    const roots = (p) => {
      if (n === 1) return [];
      if (n === 2) {
        const d = p[0] - 2 * p[1] + p[2];
        return d ? [(p[0] - p[1]) / d] : [];
      }
      const a = -p[0] + 3 * p[1] - 3 * p[2] + p[3],
        b = 2 * (p[0] - 2 * p[1] + p[2]),
        d = p[1] - p[0];
      if (Math.abs(a) < 1e-14) return b ? [-d / b] : [];
      const q = b * b - 4 * a * d;
      return q < 0 ? [] : [(-b + Math.sqrt(q)) / (2 * a), (-b - Math.sqrt(q)) / (2 * a)];
    };
    for (const t of [0, 1, ...roots(xs), ...roots(ys)]) if (t >= 0 && t <= 1) add(at(xs, t), at(ys, t));
    x = xs.at(-1);
    y = ys.at(-1);
  }
  return xmin === Infinity
    ? { x: 0, y: 0, width: 0, height: 0 }
    : { x: xmin, y: ymin, width: xmax - xmin, height: ymax - ymin };
}
function boxMatrix(bounds) {
  fail(
    bounds.width > 0 && bounds.height > 0,
    'Object-bounding-box resources require nondegenerate artwork bounds.',
    'SVG_UNSUPPORTED',
  );
  return [bounds.width, 0, 0, bounds.height, bounds.x, bounds.y];
}
function unitValue(value, fallback, axis, units, viewport) {
  if (value === undefined) value = fallback;
  if (value.trim().endsWith('%')) {
    const amount = Number(value.trim().slice(0, -1)) / 100;
    return numeric(
      amount *
        (units === 'objectBoundingBox'
          ? 1
          : axis === 'x'
            ? viewport.width
            : axis === 'y'
              ? viewport.height
              : Math.hypot(viewport.width, viewport.height) / Math.SQRT2),
      'SVG resource coordinate',
    );
  }
  if (units === 'objectBoundingBox') return numeric(Number(value), 'Bounding-box coordinate');
  return length(value, 'SVG resource coordinate');
}
function alphaColor(value, amount) {
  return value === 'none' || amount === 1 ? value : colorInterpolator(value, 'transparent')(1 - amount);
}
function layerNames(attrs) {
  const decoded = attrs.id?.replace(/_x([0-9a-fA-F]{2,6})_/g, (_, hex) => {
    const n = parseInt(hex, 16);
    fail(n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff), 'Invalid escaped layer name.');
    return String.fromCodePoint(n);
  });
  const names = [attrs.id, attrs['data-name'], decoded].filter(Boolean);
  for (const name of names) fail(name.length <= 200, 'Layer names must not exceed 200 characters.', 'RESOURCE_LIMIT');
  return [...new Set(names)];
}
function shape(tag, attrs, budget) {
  const get = (key, fallback = 0) => length(attrs[key], `${tag} ${key}`, fallback);
  let commands = [];
  if (tag === 'path')
    commands = parseSVGPath(attrs.d ?? '', { maxCommands: Math.min(10000, budget.maxCommands - budget.commands || 1) });
  else if (tag === 'line')
    commands = [
      ['M', get('x1'), get('y1')],
      ['L', get('x2'), get('y2')],
    ];
  else if (tag === 'polyline' || tag === 'polygon') {
    const p = numbers(attrs.points ?? '', 20000);
    fail(p.length % 2 === 0, 'SVG points need coordinate pairs.');
    for (let i = 0; i < p.length; i += 2) commands.push([i ? 'L' : 'M', p[i], p[i + 1]]);
    if (tag === 'polygon' && p.length) commands.push(['Z']);
  } else if (tag === 'circle' || tag === 'ellipse') {
    const x = get('cx'),
      y = get('cy'),
      rx = get(tag === 'circle' ? 'r' : 'rx'),
      ry = tag === 'circle' ? rx : get('ry');
    numeric(rx, 'SVG radius', 0, 1e5);
    numeric(ry, 'SVG radius', 0, 1e5);
    if (rx > 0 && ry > 0) {
      commands = [['M', x + rx, y]];
      // Native circles/ellipses get eight cubics: quarter-circle cubics visibly
      // deviate at ordinary import sizes. General path arcs retain their contract.
      arc(x + rx, y, rx, ry, 0, 0, 1, x - rx, y, (c) => commands.push(c), Math.PI / 4);
      arc(x - rx, y, rx, ry, 0, 0, 1, x + rx, y, (c) => commands.push(c), Math.PI / 4);
      commands.push(['Z']);
    }
  } else if (tag === 'rect') {
    const x = get('x'),
      y = get('y'),
      w = get('width'),
      h = get('height');
    numeric(w, 'SVG width', 0, 1e5);
    numeric(h, 'SVG height', 0, 1e5);
    const rx = Math.min(get('rx', get('ry')), w / 2),
      ry = Math.min(get('ry', get('rx')), h / 2);
    numeric(rx, 'SVG corner radius', 0, 1e5);
    numeric(ry, 'SVG corner radius', 0, 1e5);
    if (w && h) {
      if (!rx || !ry) commands = [['M', x, y], ['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h], ['Z']];
      else {
        commands = [
          ['M', x + rx, y],
          ['L', x + w - rx, y],
        ];
        arc(x + w - rx, y, rx, ry, 0, 0, 1, x + w, y + ry, (c) => commands.push(c));
        commands.push(['L', x + w, y + h - ry]);
        arc(x + w, y + h - ry, rx, ry, 0, 0, 1, x + w - rx, y + h, (c) => commands.push(c));
        commands.push(['L', x + rx, y + h]);
        arc(x + rx, y + h, rx, ry, 0, 0, 1, x, y + h - ry, (c) => commands.push(c));
        commands.push(['L', x, y + ry]);
        arc(x, y + ry, rx, ry, 0, 0, 1, x + rx, y, (c) => commands.push(c));
        commands.push(['Z']);
      }
    }
  }
  budget.commands += commands.length;
  fail(budget.commands <= budget.maxCommands, 'SVG exceeds its normalized command budget.', 'RESOURCE_LIMIT');
  return commands;
}
function immutableBlueprint(node, depth, budget) {
  fail(depth <= budget.maxDepth, 'Imported component exceeds the supported hierarchy depth.', 'RESOURCE_LIMIT');
  fail(++budget.outputNodes <= budget.maxNodes, 'Imported component exceeds its node budget.', 'RESOURCE_LIMIT');
  const props = Object.freeze(properties(node.type, node.props)),
    children = Object.create(null);
  for (const [name, child] of Object.entries(node.children ?? {}))
    children[name] = immutableBlueprint(child, depth + 1, budget);
  return Object.freeze({ type: node.type, props, children: Object.freeze(children) });
}

/** Parse into inert data only. Never adopts source nodes, fetches assets or injects markup. */
export function importSVG(source, spec = {}) {
  options(spec, ['DOMParser', 'maxBytes', 'maxNodes', 'maxCommands', 'maxDepth', 'width', 'height'], 'SVG import');
  inputText(source);
  const maxBytes = cap(spec.maxBytes ?? 1_000_000, 'SVG byte budget', MAX_SOURCE);
  fail(new TextEncoder().encode(source).length <= maxBytes, 'SVG exceeds its byte budget.', 'RESOURCE_LIMIT');
  fail(
    !/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(source) && !/<\?(?!xml\s)/i.test(source),
    'DTD, entities and processing instructions are forbidden.',
    'SVG_UNSAFE',
  );
  const Parser = spec.DOMParser ?? globalThis.DOMParser;
  fail(
    Parser === undefined || typeof Parser === 'function',
    'DOMParser must be a trusted constructor.',
    'SVG_ENVIRONMENT',
  );
  const document = Parser === undefined ? parseInertSVG(source) : new Parser().parseFromString(source, 'image/svg+xml'),
    root = document.documentElement;
  fail(
    root && root.localName === 'svg' && root.namespaceURI === SVG_NS && !document.querySelector('parsererror'),
    'Malformed SVG document.',
  );
  const budget = {
    maxNodes: cap(spec.maxNodes ?? 2048, 'SVG node budget', 10000),
    maxCommands: cap(spec.maxCommands ?? 100000, 'SVG command budget', 100000),
    maxDepth: cap(spec.maxDepth ?? 24, 'SVG hierarchy budget', 24),
    sourceNodes: 0,
    outputNodes: 0,
    commands: 0,
    parts: 0,
    arcs: 0,
  };
  const ids = new Map();
  let rootAttrs;
  function scan(element, inherited, depth = 0) {
    fail(
      depth <= 24 && ++budget.sourceNodes <= budget.maxNodes,
      'SVG source exceeds its node or hierarchy budget.',
      'RESOURCE_LIMIT',
    );
    fail(element.namespaceURI === SVG_NS, 'Foreign namespaces cannot supply SVG artwork.', 'SVG_UNSAFE');
    const tag = element.localName;
    fail(Object.hasOwn(SHAPE_ATTRS, tag), `Unsupported SVG element ${tag}.`, 'SVG_UNSUPPORTED');
    fail(depth === 0 || tag !== 'svg', 'Nested SVG viewports are unsupported.', 'SVG_UNSUPPORTED');
    const attrs = Object.create(null);
    for (const attribute of element.attributes) {
      let key = attribute.name;
      const value = attribute.value;
      fail(!/^on/i.test(key) && key !== 'xml:base', 'Event handlers and XML base URLs are forbidden.', 'SVG_UNSAFE');
      if (attribute.namespaceURI === XMLNS_NS) continue;
      if (attribute.namespaceURI === 'http://www.w3.org/1999/xlink' && attribute.localName === 'href') key = 'href';
      else fail(!attribute.namespaceURI, 'Foreign namespaced attributes are unsupported.', 'SVG_UNSAFE');
      fail(
        SAFE_COMMON.includes(key) ||
          STYLE_KEYS.includes(key) ||
          SHAPE_ATTRS[tag].includes(key) ||
          key.startsWith('aria-') ||
          key.startsWith('data-'),
        `Unsupported SVG attribute ${key}.`,
        'SVG_UNSUPPORTED',
      );
      if (key === 'href') {
        fail(
          ['linearGradient', 'radialGradient'].includes(tag) && /^#[^\s#]+$/.test(value),
          'Only internal gradient template references are supported.',
          'SVG_UNSAFE',
        );
        fail(
          attrs.href === undefined || attrs.href === value,
          'Conflicting href and xlink:href references.',
          'SVG_INVALID',
        );
      }
      attrs[key] = value;
    }
    const { style, own } = styleFor(attrs, inherited);
    for (const [key, value] of Object.entries({ ...attrs, ...own }))
      if (/url\s*\(/i.test(value)) {
        fail(
          ['fill', 'stroke', 'clip-path', 'mask', 'filter', 'style'].includes(key),
          'Resource URLs are forbidden here.',
          'SVG_UNSAFE',
        );
        if (key !== 'style') localReference(value);
      }
    fail(
      attrs.transform === undefined ||
        !['linearGradient', 'radialGradient', 'stop', 'filter', 'feGaussianBlur', 'feDropShadow', 'mask'].includes(tag),
      'This resource does not support a transform attribute; use the appropriate resource transform.',
      'SVG_UNSUPPORTED',
    );
    const record = { tag, attrs, style, own, children: [] };
    if (attrs.id !== undefined) {
      fail(
        attrs.id.length > 0 && attrs.id.length <= 200 && !ids.has(attrs.id),
        'SVG IDs must be unique nonempty names.',
        'DUPLICATE_ID',
      );
      ids.set(attrs.id, record);
    }
    const descriptive = ['title', 'desc', 'metadata'].includes(tag);
    for (const child of element.childNodes) {
      if (child.nodeType === 1) {
        fail(!descriptive, 'Descriptive SVG elements cannot contain artwork.', 'SVG_UNSUPPORTED');
        record.children.push(scan(child, style, depth + 1));
      } else if (child.nodeType === 3 || child.nodeType === 4)
        fail(
          descriptive || !child.textContent.trim(),
          'Text needs conversion to outlines before SVG import.',
          'SVG_UNSUPPORTED',
        );
      else fail(child.nodeType === 8, 'Processing instructions are forbidden.', 'SVG_UNSAFE');
    }
    if (depth === 0) rootAttrs = attrs;
    return record;
  }
  const tree = scan(root, DEFAULT_STYLE);
  const sourceViewBox = rootAttrs.viewBox === undefined ? null : numbers(rootAttrs.viewBox, 4);
  fail(
    !sourceViewBox || (sourceViewBox.length === 4 && sourceViewBox[2] > 0 && sourceViewBox[3] > 0),
    'viewBox needs x y positive-width positive-height.',
  );
  const viewportSize = {
    width: sourceViewBox?.[2] ?? spec.width ?? length(rootAttrs.width, 'SVG width', 300),
    height: sourceViewBox?.[3] ?? spec.height ?? length(rootAttrs.height, 'SVG height', 150),
  };
  let referenceWork = 0;
  function resource(id, tags, stack = []) {
    fail(++referenceWork <= 10000, 'SVG resource expansion exceeds its reference budget.', 'RESOURCE_LIMIT');
    fail(stack.length < 24, 'SVG resource reference depth exceeded.', 'RESOURCE_LIMIT');
    fail(!stack.includes(id), 'Cyclic SVG resource reference.', 'SVG_INVALID');
    const item = ids.get(id);
    fail(item && tags.includes(item.tag), `Missing or incompatible SVG resource #${id}.`, 'SVG_UNSUPPORTED');
    return item;
  }
  function gradientTemplate(id, stack = []) {
    const item = resource(id, ['linearGradient', 'radialGradient'], stack),
      next = [...stack, id];
    let inherited = { attrs: {}, stops: [] };
    if (item.attrs.href) inherited = gradientTemplate(item.attrs.href.slice(1), next);
    const children = item.children.filter((c) => !['title', 'desc'].includes(c.tag));
    fail(
      children.every((c) => c.tag === 'stop'),
      'Gradients accept only stops and descriptions.',
      'SVG_UNSUPPORTED',
    );
    const ownStops = children.map((stop) => {
      fail(stop.children.length === 0, 'Gradient stops cannot contain artwork.', 'SVG_UNSUPPORTED');
      const offset = unitValue(stop.attrs.offset ?? '0', '0', 'x', 'objectBoundingBox', viewportSize);
      const stopColor = stop.own['stop-color'] ?? 'black',
        c = stopColor.toLowerCase() === 'currentcolor' ? stop.style.color : stopColor;
      return {
        offset: Math.max(0, Math.min(1, offset)),
        color: alphaColor(color(c, { stop: true }), opacity(stop.own['stop-opacity'], 'Stop opacity')),
      };
    });
    let previous = 0;
    const stops = (ownStops.length ? ownStops : inherited.stops).map((s) => ({
      ...s,
      offset: (previous = Math.max(previous, s.offset)),
    }));
    return { tag: item.tag, attrs: { ...inherited.attrs, ...item.attrs }, stops, style: item.style };
  }
  function paint(value, amount, bounds, style) {
    if (!/url\s*\(/i.test(value))
      return alphaColor(color(value.toLowerCase() === 'currentcolor' ? style.color : value), amount);
    const g = gradientTemplate(localReference(value)),
      a = g.attrs,
      units = a.gradientUnits ?? 'objectBoundingBox';
    fail(['objectBoundingBox', 'userSpaceOnUse'].includes(units), 'Unsupported gradient units.', 'SVG_UNSUPPORTED');
    fail(
      (a.spreadMethod ?? 'pad') === 'pad' && g.style['color-interpolation'] === 'sRGB',
      'Only pad gradients with sRGB interpolation are representable.',
      'SVG_UNSUPPORTED',
    );
    fail(g.stops.length >= 1 && g.stops.length <= 64, 'A gradient needs 1–64 stops.', 'SVG_UNSUPPORTED');
    const stops = g.stops.map((s) => ({ ...s, color: alphaColor(s.color, amount) }));
    if (stops.length === 1) stops.push({ ...stops[0], offset: 1 });
    const m = multiply(
        units === 'objectBoundingBox' ? boxMatrix(bounds) : IDENTITY,
        parseSVGTransform(a.gradientTransform ?? ''),
      ),
      coord = (key, fallback, axis) => unitValue(a[key], fallback, axis, units, viewportSize),
      point = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
    if (g.tag === 'linearGradient') {
      const x1 = coord('x1', '0%', 'x'),
        y1 = coord('y1', '0%', 'y'),
        x2 = coord('x2', '100%', 'x'),
        y2 = coord('y2', '0%', 'y'),
        dx = x2 - x1,
        dy = y2 - y1,
        norm = dx * dx + dy * dy,
        det = m[0] * m[3] - m[1] * m[2];
      fail(
        norm > 0 && Math.abs(det) > 1e-14,
        'Degenerate gradient transforms or endpoints are unsupported.',
        'SVG_UNSUPPORTED',
      );
      // A linear gradient is a scalar field. Its covector follows inverse transpose,
      // not the transformed endpoint vector (which fails under shear/nonuniform scale).
      const gx = (m[3] * dx - m[1] * dy) / (det * norm),
        gy = (-m[2] * dx + m[0] * dy) / (det * norm),
        den = gx * gx + gy * gy,
        [x, y] = point(x1, y1);
      return { type: 'linear', x1: x, y1: y, x2: x + gx / den, y2: y + gy / den, stops };
    }
    const cx = coord('cx', '50%', 'x'),
      cy = coord('cy', '50%', 'y'),
      r = coord('r', '50%', 'r'),
      fx = coord('fx', a.cx ?? '50%', 'x'),
      fy = coord('fy', a.cy ?? '50%', 'y'),
      fr = coord('fr', '0', 'r'),
      sx = Math.hypot(m[0], m[1]),
      sy = Math.hypot(m[2], m[3]);
    fail(
      fx === cx &&
        fy === cy &&
        fr === 0 &&
        r > 0 &&
        sx > 0 &&
        Math.abs(sx - sy) < 1e-9 * Math.max(1, sx, sy) &&
        Math.abs(m[0] * m[2] + m[1] * m[3]) < 1e-9 * Math.max(1, sx * sy),
      'Only concentric circular radial gradients with zero focal radius are representable.',
      'SVG_UNSUPPORTED',
    );
    const [x, y] = point(cx, cy);
    return { type: 'radial', x, y, r: r * sx, stops };
  }
  function clipResource(value, bounds) {
    const item = resource(localReference(value), ['clipPath']),
      units = item.attrs.clipPathUnits ?? 'userSpaceOnUse';
    fail(['userSpaceOnUse', 'objectBoundingBox'].includes(units), 'Unsupported clipping units.', 'SVG_UNSUPPORTED');
    if (units === 'objectBoundingBox') boxMatrix(bounds); // Retain nondegenerate-bounds validation.
    fail(
      Object.keys(item.own).every((k) => INHERITED.includes(k)),
      'Clip-path compositing effects are unsupported.',
      'SVG_UNSUPPORTED',
    );
    const children = item.children.filter((c) => !['title', 'desc'].includes(c.tag));
    fail(
      children.length === 1 && !RESOURCE_TAGS.has(children[0].tag) && !['g', 'svg'].includes(children[0].tag),
      'A clip requires exactly one basic shape or compound path; overlapping child unions are unsupported.',
      'SVG_UNSUPPORTED',
    );
    const c = children[0];
    fail(
      Object.keys(c.own).every((k) =>
        ['clip-rule', 'fill-rule', 'fill', 'stroke', 'color', 'visibility'].includes(k),
      ) && !c.children.length,
      'Unsupported clip shape effects.',
      'SVG_UNSUPPORTED',
    );
    fail(c.style.visibility === 'visible', 'Hidden clip geometry is unsupported.', 'SVG_UNSUPPORTED');
    const m = multiply(parseSVGTransform(item.attrs.transform ?? ''), parseSVGTransform(c.attrs.transform ?? ''));
    return {
      type: 'path',
      commands: transformCommands(shape(c.tag, c.attrs, budget), m),
      fillRule: c.style['clip-rule'],
      ...(units === 'objectBoundingBox' ? { units: 'bounds' } : {}),
    };
  }
  function maskResource(value, bounds) {
    const item = resource(localReference(value), ['mask']),
      a = item.attrs,
      children = item.children.filter((c) => !['title', 'desc'].includes(c.tag));
    fail(
      (item.own['mask-type'] ?? 'luminance') === 'alpha' && children.length === 1 && children[0].tag === 'rect',
      'Only an explicit alpha mask containing one gradient rectangle is representable.',
      'SVG_UNSUPPORTED',
    );
    fail(
      a.transform === undefined && Object.keys(item.own).every((k) => k === 'mask-type'),
      'Mask transforms and compositing styles are unsupported.',
      'SVG_UNSUPPORTED',
    );
    const c = children[0],
      ca = c.attrs;
    fail(
      !ca.transform &&
        !ca.rx &&
        !ca.ry &&
        !c.children.length &&
        Object.keys(c.own).every((k) => ['fill', 'fill-opacity', 'opacity', 'stroke'].includes(k)) &&
        (c.style.stroke === 'none' || opacity(c.style['stroke-opacity'], 'Mask stroke opacity') === 0),
      'Mask rectangle transforms, corners, strokes and effects are unsupported.',
      'SVG_UNSUPPORTED',
    );
    const contentUnits = a.maskContentUnits ?? 'userSpaceOnUse';
    fail(
      ['userSpaceOnUse', 'objectBoundingBox'].includes(contentUnits),
      'Unsupported mask content units.',
      'SVG_UNSUPPORTED',
    );
    fail(
      contentUnits === 'userSpaceOnUse',
      'Object-bounding-box mask content is not yet representable.',
      'SVG_UNSUPPORTED',
    );
    const box = {
      x: length(ca.x, 'Mask rectangle x'),
      y: length(ca.y, 'Mask rectangle y'),
      width: length(ca.width, 'Mask rectangle width'),
      height: length(ca.height, 'Mask rectangle height'),
    };
    fail(box.width > 0 && box.height > 0, 'Mask rectangle must be nonempty.', 'SVG_UNSUPPORTED');
    const units = a.maskUnits ?? 'objectBoundingBox';
    fail(['userSpaceOnUse', 'objectBoundingBox'].includes(units), 'Unsupported mask region units.', 'SVG_UNSUPPORTED');
    const regionCoord = (key, fallback, axis) => unitValue(a[key], fallback, axis, units, viewportSize),
      m = units === 'objectBoundingBox' ? boxMatrix(bounds) : IDENTITY;
    const region = {
      x: m[0] * regionCoord('x', '-10%', 'x') + m[4],
      y: m[3] * regionCoord('y', '-10%', 'y') + m[5],
      width: m[0] * regionCoord('width', '120%', 'x'),
      height: m[3] * regionCoord('height', '120%', 'y'),
    };
    const x = Math.max(box.x, region.x),
      y = Math.max(box.y, region.y),
      right = Math.min(box.x + box.width, region.x + region.width),
      bottom = Math.min(box.y + box.height, region.y + region.height);
    fail(right > x && bottom > y, 'Empty mask intersections are unsupported.', 'SVG_UNSUPPORTED');
    const gradient = paint(
      c.style.fill,
      opacity(c.style['fill-opacity'], 'Mask fill opacity') * opacity(c.own.opacity, 'Mask opacity'),
      box,
      c.style,
    );
    fail(typeof gradient === 'object', 'Alpha masks require a gradient fill.', 'SVG_UNSUPPORTED');
    return { type: 'alpha', gradient, bounds: { x, y, width: right - x, height: bottom - y } };
  }
  function filterResource(value, bounds, world) {
    const item = resource(localReference(value), ['filter']),
      a = item.attrs,
      children = item.children.filter((c) => !['title', 'desc'].includes(c.tag));
    fail(
      children.length === 1 && ['feGaussianBlur', 'feDropShadow'].includes(children[0].tag),
      'Only one Gaussian blur or drop-shadow primitive is representable.',
      'SVG_UNSUPPORTED',
    );
    fail(
      (a.primitiveUnits ?? 'userSpaceOnUse') === 'userSpaceOnUse',
      'Bounding-box filter primitive units are unsupported.',
      'SVG_UNSUPPORTED',
    );
    fail(
      Object.keys(item.own).every((k) => k === 'color-interpolation-filters'),
      'Filter compositing styles are unsupported.',
      'SVG_UNSUPPORTED',
    );
    const c = children[0];
    fail(
      !c.children.length &&
        !c.attrs.transform &&
        (c.attrs.in === undefined || c.attrs.in === 'SourceGraphic') &&
        (c.attrs.edgeMode === undefined || c.attrs.edgeMode === 'none'),
      'Only unmodified SourceGraphic filtering is supported.',
      'SVG_UNSUPPORTED',
    );
    fail(
      c.style['color-interpolation-filters'] === 'sRGB',
      'Filters must explicitly select sRGB interpolation for Canvas parity.',
      'SVG_UNSUPPORTED',
    );
    const deviations = numbers(c.attrs.stdDeviation ?? (c.tag === 'feDropShadow' ? '2' : '0'), 2);
    fail(
      deviations.length === 1 || (deviations.length === 2 && deviations[0] === deviations[1]),
      'Anisotropic SVG blur is unsupported.',
      'SVG_UNSUPPORTED',
    );
    const sigma = numeric(deviations[0], 'SVG blur', 0, 64);
    if (c.tag === 'feGaussianBlur')
      fail(
        Object.keys(c.own).every((k) => k === 'color-interpolation-filters'),
        'Unsupported Gaussian blur style.',
        'SVG_UNSUPPORTED',
      );
    const sx = Math.hypot(world[0], world[1]),
      sy = Math.hypot(world[2], world[3]);
    fail(
      sx > 1e-6 &&
        Math.abs(sx - sy) <= 1e-8 * Math.max(1, sx, sy) &&
        Math.abs(world[0] * world[2] + world[1] * world[3]) <= 1e-8 * Math.max(1, sx * sy) &&
        sigma * sx <= 128,
      'Filter requires uniform nonsingular world scaling within the blur budget.',
      'SVG_UNSUPPORTED',
    );
    // Preserve the finite filter region using an outer clip, rather than silently
    // changing SVG's default -10%/120% clipping to the runtime's padded viewport.
    const units = a.filterUnits ?? 'objectBoundingBox';
    fail(['userSpaceOnUse', 'objectBoundingBox'].includes(units), 'Unsupported filter units.', 'SVG_UNSUPPORTED');
    const coord = (key, fallback, axis) => unitValue(a[key], fallback, axis, units, viewportSize),
      m = units === 'objectBoundingBox' ? boxMatrix(bounds) : IDENTITY;
    const region = {
      type: 'rect',
      x: m[0] * coord('x', '-10%', 'x') + m[4],
      y: m[3] * coord('y', '-10%', 'y') + m[5],
      width: m[0] * coord('width', '120%', 'x'),
      height: m[3] * coord('height', '120%', 'y'),
    };
    fail(region.width > 0 && region.height > 0, 'Empty filter regions are unsupported.', 'SVG_UNSUPPORTED');
    if (c.tag === 'feGaussianBlur') return { props: { blur: sigma }, region };
    fail(
      length(c.attrs.dx, 'Drop shadow dx', 2) === 0 && length(c.attrs.dy, 'Drop shadow dy', 2) === 0,
      'Offset drop shadows cannot be represented by centered glow.',
      'SVG_UNSUPPORTED',
    );
    fail(
      Object.keys(c.own).every((k) => ['flood-color', 'flood-opacity', 'color-interpolation-filters'].includes(k)),
      'Unsupported drop-shadow style.',
      'SVG_UNSUPPORTED',
    );
    return {
      props: {
        glow: {
          blur: sigma,
          color: color(c.own['flood-color'] ?? 'black', { stop: true }),
          opacity: opacity(c.own['flood-opacity'], 'Flood opacity'),
        },
      },
      region,
    };
  }
  function artworkGeometry(record, m = IDENTITY) {
    if (
      record.own.display === 'none' ||
      RESOURCE_TAGS.has(record.tag) ||
      ['title', 'desc', 'metadata'].includes(record.tag)
    )
      return [];
    const t = multiply(m, parseSVGTransform(record.attrs.transform ?? ''));
    if (record.tag === 'g' || record.tag === 'svg') return record.children.flatMap((c) => artworkGeometry(c, t));
    if (!record.commands) record.commands = shape(record.tag, record.attrs, budget);
    return transformCommands(record.commands, t);
  }
  // Resolve every template graph, even unused definitions, to bound and reject cycles.
  for (const [id, item] of ids) if (['linearGradient', 'radialGradient'].includes(item.tag)) gradientTemplate(id);
  function compile(record, isRoot = false, parentWorld = IDENTITY) {
    const { tag, attrs, style, own } = record;
    if (RESOURCE_TAGS.has(tag) || ['title', 'desc', 'metadata'].includes(tag)) return { blueprint: null, parts: [] };
    const local = parseSVGTransform(isRoot ? '' : (attrs.transform ?? '')),
      world = multiply(parentWorld, local),
      children = Object.create(null),
      parts = [];
    const group = tag === 'svg' || tag === 'g';
    fail(
      group || record.children.every((c) => ['title', 'desc', 'metadata'].includes(c.tag)),
      'A basic SVG shape cannot contain artwork.',
      'SVG_UNSUPPORTED',
    );
    for (const child of record.children) {
      const item = compile(child, false, world);
      if (!item.blueprint) continue;
      const name = `part${++budget.parts}`;
      children[name] = item.blueprint;
      for (const p of item.parts) parts.push({ ...p, path: [name, ...p.path] });
    }
    let commands;
    if (!group) commands = record.commands ?? (record.commands = shape(tag, attrs, budget));
    const geometry = group ? record.children.flatMap((c) => artworkGeometry(c)) : commands,
      bounds = boundsOf(geometry);
    const props = { opacity: own.display === 'none' ? 0 : opacity(own.opacity, 'SVG opacity') };
    if (!group) {
      Object.assign(props, {
        fill: paint(style.fill, opacity(style['fill-opacity'], 'Fill opacity'), bounds, style),
        stroke: paint(style.stroke, opacity(style['stroke-opacity'], 'Stroke opacity'), bounds, style),
        fillRule: style['fill-rule'],
        strokeWidth: length(style['stroke-width'], 'SVG stroke width'),
        strokeLinecap: style['stroke-linecap'],
        strokeLinejoin: style['stroke-linejoin'],
        strokeMiterlimit: Number(style['stroke-miterlimit']),
        commands,
      });
      if (style.visibility !== 'visible') props.opacity = 0;
    }
    if (own['mix-blend-mode'] !== undefined) {
      fail(
        ['normal', 'multiply', 'screen'].includes(own['mix-blend-mode']),
        'Unsupported SVG blend mode.',
        'SVG_UNSUPPORTED',
      );
      props.blend = own['mix-blend-mode'];
    }
    const effects = {};
    for (const [key, fn] of [
      ['clip-path', clipResource],
      ['mask', maskResource],
    ])
      if (own[key] !== undefined && own[key] !== 'none')
        effects[key === 'clip-path' ? 'clip' : 'mask'] = fn(own[key], bounds);
    let node = { type: group ? 'group' : 'path', props, children: group ? children : {} };
    // SVG applies filters first, then clipping/masking, opacity and blend.
    // A wrapper also retains finite source filter regions after blur.
    let effectPrefix = [];
    if (own.filter !== undefined && own.filter !== 'none') {
      const filter = filterResource(own.filter, bounds, world);
      Object.assign(props, filter.props);
      const composite = { opacity: props.opacity, ...(props.blend ? { blend: props.blend } : {}) };
      props.opacity = 1;
      delete props.blend;
      node = { type: 'group', props: { ...composite, clip: filter.region }, children: { filtered: node } };
      effectPrefix = ['filtered'];
      if (Object.keys(effects).length) {
        node = { type: 'group', props: { ...composite, ...effects }, children: { filtered: node } };
        node.children.filtered.props.opacity = 1;
        delete node.children.filtered.props.blend;
        effectPrefix = ['filtered', ...effectPrefix];
      }
    } else Object.assign(props, effects);
    if (!group && /[Aa]/.test(attrs.d ?? '')) budget.arcs++;
    const wrapped = affine(node, local);
    for (const name of layerNames(attrs))
      parts.push({ id: name, sourceId: attrs.id ?? null, type: node.type, path: [], own: true });
    return {
      blueprint: wrapped.blueprint,
      parts: parts.map(({ own: localOwn4, ...p }) => ({
        ...p,
        path: [...wrapped.prefix, ...(localOwn4 ? [] : effectPrefix), ...p.path],
      })),
    };
  }
  const viewBox = rootAttrs.viewBox === undefined ? null : numbers(rootAttrs.viewBox, 4);
  fail(
    !viewBox || (viewBox.length === 4 && viewBox[2] > 0 && viewBox[3] > 0),
    'viewBox needs x y positive-width positive-height.',
  );
  const width = numeric(
      spec.width ?? length(rootAttrs.width, 'SVG width', viewBox?.[2] ?? 300),
      'Imported width',
      1,
      8192,
    ),
    height = numeric(
      spec.height ?? length(rootAttrs.height, 'SVG height', viewBox?.[3] ?? 150),
      'Imported height',
      1,
      8192,
    );
  let viewport = [...IDENTITY];
  if (viewBox) {
    const [x, y, w, h] = viewBox,
      aspect = (rootAttrs.preserveAspectRatio ?? 'xMidYMid meet').trim().split(/\s+/);
    let sx = width / w,
      sy = height / h,
      tx = -x * sx,
      ty = -y * sy;
    fail(
      aspect[0] === 'none' || /^x(?:Min|Mid|Max)Y(?:Min|Mid|Max)$/.test(aspect[0]),
      'Unsupported preserveAspectRatio alignment.',
      'SVG_UNSUPPORTED',
    );
    if (aspect[0] === 'none') fail(aspect.length === 1, 'preserveAspectRatio none has no fitting mode.');
    else {
      fail(
        aspect.length <= 2 && ['meet', 'slice'].includes(aspect[1] ?? 'meet'),
        'Use meet or slice SVG aspect fitting.',
      );
      const scale = (aspect[1] ?? 'meet') === 'slice' ? Math.max(sx, sy) : Math.min(sx, sy),
        align = aspect[0],
        ax = align.includes('xMin') ? 0 : align.includes('xMid') ? 0.5 : 1,
        ay = align.includes('YMin') ? 0 : align.includes('YMid') ? 0.5 : 1;
      sx = sy = scale;
      tx = -x * scale + (width - w * scale) * ax;
      ty = -y * scale + (height - h * scale) * ay;
    }
    viewport = [sx, 0, 0, sy, tx, ty];
  } else
    fail(
      rootAttrs.preserveAspectRatio === undefined,
      'preserveAspectRatio requires viewBox for import.',
      'SVG_UNSUPPORTED',
    );
  const compiled = compile(tree, true, multiply(parseSVGTransform(rootAttrs.transform ?? ''), viewport));
  const view = affine(
      { type: 'group', props: {}, children: { source: compiled.blueprint } },
      multiply(parseSVGTransform(rootAttrs.transform ?? ''), viewport),
    ),
    blueprint = immutableBlueprint(
      {
        type: 'group',
        props: { clip: { type: 'rect', x: 0, y: 0, width, height, rx: 0 } },
        children: { artwork: view.blueprint },
      },
      0,
      budget,
    );
  const parts = Object.freeze(
    compiled.parts.map((p) =>
      Object.freeze({
        id: p.id,
        sourceId: p.sourceId ?? p.id,
        type: p.type,
        path: ['artwork', ...view.prefix, 'source', ...p.path].join('.'),
      }),
    ),
  );
  return Object.freeze({
    blueprint,
    width,
    height,
    viewBox: viewBox ? Object.freeze([...viewBox]) : null,
    parts,
    diagnostics: Object.freeze({
      sourceNodes: budget.sourceNodes,
      componentNodes: budget.outputNodes,
      commands: budget.commands,
      arcPaths: budget.arcs,
      arcApproximation: 'cubic segments of at most 90 degrees',
      externalResources: false,
      resourceReferences: referenceWork,
      naming: 'id, data-name, decoded Illustrator escapes',
      unsupported: 'reject before returning a blueprint',
    }),
  });
}

/** Explicit local-file read. No automatic fetch, URL resolution, recording or persistence. */
export async function importSVGFile(file, spec = {}) {
  options(spec, ['DOMParser', 'maxBytes', 'maxNodes', 'maxCommands', 'maxDepth', 'width', 'height'], 'SVG file import');
  const limit = cap(spec.maxBytes ?? 1_000_000, 'SVG byte budget', MAX_SOURCE);
  fail(
    file && typeof file.text === 'function' && Number.isFinite(file.size) && file.size >= 0,
    'Supply a local File/Blob with size and text().',
    'SVG_INVALID',
  );
  fail(file.size <= limit, 'SVG file exceeds its byte budget.', 'RESOURCE_LIMIT');
  return importSVG(await file.text(), spec);
}
