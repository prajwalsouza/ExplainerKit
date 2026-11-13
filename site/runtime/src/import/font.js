import { assert, number, options, text, safeCopy, KitError } from '../core/validate.js';
import { validateProperty } from '../core/geometry.js';

const fonts = new WeakMap(),
  MAX_BYTES = 16_000_000;
function fail(test, message, code = 'FONT_INVALID') {
  assert(test, code, message);
}
function bytes(value) {
  const input =
    value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : ArrayBuffer.isView(value)
        ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
        : null;
  fail(
    input && input.length >= 12 && input.length <= MAX_BYTES,
    'Use a bounded SFNT TrueType byte buffer.',
    'RESOURCE_LIMIT',
  );
  return new Uint8Array(input);
}
/**
 * TrueType variations: avar axis remapping and gvar point deltas with IUP inference for untouched points.
 * deltas(glyph, pointCount, contourEnds, xs, ys, coords) returns x/y deltas for every point plus four phantoms.
 */
function variationTables({ tables, table, inside, u16, i16, u32, view, glyphCount, axisCount, spend }) {
  const result = { gvar: false, avar: null, deltas: null };
  if (!axisCount) return result;
  const f2 = (o) => i16(o) / 16384;
  if (tables.has('avar')) {
    const t = table('avar', 8),
      count = u16(t.offset + 6);
    let o = t.offset + 8;
    result.avar = [];
    for (let a = 0; a < Math.min(count, axisCount); a++) {
      const n = u16(inside(t, o, 2));
      o += 2;
      inside(t, o, n * 4);
      const map = Array.from({ length: n }, (_, i) => [f2(o + i * 4), f2(o + i * 4 + 2)]);
      o += n * 4;
      result.avar.push((v) => {
        if (map.length < 2) return v;
        for (let i = 1; i < map.length; i++) {
          const [x0, y0] = map[i - 1],
            [x1, y1] = map[i];
          if (v <= x1) return x1 === x0 ? y1 : y0 + ((v - x0) * (y1 - y0)) / (x1 - x0);
        }
        return map.at(-1)[1];
      });
    }
  }
  if (!tables.has('gvar')) return result;
  const t = table('gvar', 20),
    axes = u16(t.offset + 4),
    sharedCount = u16(t.offset + 6),
    sharedOffset = t.offset + u32(t.offset + 8),
    count = u16(t.offset + 12),
    long = u16(t.offset + 14) & 1,
    dataStart = t.offset + u32(t.offset + 16);
  if (axes !== axisCount || count !== glyphCount)
    throw new KitError('FONT_INVALID', 'gvar does not match the font axes or glyph count.');
  inside(t, sharedOffset, sharedCount * axes * 2);
  inside(t, t.offset + 20, (count + 1) * (long ? 4 : 2));
  const shared = Array.from({ length: sharedCount }, (_, i) =>
    Array.from({ length: axes }, (local_1, a) => f2(sharedOffset + (i * axes + a) * 2)),
  );
  const glyphOffset = (i) => (long ? u32(t.offset + 20 + i * 4) : u16(t.offset + 20 + i * 2) * 2);
  fail(
    dataStart >= t.offset + 20 + (count + 1) * (long ? 4 : 2) && dataStart <= t.offset + t.length,
    'Invalid gvar data offset.',
  );
  let previousOffset = 0;
  for (let i = 0; i <= count; i++) {
    const next = glyphOffset(i);
    fail(next >= previousOffset && dataStart + next <= t.offset + t.length, 'Invalid gvar glyph offsets.');
    previousOffset = next;
  }
  const within = (o, n, limit) => {
    inside(t, o, n);
    fail(o + n <= limit, 'Read exceeds gvar glyph or tuple bounds.');
    return o;
  };
  function points(o, limit, end) {
    let n = view.getUint8(within(o, 1, end));
    o++;
    if (n === 0) return { all: true, o };
    if (n & 0x80) {
      n = ((n & 0x7f) << 8) | view.getUint8(within(o, 1, end));
      o++;
    }
    fail(n <= limit, 'Too many gvar point indices.');
    const list = [];
    let last = 0;
    while (list.length < n) {
      const c = view.getUint8(within(o, 1, end));
      o++;
      const run = (c & 0x7f) + 1,
        words = c & 0x80;
      fail(list.length + run <= n, 'gvar point run exceeds its declared count.');
      for (let i = 0; i < run; i++) {
        within(o, words ? 2 : 1, end);
        last += words ? u16(o) : view.getUint8(o);
        o += words ? 2 : 1;
        if (last >= limit) throw new KitError('FONT_INVALID', 'gvar point number out of range.');
        list.push(last);
      }
    }
    return { all: false, list, o };
  }
  function packed(o, n, end) {
    const out = [];
    while (out.length < n) {
      const c = view.getUint8(within(o, 1, end));
      o++;
      const run = (c & 0x3f) + 1;
      fail(out.length + run <= n, 'gvar delta run exceeds its declared count.');
      for (let i = 0; i < run; i++) {
        if (c & 0x80) out.push(0);
        else if (c & 0x40) {
          within(o, 2, end);
          out.push(i16(o));
          o += 2;
        } else {
          out.push(view.getInt8(within(o, 1, end)));
          o++;
        }
      }
    }
    return { values: out, o };
  }
  function scalar(peak, start, end, coords) {
    let s = 1;
    for (let a = 0; a < axes; a++) {
      const p = peak[a],
        v = coords[a];
      if (p === 0) continue;
      const lo = start ? start[a] : Math.min(0, p),
        hi = end ? end[a] : Math.max(0, p);
      if (v < lo || v > hi || (v === 0 && !start)) return 0;
      if (v === p) continue;
      if (start && (lo > p || p > hi || (lo < 0 && hi > 0))) continue;
      s *= v < p ? (v - lo) / (p - lo) : (hi - v) / (hi - p);
    }
    return s;
  }
  // Interpolate untouched points from their touched neighbours, separately in x and y, within each contour.
  function iup(delta, touched, base, ends) {
    let begin = 0;
    for (const stop of ends) {
      const idx = [];
      for (let i = begin; i <= stop; i++) if (touched[i]) idx.push(i);
      if (idx.length === 1) {
        for (let i = begin; i <= stop; i++) if (!touched[i]) delta[i] = delta[idx[0]];
      } else if (idx.length > 1)
        for (let k = 0; k < idx.length; k++) {
          const a = idx[k],
            b = idx[(k + 1) % idx.length];
          for (let i = a + 1; ; i++) {
            if (i > stop) i = begin;
            if (i === b) break;
            const ca = base[a],
              cb = base[b],
              c = base[i];
            if (ca === cb) delta[i] = delta[a] === delta[b] ? delta[a] : 0;
            else if (c <= Math.min(ca, cb)) delta[i] = ca < cb ? delta[a] : delta[b];
            else if (c >= Math.max(ca, cb)) delta[i] = ca > cb ? delta[a] : delta[b];
            else delta[i] = delta[a] + ((c - ca) * (delta[b] - delta[a])) / (cb - ca);
          }
        }
      begin = stop + 1;
    }
  }
  result.gvar = true;
  result.deltas = (glyph, n, ends, xs, ys, coords) => {
    const total = n + 4,
      start = glyphOffset(glyph),
      stop = glyphOffset(glyph + 1),
      end = dataStart + stop;
    spend(total * 2);
    const dx = new Float64Array(total),
      dy = new Float64Array(total);
    if (stop === start) return { x: dx, y: dy };
    const base = dataStart + start;
    within(base, 4, end);
    const header = u16(base),
      tuples = header & 0x0fff,
      serialized = base + u16(base + 2);
    fail(serialized >= base + 4 && serialized <= end, 'Invalid gvar tuple data offset.');
    // Charge all potential decoding, interpolation and allocation work before entering attacker-controlled loops.
    spend(tuples * (total * 6 + axes * 3 + 1));
    let serial = serialized,
      o = base + 4,
      sharedPoints = { all: true };
    if (header & 0x8000) {
      const p = points(serial, total, end);
      sharedPoints = p;
      serial = p.o;
    }
    for (let k = 0; k < tuples; k++) {
      within(o, 4, serialized);
      const size = u16(o),
        index = u16(o + 2);
      o += 4;
      let peak;
      if (index & 0x8000) {
        within(o, axes * 2, serialized);
        peak = Array.from({ length: axes }, (_, a) => f2(o + a * 2));
        o += axes * 2;
      } else {
        peak = shared[index & 0x0fff];
        if (!peak) throw new KitError('FONT_INVALID', 'gvar references a missing shared tuple.');
      }
      let lo = null,
        hi = null;
      if (index & 0x4000) {
        within(o, axes * 4, serialized);
        lo = Array.from({ length: axes }, (_, a) => f2(o + a * 2));
        o += axes * 2;
        hi = Array.from({ length: axes }, (_, a) => f2(o + a * 2));
        o += axes * 2;
      }
      const weight = scalar(peak, lo, hi, coords),
        tupleStart = serial;
      within(serial, size, end);
      serial += size;
      if (weight === 0) continue;
      let q = tupleStart,
        pts = sharedPoints;
      if (index & 0x2000) {
        pts = points(q, total, serial);
        q = pts.o;
      }
      const list = pts.all ? Array.from({ length: total }, (_, i) => i) : pts.list,
        x = packed(q, list.length, serial),
        y = packed(x.o, list.length, serial);
      if (pts.all || !ends) {
        list.forEach((p, i) => {
          dx[p] += weight * x.values[i];
          dy[p] += weight * y.values[i];
        });
        continue;
      }
      const tx = new Float64Array(total),
        ty = new Float64Array(total),
        touched = new Uint8Array(total);
      list.forEach((p, i) => {
        tx[p] += x.values[i];
        ty[p] += y.values[i];
        touched[p] = 1;
      });
      iup(tx, touched, xs, ends);
      iup(ty, touched, ys, ends);
      for (let i = 0; i < total; i++) {
        dx[i] += weight * tx[i];
        dy[i] += weight * ty[i];
      }
    }
    return { x: dx, y: dy };
  };
  return result;
}

