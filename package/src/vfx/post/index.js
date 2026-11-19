import { assert, number, options } from '../../core/validate.js';
import { randomAt, seedValue } from '../../noise/vector.js';
import { toRGBA } from '../../color/space.js';

// Film post-processing on pixel buffers. An image is {width, height, data} where data is a
// Float32Array of RGBA values in [0, 1]. Every operation returns a new image and leaves its
// input alone, so a frame exported twice is identical. Work is bounded by MAX_PIXELS and by the
// largest blur radius. These run on the CPU for frame-by-frame film export, not for live play.

export const MAX_PIXELS = 3840 * 2160;
const MAX_RADIUS = 256;

/** Validate an image and return it. Accepts {width, height, data} with RGBA floats. */
export function image(width, height, data) {
  number(width, 'image width', 1, 16384);
  number(height, 'image height', 1, 16384);
  assert(Number.isInteger(width) && Number.isInteger(height), 'INVALID_IMAGE', 'Image size must be whole pixels.');
  assert(width * height <= MAX_PIXELS, 'RESOURCE_LIMIT', `Images hold at most ${MAX_PIXELS} pixels (3840 x 2160).`);
  const out = data === undefined ? new Float32Array(width * height * 4) : data;
  assert(
    out instanceof Float32Array && out.length === width * height * 4,
    'INVALID_IMAGE',
    'Image data must be a Float32Array of width x height x 4 values.',
  );
  return { width, height, data: out };
}
const checked = (img) => {
  assert(img && typeof img === 'object', 'INVALID_IMAGE', 'Pass an image made with image() or fromRGBA8().');
  return image(img.width, img.height, img.data);
};
const blank = (img) => image(img.width, img.height);
const clone = (img) => image(img.width, img.height, Float32Array.from(img.data));

/** Convert 8-bit RGBA (for example canvas ImageData) to a float image. */
export function fromRGBA8(width, height, bytes) {
  assert(bytes && bytes.length === width * height * 4, 'INVALID_IMAGE', 'Pass width x height x 4 bytes.');
  const img = image(width, height);
  for (let k = 0; k < bytes.length; k++) img.data[k] = bytes[k] / 255;
  return img;
}
/** Convert a float image back to 8-bit RGBA, clamping to [0, 1]. */
export function toRGBA8(img) {
  checked(img);
  const out = new Uint8ClampedArray(img.data.length);
  for (let k = 0; k < out.length; k++) out[k] = Math.round(Math.min(1, Math.max(0, img.data[k])) * 255);
  return out;
}
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const rgb = (c) => toRGBA(c).slice(0, 3);

// Separable box blur, three passes approximate a Gaussian. Running sums keep the cost
// independent of the radius.
function boxPass(src, dst, w, h, r, horizontal) {
  const n = horizontal ? w : h,
    lines = horizontal ? h : w,
    stride = horizontal ? 4 : w * 4,
    lineStride = horizontal ? w * 4 : 4,
    scale = 1 / (2 * r + 1);
  for (let line = 0; line < lines; line++) {
    const base = line * lineStride;
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += src[base + Math.min(n - 1, Math.max(0, k)) * stride + c];
      for (let i = 0; i < n; i++) {
        dst[base + i * stride + c] = sum * scale;
        sum += src[base + Math.min(n - 1, i + r + 1) * stride + c] - src[base + Math.max(0, i - r) * stride + c];
      }
    }
  }
}
/** A Gaussian-like blur of `radius` pixels (three box passes). */
export function blur(img, radius) {
  checked(img);
  number(radius, 'blur radius', 0, MAX_RADIUS);
  const r = Math.round(radius / Math.sqrt(3));
  if (r < 1) return clone(img);
  const { width: w, height: h } = img;
  let a = Float32Array.from(img.data),
    b = new Float32Array(a.length);
  for (let pass = 0; pass < 3; pass++) {
    boxPass(a, b, w, h, r, true);
    boxPass(b, a, w, h, r, false);
  }
  return image(w, h, a);
}

