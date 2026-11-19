import { assert, number, options, text } from '../../core/validate.js';
import { textOutline } from '../../import/font.js';

// Text lifted from source documents: lay text into a document template, find a phrase, map
// page millimetres onto a 3D surface, and schedule the highlight and the lift. Every schedule
// is a pure function of time, so film frames and scrubbing agree.

const ALIGN = ['left', 'center', 'right', 'justify', 'justify-ends'];

/** Named easings used by the source-document motion pack. `outBack(1.2)` sets the overshoot. */
export function sourceEase(name = 'linear') {
  text(name, 'ease', 40);
  const back = /^outBack\((\d+(?:\.\d+)?)\)$/.exec(name);
  if (back) {
    const s = number(Number(back[1]), 'overshoot', 0, 10);
    return (t) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2;
  }
  const table = {
    linear: (t) => t,
    outQuad: (t) => 1 - (1 - t) ** 2,
    outCubic: (t) => 1 - (1 - t) ** 3,
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
    inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
    outBack: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  };
  assert(Object.hasOwn(table, name), 'INVALID_EASE', `Use one of ${Object.keys(table).join(', ')} or outBack(n).`);
  return table[name];
}
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const progress = (time, at, duration) => (duration <= 0 ? (time >= at ? 1 : 0) : clamp01((time - at) / duration));

function measurer(spec) {
  if (spec.measure !== undefined) {
    assert(
      typeof spec.measure === 'function',
      'INVALID_MEASURE',
      'measure must be a function (text, sizeMm, trackingMm) => widthMm.',
    );
    return (s, size, tracking) => number(spec.measure(s, size, tracking), 'measured width', 0, 1e6);
  }
  if (spec.font !== undefined)
    return (s, size, tracking) =>
      s ? textOutline(spec.font, s, { size, letterSpacing: tracking, missing: 'notdef' }).advance : 0;
  assert(
    false,
    'INVALID_MEASURE',
    'Pass font (from explainerkit/import/font) or a measure function, so layout does not depend on installed fonts.',
  );
}
const rectOf = (r, name) => {
  options(r, ['x', 'y', 'width', 'height'], name);
  return {
    x: number(r.x, `${name} x`, -1e5, 1e5),
    y: number(r.y, `${name} y`, -1e5, 1e5),
    width: number(r.width, `${name} width`, 0, 1e5),
    height: number(r.height, `${name} height`, 0, 1e5),
  };
};

/**
 * Flow text into a document template's slots (the `layout.slots` of a source-document pack).
 * `content` maps slot names to text. Returns measured lines with each word's box, in
 * millimetres from the surface's top-left corner, plus any text that did not fit.
 */
