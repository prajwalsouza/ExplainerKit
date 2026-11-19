import { assert, number, options } from '../core/validate.js';

// A bounded reader for single-band GeoTIFF elevation tiles, such as the Copernicus DEM. It reads
// strips or tiles, uncompressed or compressed with DEFLATE or TIFF LZW, with no predictor, horizontal
// differencing or the floating-point predictor, and returns the samples with their bounds.
// DEFLATE decompression is asynchronous and comes from the caller or the platform.
//
// Work is bounded three ways: the file is at most MAX_BYTES, the image at most `maxSamples`
// samples, and every block decompresses to at most the bytes its size needs. The platform
// decompressor stops reading as soon as it has that many bytes, so a small block that would
// expand to gigabytes costs no more than a correct one.

const MAX_BYTES = 256 * 1024 * 1024;
const MAX_SAMPLES = 64 * 1024 * 1024;
const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 16: 8 };

async function platformInflate(bytes, maxBytes) {
  const Stream = globalThis.DecompressionStream;
  assert(
    typeof Stream === 'function',
    'INFLATE_UNAVAILABLE',
    'Pass inflate: async (bytes, maxBytes) => bytes, because this platform has no DecompressionStream.',
  );
  const reader = new Blob([bytes]).stream().pipeThrough(new Stream('deflate')).getReader();
  const out = new Uint8Array(maxBytes);
  let used = 0;
  try {
    while (used < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      const take = Math.min(value.length, maxBytes - used);
      out.set(value.subarray(0, take), used);
      used += take;
    }
  } catch {
    assert(false, 'INVALID_TIFF', 'A compressed block is not valid DEFLATE data.');
  } finally {
    reader.cancel().catch(() => {});
  }
  return out.subarray(0, used);
}

function tiffLzw(bytes, size, { prefix, suffix, stack }) {
  // TIFF 6.0 LZW uses high-bit-first codes, grows its code width one code early, and
  // restarts at nine bits on Clear. Each block has its own dictionary.
  const output = new Uint8Array(size);
  let bits = 0;
  let bitCount = 0;
  let width = 9;
  let next = 258;
  let previous = -1;
  let offset = 0;
  let written = 0;
  // Even a stream of only Clear codes cannot reread arbitrarily many input bytes for a tile.
  let remaining = size * 3 + 8;
  while (written < size) {
    assert(--remaining >= 0, 'RESOURCE_LIMIT', 'An LZW block exceeds its decoding work limit.');
    while (bitCount < width && offset < bytes.length) {
      bits = (bits << 8) | bytes[offset++];
      bitCount += 8;
    }
    if (bitCount < width) break;
    bitCount -= width;
    const code = (bits >>> bitCount) & ((1 << width) - 1);
    if (code === 257) break;
    if (code === 256) {
      width = 9;
      next = 258;
      previous = -1;
      continue;
    }
    assert(code < next || (code === next && previous >= 0), 'INVALID_TIFF', 'An LZW block has an invalid code.');
    // The only code that can be read before entering the dictionary is the previous
    // string followed by its first byte.
    const repeatFirst = code === next;
    let word = repeatFirst ? previous : code;
    let depth = 0;
    while (word >= 258) {
      stack[depth++] = suffix[word];
      word = prefix[word];
    }
    assert(written + depth + 1 + Number(repeatFirst) <= size, 'INVALID_TIFF', 'An LZW block expands past its size.');
    output[written++] = word;
    while (depth) output[written++] = stack[--depth];
    if (repeatFirst) output[written++] = word;
    if (previous >= 0 && next < 4096) {
      prefix[next] = previous;
      suffix[next] = word;
      next++;
      if (width < 12 && next === (1 << width) - 1) width++;
    }
    previous = code;
  }
  return output.subarray(0, written);
}

function pointPixels(directory) {
  if (directory?.type !== 3 || directory.n < 4) return false;
  const end = Math.min(directory.n, 4 + directory.read(3) * 4);
  for (let i = 4; i + 3 < end; i += 4) {
    if (directory.read(i) === 1025 && directory.read(i + 1) === 0 && directory.read(i + 2) === 1)
      return directory.read(i + 3) === 2;
  }
  return false;
}

/**
 * Read a GeoTIFF elevation tile. `bytes` is a Uint8Array or ArrayBuffer of the whole file.
 * Returns {width, height, values (Float32Array, row 0 north), bounds {west, south, east, north}
 * in the file's coordinate system, noData}. Invalid or unsupported files are refused by name.
 *
 * `inflate(bytes, maxBytes)` may be passed to decompress DEFLATE blocks where the platform has
 * no DecompressionStream. It receives the most bytes the block may need and should stop there.
 * Any extra bytes it returns are ignored.
 */