// Variable blur: blend between a few pre-blurred levels by each pixel's blur radius.
function variableBlur(img, radiusAt, maxRadius) {
  const levels = [0, 0.25, 0.5, 1].map((f) => f * maxRadius);
  const blurred = levels.map((r) => (r < 0.5 ? img : blur(img, r)));
  const out = blank(img),
    { width: w, height: h } = img;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const r = Math.min(maxRadius, Math.max(0, radiusAt(x, y)));
      let k = 0;
      while (k < levels.length - 2 && r > levels[k + 1]) k++;
      const t = levels[k + 1] > levels[k] ? Math.min(1, (r - levels[k]) / (levels[k + 1] - levels[k])) : 0;
      const p = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) out.data[p + c] = blurred[k].data[p + c] * (1 - t) + blurred[k + 1].data[p + c] * t;
    }
  return out;
}

/**
 * The tilt-shift miniature lens: one sharp band, blur growing above and below. `center`,
 * `halfWidth`, `falloff` and `maxBlur` are fractions of the frame height, as in the lens pack;
 * `angleDeg` tilts the band. Returns the image and the per-pixel blur (for sharp-only effects).
 */
export function tiltShift(img, spec = {}) {
  checked(img);
  options(spec, ['center', 'halfWidth', 'falloff', 'maxBlur', 'angleDeg', 'kind', 'taps'], 'tiltShift');
  const { width: w, height: h } = img;
  const center = number(spec.center ?? 0.5, 'band center', 0, 1),
    half = number(spec.halfWidth ?? 0.17, 'band half width', 0, 1),
    falloff = number(spec.falloff ?? 0.32, 'band falloff', 1e-4, 2),
    maxBlur = number(spec.maxBlur ?? 0.007, 'max blur', 0, 0.2) * h,
    angle = (number(spec.angleDeg ?? 0, 'band angle', -90, 90) * Math.PI) / 180;
  assert(maxBlur <= MAX_RADIUS, 'RESOURCE_LIMIT', 'The blur radius is larger than 256 pixels at this size.');
  const s = Math.sin(angle),
    c = Math.cos(angle);
  const amount = (x, y) => {
    const d = Math.abs((y / h - center) * c - ((x - w / 2) / h) * s);
    const t = Math.min(1, Math.max(0, (d - half) / falloff));
    return t * t * (3 - 2 * t);
  };
  const coc = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) coc[y * w + x] = amount(x, y);
  return { image: variableBlur(img, (x, y) => coc[y * w + x] * maxBlur, maxBlur), blur: coc };
}

/**
 * Depth of field from a depth buffer (one value per pixel, any unit). Pixels at `focus` stay
 * sharp; blur grows to `maxBlur` (fraction of frame height) at `range` units away.
 */
export function depthOfField(img, depth, spec = {}) {
  checked(img);
  options(spec, ['focus', 'range', 'maxBlur'], 'depthOfField');
  const { width: w, height: h } = img;
  assert(depth && depth.length === w * h, 'INVALID_IMAGE', 'depth needs one value per pixel.');
  const focus = number(spec.focus, 'focus distance', -1e9, 1e9),
    range = number(spec.range ?? 1, 'focus range', 1e-9, 1e9),
    maxBlur = number(spec.maxBlur ?? 0.01, 'max blur', 0, 0.2) * h;
  assert(maxBlur <= MAX_RADIUS, 'RESOURCE_LIMIT', 'The blur radius is larger than 256 pixels at this size.');
  const coc = new Float32Array(w * h);
  for (let k = 0; k < coc.length; k++)
    coc[k] = Math.min(1, Math.abs(number(depth[k], 'depth', -1e12, 1e12) - focus) / range);
  return { image: variableBlur(img, (x, y) => coc[y * w + x] * maxBlur, maxBlur), blur: coc };
}

/**
 * Bloom: light from bright areas spreads into its surroundings. Pixels brighter than `threshold`
 * (or the pixels a `mask` marks, for selective bloom of rivers and screens) are blurred at
 * several sizes and added back with `strength`. `radius` is a fraction of the frame height.
 */