/** Horizontal pair kerning from GPOS PairPos (formats 1 and 2, via the kern feature) or the legacy kern table. */
function kerningTables({ tables, table, inside, u16, i16, u32, glyphCount }) {
  const pairs = [],
    coverageCache = new Map(),
    classCache = new Map(),
    seenSubtables = new Set();
  let queryWork = 0;
  const querySpend = () => {
    fail(++queryWork <= 4e6, 'Font kerning queries exceed this outline work budget.', 'RESOURCE_LIMIT');
  };
  const cached = (cache, key, build) => {
    if (!cache.has(key)) cache.set(key, build());
    return cache.get(key);
  };
  const coverage = (t, o) => cached(coverageCache, o, () => buildCoverage(t, o));
  const classes = (t, o) => (!o ? () => 0 : cached(classCache, o, () => buildClasses(t, o)));
  // Counts in these tables are attacker-controlled and multiply (features × lookups × subtables × pairs): one budget for all of it.
  let work = 0;
  const spend = (n) => {
    work += n;
    fail(work <= 4e6, 'Font kerning tables exceed the work budget.', 'RESOURCE_LIMIT');
  };
  function buildCoverage(t, o) {
    inside(t, o, 4);
    const format = u16(o);
    if (format === 1) {
      const n = u16(o + 2);
      inside(t, o + 4, n * 2);
      spend(n);
      const map = new Map();
      for (let i = 0; i < n; i++) map.set(u16(o + 4 + i * 2), i);
      return (g) => map.get(g) ?? -1;
    }
    if (format === 2) {
      const n = u16(o + 2);
      inside(t, o + 4, n * 6);
      spend(n);
      const ranges = Array.from({ length: n }, (_, i) => [u16(o + 4 + i * 6), u16(o + 6 + i * 6), u16(o + 8 + i * 6)]);
      return (g) => {
        for (const [a, b, c] of ranges) {
          querySpend();
          if (g >= a && g <= b) return c + g - a;
        }
        return -1;
      };
    }
    return () => -1;
  }
  function buildClasses(t, o) {
    inside(t, o, 4);
    const format = u16(o);
    if (format === 1) {
      inside(t, o, 6);
      const first = u16(o + 2),
        n = u16(o + 4);
      inside(t, o + 6, n * 2);
      spend(n);
      return (g) => (g >= first && g < first + n ? u16(o + 6 + (g - first) * 2) : 0);
    }
    if (format === 2) {
      const n = u16(o + 2);
      inside(t, o + 4, n * 6);
      spend(n);
      const ranges = Array.from({ length: n }, (_, i) => [u16(o + 4 + i * 6), u16(o + 6 + i * 6), u16(o + 8 + i * 6)]);
      return (g) => {
        for (const [a, b, c] of ranges) {
          querySpend();
          if (g >= a && g <= b) return c;
        }
        return 0;
      };
    }
    return () => 0;
  }
  const valueSize = (f) => {
      let n = 0;
      for (let b = f & 0xff; b; b >>= 1) n += b & 1;
      return n * 2;
    },
    xAdvance = (o, f) => {
      if (!(f & 4)) return 0;
      let skip = 0;
      if (f & 1) skip += 2;
      if (f & 2) skip += 2;
      return i16(o + skip);
    };
  if (tables.has('GPOS')) {
    const t = table('GPOS', 10),
      features = t.offset + u16(t.offset + 6),
      lookups = t.offset + u16(t.offset + 8),
      wanted = new Set();
    inside(t, features, 2);
    inside(t, lookups, 2);
    const lookupCount = u16(lookups);
    inside(t, lookups + 2, lookupCount * 2);
    const featureCount = u16(features),
      seenFeatures = new Set();
    inside(t, features + 2, featureCount * 6);
    for (let i = 0; i < featureCount; i++) {
      spend(1);
      const r = features + 2 + i * 6,
        tag = String.fromCharCode(u16(r) >> 8, u16(r) & 255, u16(r + 2) >> 8, u16(r + 2) & 255);
      if (tag !== 'kern') continue;
      const f = features + u16(r + 4);
      if (seenFeatures.has(f)) continue;
      seenFeatures.add(f);
      inside(t, f, 4);
      const n = u16(f + 2);
      inside(t, f + 4, n * 2);
      spend(n);
      for (let k = 0; k < n; k++) wanted.add(u16(f + 4 + k * 2));
    }
    for (const index of [...wanted].sort((a, b) => a - b)) {
      fail(index < lookupCount, 'GPOS feature references a missing lookup.');
      const lookup = lookups + u16(lookups + 2 + index * 2);
      inside(t, lookup, 6);
      let type = u16(lookup);
      const subtables = u16(lookup + 4);
      inside(t, lookup + 6, subtables * 2);
      spend(subtables);
      for (let k = 0; k < subtables; k++) {
        let sub = lookup + u16(lookup + 6 + k * 2);
        inside(t, sub, 2);
        if (type === 9 || u16(lookup) === 9) {
          inside(t, sub, 8);
          type = u16(sub + 2);
          sub = sub + u32(sub + 4);
        }
        if (type !== 2 || seenSubtables.has(sub)) continue;
        seenSubtables.add(sub);
        spend(1);
        inside(t, sub, 8);
        const format = u16(sub),
          cover = coverage(t, sub + u16(sub + 2)),
          f1 = u16(sub + 4),
          f2 = u16(sub + 6),
          s1 = valueSize(f1),
          s2 = valueSize(f2);
        if (format === 1) {
          inside(t, sub, 10);
          const sets = u16(sub + 8);
          inside(t, sub + 10, sets * 2);
          spend(sets);
          pairs.push((a, b) => {
            const c = cover(a);
            if (c < 0 || c >= sets) return null;
            const set = sub + u16(sub + 10 + c * 2);
            inside(t, set, 2);
            const n = u16(set),
              record = 2 + s1 + s2;
            inside(t, set + 2, n * record);
            let lo = 0,
              hi = n - 1;
            while (lo <= hi) {
              querySpend();
              const m = (lo + hi) >> 1,
                r = set + 2 + m * record,
                g = u16(r);
              if (g === b) return xAdvance(r + 2, f1);
              if (g < b) lo = m + 1;
              else hi = m - 1;
            }
            return null;
          });
        } else if (format === 2) {
          inside(t, sub, 16);
          const c1 = classes(t, sub + u16(sub + 8)),
            c2 = classes(t, sub + u16(sub + 10)),
            n1 = u16(sub + 12),
            n2 = u16(sub + 14),
            record = s1 + s2;
          inside(t, sub + 16, n1 * n2 * record);
          spend(n1 * n2);
          pairs.push((a, b) => {
            if (cover(a) < 0) return null;
            const x = c1(a),
              y = c2(b);
            if (x >= n1 || y >= n2) return null;
            return xAdvance(sub + 16 + (x * n2 + y) * record, f1);
          });
        }
      }
    }
  }
  if (!pairs.length && tables.has('kern')) {
    const t = table('kern', 4),
      version = u16(t.offset),
      n = version === 0 ? u16(t.offset + 2) : 0;
    let o = t.offset + 4;
    const map = new Map();
    for (let i = 0; i < n; i++) {
      inside(t, o, 6);
      const length = u16(o + 2),
        coverageBits = u16(o + 4);
      fail(length >= 14, 'Invalid kern subtable length.');
      inside(t, o, length);
      spend(1);
      if (coverageBits >> 8 === 0 && coverageBits & 1) {
        const count = u16(o + 6);
        inside(t, o + 14, count * 6);
        spend(count);
        for (let k = 0; k < count; k++) {
          const r = o + 14 + k * 6;
          map.set(u16(r) * 65536 + u16(r + 2), i16(r + 4));
        }
      }
      o += length;
    }
    if (map.size) pairs.push((a, b) => map.get(a * 65536 + b) ?? null);
  }
  return {
    available: pairs.length > 0,
    begin: () => {
      queryWork = 0;
    },
    pair: (a, b) => {
      if (a >= glyphCount || b >= glyphCount) return 0;
      for (const lookup of pairs) {
        querySpend();
        const v = lookup(a, b);
        if (v !== null) return v;
      }
      return 0;
    },
  };
}

