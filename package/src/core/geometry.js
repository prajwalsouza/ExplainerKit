import { strokePropertySuggestion } from './stroke-hints.js';
import { pivotKeywords } from './transform.js';
import { assert, number, text, options } from './validate.js';
import { validateClip, validatePaint, fillRule, pathCommands, strokeDasharray } from '../graphics/index.js';
import { validateBlur, validateGlow, validateMask, blendMode } from '../graphics/look.js';
import { validateShade } from '../graphics/lighting.js';
import { validateTexture } from '../graphics/texture.js';
import { cloudPoints, pointShape, pointBlend, cloudRadius, EMPTY_CLOUD } from '../graphics/cloud.js';
const base = {
  x: 0,
  y: 0,
  z: 0,
  rotation: 0,
  pivot: null,
  skewX: 0,
  skewY: 0,
  rotationX: 0,
  rotationY: 0,
  scaleX: 1,
  scaleY: 1,
  scaleZ: 1,
  depth: 0,
  opacity: 1,
  fillOpacity: 1,
  strokeOpacity: 1,
  fill: '#132d3c',
  stroke: 'none',
  strokeWidth: 1,
  strokeDasharray: [],
  strokeDashoffset: 0,
  strokeLinecap: 'butt',
  strokeLinejoin: 'miter',
  strokeMiterlimit: 4,
  clip: null,
  fillRule: 'nonzero',
  blur: 0,
  glow: null,
  mask: null,
  blend: 'normal',
  shade: null,
  texture: null,
};
const defaults = {
  group: {},
  circle: { r: 10 },
  rect: { width: 20, height: 20, rx: 0 },
  line: { x1: 0, y1: 0, x2: 20, y2: 0, fill: 'none', stroke: '#132d3c' },
  path: { commands: [], trimStart: 0, trimEnd: 1, trimOffset: 0 },
  cloud: { points: EMPTY_CLOUD, pointSize: 2, pointShape: 'circle', pointBlend: 'normal' },
  text: {
    text: '',
    fontSize: 16,
    fontFamily: 'sans-serif',
    fontWeight: 400,
    letterSpacing: 0,
    align: 'start',
    baseline: 'alphabetic',
    wrap: null,
    lineHeight: 1.3,
    minScreenSize: 0,
    halo: null,
  },
};
export const shapeTypes = Object.freeze(Object.keys(defaults));
export function validateProperty(type, key, value) {
  assert(
    Object.hasOwn(base, key) ||
      Object.hasOwn(defaults[type] ?? {}, key) ||
      (type === 'text' && ['textOutline', 'textAdvance'].includes(key)),
    'UNKNOWN_PROPERTY',
    `${type} has no writable ${key} property.${strokePropertySuggestion(key) ? ' Did you mean ' + strokePropertySuggestion(key) + '?' : ''}`,
  );
  if (key === 'pivot') {
    if (value === null) return null;
    if (Array.isArray(value)) {
      assert(value.length === 2, 'INVALID_PIVOT', 'Use a two-coordinate pivot.');
      return Object.freeze(
        Array.from({ length: 2 }, (_, i) => {
          const d = Object.getOwnPropertyDescriptor(value, i);
          assert(d && 'value' in d, 'INVALID_PIVOT', 'Pivot coordinates must be dense values.');
          return number(d.value, 'pivot');
        }),
      );
    }
    assert(pivotKeywords.includes(value), 'INVALID_PIVOT', 'Use a pivot keyword or coordinate pair.');
    return value;
  }
  if (key === 'skewX' || key === 'skewY') return number(value, key, -1.4, 1.4);
  if (key === 'halo') {
    if (value === null) return null;
    options(value, ['color', 'width'], 'text halo');
    const paint = validatePaint(value.color ?? '#ffffff');
    assert(typeof paint === 'string' && paint !== 'none', 'INVALID_HALO', 'Use a solid halo colour.');
    return Object.freeze({ color: paint, width: number(value.width ?? 2, 'halo width', 0, 32) });
  }
  if (key === 'wrap') return value === null ? null : number(value, 'text wrap width', 1, 1e5);
  if (key === 'lineHeight') return number(value, 'text line height', 0.8, 4);
  if (key === 'minScreenSize') return number(value, 'minimum screen text size', 0, 200);
  if (key === 'text') return text(value, 'text');
  if (key === 'textOutline') return value == null ? null : pathCommands(value);
  if (key === 'textAdvance') return value == null ? null : number(value, 'text advance', 0, 1e7);
  if (key === 'fontFamily') {
    assert(
      typeof value === 'string' && value.length > 0 && value.length <= 200 && /^[\w\s,\-"']+$/.test(value),
      'UNSUPPORTED_FONT',
      'Use a safe CSS font family or fallback list.',
    );
    return value;
  }
  if (key === 'fill' || key === 'stroke') {
    return validatePaint(value);
  }
  if (key === 'clip') return validateClip(value);
  if (key === 'fillRule') return fillRule(value);
  if (key === 'shade') return validateShade(value);
  if (key === 'texture') return value === null ? null : validateTexture(value);
  if (key === 'blur') return validateBlur(value);
  if (key === 'glow') return validateGlow(value);
  if (key === 'mask') return validateMask(value);
  if (key === 'blend') return blendMode(value);
  if (key === 'strokeDasharray') return strokeDasharray(value);
  if (key === 'strokeDashoffset') return number(value, key);
  if (key === 'strokeLinecap') {
    assert(['butt', 'round', 'square'].includes(value), 'INVALID_STROKE', 'Use butt, round or square caps.');
    return value;
  }
  if (key === 'strokeLinejoin') {
    assert(['miter', 'round', 'bevel'].includes(value), 'INVALID_STROKE', 'Use miter, round or bevel joins.');
    return value;
  }
  if (key === 'strokeMiterlimit') return number(value, key, 1, 1e4);
  if (key === 'trimStart' || key === 'trimEnd') return number(value, key, 0, 1);
  if (key === 'trimOffset') return number(value, key, -1e4, 1e4);
  if (key === 'depth') return number(value, key, 0, 1e5);
  if (key === 'align') {
    assert(['start', 'middle', 'end'].includes(value), 'INVALID_ALIGN', 'Text align must be start, middle or end.');
    return value;
  }
  if (key === 'baseline') {
    assert(['alphabetic', 'middle', 'hanging'].includes(value), 'INVALID_BASELINE', 'Unsupported text baseline.');
    return value;
  }
  if (key === 'points') return cloudPoints(value);
  if (key === 'pointShape') return pointShape(value);
  if (key === 'pointBlend') return pointBlend(value);
  if (key === 'pointSize') return cloudRadius(value);
  if (key === 'commands') {
    return pathCommands(value);
  }
  if (['opacity', 'fillOpacity', 'strokeOpacity'].includes(key)) return number(value, key, 0, 1);
  if (['r', 'width', 'height', 'rx', 'strokeWidth'].includes(key)) return number(value, key, 0, 1e5);
  if (key === 'fontSize') return number(value, key, 1, 1000);
  if (key === 'fontWeight') return number(value, key, 100, 900);
  if (key === 'letterSpacing') return number(value, key, -100, 100);
  return number(value, key);
}
export function properties(type, input = {}) {
  assert(shapeTypes.includes(type), 'UNSUPPORTED_SHAPE', `Unsupported shape ${type}.`);
  for (const key of Object.keys(input ?? {})) if (strokePropertySuggestion(key)) validateProperty(type, key, undefined);
  options(
    input,
    [...Object.keys(base), ...Object.keys(defaults[type]), ...(type === 'text' ? ['textOutline', 'textAdvance'] : [])],
    `${type} properties`,
  );
  const props = Object.fromEntries(
    Object.entries({ ...base, ...defaults[type] }).map(([k, v]) => [k, validateProperty(type, k, v)]),
  );
  for (const [k, v] of Object.entries(input)) props[k] = validateProperty(type, k, v);
  return props;
}
export function linearScale(spec) {
  options(spec, ['domain', 'range', 'clamp']);
  assert(
    Array.isArray(spec.domain) && spec.domain.length === 2 && Array.isArray(spec.range) && spec.range.length === 2,
    'INVALID_SCALE',
    'Scale needs two-value domain and range.',
  );
  assert(spec.clamp === undefined || typeof spec.clamp === 'boolean', 'INVALID_SCALE', 'clamp must be boolean.');
  const clamp = spec.clamp ?? false;
  const [a, b] = [number(spec.domain[0], 'scale domain'), number(spec.domain[1], 'scale domain')];
  const [c, d] = [number(spec.range[0], 'scale range'), number(spec.range[1], 'scale range')];
  assert(a !== b, 'INVALID_SCALE', 'Scale domain endpoints must differ.');
  return (value) => {
    number(value, 'bound value');
    let t = (value - a) / (b - a);
    if (clamp) t = Math.max(0, Math.min(1, t));
    return c + (d - c) * t;
  };
}