export function bloom(img, spec = {}) {
  checked(img);
  options(spec, ['threshold', 'strength', 'radius', 'mask', 'selective'], 'bloom');
  const { width: w, height: h } = img;
  const threshold = number(spec.threshold ?? 0.85, 'bloom threshold', 0, 10),
    strength = number(spec.strength ?? 0.5, 'bloom strength', 0, 10),
    radius = Math.min(MAX_RADIUS, number(spec.radius ?? 0.5, 'bloom radius', 0, 1) * h * 0.05);
  const mask = spec.mask;
  assert(mask === undefined || mask.length === w * h, 'INVALID_IMAGE', 'A bloom mask needs one value per pixel.');
  const bright = blank(img);
  for (let k = 0, p = 0; k < w * h; k++, p += 4) {
    const d = img.data;
    const l = luma(d[p], d[p + 1], d[p + 2]);
    const m = mask
      ? Math.min(1, Math.max(0, mask[k]))
      : Math.min(1, Math.max(0, (l - threshold) / Math.max(1e-6, 1 - threshold)));
    for (let c = 0; c < 3; c++) bright.data[p + c] = d[p + c] * m;
  }
  const out = clone(img);
  for (const scale of [0.25, 0.5, 1]) {
    const b = blur(bright, radius * scale);
    for (let p = 0; p < out.data.length; p += 4)
      for (let c = 0; c < 3; c++) out.data[p + c] += (b.data[p + c] * strength) / 3;
  }
  return out;
}

/** Halation: a warm glow that film emulsion throws around bright highlights. */
export function halation(img, spec = {}) {
  checked(img);
  options(spec, ['threshold', 'strength', 'radius', 'color'], 'halation');
  const threshold = number(spec.threshold ?? 0.8, 'halation threshold', 0, 10),
    strength = number(spec.strength ?? 0.25, 'halation strength', 0, 10),
    radius = Math.min(MAX_RADIUS, number(spec.radius ?? 0.006, 'halation radius', 0, 0.2) * img.height);
  const tint = rgb(spec.color ?? 'hsla(12, 90%, 55%, 1)');
  const glow = blank(img);
  for (let p = 0; p < img.data.length; p += 4) {
    const l = luma(img.data[p], img.data[p + 1], img.data[p + 2]),
      m = Math.max(0, l - threshold) / Math.max(1e-6, 1 - threshold);
    for (let c = 0; c < 3; c++) glow.data[p + c] = m * tint[c];
  }
  const b = blur(glow, radius),
    out = clone(img);
  for (let p = 0; p < out.data.length; p += 4) for (let c = 0; c < 3; c++) out.data[p + c] += b.data[p + c] * strength;
  return out;
}

/**
 * Light rays (god rays): bright pixels smeared toward a light at `origin` (in pixels), each
 * sample weaker than the last. A radial blur after GPU Gems 3, chapter 13.
 */
export function lightRays(img, spec = {}) {
  checked(img);
  options(spec, ['origin', 'samples', 'density', 'decay', 'weight', 'threshold'], 'lightRays');
  options(spec.origin, ['x', 'y'], 'ray origin');
  const ox = number(spec.origin.x, 'origin x', -1e5, 1e5),
    oy = number(spec.origin.y, 'origin y', -1e5, 1e5);
  const samples = number(spec.samples ?? 48, 'ray samples', 1, 128),
    density = number(spec.density ?? 0.9, 'ray density', 0, 1),
    decay = number(spec.decay ?? 0.95, 'ray decay', 0, 1),
    weight = number(spec.weight ?? 0.04, 'ray weight', 0, 10),
    threshold = number(spec.threshold ?? 0.7, 'ray threshold', 0, 10);
  const { width: w, height: h } = img;
  const src = img.data;
  const bright = new Float32Array(w * h * 3);
  for (let k = 0, p = 0; k < w * h; k++, p += 4) {
    const m = Math.max(0, luma(src[p], src[p + 1], src[p + 2]) - threshold) > 0 ? 1 : 0;
    bright[k * 3] = src[p] * m;
    bright[k * 3 + 1] = src[p + 1] * m;
    bright[k * 3 + 2] = src[p + 2] * m;
  }
  const out = clone(img);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = ((x - ox) * density) / samples,
        dy = ((y - oy) * density) / samples;
      let sx = x,
        sy = y,
        illum = 1,
        r = 0,
        g = 0,
        b = 0;
      for (let s = 0; s < samples; s++) {
        sx -= dx;
        sy -= dy;
        const ix = Math.round(sx),
          iy = Math.round(sy);
        if (ix < 0 || iy < 0 || ix >= w || iy >= h) break;
        const q = (iy * w + ix) * 3;
        r += bright[q] * illum * weight;
        g += bright[q + 1] * illum * weight;
        b += bright[q + 2] * illum * weight;
        illum *= decay;
      }
      const p = (y * w + x) * 4;
      out.data[p] += r;
      out.data[p + 1] += g;
      out.data[p + 2] += b;
    }
  return out;
}

