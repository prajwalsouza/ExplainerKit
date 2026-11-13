import { assert, number, options, safeCopy } from '../core/validate.js';
import { color } from './index.js';
import { noiseRaw } from '../noise/vector.js';
import { colorInterpolator } from '../color/interpolate.js';
/** First-party 32px tiles. All numeric defaults are artistic conventions. */
export function texture(spec = {}) {
  const v = safeCopy(spec);
  options(
    v,
    ['type', 'kind', 'scale', 'amount', 'seed', 'color', 'space', 'colors', 'direction', 'frequency'],
    'texture',
  );
  assert(v.type === undefined || v.type === 'texture', 'INVALID_TEXTURE', 'Expected a texture descriptor.');
  assert(
    ['grain', 'paper', 'halftone', 'hatch', 'paint', 'brush'].includes(v.kind ?? 'grain'),
    'INVALID_TEXTURE',
    'Unknown texture kind.',
  );
  assert(Number.isInteger(v.seed ?? 1), 'INVALID_TEXTURE', 'Texture seed must be an integer.');
  assert(['shape', 'screen'].includes(v.space ?? 'shape'), 'INVALID_TEXTURE', 'Texture space must be shape or screen.');
  const painted = ['paint', 'brush'].includes(v.kind),
    extra = {};
  if (painted) {
    const palette = v.colors ?? ['#315647', '#97b578'];
    assert(
      Array.isArray(palette) && palette.length >= 2 && palette.length <= 8,
      'INVALID_TEXTURE',
      'Painterly fills need 2–8 palette colours.',
    );
    extra.colors = Object.freeze(palette.map((c) => color(c, { stop: true })));
    extra.direction = number(v.direction ?? 0, 'paint direction');
    extra.frequency = number(v.frequency ?? 2, 'paint frequency', 0.1, 16);
  } else
    assert(
      v.colors === undefined && v.direction === undefined && v.frequency === undefined,
      'INVALID_TEXTURE',
      'Palette/direction/frequency require a paint or brush texture.',
    );
  return Object.freeze({
    type: 'texture',
    kind: v.kind ?? 'grain',
    scale: number(v.scale ?? 1, 'texture scale', 0.25, 16),
    amount: number(v.amount ?? 0.15, 'texture amount', 0, 1),
    seed: number(v.seed ?? 1, 'texture seed', 0, 4294967295),
    color: color(v.color ?? '#000000', { stop: true }),
    space: v.space ?? 'shape',
    ...extra,
  });
}
export const validateTexture = (value) => (value === null ? null : texture(value));
const tiles = new Map();
export function textureTile(value) {
  const t = texture(value),
    key = JSON.stringify(t);
  if (tiles.has(key)) return tiles.get(key);
  let state = t.seed >>> 0 || 0x6d2b79f5;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  const painted = ['paint', 'brush'].includes(t.kind),
    mixers = painted ? t.colors.slice(1).map((c, i) => colorInterpolator(t.colors[i], c)) : null;
  const cells = [];
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      if (painted) {
        const u = (2 * Math.PI * x) / 32,
          v = (2 * Math.PI * y) / 32,
          c = Math.cos(t.direction),
          s = Math.sin(t.direction),
          noise = noiseRaw(
            (Math.cos(u) * c + Math.cos(v) * s) * t.frequency,
            Math.sin(u) * t.frequency,
            Math.sin(v) * t.frequency,
            t.seed,
          ),
          directional = (Math.cos(u) * c + Math.cos(v) * s) / Math.SQRT2,
          brush = t.kind === 'brush' ? Math.sin(((x * c + y * s) * Math.PI) / 4) * 0.15 : 0,
          q = Math.max(0, Math.min(1, 0.5 + t.amount * (0.3 * noise + 0.2 * directional + brush))),
          index = Math.min(mixers.length - 1, Math.floor(q * mixers.length)),
          shade = mixers[index](q * mixers.length - index);
        cells.push(Object.freeze({ x, y, alpha: 1, color: shade }));
        continue;
      }
      const r = random();
      let a =
        t.kind === 'grain'
          ? r < 0.35
            ? r / 0.35
            : 0
          : t.kind === 'paper'
            ? 0.25 + 0.75 * r
            : t.kind === 'hatch'
              ? (x + y + (t.seed % 8)) % 8 < 2
                ? 1
                : 0
              : (((x + (t.seed % 8)) % 8) - 3.5) ** 2 + (((y + ((t.seed >>> 3) % 8)) % 8) - 3.5) ** 2 <= 5
                ? 1
                : 0;
      a = Math.round(a * t.amount * 255) / 255;
      if (a) cells.push(Object.freeze({ x, y, alpha: a }));
    }
  const tile = Object.freeze({ size: 32, cells: Object.freeze(cells) });
  if (tiles.size >= 64) tiles.delete(tiles.keys().next().value);
  tiles.set(key, tile);
  return tile;
}

/** Gradient-mapped coherent-noise or brush texture, using the existing texture resource contract. */
export function paint(spec = {}) {
  options(spec, ['kind', 'colors', 'direction', 'frequency', 'scale', 'amount', 'seed', 'space'], 'painterly paint');
  assert(
    spec.kind === undefined || ['noise', 'brush'].includes(spec.kind),
    'INVALID_TEXTURE',
    'Use noise or brush paint.',
  );
  return texture({ ...spec, kind: spec.kind === 'brush' ? 'brush' : 'paint', amount: spec.amount ?? 1 });
}