/** Parse SFNT/glyf TrueType outlines directly. No font engine or hint execution. */
export function parseFont(input) {
  const data = bytes(input),
    view = new DataView(data.buffer),
    u16 = (o) => {
      fail(o >= 0 && o + 2 <= data.length, 'Truncated font table.');
      return view.getUint16(o);
    },
    i16 = (o) => {
      fail(o >= 0 && o + 2 <= data.length, 'Truncated font table.');
      return view.getInt16(o);
    },
    u32 = (o) => {
      fail(o >= 0 && o + 4 <= data.length, 'Truncated font table.');
      return view.getUint32(o);
    };
  fail(u32(0) !== 0x774f4646, 'WOFF needs decompression; load it with loadFont().', 'FONT_FORMAT_UNSUPPORTED');
  fail(
    u32(0) === 0x00010000 || u32(0) === 0x74727565,
    'Only TrueType (glyf) outlines are supported. CFF/OTF and WOFF2 fonts need converting to TTF or WOFF first.',
    'FONT_FORMAT_UNSUPPORTED',
  );
  const count = u16(4),
    tables = new Map();
  fail(count > 0 && count <= 128 && 12 + count * 16 <= data.length, 'Invalid font directory.');
  for (let i = 0; i < count; i++) {
    const p = 12 + i * 16,
      tag = String.fromCharCode(...data.slice(p, p + 4)),
      offset = u32(p + 8),
      length = u32(p + 12);
    fail(!tables.has(tag) && offset + length <= data.length, 'Duplicate or out-of-bounds font table.');
    tables.set(tag, { offset, length });
  }
  function table(tag, min) {
    const entry = tables.get(tag);
    fail(entry && entry.length >= min, `Missing/short ${tag} table.`);
    return entry;
  }
  function inside(t, o, n) {
    fail(o >= t.offset && o + n <= t.offset + t.length, 'Read exceeds font table bounds.');
    return o;
  }
  const head = table('head', 54),
    maxp = table('maxp', 6),
    hhea = table('hhea', 36),
    glyphCount = u16(maxp.offset + 4),
    unitsPerEm = u16(head.offset + 18),
    locFormat = i16(head.offset + 50),
    metrics = u16(hhea.offset + 34);
  fail(
    glyphCount > 0 &&
      unitsPerEm >= 16 &&
      unitsPerEm <= 16384 &&
      (locFormat === 0 || locFormat === 1) &&
      metrics > 0 &&
      metrics <= glyphCount,
    'Invalid font metrics.',
  );
  const hmtx = table('hmtx', metrics * 4 + (glyphCount - metrics) * 2),
    loca = table('loca', (glyphCount + 1) * (locFormat ? 4 : 2)),
    glyf = table('glyf', 0),
    locations = [];
  for (let i = 0; i <= glyphCount; i++) {
    const offset = locFormat ? u32(loca.offset + i * 4) : u16(loca.offset + i * 2) * 2;
    fail(offset <= glyf.length && (!i || offset >= locations[i - 1]), 'Invalid glyph locations.');
    locations.push(offset);
  }
  const advance = (index) => u16(hmtx.offset + Math.min(index, metrics - 1) * 4),
    cmap = table('cmap', 4),
    records = u16(cmap.offset + 2);
  fail(records > 0 && records <= 128, 'Invalid cmap records.');
  inside(cmap, cmap.offset + 4, records * 8);
  let chosen = null;
  for (let i = 0; i < records; i++) {
    const p = cmap.offset + 4 + i * 8,
      platform = u16(p),
      encoding = u16(p + 2),
      offset = cmap.offset + u32(p + 4);
    inside(cmap, offset, 2);
    const format = u16(offset),
      score =
        (format === 12 ? 20 : format === 4 ? 10 : 0) +
        (platform === 0 ? 2 : platform === 3 && (encoding === 1 || encoding === 10) ? 1 : -100);
    if (score > 0 && (!chosen || score > chosen.score)) chosen = { offset, format, score };
  }
  fail(chosen, 'Use a Unicode format4 or format12 cmap.', 'FONT_FORMAT_UNSUPPORTED');
  let lookup;
  if (chosen.format === 12) {
    const p = chosen.offset;
    inside(cmap, p, 16);
    const length = u32(p + 4),
      n = u32(p + 12);
    fail(length >= 16 + n * 12 && n <= 65536, 'Invalid format12 cmap.');
    inside(cmap, p, length);
    const groups = [];
    let previous = -1;
    for (let i = 0; i < n; i++) {
      const q = p + 16 + i * 12,
        start = u32(q),
        end = u32(q + 4),
        localGlyph2 = u32(q + 8);
      fail(
        start > previous && end >= start && end <= 0x10ffff && localGlyph2 + end - start < glyphCount,
        'Invalid cmap group.',
      );
      groups.push({ start, end, glyph: localGlyph2 });
      previous = end;
    }
    lookup = (code) => {
      let lo = 0,
        hi = groups.length - 1;
      while (lo <= hi) {
        const i = (lo + hi) >> 1,
          g = groups[i];
        if (code < g.start) hi = i - 1;
        else if (code > g.end) lo = i + 1;
        else return g.glyph + code - g.start;
      }
      return 0;
    };
  } else {
    const p = chosen.offset;
    inside(cmap, p, 14);
    const length = u16(p + 2),
      n = u16(p + 6) / 2;
    fail(Number.isInteger(n) && n > 0 && n <= 8192 && length >= 16 + 8 * n, 'Invalid format4 cmap.');
    inside(cmap, p, length);
    const end = p + 14,
      start = end + 2 * n + 2,
      delta = start + 2 * n,
      range = delta + 2 * n;
    let previous = -1;
    for (let i = 0; i < n; i++) {
      fail(u16(start + i * 2) <= u16(end + i * 2) && u16(end + i * 2) > previous, 'Invalid cmap segments.');
      previous = u16(end + i * 2);
    }
    lookup = (code) => {
      if (code > 0xffff) return 0;
      let lo = 0,
        hi = n - 1;
      while (lo < hi) {
        const i = (lo + hi) >> 1;
        if (u16(end + i * 2) < code) lo = i + 1;
        else hi = i;
      }
      if (code < u16(start + lo * 2) || code > u16(end + lo * 2)) return 0;
      const r = u16(range + lo * 2);
      let localGlyph3;
      if (r === 0) localGlyph3 = (code + i16(delta + lo * 2)) & 0xffff;
      else {
        const o = range + lo * 2 + r + 2 * (code - u16(start + lo * 2));
        fail(o >= p && o + 2 <= p + length, 'Glyph index exceeds cmap.');
        localGlyph3 = u16(o);
        if (localGlyph3) localGlyph3 = (localGlyph3 + i16(delta + lo * 2)) & 0xffff;
      }
      fail(localGlyph3 < glyphCount, 'cmap references a missing glyph.');
      return localGlyph3;
    };
  }
  const axes = Object.create(null);
  if (tables.has('fvar')) {
    const f = table('fvar', 16),
      axisOffset = u16(f.offset + 4),
      n = u16(f.offset + 8),
      size = u16(f.offset + 10);
    fail(n <= 32 && size >= 20, 'Invalid variation axis table.');
    inside(f, f.offset + axisOffset, n * size);
    for (let i = 0; i < n; i++) {
      const p = f.offset + axisOffset + i * size,
        tag = String.fromCharCode(...data.slice(p, p + 4)),
        fixed = (o) => view.getInt32(o) / 65536;
      fail(!Object.hasOwn(axes, tag), 'Duplicate variation axis.');
      const min = fixed(p + 4),
        value = fixed(p + 8),
        max = fixed(p + 12);
      fail(min <= value && value <= max, 'Invalid variation bounds.');
      axes[tag] = Object.freeze({ min, default: value, max });
    }
  }
  let glyphWork = 0;
  const beginGlyph = () => {
    glyphWork = 0;
  };
  const spendGlyph = (n) => {
    glyphWork += n;
    fail(glyphWork <= 4e6, 'Font outlines exceed the aggregate work budget.', 'RESOURCE_LIMIT');
  };
  const axisTags = Object.keys(axes),
    variations = variationTables({
      tables,
      table,
      inside,
      u16,
      i16,
      u32,
      view,
      data,
      glyphCount,
      axisCount: axisTags.length,
      spend: spendGlyph,
    });
  const kerning = kerningTables({ tables, table, inside, u16, i16, u32, glyphCount });
  /** Normalized, avar-mapped coordinates in axis order, or null at the default instance. */
  function normalize(values) {
    const coords = axisTags
      .map((tag) => {
        const a = axes[tag],
          v = values[tag] ?? a.default;
        return v < a.default
          ? a.default === a.min
            ? 0
            : (v - a.default) / (a.default - a.min)
          : v > a.default
            ? a.max === a.default
              ? 0
              : (v - a.default) / (a.max - a.default)
            : 0;
      })
      .map((v, i) => (variations.avar?.[i] ? variations.avar[i](v) : v));
    return coords.some((v) => v !== 0) ? coords : null;
  }
  const cache = new Map();
  function glyph(index, depth = 0, visiting = new Set(), coords = null) {
    spendGlyph(1);
    fail(Number.isInteger(index) && index >= 0 && index < glyphCount, 'Unknown glyph index.');
    const cacheKey = coords ? `${index}@${coords.join(',')}` : index;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    fail(depth <= 16 && !visiting.has(index), 'Cyclic/deep composite glyph.', 'RESOURCE_LIMIT');
    visiting.add(index);
    const start = glyf.offset + locations[index],
      end = glyf.offset + locations[index + 1],
      commands = [];
    let offset = start,
      componentAdvance = null,
      advanceDelta = 0;
    const need = (n) => {
      fail(offset + n <= end, 'Truncated glyph outline.');
    };
    if (start !== end) {
      need(10);
      const contours = i16(offset);
      offset += 10;
      if (contours === 0 && offset === end) {
        /* Valid header-only empty glyph. */
      } else if (contours >= 0) {
        fail(contours <= 2048, 'Too many glyph contours.', 'RESOURCE_LIMIT');
        need(contours * 2 + 2);
        const ends = [];
        let previous = -1;
        for (let i = 0; i < contours; i++) {
          const e = u16(offset);
          offset += 2;
          fail(e > previous, 'Invalid glyph contour ends.');
          ends.push(e);
          previous = e;
        }
        const n = contours ? ends.at(-1) + 1 : 0;
        fail(n <= 16384, 'Glyph point budget exceeded.', 'RESOURCE_LIMIT');
        spendGlyph(n * 8);
        const instructionLength = u16(offset);
        offset += 2;
        need(instructionLength);
        offset += instructionLength;
        const flags = [];
        while (flags.length < n) {
          need(1);
          const flag = data[offset++];
          flags.push(flag);
          if (flag & 8) {
            need(1);
            const repeat = data[offset++];
            fail(flags.length + repeat <= n, 'Invalid repeated glyph flags.');
            for (let i = 0; i < repeat; i++) flags.push(flag);
          }
        }
        const xs = [],
          ys = [];
        for (const [out, short, same] of [
          [xs, 2, 16],
          [ys, 4, 32],
        ]) {
          let value = 0;
          for (const f of flags) {
            if (f & short) {
              need(1);
              value += (f & same ? 1 : -1) * data[offset++];
            } else if (!(f & same)) {
              need(2);
              value += i16(offset);
              offset += 2;
            }
            out.push(value);
          }
        }
        if (coords && variations.gvar) {
          const d = variations.deltas(index, n, ends, xs, ys, coords);
          for (let i = 0; i < n; i++) {
            xs[i] += d.x[i];
            ys[i] += d.y[i];
          }
          advanceDelta = d.x[n + 1] - d.x[n];
        }
        let begin = 0;
        for (const stop of ends) {
          const points = Array.from({ length: stop - begin + 1 }, (_, i) => ({
            x: xs[begin + i],
            y: ys[begin + i],
            on: !!(flags[begin + i] & 1),
          }));
          begin = stop + 1;
          const first = points[0],
            last = points.at(-1),
            initial = first.on
              ? first
              : last.on
                ? last
                : { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2, on: true },
            rest = first.on ? points.slice(1) : last.on ? points.slice(0, -1) : points;
          commands.push(['M', initial.x, initial.y]);
          for (let i = 0; i < rest.length;) {
            const p = rest[i];
            if (p.on) {
              commands.push(['L', p.x, p.y]);
              i++;
            } else {
              const q = rest[i + 1] ?? initial;
              if (q.on) {
                commands.push(['Q', p.x, p.y, q.x, q.y]);
                i += 2;
              } else {
                commands.push(['Q', p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2]);
                i++;
              }
            }
          }
          commands.push(['Z']);
        }
      } else {
        // Each component offset is one variation point, followed by the four phantom points.
        let componentDeltas = null,
          component = 0;
        if (coords && variations.gvar) {
          let localCount4 = 0,
            o = offset,
            f;
          do {
            fail(o + 4 <= end, 'Truncated composite glyph.');
            f = u16(o);
            localCount4++;
            fail(localCount4 <= 4096, 'Composite glyph component budget exceeded.', 'RESOURCE_LIMIT');
            spendGlyph(1);
            o += 4 + (f & 1 ? 4 : 2) + (f & 8 ? 2 : f & 64 ? 4 : f & 128 ? 8 : 0);
            fail(o <= end, 'Truncated composite transform.');
          } while (f & 32);
          componentDeltas = variations.deltas(index, localCount4, null, null, null, coords);
          advanceDelta = componentDeltas.x[localCount4 + 1] - componentDeltas.x[localCount4];
        }
        let flags,
          hasInstructions = false;
        do {
          fail(component < 4096, 'Composite glyph component budget exceeded.', 'RESOURCE_LIMIT');
          spendGlyph(1);
          need(4);
          flags = u16(offset);
          const child = u16(offset + 2);
          offset += 4;
          hasInstructions ||= !!(flags & 256);
          fail((flags & 0xe010) === 0, 'Reserved composite flags are set.');
          fail([8, 64, 128].filter((bit) => flags & bit).length <= 1, 'Conflicting composite transform flags.');
          let x, y;
          if (flags & 1) {
            need(4);
            x = i16(offset);
            y = i16(offset + 2);
            offset += 4;
          } else {
            need(2);
            x = view.getInt8(offset);
            y = view.getInt8(offset + 1);
            offset += 2;
          }
          fail(flags & 2, 'Point-matched composite glyphs are unsupported.', 'FONT_COMPOSITE_UNSUPPORTED');
          if (componentDeltas) {
            x += componentDeltas.x[component];
            y += componentDeltas.y[component];
          }
          component++;
          let a = 1,
            b = 0,
            c = 0,
            d = 1;
          if (flags & 8) {
            need(2);
            a = d = i16(offset) / 16384;
            offset += 2;
          } else if (flags & 64) {
            need(4);
            a = i16(offset) / 16384;
            d = i16(offset + 2) / 16384;
            offset += 4;
          } else if (flags & 128) {
            need(8);
            a = i16(offset) / 16384;
            b = i16(offset + 2) / 16384;
            c = i16(offset + 4) / 16384;
            d = i16(offset + 6) / 16384;
            offset += 8;
          }
          if (flags & 0x0800) {
            const tx = a * x + c * y,
              ty = b * x + d * y;
            x = tx;
            y = ty;
          }
          fail(!(flags & 0x0800 && flags & 0x1000), 'Conflicting composite offset flags.');
          const part = glyph(child, depth + 1, visiting, coords);
          if (flags & 512) {
            fail(componentAdvance === null, 'Only one component may supply glyph metrics.');
            fail(b === 0 && c === 0, 'Metrics from rotated components are undefined.', 'FONT_COMPOSITE_UNSUPPORTED');
            componentAdvance = part.advance;
          }
          spendGlyph(part.commands.length);
          for (const command of part.commands) {
            const next = [command[0]];
            for (let i = 1; i < command.length; i += 2)
              next.push(a * command[i] + c * command[i + 1] + x, b * command[i] + d * command[i + 1] + y);
            commands.push(next);
          }
          fail(commands.length <= 10000, 'Composite glyph command budget exceeded.', 'RESOURCE_LIMIT');
        } while (flags & 32);
        if (hasInstructions) {
          need(2);
          const n = u16(offset);
          offset += 2;
          need(n);
          offset += n;
        }
      }
    }
    if (start === end && coords && variations.gvar) {
      const d = variations.deltas(index, 0, [], [], [], coords);
      advanceDelta = d.x[1] - d.x[0];
    }
    visiting.delete(index);
    const result = Object.freeze({
      index,
      advance: componentAdvance ?? advance(index) + advanceDelta,
      commands: validateProperty('path', 'commands', commands),
    });
    while (
      cache.size >= 256 ||
      [...cache.values()].reduce((n, g) => n + g.commands.length, 0) + result.commands.length > 100000
    ) {
      if (!cache.size) break;
      cache.delete(cache.keys().next().value);
    }
    cache.set(cacheKey, result);
    return result;
  }
  const font = Object.freeze({
    unitsPerEm,
    glyphCount,
    axes: Object.freeze(axes),
    format: 'TrueType-glyf',
    variable: !!variations.gvar,
    kerning: kerning.available,
    glyph: (index, values) => {
      beginGlyph();
      if (values) {
        options(values, axisTags, 'font axes');
        for (const [tag, value] of Object.entries(values)) number(value, tag, axes[tag].min, axes[tag].max);
      }
      return glyph(index, 0, new Set(), values ? normalize(values) : null);
    },
  });
  fonts.set(font, { lookup, normalize, glyph, beginGlyph, kern: kerning.pair, beginKerning: kerning.begin });
  return font;
}