/**
 * Motion blur from a velocity buffer: two values per pixel, the screen motion in pixels during
 * the shutter. Each pixel averages `samples` taps along its own motion.
 */
export function motionBlur(img, velocity, spec = {}) {
  checked(img);
  options(spec, ['samples', 'shutter'], 'motionBlur');
  const { width: w, height: h } = img;
  assert(velocity && velocity.length === w * h * 2, 'INVALID_IMAGE', 'velocity needs two values (x, y) per pixel.');
  const samples = number(spec.samples ?? 8, 'motion samples', 1, 64),
    shutter = number(spec.shutter ?? 0.5, 'shutter fraction', 0, 1);
  const out = blank(img),
    d = img.data;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = y * w + x,
        vx = Math.max(-MAX_RADIUS, Math.min(MAX_RADIUS, velocity[k * 2] * shutter)),
        vy = Math.max(-MAX_RADIUS, Math.min(MAX_RADIUS, velocity[k * 2 + 1] * shutter));
      const acc = [0, 0, 0, 0];
      for (let s = 0; s < samples; s++) {
        const t = samples === 1 ? 0 : s / (samples - 1) - 0.5;
        const ix = Math.min(w - 1, Math.max(0, Math.round(x + vx * t))),
          iy = Math.min(h - 1, Math.max(0, Math.round(y + vy * t)));
        const q = (iy * w + ix) * 4;
        for (let c = 0; c < 4; c++) acc[c] += d[q + c];
      }
      for (let c = 0; c < 4; c++) out.data[k * 4 + c] = acc[c] / samples;
    }
  return out;
}

function bilinear(d, w, h, x, y, c) {
  const x0 = Math.min(w - 1, Math.max(0, Math.floor(x))),
    y0 = Math.min(h - 1, Math.max(0, Math.floor(y)));
  const x1 = Math.min(w - 1, x0 + 1),
    y1 = Math.min(h - 1, y0 + 1),
    a = Math.min(1, Math.max(0, x - x0)),
    b = Math.min(1, Math.max(0, y - y0));
  return (
    (d[(y0 * w + x0) * 4 + c] * (1 - a) + d[(y0 * w + x1) * 4 + c] * a) * (1 - b) +
    (d[(y1 * w + x0) * 4 + c] * (1 - a) + d[(y1 * w + x1) * 4 + c] * a) * b
  );
}

/** Barrel (positive k1) or pincushion (negative k1) lens distortion around the frame centre. */
export function lensDistortion(img, spec = {}) {
  checked(img);
  options(spec, ['k1', 'k2', 'zoom'], 'lensDistortion');
  const k1 = number(spec.k1 ?? 0.05, 'k1', -1, 1),
    k2 = number(spec.k2 ?? 0, 'k2', -1, 1),
    zoom = number(spec.zoom ?? 1, 'zoom', 0.25, 4);
  const { width: w, height: h } = img,
    out = blank(img),
    norm = Math.hypot(w, h) / 2;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const nx = (x - w / 2) / norm / zoom,
        ny = (y - h / 2) / norm / zoom,
        r2 = nx * nx + ny * ny,
        f = 1 + k1 * r2 + k2 * r2 * r2;
      const sx = w / 2 + nx * f * norm,
        sy = h / 2 + ny * f * norm,
        p = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) out.data[p + c] = bilinear(img.data, w, h, sx, sy, c);
    }
  return out;
}