export function layoutDocument(template, content, spec = {}) {
  options(spec, ['font', 'measure'], 'layoutDocument');
  const measure = measurer(spec);
  assert(
    template && typeof template === 'object' && template.slots && typeof template.slots === 'object',
    'INVALID_TEMPLATE',
    'Pass a template with slots, such as document.layout.',
  );
  assert(content && typeof content === 'object', 'INVALID_TEMPLATE', 'content maps slot names to text.');
  const lines = [],
    overflow = {};
  let wordCount = 0;
  for (const [slotName, value] of Object.entries(content)) {
    const slot = template.slots[slotName];
    assert(slot && typeof slot === 'object', 'UNKNOWN_SLOT', `The template has no slot named ${slotName}.`);
    assert(slot.size !== undefined, 'UNKNOWN_SLOT', `Slot ${slotName} does not hold text.`);
    let body = text(value, `${slotName} text`, 20000);
    if (slot.caps) body = body.toUpperCase();
    const size = number(slot.size, 'type size', 0.1, 500),
      leading = number(slot.leading ?? 1.2, 'leading', 0.5, 4),
      tracking = number(slot.tracking ?? 0, 'tracking', -1, 2) * size,
      align = slot.align ?? 'left',
      maxLines = slot.maxLines === undefined ? Infinity : number(slot.maxLines, 'max lines', 1, 10000);
    assert(ALIGN.includes(align), 'INVALID_TEMPLATE', `Slot ${slotName} uses an unknown alignment ${align}.`);
    const boxes = slot.columns
      ? slot.columns.map((c, k) => rectOf(c, `${slotName} column ${k}`))
      : [rectOf(slot.rect, `${slotName} rect`)];
    assert(boxes.length > 0 && boxes.length <= 32, 'INVALID_TEMPLATE', 'A slot has between 1 and 32 columns.');
    const words = body.split(/\s+/).filter(Boolean);
    wordCount += words.length;
    assert(wordCount <= 20000, 'RESOURCE_LIMIT', 'Lay out at most 20000 words per document.');
    const space = measure(' ', size, tracking),
      lineHeight = size * leading;
    let w = 0,
      count = 0;
    for (let col = 0; col < boxes.length && w < words.length && count < maxLines; col++) {
      const box = boxes[col];
      for (
        let y = box.y;
        w < words.length && count < maxLines && y + size <= box.y + box.height + 1e-9;
        y += lineHeight
      ) {
        const line = [];
        let width = 0;
        while (w < words.length) {
          const ww = measure(words[w], size, tracking);
          const next = line.length ? width + space + ww : ww;
          if (line.length && next > box.width) break;
          line.push({ text: words[w], width: ww });
          width = next;
          w++;
          if (width > box.width) break; // a single word wider than the column stays on its own line
        }
        const last = w >= words.length || count + 1 >= maxLines;
        const justify = (align === 'justify' && !last) || align === 'justify-ends';
        const gap = justify && line.length > 1 ? space + (box.width - width) / (line.length - 1) : space;
        let x =
          align === 'center' ? box.x + (box.width - width) / 2 : align === 'right' ? box.x + box.width - width : box.x;
        const placed = line.map((word) => {
          const out = Object.freeze({ text: word.text, x, width: word.width });
          x += word.width + gap;
          return out;
        });
        lines.push(
          Object.freeze({
            slot: slotName,
            column: col,
            index: count,
            text: line.map((q) => q.text).join(' '),
            x: placed[0].x,
            y,
            width: placed.at(-1).x + placed.at(-1).width - placed[0].x,
            height: size,
            baseline: y + size * 0.8,
            size,
            words: Object.freeze(placed),
          }),
        );
        count++;
      }
    }
    if (w < words.length) overflow[slotName] = words.slice(w).join(' ');
  }
  return Object.freeze({ lines: Object.freeze(lines), overflow: Object.freeze(overflow) });
}

const normalWord = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, '');

/**
 * Find a phrase in a layout. Returns one rectangle per line the phrase covers (a phrase split
 * across a line break gives two), or an empty list. `occurrence` picks a later match.
 */
export function findPhrase(layout, phrase, spec = {}) {
  options(spec, ['slot', 'occurrence', 'padding'], 'findPhrase');
  assert(layout && Array.isArray(layout.lines), 'INVALID_LAYOUT', 'Pass the result of layoutDocument().');
  const parts = text(phrase, 'phrase', 500).split(/\s+/).map(normalWord).filter(Boolean);
  assert(parts.length > 0, 'INVALID_PHRASE', 'The phrase needs at least one word.');
  const occurrence = number(spec.occurrence ?? 0, 'occurrence', 0, 10000),
    pad = number(spec.padding ?? 0, 'padding', 0, 100);
  const words = [];
  for (const line of layout.lines)
    if (spec.slot === undefined || line.slot === spec.slot)
      for (const word of line.words) words.push({ line, word, key: normalWord(word.text) });
  let found = -1;
  for (let i = 0, seen = 0; i + parts.length <= words.length; i++)
    if (parts.every((p, k) => words[i + k].key === p) && seen++ === occurrence) {
      found = i;
      break;
    }
  if (found < 0) return Object.freeze([]);
  const rects = new Map();
  for (const { line, word } of words.slice(found, found + parts.length)) {
    const r = rects.get(line) ?? { x0: Infinity, x1: -Infinity, line };
    r.x0 = Math.min(r.x0, word.x);
    r.x1 = Math.max(r.x1, word.x + word.width);
    rects.set(line, r);
  }
  return Object.freeze(
    [...rects.values()].map((r) =>
      Object.freeze({
        x: r.x0 - pad,
        y: r.line.y - pad,
        width: r.x1 - r.x0 + 2 * pad,
        height: r.line.height + 2 * pad,
        slot: r.line.slot,
        column: r.line.column,
      }),
    ),
  );
}

