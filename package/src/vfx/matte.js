import { assert, number, options } from '../core/validate.js';

const bytePrototype = Object.getPrototypeOf(Uint8Array.prototype);
const byteTag = Object.getOwnPropertyDescriptor(bytePrototype, Symbol.toStringTag).get;
const byteLength = Object.getOwnPropertyDescriptor(bytePrototype, 'length').get;
const clamp = (value, high) => Math.min(high, Math.max(0, value));

function pixelCount(width, height) {
  number(width, 'matte width', 1, 4096);
  number(height, 'matte height', 1, 4096);
  assert(
    Number.isInteger(width) && Number.isInteger(height) && width * height <= 2097152,
    'RESOURCE_LIMIT',
    'Use integer matte dimensions with at most 2,097,152 pixels.',
  );
  return width * height;
}

function bytes(value, length, name) {
  const tag = byteTag.call(value);
  assert(
    (tag === 'Uint8Array' || tag === 'Uint8ClampedArray') && byteLength.call(value) === length,
    'INVALID_DATA',
    name + ' must contain the specified number of bytes.',
  );
  return value;
}

function axisPass(input, output, width, height, radius, vertical, mode) {
  const lines = vertical ? width : height;
  const length = vertical ? height : width;
  const stride = vertical ? width : 1;
  const indices = new Int32Array(length + 2 * radius);
  for (let line = 0; line < lines; line++) {
    const start = vertical ? line : line * width;
    const read = (at) => input[start + clamp(at, length - 1) * stride];
    let head = 0,
      tail = 0,
      sum = 0;
    for (let j = -radius; j < length + radius; j++) {
      const value = read(j);
      if (mode === 'mean') {
        sum += value;
        if (j > radius) sum -= read(j - 2 * radius - 1);
      } else {
        while (head < tail && indices[head] < j - 2 * radius) head++;
        while (head < tail && (mode === 'max' ? read(indices[tail - 1]) <= value : read(indices[tail - 1]) >= value))
          tail--;
        indices[tail++] = j;
      }
      if (j >= radius) {
        output[start + (j - radius) * stride] = mode === 'mean' ? sum / (2 * radius + 1) : read(indices[head]);
      }
    }
  }
}

/** Expand or contract a coverage matte, then soften its edge. */
export function adjustMatte(alpha, width, height, spec = {}) {
  options(spec, ['shift', 'feather'], 'matte adjustment');
  const size = pixelCount(width, height);
  bytes(alpha, size, 'Coverage matte');
  const shift = number(spec.shift ?? 0, 'matte shift', -24, 24);
  const feather = number(spec.feather ?? 0, 'matte feather', 0, 24);
  assert(
    Number.isInteger(shift) && Number.isInteger(feather),
    'INVALID_NUMBER',
    'Matte shift and feather use whole pixels.',
  );
  const result = new Uint8ClampedArray(alpha);
  if (shift === 0 && feather === 0) return result;
  const scratch = new Uint8ClampedArray(size);
  if (shift !== 0) {
    const mode = shift > 0 ? 'max' : 'min';
    axisPass(result, scratch, width, height, Math.abs(shift), false, mode);
    axisPass(scratch, result, width, height, Math.abs(shift), true, mode);
  }
  if (feather > 0) {
    for (let pass = 0; pass < 2; pass++) {
      axisPass(result, scratch, width, height, feather, false, 'mean');
      axisPass(scratch, result, width, height, feather, true, 'mean');
    }
  }
  return result;
}

const linear = Float32Array.from({ length: 256 }, (_, i) => {
  const value = i / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
});
const srgb = Uint8ClampedArray.from({ length: 4097 }, (_, i) => {
  const value = i / 4096;
  return 255 * (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055);
});

/** Composite straight sRGB footage and an insert using foreground coverage and an optional clean plate. */
export function compositeMatte(input) {
  options(input, ['width', 'height', 'footage', 'insert', 'foreground', 'cleanPlate'], 'matte composite');
  const { width, height, footage, insert, foreground, cleanPlate } = input;
  const size = pixelCount(width, height);
  bytes(footage, 4 * size, 'Footage');
  bytes(insert, 4 * size, 'Insert');
  bytes(foreground, size, 'Coverage matte');
  if (cleanPlate !== undefined) bytes(cleanPlate, 4 * size, 'Clean plate');
  const output = new Uint8ClampedArray(4 * size);
  for (let pixel = 0, offset = 0; pixel < size; pixel++, offset += 4) {
    const uncovered = (255 - foreground[pixel]) / 255;
    const opacity = insert[offset + 3] / 255;
    if (uncovered === 0 || opacity === 0) continue;
    output[offset + 3] = 255;
    const confidence = cleanPlate && foreground[pixel] > 0 ? cleanPlate[offset + 3] / 255 : 0;
    for (let channel = offset; channel < offset + 3; channel++) {
      const original = linear[footage[channel]];
      const background = confidence ? original + confidence * (linear[cleanPlate[channel]] - original) : original;
      // An imperfect plate can otherwise subtract more light than the pixel contains.
      const oldContribution = Math.max(original - (1 - uncovered), Math.min(original, uncovered * background));
      const value = original + opacity * (uncovered * linear[insert[channel]] - oldContribution);
      output[channel] = srgb[Math.round(clamp(value, 1) * 4096)];
    }
  }
  return output;
}

/** Keep the visible part of an RGBA insert using registered camera-space depth. */
export function applyDepthHoldout(input) {
  options(input, ['width', 'height', 'insert', 'insertDepth', 'observed', 'bias', 'softness'], 'depth holdout');
  const { width, height, insert, insertDepth, observed } = input;
  const size = pixelCount(width, height);
  bytes(insert, size * 4, 'Insert');
  assert(
    byteTag.call(insertDepth) === 'Float32Array' && byteLength.call(insertDepth) === size,
    'INVALID_DATA',
    'Insert depth must contain one float per insert pixel.',
  );
  options(observed, ['width', 'height', 'data', 'scale'], 'observed depth');
  const count = pixelCount(observed.width, observed.height);
  const tag = byteTag.call(observed.data);
  assert(
    ['Float32Array', 'Uint16Array', 'Uint8Array'].includes(tag) && byteLength.call(observed.data) === count,
    'INVALID_DATA',
    'Observed depth must contain one depth sample per observed pixel.',
  );
  const scale = number(observed.scale ?? 1, 'depth scale', 1e-12, 1e6);
  const bias = number(input.bias ?? 0, 'depth bias', 0, 1e6);
  const softness = number(input.softness ?? 0, 'depth softness', 0, 1e6);
  const overlay = new Uint8ClampedArray(insert);
  const columns = Uint16Array.from({ length: width }, (_, x) => Math.floor(((x + 0.5) * observed.width) / width));
  for (let y = 0; y < height; y++) {
    const row = Math.floor(((y + 0.5) * observed.height) / height) * observed.width;
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const alpha = i * 4 + 3;
      const virtual = insertDepth[i];
      if (!overlay[alpha] || !Number.isFinite(virtual) || virtual <= 0) continue;
      const real = observed.data[row + columns[x]] * scale;
      if (!Number.isFinite(real) || real <= 0) continue;
      const difference = real - virtual + bias;
      overlay[alpha] *= softness ? clamp(difference / softness, 1) : Number(difference >= 0);
    }
  }
  return overlay;
}