/**
 * Chromatic aberration: red and blue pulled apart toward the frame edge by `amount` (a fraction
 * of the frame diagonal). Give `blur` (per-pixel 0..1, as returned by tiltShift) to apply it only
 * where the image is sharp, so blurred areas do not turn green.
 */
export function chromaticAberration(img, spec = {}) {
  checked(img);
  options(spec, ['amount', 'blur'], 'chromaticAberration');
  const amount = number(spec.amount ?? 0.0006, 'aberration amount', 0, 0.05);
  const { width: w, height: h } = img,
    coc = spec.blur;
  assert(coc === undefined || coc.length === w * h, 'INVALID_IMAGE', 'blur needs one value per pixel.');
  const out = clone(img),
    diag = Math.hypot(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const k = y * w + x,
        sharp = coc ? 1 - Math.min(1, Math.max(0, coc[k])) : 1;
      if (sharp <= 0) continue;
      const dx = x - w / 2,
        dy = y - h / 2,
        s = amount * diag * sharp,
        l = Math.hypot(dx, dy) / (diag / 2) || 0;
      const ux = l ? (dx / Math.hypot(dx, dy)) * s * l : 0,
        uy = l ? (dy / Math.hypot(dx, dy)) * s * l : 0;
      out.data[k * 4] = bilinear(img.data, w, h, x + ux, y + uy, 0);
      out.data[k * 4 + 2] = bilinear(img.data, w, h, x - ux, y - uy, 2);
    }
  return out;
}

/** Darken toward the corners. `roundness` 1 is a circle, lower follows the frame's shape. */
export function vignette(img, spec = {}) {
  checked(img);
  options(spec, ['amount', 'softness', 'roundness'], 'vignette');
  const amount = number(spec.amount ?? 0.28, 'vignette amount', 0, 1),
    soft = number(spec.softness ?? 0.55, 'vignette softness', 0.01, 2),
    round = number(spec.roundness ?? 0.8, 'vignette roundness', 0, 1);
  const { width: w, height: h } = img,
    out = clone(img),
    aspect = w / h;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const nx = (x / (w - 1 || 1) - 0.5) * 2 * (round * aspect + (1 - round)) * (1 / Math.max(aspect, 1) ** round),
        ny = (y / (h - 1 || 1) - 0.5) * 2;
      const d = Math.hypot(nx, ny) / Math.SQRT2;
      const t = Math.min(1, Math.max(0, (d - (1 - soft)) / soft)),
        f = 1 - amount * t * t * (3 - 2 * t);
      const p = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) out.data[p + c] *= f;
    }
  return out;
}

/**
 * The colour grade from a cinematic-look pack: split tone (a colour mixed into shadows and another
 * into highlights), saturation and contrast. Vignette, grain and aberration have their own steps.
 */
export function grade(img, spec = {}) {
  checked(img);
  options(spec, ['splitTone', 'saturation', 'contrast', 'exposure'], 'grade');
  const sat = number(spec.saturation ?? 1, 'saturation', 0, 4),
    con = number(spec.contrast ?? 1, 'contrast', 0, 4),
    gain = 2 ** number(spec.exposure ?? 0, 'exposure', -8, 8);
  let st = null;
  if (spec.splitTone) {
    options(spec.splitTone, ['shadows', 'shadowAmount', 'highlights', 'highlightAmount', 'balance'], 'split tone');
    const s = rgb(spec.splitTone.shadows ?? '#808080'),
      hgt = rgb(spec.splitTone.highlights ?? '#808080');
    const norm = (c) => {
      const l = luma(...c) || 1;
      return c.map((v) => v / l);
    };
    st = {
      s: norm(s),
      h: norm(hgt),
      sa: number(spec.splitTone.shadowAmount ?? 0.1, 'shadow amount', 0, 1),
      ha: number(spec.splitTone.highlightAmount ?? 0.1, 'highlight amount', 0, 1),
      balance: number(spec.splitTone.balance ?? 0, 'balance', -1, 1),
    };
  }
  const out = clone(img),
    d = out.data;
  for (let p = 0; p < d.length; p += 4) {
    let r = d[p] * gain,
      g = d[p + 1] * gain,
      b = d[p + 2] * gain;
    r = (r - 0.5) * con + 0.5;
    g = (g - 0.5) * con + 0.5;
    b = (b - 0.5) * con + 0.5;
    const l = luma(r, g, b);
    r = l + (r - l) * sat;
    g = l + (g - l) * sat;
    b = l + (b - l) * sat;
    if (st) {
      const pivot = 0.5 + st.balance * 0.25,
        lt = Math.min(1, Math.max(0, luma(r, g, b)));
      const ws = lt < pivot ? (1 - lt / pivot) * st.sa : 0,
        wh = lt > pivot ? ((lt - pivot) / (1 - pivot)) * st.ha : 0;
      r = r * (1 - ws - wh) + r * st.s[0] * ws + r * st.h[0] * wh;
      g = g * (1 - ws - wh) + g * st.s[1] * ws + g * st.h[1] * wh;
      b = b * (1 - ws - wh) + b * st.s[2] * ws + b * st.h[2] * wh;
    }
    d[p] = r;
    d[p + 1] = g;
    d[p + 2] = b;
  }
  return out;
}

