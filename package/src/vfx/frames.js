import { assert, number, options, safeCopy } from '../core/validate.js';
import { corners, orientation, quadFor, rect } from './geometry.js';

const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const typedTag = Object.getOwnPropertyDescriptor(typedArrayPrototype, Symbol.toStringTag).get;
const typedLength = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'length').get;
const margin = 3;

export function grayFrame(input) {
  options(input, ['width', 'height', 'data'], 'video frame');
  const width = number(input.width, 'frame width', 8, 4096);
  const height = number(input.height, 'frame height', 8, 4096);
  const size = width * height;
  assert(
    Number.isInteger(width) && Number.isInteger(height) && size <= 2097152,
    'RESOURCE_LIMIT',
    'Use an integer frame size of at most 2,097,152 pixels.',
  );
  const data = input.data;
  const tag = typedTag.call(data);
  assert(tag === 'Uint8Array' || tag === 'Uint8ClampedArray', 'INVALID_DATA', 'Use gray or RGBA byte pixels.');
  const length = typedLength.call(data);
  assert(length === size || length === size * 4, 'INVALID_DATA', 'Pixel count must match the frame size.');
  const gray = new Uint8Array(size);
  if (length === size) gray.set(data);
  else {
    for (let i = 0, j = 0; i < size; i++, j += 4) gray[i] = (54 * data[j] + 183 * data[j + 1] + 19 * data[j + 2]) >> 8;
  }
  return { width, height, gray };
}

export function exclusions(input = []) {
  assert(
    Array.isArray(input) && input.length <= 8,
    'RESOURCE_LIMIT',
    'Use up to eight exclusion rectangles per frame.',
  );
  return safeCopy(input).map((item) => rect(item, 'exclusion'));
}

export function patchFits(frame, x, y, excluded = []) {
  if (x < margin || y < margin || x >= frame.width - margin || y >= frame.height - margin) return false;
  return !excluded.some(
    (r) => x + margin >= r.x && y + margin >= r.y && x - margin < r.x + r.width && y - margin < r.y + r.height,
  );
}

function cornerResponse(frame, x, y) {
  let xx = 0,
    yy = 0,
    xy = 0;
  const { gray, width } = frame;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const p = (y + dy) * width + x + dx;
      const gx = gray[p + 1] - gray[p - 1],
        gy = gray[p + width] - gray[p - width];
      xx += gx * gx;
      yy += gy * gy;
      xy += gx * gy;
    }
  }
  return (xx + yy - Math.hypot(xx - yy, 2 * xy)) / 50;
}

export function regionOf(input) {
  if (!Array.isArray(input)) {
    const bounds = rect(input);
    return { bounds, quad: quadFor(bounds), includes: () => true };
  }
  const quad = corners(input);
  const x = Math.min(...quad.map((p) => p.x)),
    y = Math.min(...quad.map((p) => p.y));
  const width = Math.max(...quad.map((p) => p.x)) - x,
    height = Math.max(...quad.map((p) => p.y)) - y;
  const bounds = rect({ x, y, width, height });
  const sign = orientation(quad);
  function includes(px, py) {
    return quad.every((a, i) => {
      const b = quad[(i + 1) % 4];
      return sign * ((b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x)) >= 0;
    });
  }
  return { bounds, quad, includes };
}

export function featuresIn(frame, { bounds: region, includes }, excluded) {
  const left = Math.max(margin, Math.ceil(region.x));
  const right = Math.min(frame.width - margin, Math.ceil(region.x + region.width));
  const top = Math.max(margin, Math.ceil(region.y));
  const bottom = Math.min(frame.height - margin, Math.ceil(region.y + region.height));
  if (right <= left || bottom <= top) return [];
  const step = Math.max(2, Math.ceil(Math.max(right - left, bottom - top) / 105));
  const cols = 6,
    rows = 5;
  const cells = Array(cols * rows).fill(null);
  for (let y = top; y < bottom; y += step) {
    for (let x = left; x < right; x += step) {
      if (!includes(x, y) || !patchFits(frame, x, y, excluded)) continue;
      const score = cornerResponse(frame, x, y);
      const cell =
        Math.floor(((y - top) * rows) / (bottom - top)) * cols + Math.floor(((x - left) * cols) / (right - left));
      if (score >= 12 && score > (cells[cell]?.score ?? 0)) cells[cell] = { x, y, score };
    }
  }
  return cells.filter(Boolean);
}

export function frameStats(frame, { bounds: region, includes }) {
  const { width, height, gray } = frame;
  const left = Math.max(0, Math.ceil(region.x)),
    right = Math.min(width, Math.ceil(region.x + region.width));
  const top = Math.max(0, Math.ceil(region.y)),
    bottom = Math.min(height, Math.ceil(region.y + region.height));
  const step = Math.max(1, Math.ceil(Math.max(right - left, bottom - top) / 80));
  let sum = 0,
    square = 0,
    count = 0,
    dark = 0,
    light = 0;
  for (let y = top; y < bottom; y += step) {
    for (let x = left; x < right; x += step) {
      if (!includes(x, y)) continue;
      const value = gray[y * width + x];
      sum += value;
      square += value * value;
      count++;
      if (value <= 12) dark++;
      if (value >= 243) light++;
    }
  }
  const mean = count ? sum / count : 0;
  return {
    brightness: mean / 255,
    contrast: count ? Math.sqrt(Math.max(0, square / count - mean * mean)) / 255 : 0,
    darkFraction: count ? dark / count : 0,
    brightFraction: count ? light / count : 0,
  };
}

export function cutHint(a, b) {
  const histogram = new Int32Array(16);
  let delta = 0,
    count = 0;
  const step = Math.max(1, Math.ceil(Math.max(a.width, a.height) / 48));
  for (let y = 0; y < a.height; y += step) {
    for (let x = 0; x < a.width; x += step) {
      const i = y * a.width + x,
        p = a.gray[i],
        q = b.gray[i];
      histogram[p >> 4]++;
      histogram[q >> 4]--;
      delta += Math.abs(p - q);
      count++;
    }
  }
  return (
    delta / (count * 255) > 0.18 && histogram.reduce((sum, value) => sum + Math.abs(value), 0) / (2 * count) > 0.45
  );
}
