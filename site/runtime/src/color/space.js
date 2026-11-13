import { assert, number, options } from '../core/validate.js';

export const namedColors = Object.freeze({
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  transparent: '#00000000',
  yellow: '#ffff00',
  orange: '#ffa500',
  purple: '#800080',
  gray: '#808080',
  grey: '#808080',
  pink: '#ffc0cb',
  brown: '#a52a2a',
  cyan: '#00ffff',
  magenta: '#ff00ff',
  navy: '#000080',
  teal: '#008080',
  gold: '#ffd700',
  ivory: '#fffff0',
  coral: '#ff7f50',
  lime: '#00ff00',
});
const hue = (h) => ((number(h, 'hue', -1e9, 1e9) % 360) + 360) % 360;
const unit = (v, name) => number(v, name, 0, 1);
const percent = (v, name) => number(v, name, 0, 100);

/** Hue is degrees; saturation/lightness are percentages; alpha is 0–1. */
export function hsla(h, s, l, a = 1) {
  return `hsla(${hue(h)}, ${percent(s, 'saturation')}%, ${percent(l, 'lightness')}%, ${unit(a, 'alpha')})`;
}
/** Convert normalized RGB channels to a frozen HSLA record, preserving alpha. */
export function fromRGBA(r, g, b, a = 1) {
  [r, g, b, a].forEach((v) => unit(v, 'RGBA channel'));
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min,
    l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (l <= 0.5 ? max + min : 2 - max - min);
  const h =
    d === 0 ? 0 : max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return Object.freeze({
    h: hue(h),
    s: Math.max(0, Math.min(100, s * 100)),
    l: Math.max(0, Math.min(100, l * 100)),
    a,
  });
}
/** Convert an HSLA record to normalized RGBA. No browser or CSS evaluation. */
function captureHSLA(value) {
  options(value, ['h', 's', 'l', 'a'], 'HSLA color');
  return Object.freeze({
    h: hue(value.h),
    s: percent(value.s, 'saturation'),
    l: percent(value.l, 'lightness'),
    a: unit(value.a ?? 1, 'alpha'),
  });
}
export function hslaToRGBA(value) {
  const record = captureHSLA(value),
    h = record.h,
    s = record.s / 100,
    l = record.l / 100,
    a = record.a;
  const c = (1 - Math.abs(2 * l - 1)) * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = l - c / 2;
  const rgb =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return Object.freeze([...rgb.map((v) => Math.max(0, Math.min(1, v + m))), a]);
}
const numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
function component(s, isPercent = false) {
  assert(!isPercent || s.endsWith('%'), 'INVALID_COLOR', 'Saturation and lightness require percentages.');
  const raw = isPercent ? s.slice(0, -1) : s;
  assert(numeric.test(raw), 'INVALID_COLOR', 'Color channels must be finite numeric literals.');
  return Number(raw);
}
/** Bounded safe color parser: hex, supported names, numeric hsl()/hsla(), or HSLA records. */
export function toRGBA(value) {
  if (value && typeof value === 'object') return hslaToRGBA(value);
  assert(typeof value === 'string' && value.length <= 128, 'INVALID_COLOR', 'Use a bounded solid color.');
  const input = value.trim().toLowerCase();
  const named = Object.hasOwn(namedColors, input) ? namedColors[input] : input;
  if (/^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(named)) {
    let hex = named.slice(1);
    if (hex.length <= 4) hex = [...hex].map((v) => v + v).join('');
    if (hex.length === 6) hex += 'ff';
    return Object.freeze(Array.from({ length: 4 }, (_, i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16) / 255));
  }
  return hslaToRGBA(parseHSL(input));
}
function parseHSL(input) {
  const match = /^hsla?\(([^()]*)\)$/.exec(input);
  assert(
    match,
    'INVALID_COLOR',
    'Use hex, a supported name, or numeric HSL/HSLA; URLs and CSS expressions are forbidden.',
  );
  const body = match[1];
  let channels;
  if (body.includes(',')) {
    assert(!body.includes('/'), 'INVALID_COLOR', 'Do not mix comma and slash color syntax.');
    channels = body.split(',').map((v) => v.trim());
  } else {
    const parts = body.split('/');
    assert(parts.length <= 2, 'INVALID_COLOR', 'Use one alpha channel.');
    channels = parts[0].trim().split(/\s+/);
    if (parts.length === 2) channels.push(parts[1].trim());
  }
  assert(channels.length === 3 || channels.length === 4, 'INVALID_COLOR', 'Use three HSL channels and optional alpha.');
  const rawHue = channels[0].endsWith('deg') ? channels[0].slice(0, -3) : channels[0];
  const alpha = channels[3];
  return captureHSLA({
    h: component(rawHue),
    s: component(channels[1], true),
    l: component(channels[2], true),
    a: alpha === undefined ? 1 : alpha.endsWith('%') ? component(alpha, true) / 100 : component(alpha),
  });
}
export function toHSLA(value) {
  if (value && typeof value === 'object') return captureHSLA(value);
  if (typeof value === 'string' && value.length <= 128 && /^hsla?\(/i.test(value.trim()))
    return parseHSL(value.trim().toLowerCase());
  return fromRGBA(...toRGBA(value));
}
export function toHex(value) {
  return (
    '#' +
    toRGBA(value)
      .map((v) =>
        Math.round(v * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
export function toCSS(value) {
  const { h, s, l, a } = toHSLA(value);
  return hsla(h, s, l, a);
}
/** Explicit adjustments; inputs are not mutated. Values outside saturation/lightness/alpha bounds refuse. */
export function adjust(value, changes = {}) {
  options(changes, ['h', 's', 'l', 'a'], 'color adjustment');
  return toCSS({ ...toHSLA(value), ...changes });
}
/** Shared paint validation. Preserve legacy names/hex; normalize HSL to renderer-safe hex. */
export function solidColor(value, { stop = false } = {}) {
  if (typeof value === 'string') {
    assert(value.length <= 128, 'INVALID_COLOR', 'Use a bounded solid color.');
    value = value.trim();
    const lower = value.toLowerCase();
    if (lower === 'none') {
      assert(!stop, 'INVALID_COLOR', 'A gradient stop needs a solid color.');
      return 'none';
    }
    // Validation is allocation-free for the common sampled hex/named paint path.
    if (/^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(value)) return value;
    if (Object.hasOwn(namedColors, lower)) return lower;
  }
  return toHex(value);
}