/**
 * Map millimetres on a printable surface to 3D. `positions` holds (cols + 1) x (rows + 1)
 * vertices as x, y, z triples in metres, with vertex (i, j) at index j * (cols + 1) + i, as
 * the source-document packs store them. Normals are computed from the grid when not given.
 */
export function surfaceMapper(spec = {}) {
  options(spec, ['size', 'grid', 'positions', 'normals'], 'surfaceMapper');
  const [wMm, hMm] = spec.size ?? [];
  number(wMm, 'surface width mm', 1e-3, 1e5);
  number(hMm, 'surface height mm', 1e-3, 1e5);
  const [cols, rows] = spec.grid ?? [];
  assert(
    Number.isInteger(cols) && Number.isInteger(rows) && cols >= 1 && rows >= 1 && (cols + 1) * (rows + 1) <= 1_000_000,
    'INVALID_SURFACE',
    'grid is [cols, rows] with at most a million vertices.',
  );
  const count = (cols + 1) * (rows + 1);
  const read = (arr, name) => {
    assert(arr && arr.length === count * 3, 'INVALID_SURFACE', `${name} must hold ${count * 3} numbers.`);
    const out = new Float64Array(count * 3);
    for (let k = 0; k < out.length; k++) out[k] = number(arr[k], name, -1e5, 1e5);
    return out;
  };
  const P = read(spec.positions, 'positions');
  let N;
  if (spec.normals !== undefined) N = read(spec.normals, 'normals');
  else {
    N = new Float64Array(count * 3);
    const v = (i, j) => (Math.min(rows, Math.max(0, j)) * (cols + 1) + Math.min(cols, Math.max(0, i))) * 3;
    for (let j = 0; j <= rows; j++)
      for (let i = 0; i <= cols; i++) {
        const a = v(i + 1, j),
          b = v(i - 1, j),
          c = v(i, j + 1),
          d = v(i, j - 1);
        const du = [P[a] - P[b], P[a + 1] - P[b + 1], P[a + 2] - P[b + 2]],
          dv = [P[c] - P[d], P[c + 1] - P[d + 1], P[c + 2] - P[d + 2]];
        // v runs from the top (far) edge toward the viewer, so dv x du points up for a flat page.
        const n = [dv[1] * du[2] - dv[2] * du[1], dv[2] * du[0] - dv[0] * du[2], dv[0] * du[1] - dv[1] * du[0]];
        const l = Math.hypot(...n) || 1,
          k = v(i, j);
        N[k] = n[0] / l;
        N[k + 1] = n[1] / l;
        N[k + 2] = n[2] / l;
      }
  }
  const blend = (arr, gi, gj) => {
    const i0 = Math.min(cols - 1, Math.floor(gi)),
      j0 = Math.min(rows - 1, Math.floor(gj)),
      a = gi - i0,
      b = gj - j0;
    const idx = (i, j) => (j * (cols + 1) + i) * 3;
    return [0, 1, 2].map(
      (c) =>
        (arr[idx(i0, j0) + c] * (1 - a) + arr[idx(i0 + 1, j0) + c] * a) * (1 - b) +
        (arr[idx(i0, j0 + 1) + c] * (1 - a) + arr[idx(i0 + 1, j0 + 1) + c] * a) * b,
    );
  };
  return Object.freeze({
    /** The 3D point and unit normal under page position (xMm, yMm). */
    at(xMm, yMm) {
      const gi = clamp01(number(xMm, 'x mm', -1e5, 1e5) / wMm) * cols,
        gj = clamp01(number(yMm, 'y mm', -1e5, 1e5) / hMm) * rows;
      const [x, y, z] = blend(P, gi, gj),
        n = blend(N, gi, gj),
        l = Math.hypot(...n) || 1;
      return Object.freeze({ x, y, z, normal: Object.freeze({ x: n[0] / l, y: n[1] / l, z: n[2] / l }) });
    },
  });
}