/**
 * Film grain: seeded per-pixel noise, strongest in the midtones. Change `frame` every frame so
 * the grain moves; the same seed and frame always give the same grain.
 */
export function grain(img, spec = {}) {
  checked(img);
  options(spec, ['amount', 'size', 'seed', 'frame'], 'grain');
  const amount = number(spec.amount ?? 0.025, 'grain amount', 0, 1),
    size = number(spec.size ?? 1, 'grain size', 1, 8),
    seed = seedValue(spec.seed ?? 7),
    frame = number(spec.frame ?? 0, 'grain frame', 0, 1e7);
  assert(Number.isInteger(frame), 'INVALID_NUMBER', 'grain frame must be a whole number.');
  const { width: w, height: h } = img,
    out = clone(img);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const gx = Math.floor(x / size),
        gy = Math.floor(y / size);
      const n =
        randomAt((seed + frame * 0x9e37) >>> 0, gy * 65536 + gx, 0) +
        randomAt((seed + frame * 0x9e37) >>> 0, gy * 65536 + gx, 1) -
        1;
      const p = (y * w + x) * 4,
        l = Math.min(1, Math.max(0, luma(out.data[p], out.data[p + 1], out.data[p + 2]))),
        k = amount * n * 4 * l * (1 - l);
      for (let c = 0; c < 3; c++) out.data[p + c] += k;
    }
  return out;
}

/**
 * The finishing chain from the look pack, in its intended order: lens blur, bloom, grade,
 * vignette, sharp-only aberration, then grain. `lens` and `look` take the pack JSON objects.
 */
export function finishFrame(img, spec = {}) {
  checked(img);
  options(spec, ['lens', 'look', 'frame', 'seed', 'bloomMask'], 'finishFrame');
  let current = img,
    coc;
  const lens = spec.lens ?? null,
    look = spec.look ?? null;
  if (lens?.interactive?.kind === 'band') {
    const { center, halfWidth, falloff, maxBlur, angleDeg } = lens.interactive;
    const r = tiltShift(current, { center, halfWidth, falloff, maxBlur, angleDeg });
    current = r.image;
    coc = r.blur;
  }
  if (lens?.bloom) {
    const { threshold, strength, radius } = lens.bloom;
    current = bloom(current, { threshold, strength, radius, ...(spec.bloomMask ? { mask: spec.bloomMask } : {}) });
  }
  if (look) {
    current = grade(current, { splitTone: look.splitTone, saturation: look.saturation, contrast: look.contrast });
    if (look.vignette)
      current = vignette(current, {
        amount: look.vignette.amount,
        softness: look.vignette.softness,
        roundness: look.vignette.roundness,
      });
    if (look.chromaticAberration)
      current = chromaticAberration(current, { amount: look.chromaticAberration, ...(coc ? { blur: coc } : {}) });
    if (look.grain)
      current = grain(current, {
        amount: look.grain.amount,
        size: Math.max(1, look.grain.size ?? 1),
        seed: spec.seed ?? 7,
        frame: spec.frame ?? 0,
      });
  }
  return current;
}
