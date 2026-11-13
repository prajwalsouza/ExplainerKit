import { assert, number, options } from '../core/validate.js';
import { seedValue, randomAt } from '../noise/vector.js';

const integer = (value, label, min, max) => {
  number(value, label, min, max);
  assert(Number.isInteger(value), 'INVALID_GRAIN', `${label} must be an integer.`);
  return value;
};

/** Time-addressed monochrome grain. Returns explicit overlays, never a hidden postprocess. */
export function filmGrain(spec = {}) {
  options(spec, ['width', 'height', 'size', 'intensity', 'rate', 'seed', 'maxPixels', 'maxNodes'], 'film grain');
  const width = integer(spec.width ?? 320, 'grain width', 1, 8192),
    height = integer(spec.height ?? 180, 'grain height', 1, 8192),
    size = integer(spec.size ?? 4, 'grain block size', 1, 8192),
    intensity = number(spec.intensity ?? 0.12, 'grain intensity', 0, 1),
    rate = number(spec.rate ?? 24, 'grain rate', 0, 240),
    seed = seedValue(spec.seed),
    maxPixels = integer(spec.maxPixels ?? 1048576, 'grain pixel cap', 1, 8000000),
    maxNodes = integer(spec.maxNodes ?? 4096, 'grain node cap', 2, 10000);
  assert(
    width * height <= maxPixels,
    'RESOURCE_LIMIT',
    'Grain raster exceeds maxPixels. Reduce its dimensions or explicitly raise the cap, up to eight million pixels.',
  );
  const columns = Math.ceil(width / size),
    rows = Math.ceil(height / size),
    cells = columns * rows;
  function frameAt(time) {
    number(time, 'grain time', 0, 86400);
    return Math.floor(time * rate);
  }
  function cell(frame, index) {
    const value = randomAt(seed, index, frame) * 2 - 1;
    return { channel: value < 0 ? 0 : 255, alpha: Math.round(Math.abs(value) * intensity * 255) };
  }
  const settings = Object.freeze({ width, height, size, intensity, rate, seed, maxPixels, maxNodes });
  return Object.freeze({
    ...settings,
    settings,
    columns,
    rows,
    frameAt,
    pixels(time = 0) {
      const frame = frameAt(time),
        data = new Uint8ClampedArray(width * height * 4);
      for (let row = 0; row < rows; row++)
        for (let col = 0; col < columns; col++) {
          const { channel, alpha } = cell(frame, row * columns + col),
            endX = Math.min(width, (col + 1) * size),
            endY = Math.min(height, (row + 1) * size);
          for (let y = row * size; y < endY; y++)
            for (let x = col * size; x < endX; x++) {
              const i = (y * width + x) * 4;
              data[i] = data[i + 1] = data[i + 2] = channel;
              data[i + 3] = alpha;
            }
        }
      // The buffer is deliberately caller-owned: typed arrays cannot be frozen portably.
      return Object.freeze({ width, height, frame, data });
    },
    blueprint(time = 0) {
      const frame = frameAt(time);
      assert(
        cells + 1 <= maxNodes,
        'RESOURCE_LIMIT',
        'Grain geometry exceeds maxNodes, including its group. Increase size or explicitly raise the cap; allow room for the rest of the scene.',
      );
      const children = Object.create(null);
      for (let row = 0; row < rows; row++)
        for (let col = 0; col < columns; col++) {
          const index = row * columns + col,
            { channel, alpha } = cell(frame, index),
            x = col * size,
            y = row * size;
          children[`cell${index}`] = Object.freeze({
            type: 'rect',
            props: Object.freeze({
              x,
              y,
              width: Math.min(size, width - x),
              height: Math.min(size, height - y),
              fill: channel ? '#ffffff' : '#000000',
              stroke: 'none',
              opacity: alpha / 255,
            }),
          });
        }
      return Object.freeze({ type: 'group', props: Object.freeze({}), children: Object.freeze(children) });
    },
  });
}