export async function readGeoTIFF(bytes, spec = {}) {
  options(spec, ['inflate', 'maxSamples'], 'readGeoTIFF');
  const data = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  assert(
    data instanceof Uint8Array && data.length >= 8 && data.length <= MAX_BYTES,
    'INVALID_TIFF',
    `Pass the file as bytes, at most ${MAX_BYTES} of them.`,
  );
  const maxSamples = number(spec.maxSamples ?? MAX_SAMPLES, 'max samples', 1, MAX_SAMPLES);
  const inflate = spec.inflate ?? platformInflate;
  assert(typeof inflate === 'function', 'INVALID_TIFF', 'inflate must be an async function.');
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const order = String.fromCharCode(data[0], data[1]);
  assert(order === 'II' || order === 'MM', 'INVALID_TIFF', 'This is not a TIFF file.');
  const le = order === 'II';
  const u16 = (o) => {
    assert(o >= 0 && o + 2 <= data.length, 'INVALID_TIFF', 'The file ends inside a header.');
    return view.getUint16(o, le);
  };
  const u32 = (o) => {
    assert(o >= 0 && o + 4 <= data.length, 'INVALID_TIFF', 'The file ends inside a header.');
    return view.getUint32(o, le);
  };
  assert(u16(2) === 42, 'INVALID_TIFF', 'BigTIFF and other variants are not supported.');
  const ifd = u32(4);
  const count = u16(ifd);
  assert(count > 0 && count < 500, 'INVALID_TIFF', 'The image directory is malformed.');
  const tags = new Map();
  for (let k = 0; k < count; k++) {
    const e = ifd + 2 + k * 12,
      tag = u16(e),
      type = u16(e + 2),
      n = u32(e + 4);
    const size = (TYPE_SIZE[type] ?? 0) * n;
    assert(size <= 64 * 1024 * 1024, 'INVALID_TIFF', 'A header value is too large.');
    const at = size <= 4 ? e + 8 : u32(e + 8);
    assert(at + size <= data.length, 'INVALID_TIFF', 'A header value points outside the file.');
    const read = (i) => {
      const o = at + i * (TYPE_SIZE[type] ?? 1);
      if (type === 3 || type === 8) return view.getUint16(o, le);
      if (type === 4 || type === 9) return view.getUint32(o, le);
      if (type === 12) return view.getFloat64(o, le);
      if (type === 11) return view.getFloat32(o, le);
      return data[o];
    };
    tags.set(tag, { type, n, at, read, all: () => Array.from({ length: Math.min(n, 1_000_000) }, (_, i) => read(i)) });
  }
  const one = (tag, fallback) => (tags.has(tag) ? tags.get(tag).read(0) : fallback);
  const width = one(256),
    height = one(257);
  assert(
    Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0,
    'INVALID_TIFF',
    'The image has no size.',
  );
  assert(
    width * height <= maxSamples,
    'RESOURCE_LIMIT',
    `The image has ${width * height} samples, more than ${maxSamples}.`,
  );
  assert(one(277, 1) === 1, 'TIFF_UNSUPPORTED', 'Only single-band elevation images are supported.');
  const bits = one(258, 1),
    format = one(339, 1),
    compression = one(259, 1),
    predictor = one(317, 1);
  const kind = `${format}:${bits}`;
  assert(
    ['3:32', '2:16', '1:16', '2:32'].includes(kind),
    'TIFF_UNSUPPORTED',
    `Samples of format ${format} and ${bits} bits are not supported.`,
  );
  assert(
    [1, 5, 8, 32946].includes(compression),
    'TIFF_UNSUPPORTED',
    `Compression ${compression} is not supported. Use uncompressed, LZW, or DEFLATE files.`,
  );
  assert([1, 2, 3].includes(predictor), 'TIFF_UNSUPPORTED', `Predictor ${predictor} is not supported.`);
  assert(predictor !== 3 || format === 3, 'INVALID_TIFF', 'The floating-point predictor needs floating-point samples.');
  assert(predictor !== 2 || format !== 3, 'INVALID_TIFF', 'Horizontal differencing needs integer samples.');
  const bps = bits / 8;
  const tiled = tags.has(322);
  assert(!tiled || tags.has(323), 'INVALID_TIFF', 'A tiled image needs both tile width and tile length.');
  const blockW = tiled ? one(322) : width,
    blockH = tiled ? one(323) : Math.min(one(278, height), height);
  assert(
    Number.isInteger(blockW) &&
      Number.isInteger(blockH) &&
      blockW > 0 &&
      blockH > 0 &&
      blockW * blockH <= 16 * 1024 * 1024,
    'INVALID_TIFF',
    'The block size is malformed.',
  );
  const offsets = tags.get(tiled ? 324 : 273)?.all() ?? [],
    lengths = tags.get(tiled ? 325 : 279)?.all() ?? [];
  const across = Math.ceil(width / blockW),
    down = Math.ceil(height / blockH);
  assert(
    offsets.length === across * down && lengths.length === offsets.length,
    'INVALID_TIFF',
    'The block table does not match the image size.',
  );
  // Tiles may overhang the image edge. Refuse padding that would decode far more than the image.
  assert(
    across * down * blockW * blockH <= 2 * maxSamples,
    'RESOURCE_LIMIT',
    'The image blocks would decode far more samples than the image holds.',
  );

  const values = new Float32Array(width * height);
  const scratch = new DataView(new ArrayBuffer(4));
  const lzw =
    compression === 5
      ? { prefix: new Uint16Array(4096), suffix: new Uint8Array(4096), stack: new Uint8Array(4096) }
      : null;
  for (let b = 0; b < offsets.length; b++) {
    const start = offsets[b],
      length = lengths[b];
    assert(start + length <= data.length, 'INVALID_TIFF', 'A block points outside the file.');
    assert(
      Number.isInteger(start) && Number.isInteger(length),
      'INVALID_TIFF',
      'A block offset or length is not a whole number.',
    );
    const rowsHere = tiled ? blockH : Math.min(blockH, height - Math.floor(b / across) * blockH);
    const need = blockW * rowsHere * bps;
    let raw = data.subarray(start, start + length);
    if (lzw) raw = tiffLzw(raw, need, lzw);
    else if (compression !== 1) {
      raw = await inflate(raw, need);
      assert(raw instanceof Uint8Array, 'INVALID_TIFF', 'inflate must resolve to a Uint8Array.');
    }
    assert(raw.length >= need, 'INVALID_TIFF', 'A block decompressed to fewer bytes than its size.');
    const block = new Uint8Array(raw.slice(0, need));
    const bv = new DataView(block.buffer);
    const bx = (b % across) * blockW,
      by = Math.floor(b / across) * blockH;
    for (let r = 0; r < rowsHere; r++) {
      const y = by + r;
      const rowStart = r * blockW * bps;
      if (predictor === 3) {
        // The floating-point predictor differences bytes along the row, then stores each
        // sample's bytes in separate planes, most significant first.
        const row = block.subarray(rowStart, rowStart + blockW * bps);
        for (let i = 1; i < row.length; i++) row[i] = (row[i] + row[i - 1]) & 0xff;
        for (let i = 0; i < blockW; i++) {
          const x = bx + i;
          if (x >= width || y >= height) continue;
          const b0 = row[i],
            b1 = row[blockW + i],
            b2 = row[2 * blockW + i],
            b3 = row[3 * blockW + i];
          scratch.setUint8(0, b0);
          scratch.setUint8(1, b1);
          scratch.setUint8(2, b2);
          scratch.setUint8(3, b3);
          values[y * width + x] = scratch.getFloat32(0, false);
        }
        continue;
      }
      let previous = 0;
      for (let i = 0; i < blockW; i++) {
        const o = rowStart + i * bps;
        let v =
          kind === '3:32'
            ? bv.getFloat32(o, le)
            : kind === '2:16'
              ? bv.getInt16(o, le)
              : kind === '1:16'
                ? bv.getUint16(o, le)
                : bv.getInt32(o, le);
        if (predictor === 2) {
          v =
            kind === '2:16'
              ? ((v + previous) << 16) >> 16
              : kind === '1:16'
                ? (v + previous) & 0xffff
                : (v + previous) | 0;
          previous = v;
        }
        const x = bx + i;
        if (x < width && y < height) values[y * width + x] = v;
      }
    }
  }

  // Georeferencing: pixel scale and one tie point give the bounds of a north-up image.
  let bounds = null;
  if (tags.has(33550) && tags.has(33922)) {
    const [sx, sy] = tags.get(33550).all(),
      tie = tags.get(33922).all();
    assert(
      tie.length >= 6 && [sx, sy, ...tie.slice(0, 6)].every(Number.isFinite) && sx > 0 && sy > 0,
      'INVALID_TIFF',
      'The pixel scale or tie point is malformed.',
    );
    // RasterPixelIsPoint references the pixel center. Return outer pixel edges in both cases.
    const shift = pointPixels(tags.get(34735)) ? 0.5 : 0;
    const west = tie[3] - (tie[0] + shift) * sx,
      north = tie[4] + (tie[1] + shift) * sy;
    bounds = Object.freeze({
      west,
      north,
      east: west + width * sx,
      south: north - height * sy,
      pixel: Object.freeze({ x: sx, y: sy }),
    });
  }
  let noData = null;
  if (tags.has(42113)) {
    const t = tags.get(42113);
    const text = String.fromCharCode(...data.subarray(t.at, t.at + Math.min(t.n, 64)))
      .replace(/\0/g, '')
      .trim();
    if (text && Number.isFinite(Number(text))) noData = Number(text);
  }
  return Object.freeze({ width, height, values, bounds, noData });
}
