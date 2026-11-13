// Text contrast against rendered pixels. The composition audit checks text against the marks of its
// own scene; text laid over pixels it cannot see (a WebGL canvas, video, a photograph, another
// renderer) needs the pixels themselves. Render the backdrop without the text, pass its RGBA pixels
// and the text boxes, and each box is checked against WCAG 2.2 SC 1.4.3 using the worst part of the
// backdrop behind it (a low percentile of per-pixel contrast), not the average, so a bright patch
// behind a single word still fails.
import { assert, number, options, safeCopy, text } from '../core/validate.js';
import { toRGBA } from '../color/space.js';

const MAX_TEXTS = 256;
const MAX_SAMPLES = 400000;
const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (r, g, b) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/**
 * `image` is {width, height, data} with 8-bit RGBA rows (an ImageData or a decoded screenshot),
 * rendered without the text. `texts` are {id, x, y, width, height, color, fontSize, bold?} in the
 * image's pixels. `percentile` (default 0.1) picks how much of the backdrop may be worse than the
 * reported contrast. Returns {status, checks}, each check with the measured contrast, the WCAG
 * requirement for its size, and the backdrop colour that limits it.
 */
export function auditTextOverPixels(spec) {
  options(spec, ['image', 'texts', 'percentile'], 'text-over-pixels audit');
  const image = spec.image;
  assert(image && typeof image === 'object', 'INVALID_PIXEL_AUDIT', 'Pass an image {width, height, data}.');
  const width = number(image.width, 'image width', 1, 16384),
    height = number(image.height, 'image height', 1, 16384),
    data = image.data;
  assert(
    Number.isInteger(width) &&
      Number.isInteger(height) &&
      data &&
      typeof data.length === 'number' &&
      data.length === width * height * 4,
    'INVALID_PIXEL_AUDIT',
    'Image data must hold width × height RGBA bytes.',
  );
  const percentile = number(spec.percentile ?? 0.1, 'percentile', 0, 0.5);
  assert(
    Array.isArray(spec.texts) && spec.texts.length <= MAX_TEXTS,
    'INVALID_PIXEL_AUDIT',
    `Pass at most ${MAX_TEXTS} text boxes.`,
  );
  const boxes = spec.texts.map((raw) => {
    const t = safeCopy(raw);
    options(t, ['id', 'x', 'y', 'width', 'height', 'color', 'fontSize', 'bold'], 'text box');
    return {
      id: text(t.id, 'text id', 128),
      x: number(t.x, 'text x', -1e5, 1e5),
      y: number(t.y, 'text y', -1e5, 1e5),
      width: number(t.width, 'text width', 0, 1e5),
      height: number(t.height, 'text height', 0, 1e5),
      rgba: toRGBA(t.color),
      fontSize: number(t.fontSize, 'font size', 1, 1000),
      bold: !!t.bold,
    };
  });
  const area = boxes.reduce((s, b) => s + b.width * b.height, 0),
    stride = Math.max(1, Math.ceil(Math.sqrt(area / MAX_SAMPLES)));
  const checks = boxes.map((b) => {
    const [r, g, bl, a] = b.rgba,
      large = b.fontSize >= 24 || (b.bold && b.fontSize >= 18.66),
      required = large ? 3 : 4.5;
    const x0 = Math.max(0, Math.floor(b.x)),
      y0 = Math.max(0, Math.floor(b.y)),
      x1 = Math.min(width, Math.ceil(b.x + b.width)),
      y1 = Math.min(height, Math.ceil(b.y + b.height));
    const samples = [];
    for (let y = y0; y < y1; y += stride)
      for (let x = x0; x < x1; x += stride) {
        const o = (y * width + x) * 4,
          br = data[o] / 255,
          bg = data[o + 1] / 255,
          bb = data[o + 2] / 255;
        // Semi-transparent text is composited over each backdrop pixel before measuring.
        const L = luminance(r * a + br * (1 - a), g * a + bg * (1 - a), bl * a + bb * (1 - a));
        samples.push([ratio(L, luminance(br, bg, bb)), o]);
      }
    if (!samples.length)
      return Object.freeze({ id: b.id, status: 'unknown', contrast: null, required, large, backdrop: null });
    samples.sort((p, q) => p[0] - q[0]);
    const [contrast, o] = samples[Math.min(samples.length - 1, Math.floor(samples.length * percentile))];
    const hex = (v) => v.toString(16).padStart(2, '0');
    return Object.freeze({
      id: b.id,
      status: contrast >= required ? 'pass' : 'fail',
      contrast,
      required,
      large,
      backdrop: `#${hex(data[o])}${hex(data[o + 1])}${hex(data[o + 2])}`,
      samples: samples.length,
    });
  });
  return Object.freeze({
    protocol: 'explainerkit.text-over-pixels/1',
    status: checks.some((c) => c.status === 'fail')
      ? 'fail'
      : checks.every((c) => c.status === 'unknown')
        ? 'unknown'
        : 'pass',
    percentile,
    checks: Object.freeze(checks),
  });
}