/**
 * A highlight drawn over phrase rectangles: a marker stroke, underline, circle or glow from the
 * motion pack. at(time) returns each rectangle with its drawn fraction, line by line.
 */
export function highlightSchedule(rects, style, spec = {}) {
  options(spec, ['at'], 'highlightSchedule');
  assert(
    Array.isArray(rects) && rects.length > 0 && rects.length <= 64,
    'INVALID_PHRASE',
    'Highlight 1 to 64 rectangles.',
  );
  const boxes = rects.map((r) => rectOf({ x: r.x, y: r.y, width: r.width, height: r.height }, 'highlight rect'));
  assert(style && typeof style === 'object', 'INVALID_STYLE', 'Pass one highlight style from motion.json.');
  const at = number(spec.at ?? 0, 'highlight start', -86400, 86400),
    duration = number(style.duration ?? 0.4, 'highlight duration', 0, 60),
    perLine = number(style.perLineDelay ?? 0, 'per-line delay', 0, 60),
    ease = sourceEase(style.ease ?? 'outCubic');
  // Longer lines take proportionally longer, so a stroke moves at one speed across a break.
  const total = boxes.reduce((s, b) => s + b.width, 0) || 1;
  let start = at;
  const timing = boxes.map((b) => {
    const d = (duration * b.width) / total,
      t = { start, duration: d };
    start += d + perLine;
    return t;
  });
  return Object.freeze({
    end: start - perLine,
    at(time) {
      number(time, 'time', -86400, 86400);
      return Object.freeze(
        boxes.map((b, k) => Object.freeze({ ...b, drawn: ease(progress(time, timing[k].start, timing[k].duration)) })),
      );
    },
  });
}

/**
 * The lift of a phrase off the page: unstick, rise, travel and settle, as specified by the
 * motion pack's `lift` block. `from` and `to` are 3D points in metres with +y up; `index`
 * staggers several phrases lifting together. pose(time) is a pure function of time.
 */