/** Unpack WOFF 1.0 (zlib tables) into SFNT bytes. WOFF2 uses Brotli and transformed tables and is not decoded. */
async function unwrapWOFF(buffer) {
  const data = bytes(buffer),
    view = new DataView(data.buffer),
    signature = view.getUint32(0);
  fail(signature !== 0x774f4632, 'WOFF2 is not supported; convert the font to TTF or WOFF.', 'FONT_FORMAT_UNSUPPORTED');
  if (signature !== 0x774f4646) return data;
  fail(typeof DecompressionStream === 'function', 'This platform cannot decompress WOFF.', 'FONT_FORMAT_UNSUPPORTED');
  fail(data.length >= 44, 'Truncated WOFF header.');
  const flavor = view.getUint32(4),
    count = view.getUint16(12),
    total = view.getUint32(16);
  fail(
    count > 0 && count <= 128 && 44 + count * 20 <= data.length && total <= MAX_BYTES,
    'Invalid WOFF directory.',
    'RESOURCE_LIMIT',
  );
  fail(view.getUint32(8) === data.length && view.getUint16(14) === 0, 'Invalid WOFF header length or reserved field.');
  const entries = [];
  for (let i = 0; i < count; i++) {
    const p = 44 + i * 20,
      offset = view.getUint32(p + 4),
      compressed = view.getUint32(p + 8),
      length = view.getUint32(p + 12);
    fail(
      offset >= 44 + count * 20 &&
        offset % 4 === 0 &&
        offset + compressed <= data.length &&
        compressed <= length &&
        length <= MAX_BYTES,
      'Invalid WOFF table.',
    );
    entries.push({ tag: view.getUint32(p), offset, compressed, length, checksum: view.getUint32(p + 16) });
  }
  // Tables may not overlap, their declared sizes must fit the budget, and each is inflated one at a time with a
  // running count that aborts as soon as it exceeds its declared length (a small file cannot inflate to gigabytes).
  fail(
    12 + count * 16 + entries.reduce((n, e) => n + ((e.length + 3) & ~3), 0) === total && total <= MAX_BYTES,
    'WOFF tables exceed the size budget.',
    'RESOURCE_LIMIT',
  );
  const spans = entries.map((e) => [e.offset, e.offset + e.compressed]).sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < spans.length; i++) fail(spans[i][0] >= spans[i - 1][1], 'Overlapping WOFF tables.');
  const tables = [];
  for (const e of entries) {
    const raw = data.subarray(e.offset, e.offset + e.compressed);
    if (e.compressed === e.length) {
      tables.push(raw);
      continue;
    }
    const out = new Uint8Array(e.length),
      reader = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
    let got = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        fail(got + value.length <= e.length, 'WOFF table decompressed beyond its declared size.', 'RESOURCE_LIMIT');
        out.set(value, got);
        got += value.length;
      }
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    }
    fail(got === e.length, 'WOFF table decompressed to the wrong size.');
    tables.push(out);
  }
  let size = 12 + count * 16;
  const offsets = tables.map((t) => {
    const o = size;
    size += (t.length + 3) & ~3;
    return o;
  });
  fail(size <= MAX_BYTES, 'Font exceeds the size budget.', 'RESOURCE_LIMIT');
  const out = new Uint8Array(size),
    w = new DataView(out.buffer);
  w.setUint32(0, flavor);
  w.setUint16(4, count);
  let power = 1,
    log = 0;
  while (power * 2 <= count) {
    power *= 2;
    log++;
  }
  w.setUint16(6, power * 16);
  w.setUint16(8, log);
  w.setUint16(10, count * 16 - power * 16);
  entries.forEach((e, i) => {
    const p = 12 + i * 16;
    w.setUint32(p, e.tag);
    w.setUint32(p + 4, e.checksum);
    w.setUint32(p + 8, offsets[i]);
    w.setUint32(p + 12, e.length);
    out.set(tables[i], offsets[i]);
  });
  return out;
}
/** Load explicit bytes or a user-selected File/Blob (TTF or WOFF); no implicit font/network access. */
export async function loadFont(input) {
  if (input && typeof input.arrayBuffer === 'function') {
    fail(
      Number.isFinite(input.size) && input.size <= MAX_BYTES,
      'Font file exceeds the size budget.',
      'RESOURCE_LIMIT',
    );
    return parseFont(await unwrapWOFF(await input.arrayBuffer()));
  }
  return parseFont(await unwrapWOFF(input));
}
/** Unicode-to-outline layout with pair kerning and variable-font instances. No shaping engine or hinting. */
export function textOutline(font, value, spec = {}) {
  options(spec, ['size', 'x', 'y', 'letterSpacing', 'axes', 'missing', 'kerning'], 'text outline');
  fail(fonts.has(font), 'Use a font returned by parseFont/loadFont.', 'INVALID_FONT');
  text(value, 'outline text', 4096);
  const size = number(spec.size ?? 72, 'font size', 1e-4, 1e4),
    x = number(spec.x ?? 0, 'text x'),
    y = number(spec.y ?? 0, 'baseline y'),
    spacing = number(spec.letterSpacing ?? 0, 'letter spacing', -1e4, 1e4),
    axes = safeCopy(spec.axes ?? {}),
    missing = spec.missing ?? 'error',
    kern = spec.kerning ?? true;
  options(axes, Object.keys(font.axes), 'font axes');
  fail(['error', 'notdef'].includes(missing), 'Use error or notdef missing-glyph policy.');
  fail(typeof kern === 'boolean', 'kerning must be boolean.', 'INVALID_FONT');
  for (const [tag, v] of Object.entries(axes)) number(v, tag, font.axes[tag].min, font.axes[tag].max);
  const internal = fonts.get(font),
    varied = Object.keys(axes).length > 0 && !!internal.normalize(axes);
  fail(!varied || font.variable, 'This font has axes but no gvar outline variations.', 'FONT_VARIATION_UNSUPPORTED');
  internal.beginKerning();
  internal.beginGlyph();
  const coords = varied ? internal.normalize(axes) : null;
  const scale = size / font.unitsPerEm,
    commands = [],
    glyphs = [];
  let advance = 0,
    previous = null,
    kerned = 0;
  for (const character of value) {
    fail(glyphs.length < 2048, 'Text glyph budget exceeded.', 'RESOURCE_LIMIT');
    const codePoint = character.codePointAt(0),
      index = internal.lookup(codePoint);
    fail(index !== 0 || missing === 'notdef', 'The font has no mapped glyph for this character.', 'FONT_GLYPH_MISSING');
    if (kern && previous !== null) {
      const k = internal.kern(previous, index);
      if (k) {
        advance += k * scale;
        kerned++;
      }
    }
    const glyph = internal.glyph(index, 0, new Set(), coords),
      origin = x + advance;
    for (const command of glyph.commands) {
      const out = [command[0]];
      for (let i = 1; i < command.length; i += 2) out.push(origin + command[i] * scale, y - command[i + 1] * scale);
      commands.push(out);
    }
    fail(commands.length <= 10000, 'Text outline command budget exceeded.', 'RESOURCE_LIMIT');
    glyphs.push(Object.freeze({ codePoint, index, x: origin, advance: glyph.advance * scale }));
    advance += glyph.advance * scale + spacing;
    previous = index;
  }
  if (glyphs.length) advance -= spacing;
  return Object.freeze({
    commands: validateProperty('path', 'commands', commands),
    advance: number(advance, 'text advance'),
    glyphs: Object.freeze(glyphs),
    diagnostics: Object.freeze({
      shaping: false,
      hinting: false,
      kerning: kern && font.kerning,
      kernedPairs: kerned,
      variableAxes: varied,
      format: font.format,
    }),
  });
}
