import { assert, options, text } from '../core/validate.js';
import { hsla, toHSLA, toRGBA, toHex } from '../color/space.js';

/** A pure, unbranded dark-material mapping. All colour judgements use encoded sRGB HSL. */
export function darkClay(colour, spec = {}) {
  options(spec, ['role', 'hasMap', 'id'], 'Dark material palette');
  const role = text(spec.role ?? 'fill', 'material role', 64),
    hasMap = spec.hasMap ?? false,
    value = toHSLA(materialColour(colour));
  assert(typeof hasMap === 'boolean', 'INVALID_OPTIONS', 'hasMap must be boolean.');
  if (role === 'accent') return toHex(colour).slice(0, 7);
  if (hasMap) return toHex(hsla(0, 0, 36)).slice(0, 7);
  // Saturated middle-light colours remain accents; neutral clays retain hue and lightness order.
  if (value.s >= 45 && value.l > 25 && value.l < 72) return toHex(colour).slice(0, 7);
  return toHex(hsla(value.h, Math.min(100, value.s * 1.1), 10 + (value.l / 100) ** 1.4 * 22)).slice(0, 7);
}

/** A material palette changes albedo only. Alpha remains owned by the sampled frame. */
export function materialColour(value) {
  assert(
    toRGBA(value)[3] === 1,
    'INVALID_COLOR',
    'A material palette must return an opaque solid colour; author opacity on the scene.',
  );
  return toHex(value).slice(0, 7);
}
