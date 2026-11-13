import { assert, number, text, options, safeCopy } from '../core/validate.js';

const dimensions = ['length', 'mass', 'time', 'current', 'temperature', 'amount', 'luminousIntensity'];
/** An affine unit: base value = supplied value * scale + offset. */
export function defineUnit(spec = {}) {
  options(spec, ['symbol', 'dimensions', 'scale', 'offset'], 'unit');
  text(spec.symbol, 'unit symbol', 100);
  assert(spec.symbol.length, 'INVALID_UNIT', 'A unit needs a symbol.');
  const input = safeCopy(spec.dimensions ?? {});
  options(input, dimensions, 'unit dimensions');
  const vector = Object.create(null);
  for (const [key, value] of Object.entries(input)) {
    number(value, 'unit exponent', -16, 16);
    assert(Number.isInteger(value), 'INVALID_UNIT', 'Dimension exponents must be integers.');
    if (value !== 0) vector[key] = value;
  }
  return Object.freeze({
    symbol: spec.symbol,
    dimensions: Object.freeze(vector),
    scale: number(spec.scale ?? 1, 'unit scale', 1e-100, 1e100),
    offset: number(spec.offset ?? 0, 'unit offset', -1e100, 1e100),
  });
}
const unit = (value) => {
  const captured = safeCopy(value);
  return defineUnit(captured);
};
const same = (a, b) => dimensions.every((k) => (a[k] ?? 0) === (b[k] ?? 0));
export function convert(value, from, to) {
  number(value, 'measurement', -1e100, 1e100);
  from = unit(from);
  to = unit(to);
  assert(same(from.dimensions, to.dimensions), 'UNIT_MISMATCH', 'Only equal physical dimensions can be converted.');
  if (from.scale === to.scale && from.offset === to.offset) return value;
  // A ratio avoids erasing tiny values through an unnecessary base-unit product.
  // Ratios/offsets are finite under the declared 1e±100 descriptor envelope.
  const scaled = value * (from.scale / to.scale),
    shift = (from.offset - to.offset) / to.scale;
  assert(
    value === 0 || scaled !== 0 || shift !== 0,
    'NUMERIC_UNDERFLOW',
    'Converted measurement is too small to represent.',
  );
  return number(scaled + shift, 'converted measurement', -1e100, 1e100);
}
function product(a, b, sign) {
  a = unit(a);
  b = unit(b);
  assert(
    a.offset === 0 && b.offset === 0,
    'AFFINE_UNIT',
    'Convert offset units to a zero-offset unit before multiplication/division.',
  );
  const powers = Object.fromEntries(dimensions.map((k) => [k, (a.dimensions[k] ?? 0) + sign * (b.dimensions[k] ?? 0)]));
  return defineUnit({
    symbol: `(${a.symbol}${sign === 1 ? '·' : '/'}${b.symbol})`,
    dimensions: powers,
    scale: sign === 1 ? a.scale * b.scale : a.scale / b.scale,
  });
}
export function multiplyUnits(a, b) {
  return product(a, b, 1);
}
export function divideUnits(a, b) {
  return product(a, b, -1);
}
export function powerUnit(input, exponent) {
  const a = unit(input);
  number(exponent, 'unit power', -16, 16);
  assert(Number.isInteger(exponent), 'INVALID_UNIT', 'Unit powers must be integers.');
  assert(a.offset === 0, 'AFFINE_UNIT', 'Offset units cannot be exponentiated.');
  return defineUnit({
    symbol: `(${a.symbol}^${exponent})`,
    dimensions: Object.fromEntries(dimensions.map((k) => [k, (a.dimensions[k] ?? 0) * exponent])),
    scale: a.scale ** exponent,
  });
}
const u = (symbol, localDimensions1, scale = 1, offset = 0) =>
  defineUnit({ symbol, dimensions: localDimensions1, scale, offset });
export const units = Object.freeze({
  one: u('1', {}),
  m: u('m', { length: 1 }),
  cm: u('cm', { length: 1 }, 0.01),
  mm: u('mm', { length: 1 }, 0.001),
  km: u('km', { length: 1 }, 1000),
  s: u('s', { time: 1 }),
  ms: u('ms', { time: 1 }, 0.001),
  min: u('min', { time: 1 }, 60),
  h: u('h', { time: 1 }, 3600),
  kg: u('kg', { mass: 1 }),
  g: u('g', { mass: 1 }, 0.001),
  A: u('A', { current: 1 }),
  K: u('K', { temperature: 1 }),
  degC: u('°C', { temperature: 1 }, 1, 273.15),
  mol: u('mol', { amount: 1 }),
  cd: u('cd', { luminousIntensity: 1 }),
  rad: u('rad', {}),
  deg: u('°', {}, Math.PI / 180),
  mps: u('m/s', { length: 1, time: -1 }),
  kmph: u('km/h', { length: 1, time: -1 }, 1000 / 3600),
});