export function liftSchedule(lift, spec = {}) {
  options(spec, ['at', 'from', 'to', 'index', 'finalScale'], 'liftSchedule');
  assert(lift && Array.isArray(lift.phases), 'INVALID_STYLE', 'Pass the lift block from motion.json.');
  const phase = (name) => {
    const p = lift.phases.find((q) => q.name === name);
    assert(p, 'INVALID_STYLE', `The lift has no ${name} phase.`);
    return p;
  };
  const point = (p, name) => {
    options(p, ['x', 'y', 'z'], name);
    return {
      x: number(p.x, `${name} x`, -1e5, 1e5),
      y: number(p.y, `${name} y`, -1e5, 1e5),
      z: number(p.z ?? 0, `${name} z`, -1e5, 1e5),
    };
  };
  const from = point(spec.from, 'from'),
    to = point(spec.to ?? spec.from, 'to');
  const index = number(spec.index ?? 0, 'lift index', 0, 1000);
  const at = number(spec.at ?? 0, 'lift start', -86400, 86400) + index * number(lift.stagger ?? 0, 'stagger', 0, 10);
  const un = phase('unstick'),
    rise = phase('rise'),
    travel = phase('travel'),
    settle = phase('settle');
  const d1 = number(un.duration, 'unstick duration', 0, 60),
    d2 = number(rise.duration, 'rise duration', 0, 60),
    d3 = number(travel.duration, 'travel duration', 0, 60);
  const e1 = sourceEase(un.ease ?? 'outQuad'),
    e2 = sourceEase(rise.ease ?? 'outBack(1.2)'),
    e3 = sourceEase(travel.ease ?? 'inOutCubic');
  const r1 = number(un.rise_m ?? 0.0015, 'unstick rise', 0, 10),
    r2 = number(rise.rise_m ?? 0.03, 'rise height', 0, 10);
  const [sh0, sh1] = un.shadow ?? [0, 0.45];
  const imprint = number(un.imprint ?? 0.25, 'imprint', 0, 1);
  const face = number(rise.faceCamera ?? 0.6, 'face camera', 0, 1),
    grow = number(rise.scale ?? 1.6, 'rise scale', 0.1, 10),
    curl = number(rise.curl ?? 0, 'curl', 0, 1);
  const finalScale = number(spec.finalScale ?? 1, 'final scale', 0.01, 100);
  const arc = number(travel.arc ?? 0.12, 'travel arc', 0, 5);
  const { stiffness = 220, damping = 22, mass = 1 } = settle.spring ?? {};
  number(stiffness, 'settle stiffness', 1e-3, 1e6);
  number(damping, 'settle damping', 0, 1e6);
  number(mass, 'settle mass', 1e-3, 1e3);
  const w0 = Math.sqrt(stiffness / mass),
    zeta = damping / (2 * Math.sqrt(stiffness * mass));
  // Analytic step response of a damped spring, so settle needs no frame-by-frame stepping.
  const spring = (t) => {
    if (t <= 0) return 0;
    if (zeta < 1) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
    }
    return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  };
  const settleTime = 6 / (Math.max(zeta, 0.05) * w0);
  const page = lift.page ?? {};
  const pageDim = number(page.dimTo ?? 1, 'page dim', 0, 1),
    pageDesat = number(page.desaturate ?? 0, 'page desaturate', 0, 1),
    pageDuration = number(page.duration ?? 0.5, 'page duration', 0, 60);
  const flutter = lift.secondary?.flutter ?? { amplitudeDeg: 0, frequency: 1, decay: 1 };
  const t1 = at + d1,
    t2 = t1 + d2,
    t3 = t2 + d3;
  const top = { x: from.x, y: from.y + r2, z: from.z };
  const distance = Math.hypot(to.x - top.x, to.y - top.y, to.z - top.z);
  return Object.freeze({
    start: at,
    phases: Object.freeze({ unstick: at, rise: t1, travel: t2, settle: t3, done: t3 + settleTime }),
    pose(time) {
      number(time, 'time', -86400, 86400);
      const u = e1(progress(time, at, d1)),
        r = e2(progress(time, t1, d2)),
        tr = e3(progress(time, t2, d3)),
        s = spring(time - t3);
      const name =
        time < at
          ? 'rest'
          : time < t1
            ? 'unstick'
            : time < t2
              ? 'rise'
              : time < t3
                ? 'travel'
                : time < t3 + settleTime
                  ? 'settle'
                  : 'done';
      const height = r1 * u + (r2 - r1) * r;
      const lifted = { x: from.x, y: from.y + height, z: from.z };
      const position = {
        x: lifted.x + (to.x - top.x) * tr,
        y: lifted.y + (to.y - top.y) * tr + arc * distance * 4 * tr * (1 - tr),
        z: lifted.z + (to.z - top.z) * tr,
      };
      const flutterAge = time - t1;
      const flutterDeg =
        flutterAge > 0 && name !== 'done'
          ? flutter.amplitudeDeg *
            Math.exp(-flutter.decay * flutterAge) *
            Math.sin(2 * Math.PI * flutter.frequency * flutterAge)
          : 0;
      const dim = progress(time, t1, pageDuration);
      return Object.freeze({
        phase: name,
        position: Object.freeze(position),
        rise: height,
        scale: 1 + (grow - 1) * r + (finalScale - grow) * s,
        faceCamera: face * r + (1 - face) * s,
        curl: curl * r * (1 - s),
        shadow: time < at ? 0 : sh0 + (sh1 - sh0) * u,
        imprint: 1 - (1 - imprint) * u,
        motionBlur: Boolean(travel.motionBlur) && name === 'travel',
        flutterDeg,
        page: Object.freeze({ dim: 1 - (1 - pageDim) * dim, desaturate: pageDesat * dim }),
      });
    },
  });
}
