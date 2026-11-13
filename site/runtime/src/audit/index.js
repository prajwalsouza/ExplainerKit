// Composition audit: measurable heuristics that catch the mistakes a moving explainer makes most often.
// A scene is sampled over time, each frame is flattened into painted marks in frame space, and every
// mark is checked against plain rules: text collides with text, a line or shape is painted across words,
// text is too faint for its background, blurred, cut off by the frame, too small, gone before it can be
// read, or the screen holds more separate things than the explanation needs.
//
// These are heuristics with declared thresholds, not perceptual truth. Every finding names the nodes,
// the time span and the measurement, so an author can judge it. Thresholds come from published
// guidance where it exists (WCAG 2.2 for contrast and text size, reading-rate studies for dwell time,
// Mayer's coherence principle and working-memory limits for clutter) and are otherwise engineering
// choices, listed in RULES so a project can tighten or loosen them.
import { assert, number, options, safeCopy } from '../core/validate.js';
import { localMatrix } from '../core/transform.js';
import { blurRadius } from '../graphics/look.js';
import { estimateText } from '../layout/adaptive.js';
import { cloudBounds } from '../graphics/cloud.js';
import { instanceGeometryFindings } from '../procedural/provenance.js';
import { perceptualGroups } from '../perception/index.js';
export { auditMotion } from './motion.js';
export { CONTINUITY, auditHandover, auditHandoverWindow, fitSimilarity, colorDistance } from './continuity.js';
export { auditTextOverPixels } from './pixels.js';
export { auditPalette, comparePalettes } from './palette.js';
export { RENDER_3D, auditRender3D, auditStripes, describeThreeScene } from './render3d.js';
/** @typedef {import('./motion.js').MotionAuditOptions} MotionAuditOptions */
/** @typedef {import('./motion.js').MotionAuditReport} MotionAuditReport */
/** @typedef {import('./motion.js').MotionPoint} MotionPoint */
/** @typedef {import('./motion.js').MotionSampler} MotionSampler */
/** @typedef {import('./palette.js').PaletteAuditOptions} PaletteAuditOptions */
/** @typedef {import('./palette.js').PaletteAuditReport} PaletteAuditReport */
/** @typedef {import('./palette.js').PaletteCluster} PaletteCluster */
/** @typedef {import('./palette.js').PaletteGroup} PaletteGroup */
/** @typedef {import('./palette.js').PalettePolicy} PalettePolicy */
/** @typedef {import('./palette.js').PalettePixels} PalettePixels */
/** @typedef {import('./palette.js').PaletteComparison} PaletteComparison */

export const RULES = Object.freeze({
  instanceOutside: 0.75,
  // WCAG 2.2 SC 1.4.3: 4.5:1 for text, 3:1 for large text (≥ 24 CSS px, or ≥ 18.66 px bold).
  contrast: Object.freeze({ normal: 4.5, large: 3, largeSize: 24, largeBoldSize: 18.66 }),
  // Smallest comfortable on-screen text in CSS px at the reference display width.
  minText: 12,
  // Text counts as settled (judged for contrast and collisions) from this effective opacity.
  settled: 0.6,
  // Two text boxes overlapping by this share of the smaller box collide.
  textOverlap: 0.08,
  // A filled mark painted over this share of a text box hides it.
  cover: 0.15,
  // Blur on text in frame pixels at the reference display before it is reported.
  blur: 0.75,
  // Reading: 0.5 s to find the text, then about 200 words per minute for display text.
  reading: Object.freeze({ lead: 0.5, wordsPerSecond: 3.3, minimum: 1 }),
  // Clutter: separate visual units and words on stage at once. Working memory holds about four
  // chunks (Cowan 2001); seven is a generous ceiling for units in view, not a target.
  clutter: Object.freeze({ units: 7, words: 24, onsetsPerSecond: 4 }),
  // Separate shapes showing through behind one text before it reads as sitting on a busy ground.
  busyGround: 3,
  // Cards (an opaque panel holding text). Padding is in ems of the largest text on the card; balance is the
  // allowed difference between opposite margins as a share of the larger one. More than `boxes` cards at
  // once reads as a form, not a picture. A card over `coverUp` separate shapes is probably hiding a
  // placement problem rather than designing a panel.
  card: Object.freeze({ padding: 0.6, balance: 0.45, boxes: 2, coverUp: 3 }),
  // A coloured label further than this share of the frame width from every mark of its hue has lost its referent.
  orphan: 0.16,
  // Keep words this share of the frame width away from its edges (title-safe margin).
  safeArea: 0.035,
  // Renderer effect budget (src/graphics/look.js): effect nodes, and viewport-pass pixels at the largest display
  // the film should support. Warn from 75% of either limit.
  effects: Object.freeze({ nodes: 64, pixels: 64e6, width: 1920, height: 1080, warn: 0.75 }),
  // Frame cost, in milliseconds of scene sampling, and painted marks per frame.
  cost: Object.freeze({ sampleMs: 16, marks: 4000 }),
});

// ---- Color --------------------------------------------------------------------------------------
import { toRGBA } from '../color/space.js';
/** Parse a hex or named color to [r, g, b, a] in 0–1; transparent and none give null. */
export function parseColor(value) {
  if (value && typeof value === 'object' && Object.hasOwn(value, 'h')) {
    try {
      return [...toRGBA(value)];
    } catch {
      return null;
    }
  }
  if (value && typeof value === 'object') {
    const stops =
      value.stops ??
      (value.type === 'texture' ? (value.colors ?? [value.color]).filter(Boolean).map((color) => ({ color })) : []);
    if (!stops.length) return null;
    const parts = stops.map((s) => parseColor(s.color)).filter(Boolean);
    return parts.length ? [0, 1, 2, 3].map((k) => parts.reduce((a, p) => a + p[k], 0) / parts.length) : null;
  }
  if (typeof value !== 'string' || value === 'none' || value === 'transparent') return null;
  try {
    return [...toRGBA(value)];
  } catch {
    return null;
  }
}
const channel = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
/** WCAG relative luminance of an sRGB color given as [r, g, b] in 0–1. */
export function relativeLuminance([r, g, b]) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
/** WCAG contrast ratio between two opaque colors, 1–21. */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a),
    lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
const over = (top, alpha, bottom) => [0, 1, 2].map((k) => top[k] * alpha + bottom[k] * (1 - alpha));
const hexOf = (c) =>
  '#' +
  c
    .slice(0, 3)
    .map((v) =>
      Math.round(Math.max(0, Math.min(1, v)) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');

// ---- Geometry -----------------------------------------------------------------------------------
const IDENTITY = [1, 0, 0, 1, 0, 0];
const multiply = (m, n) => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const scaleOf = (m) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
const boxOf = (pts) => {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
};
const area = (b) => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);
const intersect = (a, b) => ({
  x0: Math.max(a.x0, b.x0),
  y0: Math.max(a.y0, b.y0),
  x1: Math.min(a.x1, b.x1),
  y1: Math.min(a.y1, b.y1),
});
const inset = (b, k) => {
  const dx = (b.x1 - b.x0) * k,
    dy = (b.y1 - b.y0) * k;
  return { x0: b.x0 + dx, y0: b.y0 + dy, x1: b.x1 - dx, y1: b.y1 - dy };
};

/** Flatten absolute path commands into polylines (one per subpath), curves sampled at 8 steps. */
function polylines(commands) {
  const out = [];
  let cur = null,
    at = [0, 0],
    start = [0, 0];
  for (const c of commands) {
    if (c[0] === 'M') {
      cur = [[c[1], c[2]]];
      out.push(cur);
      at = start = [c[1], c[2]];
      continue;
    }
    if (!cur) {
      cur = [at];
      out.push(cur);
    }
    if (c[0] === 'L') {
      at = [c[1], c[2]];
      cur.push(at);
    } else if (c[0] === 'Q') {
      const p0 = at;
      for (let i = 1; i <= 8; i++) {
        const t = i / 8,
          u = 1 - t;
        cur.push([u * u * p0[0] + 2 * u * t * c[1] + t * t * c[3], u * u * p0[1] + 2 * u * t * c[2] + t * t * c[4]]);
      }
      at = [c[3], c[4]];
    } else if (c[0] === 'C') {
      const p0 = at;
      for (let i = 1; i <= 8; i++) {
        const t = i / 8,
          u = 1 - t;
        cur.push([
          u ** 3 * p0[0] + 3 * u * u * t * c[1] + 3 * u * t * t * c[3] + t ** 3 * c[5],
          u ** 3 * p0[1] + 3 * u * u * t * c[2] + 3 * u * t * t * c[4] + t ** 3 * c[6],
        ]);
      }
      at = [c[5], c[6]];
    } else if (c[0] === 'Z') {
      cur.push(start);
      at = start;
      cur = null;
    }
  }
  return out.filter((l) => l.length > 1);
}
/** Keep the [from, to] share of a polyline set by arc length, as a stroke trim does. */
function trim(lines, from, to) {
  if (from <= 0 && to >= 1) return lines;
  const lengths = lines.map((l) => l.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - l[i][0], p[1] - l[i][1]), 0));
  const total = lengths.reduce((a, b) => a + b, 0),
    a = from * total,
    b = to * total,
    out = [];
  let offset = 0;
  lines.forEach((l) => {
    let run = null;
    for (let i = 1; i < l.length; i++) {
      const p = l[i - 1],
        q = l[i],
        d = Math.hypot(q[0] - p[0], q[1] - p[1]),
        s0 = offset,
        s1 = offset + d;
      offset = s1;
      if (s1 < a || s0 > b || d === 0) {
        run = null;
        continue;
      }
      const t0 = Math.max(0, (a - s0) / d),
        t1 = Math.min(1, (b - s0) / d),
        lerp = (t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      if (!run) {
        run = [lerp(t0)];
        out.push(run);
      }
      run.push(lerp(t1));
    }
  });
  return out.filter((l) => l.length > 1);
}
function segmentHitsBox(p, q, b) {
  // Liang–Barsky clip of a segment against an axis-aligned box.
  let t0 = 0,
    t1 = 1;
  const dx = q[0] - p[0],
    dy = q[1] - p[1];
  for (const [pp, qq] of [
    [-dx, p[0] - b.x0],
    [dx, b.x1 - p[0]],
    [-dy, p[1] - b.y0],
    [dy, b.y1 - p[1]],
  ]) {
    if (pp === 0) {
      if (qq < 0) return 0;
      continue;
    }
    const r = qq / pp;
    if (pp < 0) {
      if (r > t1) return 0;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return 0;
      if (r < t1) t1 = r;
    }
  }
  return (t1 - t0) * Math.hypot(dx, dy);
}
function insidePolygon(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i],
      [xj, yj] = ring[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ---- Marks ----------------------------------------------------------------------------------------
/**
 * Flatten a sampled frame into painted marks in frame space, in paint order. Each mark records its root
 * (top-level node), type, frame box, effective opacity and blur, fill and stroke, and for text its
 * string and on-frame font size; for strokes, the visible polylines.
 */
export function frameMarks(frame, { measure = estimateText, cameraId = null } = {}) {
  assert(frame && Array.isArray(frame.children), 'INVALID_AUDIT', 'Audit a sampled frame.');
  const marks = [];
  const visit = (node, parent, alpha, blur, root, path) => {
    const p = node.props ?? {},
      m = multiply(parent, localMatrix(p, node)),
      opacity = alpha * (p.opacity ?? 1),
      s = scaleOf(m);
    const requestedBlur = blurRadius(p.blur) * (p.blur?.space === 'screen' ? 1 : s);
    const effBlur = blur + Math.min(requestedBlur, p.blur?.maxScreen ?? 32);
    if (opacity <= 0.02) return;
    const base = { id: node.id, root, path, index: marks.length, type: node.type, opacity, blur: effBlur, scale: s };
    const stroke = parseColor(p.stroke),
      strokeWidth = stroke ? (p.strokeWidth ?? 1) * s : 0,
      fill = parseColor(p.fill);
    const ring = (pts) => pts.map((q) => apply(m, q));
    switch (node.type) {
      case 'text': {
        if (!p.text || !String(p.text).trim()) break;
        const size = p.fontSize ?? 16,
          lines = String(p.text).split(/\r?\n/),
          w = p.textAdvance ?? Math.max(...lines.map((line) => measure(line, size, p.fontWeight ?? 400, p.fontFamily))),
          extraHeight = (lines.length - 1) * size * (p.lineHeight ?? 1.3);
        const x0 = p.align === 'middle' ? -w / 2 : p.align === 'end' ? -w : 0;
        const y0 = p.baseline === 'middle' ? -size * 0.5 : p.baseline === 'hanging' ? 0 : -size * 0.78;
        // Glyph box: cap height to baseline, not the full line box, so stacked lines do not collide.
        const corners = ring([
          [x0, y0 + size * 0.08],
          [x0 + w, y0 + size * 0.08],
          [x0 + w, y0 + size * 0.9 + extraHeight],
          [x0, y0 + size * 0.9 + extraHeight],
        ]);
        marks.push({
          ...base,
          kind: 'text',
          text: String(p.text),
          fontSize: size * s,
          fontWeight: p.fontWeight ?? 400,
          color: fill,
          box: boxOf(corners),
          ring: corners,
        });
        break;
      }
      case 'rect':
      case 'circle':
      case 'path':
      case 'line':
      case 'cloud': {
        let lines = [],
          filled = null,
          box = null;
        if (node.type === 'rect') {
          const w = p.width ?? 0,
            h = p.height ?? 0;
          filled = ring([
            [0, 0],
            [w, 0],
            [w, h],
            [0, h],
          ]);
          lines = [[...filled, filled[0]]];
        } else if (node.type === 'circle') {
          const r = p.r ?? 0;
          filled = ring(
            Array.from({ length: 24 }, (_, i) => [r * Math.cos((i * Math.PI) / 12), r * Math.sin((i * Math.PI) / 12)]),
          );
          lines = [[...filled, filled[0]]];
        } else if (node.type === 'line') {
          lines = [
            ring([
              [p.x1, p.y1],
              [p.x2, p.y2],
            ]),
          ];
        } else if (node.type === 'path') {
          const raw = polylines(p.commands ?? []).map(ring);
          filled = raw.length ? raw : null;
          lines = trim(raw, p.trimStart ?? 0, p.trimEnd ?? 1);
        } else {
          const b = cloudBounds(p.points, p.pointSize ?? 2);
          if (b) {
            filled = ring([
              [b.x, b.y],
              [b.x + b.width, b.y],
              [b.x + b.width, b.y + b.height],
              [b.x, b.y + b.height],
            ]);
          }
        }
        const all = [
          ...(filled && node.type !== 'path' ? filled : []),
          ...(filled && node.type === 'path' ? filled.flat() : []),
          ...lines.flat(),
        ];
        if (!all.length) break;
        box = boxOf(all);
        const fillVisible =
          fill &&
          fill[3] > 0.01 &&
          node.type !== 'line' &&
          !(node.type === 'path' && (p.trimEnd ?? 1) - (p.trimStart ?? 0) < 1 && !p.fill);
        if (fillVisible && filled)
          marks.push({
            ...base,
            kind: 'fill',
            color: fill,
            rings: node.type === 'path' ? filled : [filled],
            box,
            textured: !!p.texture || p.fill?.type === 'texture',
            cloud: node.type === 'cloud',
          });
        if (stroke && strokeWidth > 0 && stroke[3] > 0.01 && lines.length)
          marks.push({
            ...base,
            kind: 'stroke',
            color: stroke,
            width: strokeWidth,
            lines,
            box: {
              x0: box.x0 - strokeWidth / 2,
              y0: box.y0 - strokeWidth / 2,
              x1: box.x1 + strokeWidth / 2,
              y1: box.y1 + strokeWidth / 2,
            },
          });
        break;
      }
      default:
        break;
    }
    // Camera and depth-layer wrappers are containers: the authored nodes inside them are the roots.
    (node.children ?? []).forEach((child, i) =>
      visit(child, m, opacity, effBlur, container(node, root) ? child.id : root, `${path}/${child.id ?? i}`),
    );
  };
  // The camera's world group comes first; screen-space overlays follow it. Without a camera ID, a lone top-level group is taken as one.
  const cameraRoot =
    cameraId !== null
      ? (frame.children.find((n) => n.id === cameraId) ?? null)
      : frame.children.length === 1 && frame.children[0].type === 'group'
        ? frame.children[0]
        : null;
  const container = (node, root) =>
    node.id === root && (node === cameraRoot || node.layerCache || String(node.id).startsWith('layer-view:'));
  frame.children.forEach((node) => visit(node, IDENTITY, 1, 0, node.id, node.id));
  return marks;
}

const coverage = (mark, b) => {
  // Share of box b covered by a filled mark, estimated on a 5 × 3 grid of sample points.
  let hit = 0,
    n = 0;
  for (let i = 0; i < 5; i++)
    for (let j = 0; j < 3; j++) {
      const pt = [b.x0 + ((b.x1 - b.x0) * (i + 0.5)) / 5, b.y0 + ((b.y1 - b.y0) * (j + 0.5)) / 3];
      n++;
      if (pt[0] < mark.box.x0 || pt[0] > mark.box.x1 || pt[1] < mark.box.y0 || pt[1] > mark.box.y1) continue;
      let inside = false;
      for (const r of mark.rings) if (insidePolygon(pt, r)) inside = !inside;
      if (inside) hit++;
    }
  return hit / n;
};
const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;
const label = (m) => (m.text ? `“${m.text.length > 32 ? m.text.slice(0, 31) + '…' : m.text}”` : `${m.type} ${m.id}`);

/**
 * Check one sampled frame. Returns findings ({rule, severity, ids, message, value}) and measures
 * ({texts, words, units, marks}). `displayWidth` is the CSS width the stage is shown at.
 */
export function auditFrame(frame, spec = {}) {
  options(
    spec,
    ['measure', 'background', 'displayWidth', 'rules', 'tagsOf', 'ignoreTags', 'marks', 'steady', 'rendererStats'],
    'audit frame',
  );
  const rules = { ...RULES, ...(spec.rules ?? {}) },
    displayWidth = number(spec.displayWidth ?? 1280, 'display width', 120, 8192);
  const px = displayWidth / frame.width,
    bg = parseColor(spec.background ?? '#ffffff') ?? [1, 1, 1, 1];
  const marks = spec.marks ?? frameMarks(frame, { measure: spec.measure }),
    tagsOf = spec.tagsOf ?? (() => []),
    ignore = new Set(spec.ignoreTags ?? ['decor', 'background']);
  const stage = { x0: 0, y0: 0, x1: frame.width, y1: frame.height },
    stageArea = area(stage),
    findings = [];
  const texts = marks.filter((m) => m.kind === 'text'),
    settled = texts.filter((t) => t.opacity >= rules.settled);
  const report = (rule, severity, ids, message, value) => findings.push({ rule, severity, ids, message, value });
  for (const t of settled) {
    const css = t.fontSize * px,
      bold = t.fontWeight >= 600;
    // Cut off by the frame.
    const visible = area(intersect(t.box, stage)) / Math.max(1e-9, area(t.box));
    if (visible < 0.98)
      report(
        'offFrame',
        visible < 0.6 ? 'error' : 'warning',
        [t.id],
        `${label(t)} is ${Math.round((1 - visible) * 100)}% outside the frame.`,
        1 - visible,
      );
    if (visible < 0.3) continue;
    if (css < rules.minText)
      report(
        'smallText',
        'warning',
        [t.id],
        `${label(t)} is ${css.toFixed(1)} px at a ${displayWidth} px display (minimum ${rules.minText}).`,
        css,
      );
    if (t.blur * px > rules.blur)
      report(
        'blurredText',
        'warning',
        [t.id],
        `${label(t)} is blurred by ${(t.blur * px).toFixed(1)} px.`,
        t.blur * px,
      );
    // Background under the text: composite every filled mark painted before it that covers its centre.
    let under = bg.slice(0, 3),
      texturedUnder = false;
    const centre = [(t.box.x0 + t.box.x1) / 2, (t.box.y0 + t.box.y1) / 2];
    for (const m of marks) {
      if (m.index >= t.index) break;
      if (
        m.kind !== 'fill' ||
        m.cloud ||
        centre[0] < m.box.x0 ||
        centre[0] > m.box.x1 ||
        centre[1] < m.box.y0 ||
        centre[1] > m.box.y1
      )
        continue;
      let inside = false;
      for (const r of m.rings) if (insidePolygon(centre, r)) inside = !inside;
      if (inside) {
        under = over(m.color, m.color[3] * m.opacity, under);
        texturedUnder ||= m.textured;
      }
    }
    // Contrast is judged once the text's opacity holds still: a fade is not a reading state, a dim is.
    if (t.color && (!spec.steady || spec.steady.has(t.id))) {
      const ink = over(t.color, t.color[3] * Math.min(1, t.opacity), under),
        ratio = contrastRatio(ink, under);
      const need =
        css >= rules.contrast.largeSize || (bold && css >= rules.contrast.largeBoldSize)
          ? rules.contrast.large
          : rules.contrast.normal;
      if (ratio < need)
        report(
          'contrast',
          ratio < need * 0.75 ? 'error' : 'warning',
          [t.id],
          `${label(t)} ${hexOf(ink)} on ${hexOf(under)} is ${ratio.toFixed(2)}:1 (needs ${need}:1${texturedUnder ? ', textured ground' : ''}).`,
          ratio,
        );
    }
    // Marks painted across the words, gathered per text so a web of lines is one finding.
    const core = inset(t.box, 0.12),
      crossed = { above: [], below: [] };
    for (const m of marks) {
      if (m === t || m.opacity < 0.25 || (m.root === t.root && m.path.startsWith(t.path))) continue;
      if (m.box.x1 < core.x0 || m.box.x0 > core.x1 || m.box.y1 < core.y0 || m.box.y0 > core.y1) continue;
      if (m.kind === 'stroke') {
        let crossing = 0;
        for (const l of m.lines) for (let i = 1; i < l.length; i++) crossing += segmentHitsBox(l[i - 1], l[i], core);
        if (crossing < Math.min(core.x1 - core.x0, core.y1 - core.y0) * 0.5) continue;
        const above = m.index > t.index;
        // A line under the text is hidden if an opaque card sits between them.
        if (
          !above &&
          marks.some(
            (c) =>
              c.kind === 'fill' &&
              !c.cloud &&
              c.index > m.index &&
              c.index < t.index &&
              c.color[3] * c.opacity > 0.9 &&
              coverage(c, t.box) > 0.9,
          )
        )
          continue;
        crossed[above ? 'above' : 'below'].push({ m, crossing });
      } else if (m.kind === 'fill' && !m.cloud && m.index > t.index && m.color[3] * m.opacity > 0.3) {
        // Sparse point clouds (confetti, sparks) are not judged as covering.
        const share = coverage(m, t.box);
        if (share >= rules.cover)
          report(
            'coveredText',
            share > 0.5 ? 'error' : 'warning',
            [t.id, m.id],
            `${label(m)} covers ${Math.round(share * 100)}% of ${label(t)}.`,
            share,
          );
      }
    }
    // Busy ground: distinct shapes from other objects whose edges show through behind the words
    // (bunting, a crowd, a chart). A ground that covers the whole text, or a card under the text, is calm.
    const behind = [];
    for (const m of marks) {
      if (m.index >= t.index) break;
      if (m.kind !== 'fill' || m.cloud || m.opacity < 0.25 || m.root === t.root) continue;
      if (m.box.x1 < core.x0 || m.box.x0 > core.x1 || m.box.y1 < core.y0 || m.box.y0 > core.y1) continue;
      const share = coverage(m, t.box);
      if (share > 0.97) {
        if (m.color[3] * m.opacity > 0.9) behind.length = 0;
        continue;
      } // an opaque ground resets what shows
      const overlap = area(intersect(m.box, t.box)) / Math.max(1e-9, area(t.box));
      if (overlap > 0.01 && contrastRatio(over(m.color, m.color[3] * m.opacity, under), under) > 1.25) behind.push(m);
    }
    const owners = [...new Set(behind.map((m) => m.root))];
    if (behind.length >= rules.busyGround)
      report(
        'busyGround',
        'warning',
        [t.id],
        `${label(t)} sits on ${behind.length} separate shapes (from ${owners.slice(0, 3).join(', ')}${owners.length > 3 ? ', …' : ''}); give it a card or clear space.`,
        behind.length,
      );
    for (const side of ['above', 'below']) {
      const list = crossed[side];
      if (!list.length) continue;
      const total = list.reduce((a, c) => a + c.crossing, 0),
        named = list
          .sort((a, b) => b.crossing - a.crossing)
          .slice(0, 3)
          .map((c) => label(c.m))
          .join(', ');
      const count = list.length === 1 ? named : `${list.length} lines (${named}${list.length > 3 ? ', …' : ''})`;
      report(
        side === 'above' ? 'strokeOverText' : 'textOverStrokes',
        side === 'above' ? 'error' : 'warning',
        [t.id],
        `${count} ${side === 'above' ? (list.length === 1 ? 'is' : 'are') + ' drawn over' : (list.length === 1 ? 'runs' : 'run') + ' under'} ${label(t)} (${total.toFixed(0)} px inside the words).`,
        total,
      );
    }
  }
  // Cards: opaque panels that hold settled text. Their padding, balance and purpose are judged.
  const cards = [];
  for (const m of marks) {
    if (m.kind !== 'fill' || m.cloud || m.color[3] * m.opacity < 0.85 || area(m.box) > stageArea * 0.25) continue;
    const held = settled.filter((t) => t.index > m.index && coverage(m, t.box) > 0.97);
    if (held.length) cards.push({ m, held });
  }
  for (const { m: c, held } of cards) {
    // Content: the held words plus marks painted on the card after it (icons, rules, numbers).
    const content = [
      ...held,
      ...marks.filter(
        (x) =>
          x.index > c.index &&
          x.kind !== 'text' &&
          x.opacity >= 0.25 &&
          area(intersect(x.box, c.box)) >= area(x.box) * 0.9 &&
          area(x.box) < area(c.box) * 0.8,
      ),
    ];
    const box = boxOf(
        content.flatMap((x) => [
          [x.box.x0, x.box.y0],
          [x.box.x1, x.box.y1],
        ]),
      ),
      em = Math.max(...held.map((t) => t.fontSize));
    const pad = {
      left: box.x0 - c.box.x0,
      right: c.box.x1 - box.x1,
      top: box.y0 - c.box.y0,
      bottom: c.box.y1 - box.y1,
    };
    const name = held.length === 1 ? label(held[0]) : `${label(held[0])} and ${held.length - 1} more`;
    const tightest = Object.entries(pad).sort((a, b) => a[1] - b[1])[0];
    // Text widths are estimates without the browser's font metrics: a spill under 0.15 em is reported as padding.
    if (tightest[1] < -em * 0.15)
      report(
        'cardOverflow',
        'error',
        [c.id, held[0].id],
        `${name} spills ${(-tightest[1]).toFixed(0)} px past the ${tightest[0]} edge of its card.`,
        -tightest[1],
      );
    else if (tightest[1] < em * rules.card.padding)
      report(
        'cardPadding',
        'warning',
        [c.id],
        `The card around ${name} leaves ${tightest[1].toFixed(0)} px on the ${tightest[0]} (${(tightest[1] / em).toFixed(2)} em; guide ≥ ${rules.card.padding} em).`,
        tightest[1] / em,
      );
    const ring = c.rings[0],
      polyArea =
        Math.abs(
          ring.reduce((sum, p, i) => {
            const q = ring[(i + 1) % ring.length];
            return sum + p[0] * q[1] - q[0] * p[1];
          }, 0),
        ) / 2;
    const rectangular = polyArea / Math.max(1e-9, area(c.box)) > 0.88; // a speech bubble's tail is not a margin, and it points at a speaker rather than hiding anything
    if (rectangular)
      for (const [a, b] of [
        ['left', 'right'],
        ['top', 'bottom'],
      ]) {
        const big = Math.max(pad[a], pad[b]),
          small = Math.min(pad[a], pad[b]);
        if (big > em * 0.5 && (big - small) / big > rules.card.balance)
          report(
            'cardBalance',
            'warning',
            [c.id],
            `The card around ${name} is lopsided: ${pad[a].toFixed(0)} px ${a}, ${pad[b].toFixed(0)} px ${b}.`,
            (big - small) / big,
          );
      }
    // What the card hides: separate shapes behind it from other objects.
    const hidden = marks.filter(
      (x) =>
        x.index < c.index &&
        x.root !== c.root &&
        x.kind !== 'text' &&
        !x.cloud &&
        x.opacity >= 0.25 &&
        area(intersect(x.box, c.box)) > 0 &&
        area(x.box) < area(c.box) * 4,
    );
    if (rectangular && hidden.length >= rules.card.coverUp)
      report(
        'coverUp',
        'warning',
        [c.id],
        `The card around ${name} sits over ${hidden.length} shapes from ${new Set(hidden.map((x) => x.root)).size} objects. If it is there to hide them, place the words in clear space or choose colours that read on the scene instead.`,
        hidden.length,
      );
  }
  // Panels over data: a strong line (a curve, a link) passing under any opaque panel or card loses that stretch.
  // Faint lines (gridlines, rules) are ground; strong ones are content.
  for (const c of marks) {
    if (
      c.kind !== 'fill' ||
      c.cloud ||
      c.color[3] * c.opacity < 0.85 ||
      area(c.box) > stageArea * 0.25 ||
      area(c.box) < stageArea * 0.004
    )
      continue;
    const ring = c.rings[0],
      fillArea =
        Math.abs(
          ring.reduce((sum, p, i) => {
            const q = ring[(i + 1) % ring.length];
            return sum + p[0] * q[1] - q[0] * p[1];
          }, 0),
        ) / 2;
    if (fillArea / Math.max(1e-9, area(c.box)) < 0.88) continue; // speech bubbles point at a speaker; they are not panels
    for (const m of marks) {
      if (
        m.kind !== 'stroke' ||
        m.index >= c.index ||
        m.root === c.root ||
        m.opacity < 0.4 ||
        contrastRatio(over(m.color, m.color[3] * m.opacity, c.color), c.color) < 2
      )
        continue;
      if (m.box.x1 < c.box.x0 || m.box.x0 > c.box.x1 || m.box.y1 < c.box.y0 || m.box.y0 > c.box.y1) continue;
      let hidden = 0;
      for (const l of m.lines)
        for (let i = 1; i < l.length; i++) hidden += segmentHitsBox(l[i - 1], l[i], inset(c.box, 0.04));
      let total = 0;
      for (const l of m.lines)
        for (let i = 1; i < l.length; i++) total += Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]);
      if (hidden > 40 && hidden < total * 0.98)
        report(
          'hidesData',
          'warning',
          [c.id, m.id],
          `${label(c)} is painted over ${hidden.toFixed(0)} px of ${label(m)}; move the panel off the line.`,
          hidden,
        );
    }
  }
  // Effect budget: the renderer refuses frames over it, and the pixel half grows with the screen size,
  // so a scene that renders in a small window can fail full screen. Invisible effect nodes still count.
  {
    let nodes = 0,
      passes = 0;
    const walk = (n, parent = [1, 0, 0, 1, 0, 0]) => {
      const p = n.props ?? {},
        matrix = multiply(parent, localMatrix(p, n));
      if (blurRadius(p.blur) > 0 || p.glow || p.shade || p.texture) {
        const sx = Math.hypot(matrix[0], matrix[1]),
          sy = Math.hypot(matrix[2], matrix[3]),
          dot = matrix[0] * matrix[2] + matrix[1] * matrix[3],
          scale = Math.max(sx, sy, 1e-12),
          deviation = Math.max(Math.abs(sx - sy) / scale, Math.abs(dot) / (scale * scale));
        if (sx <= 1e-6 || sy <= 1e-6 || deviation > 1e-8)
          report(
            'effectTransform',
            'error',
            [n.id],
            `Filtered node ${n.id} has a nonuniform or skewed inherited transform. Put the effect on a uniformly scaled ancestor before rendering.`,
            deviation,
          );
      }
      if (blurRadius(p.blur) > 0 || p.glow || p.mask || p.shade || p.texture || (p.blend ?? 'normal') !== 'normal') {
        nodes++;
        passes += 1 + (blurRadius(p.blur) > 0 || p.glow ? 1 : 0) + (p.mask ? 1 : 0) + (p.shade ? 3 : p.texture ? 1 : 0);
      }
      for (const c of n.children ?? []) walk(c, matrix);
    };
    frame.children.forEach((n) => walk(n));
    const e = rules.effects,
      pixels = passes * e.width * e.height,
      load = Math.max(nodes / e.nodes, pixels / e.pixels);
    if (load > e.warn)
      report(
        'effectBudget',
        load > 1 ? 'error' : 'warning',
        [],
        `${nodes} effect nodes and ${(pixels / 1e6).toFixed(0)} M pass pixels at ${e.width}×${e.height} (limits ${e.nodes} and ${e.pixels / 1e6} M). Share one glow or shade on a parent group.`,
        load,
      );
  }
  if (cards.length > rules.card.boxes)
    report(
      'boxes',
      'warning',
      [],
      `${cards.length} boxed labels at once (guide ≤ ${rules.card.boxes}); boxes read as a form, not a picture.`,
      cards.length,
    );
  // Grounding: figures in one semantic group (a crowd, a cast) should share the ground they stand on.
  // The ground is inferred, not declared: the large shape most of the group's feet land on. A figure
  // whose feet stop above that ground's top edge, while standing within its width, is floating.
  const figures = new Map();
  for (const m of marks) {
    if (m.opacity < 0.25) continue;
    const tags = tagsOf(m.root);
    if (!tags.length || tags.some((t) => ignore.has(t))) continue;
    const f = figures.get(m.root) ?? { root: m.root, group: tags[tags.length - 1], first: m.index, n: 0, box: m.box };
    f.n++;
    f.box = {
      x0: Math.min(f.box.x0, m.box.x0),
      y0: Math.min(f.box.y0, m.box.y0),
      x1: Math.max(f.box.x1, m.box.x1),
      y1: Math.max(f.box.y1, m.box.y1),
    };
    figures.set(m.root, f);
  }
  const grounds = marks.filter(
    (m) =>
      m.kind === 'fill' && !m.cloud && m.color[3] * m.opacity > 0.5 && area(intersect(m.box, stage)) > stageArea * 0.03,
  );
  const groups = new Map();
  for (const f of figures.values()) {
    if (f.n < 6 || f.box.y1 - f.box.y0 > frame.height * 0.9) continue; // a figure is a multi-part drawing, not a backdrop
    const foot = [(f.box.x0 + f.box.x1) / 2, f.box.y1 - 1];
    let surface = null;
    for (const g of grounds) {
      if (g.index >= f.first || g.root === f.root) continue;
      let inside = false;
      for (const r of g.rings) if (insidePolygon(foot, r)) inside = !inside;
      if (inside) surface = g;
    }
    f.foot = foot;
    f.surface = surface;
    groups.set(f.group, [...(groups.get(f.group) ?? []), f]);
  }
  for (const [group, list] of groups) {
    if (list.length < 3) continue;
    const votes = new Map();
    for (const f of list) if (f.surface) votes.set(f.surface, (votes.get(f.surface) ?? 0) + 1);
    const [ground, count] = [...votes].sort((a, b) => b[1] - a[1])[0] ?? [];
    if (!ground || count < list.length / 2) continue;
    for (const f of list) {
      if (f.surface === ground || f.foot[0] < ground.box.x0 || f.foot[0] > ground.box.x1) continue;
      const lift = ground.box.y0 - f.foot[1];
      if (lift > frame.height * 0.005)
        report(
          'floating',
          'warning',
          [f.root],
          `${f.root} in “${group}” stands ${lift.toFixed(0)} px above the ground the rest of its group stands on (${count} of ${list.length} on ${ground.id}).`,
          lift,
        );
    }
  }
  // Colour-coded labels: a word in a kind's colour should sit near a mark of that colour (its line, bar or dot).
  const hue = (c) => {
    const [r, g, b] = c,
      max = Math.max(r, g, b),
      min = Math.min(r, g, b),
      d = max - min,
      l = (max + min) / 2;
    if (d < 0.25) return null; // chroma, not HSL saturation: pale tints are not colour codes
    void l;
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  };
  const gapBetween = (a, b) => Math.hypot(Math.max(0, a.x0 - b.x1, b.x0 - a.x1), Math.max(0, a.y0 - b.y1, b.y0 - a.y1));
  for (const t of settled) {
    const h = t.color && hue(t.color);
    if (h === null || h === undefined) continue;
    const kin = marks.filter(
      (m) =>
        m.kind !== 'text' &&
        m.opacity >= 0.25 &&
        m.color &&
        !m.cloud &&
        area(m.box) < stageArea * 0.5 &&
        (() => {
          const k = hue(m.color);
          return k !== null && Math.min(Math.abs(k - h), 360 - Math.abs(k - h)) < 22;
        })(),
    );
    if (!kin.length) continue; // a coloured word with no coloured marks is emphasis, not a label
    const nearest = Math.min(...kin.map((m) => gapBetween(t.box, m.box)));
    if (nearest > frame.width * rules.orphan)
      report(
        'orphanLabel',
        'warning',
        [t.id],
        `${label(t)} is ${nearest.toFixed(0)} px from the nearest mark in its colour; put a label next to what it names.`,
        nearest,
      );
  }
  // Title-safe margin.
  const margin = frame.width * rules.safeArea;
  for (const t of settled) {
    const gap = Math.min(t.box.x0, t.box.y0, frame.width - t.box.x1, frame.height - t.box.y1);
    if (gap >= 0 && gap < margin)
      report(
        'safeArea',
        'warning',
        [t.id],
        `${label(t)} is ${gap.toFixed(0)} px from the frame edge (title-safe ≥ ${margin.toFixed(0)} px).`,
        gap,
      );
  }
  // Text colliding with text.
  for (let i = 0; i < settled.length; i++)
    for (let j = i + 1; j < settled.length; j++) {
      const a = settled[i],
        b = settled[j],
        shared = area(intersect(a.box, b.box)),
        share = shared / Math.max(1e-9, Math.min(area(a.box), area(b.box)));
      if (share > rules.textOverlap)
        report(
          'textOverlap',
          'error',
          [a.id, b.id],
          `${label(a)} and ${label(b)} overlap by ${Math.round(share * 100)}%.`,
          share,
        );
    }
  // Clutter: separate units in view. Roots that share a tag form one unit; ignored tags and
  // backgrounds that fill most of the stage do not count.
  const unitBoxes = new Map(),
    unitLook = new Map(),
    inked = new Set(),
    unitInk = new Map();
  for (const m of marks) {
    if (m.opacity < 0.25) continue;
    const tags = tagsOf(m.root);
    if (tags.some((t) => ignore.has(t))) continue;
    if (m.kind === 'fill' && area(intersect(m.box, stage)) > stageArea * 0.6) continue;
    if (area(intersect(m.box, stage)) <= 0) continue;
    const key = tags.length ? `tag:${tags[tags.length - 1]}` : `root:${m.root}`;
    if (m.kind !== 'fill') inked.add(key);
    if (!unitLook.has(key))
      unitLook.set(
        key,
        `${m.kind}:${m.type}:${m.color ? hexOf(m.color) : ''}:${Math.round(Math.log2(Math.max(1, area(m.box))))}`,
      );
    if (unitInk.has(key)) unitInk.set(key, null);
    else
      unitInk.set(
        key,
        m.kind === 'stroke' && m.lines.length === 1 && m.lines[0].length <= 128
          ? { points: m.lines[0], width: m.width }
          : null,
      );
    const b = unitBoxes.get(key);
    unitBoxes.set(
      key,
      b
        ? {
            x0: Math.min(b.x0, m.box.x0),
            y0: Math.min(b.y0, m.box.y0),
            x1: Math.max(b.x1, m.box.x1),
            y1: Math.max(b.y1, m.box.y1),
          }
        : m.box,
    );
  }
  // What a viewer counts as one thing: units that nest (a label on its card) or that sit close together
  // and look alike (a grid of cells, a row of guests) merge, using the library's Gestalt grouping.
  // A large plain panel (a card behind a chart) is ground: it is neither counted nor allowed to chain its contents together.
  for (const [key, b] of [...unitBoxes])
    if (!inked.has(key) && area(intersect(b, stage)) > stageArea * 0.12) unitBoxes.delete(key);
  const items = [...unitBoxes].map(([key, b]) => ({
    id: key,
    bounds: { x: b.x0, y: b.y0, width: Math.max(0, b.x1 - b.x0), height: Math.max(0, b.y1 - b.y0) },
    similarity: unitLook.get(key),
  }));
  let inkBudget = items.length * 4;
  for (const item of items) {
    const ink = unitInk.get(item.id),
      extra = ink ? ink.points.length - 1 - 4 : 0;
    if (ink && inkBudget + extra <= 2800) {
      item.ink = ink.points;
      item.inkWidth = ink.width;
      inkBudget += extra;
    }
  }
  let units = items.length;
  if (items.length > 1 && items.length <= 512)
    units = perceptualGroups(items, {
      distance: Math.min(frame.width, frame.height) * 0.012,
      similarityDistance: Math.min(frame.width, frame.height) * 0.04,
    }).groups.length;
  const nested = new Set();
  // Only a small container (a card, a badge) absorbs what sits on it; a panel behind a whole composition does not.
  for (const a of items)
    for (const b of items)
      if (
        a !== b &&
        !nested.has(b.id) &&
        area(unitBoxes.get(b.id)) <= stageArea * 0.12 &&
        area(intersect(unitBoxes.get(a.id), unitBoxes.get(b.id))) >= area(unitBoxes.get(a.id)) * 0.9 &&
        area(unitBoxes.get(a.id)) <= area(unitBoxes.get(b.id))
      ) {
        nested.add(a.id);
        break;
      }
  units = Math.max(1, Math.min(units, items.length - nested.size));
  if (!items.length) units = 0;
  const wordCount = settled.reduce((n, t) => n + words(t.text), 0);
  if (units > rules.clutter.units)
    report('clutter', 'warning', [], `${units} separate things on screen (guide ≤ ${rules.clutter.units}).`, units);
  if (wordCount > rules.clutter.words)
    report('wordy', 'warning', [], `${wordCount} words on stage at once (guide ≤ ${rules.clutter.words}).`, wordCount);
  const renderer = spec.rendererStats === undefined ? null : auditRendererStats(spec.rendererStats);
  findings.push(
    ...instanceGeometryFindings(frame, tagsOf, number(rules.instanceOutside, 'instance outside threshold', 0, 1)),
  );
  if (renderer) findings.push(...renderer.findings);
  return {
    findings,
    measures: {
      texts: settled.length,
      words: wordCount,
      units,
      marks: marks.length,
      ...(renderer ? { renderer: renderer.measures } : {}),
    },
  };
}

/** Warn from actual last-frame renderer counters; missing counters remain unmeasured. */
export function auditRendererStats(input, spec = {}) {
  options(spec, ['isolatedLimit'], 'renderer audit');
  const stats = safeCopy(input),
    limit = number(spec.isolatedLimit ?? 50, 'isolated layer warning limit', 0, 1e9);
  assert(
    stats && !Array.isArray(stats) && typeof stats === 'object',
    'INVALID_AUDIT',
    'Provide a renderer stats snapshot.',
  );
  const counter = (key) => {
    if (stats[key] === undefined) return null;
    const value = number(stats[key], key, 0, 1e9);
    assert(Number.isInteger(value), 'INVALID_AUDIT', `${key} must be an integer counter.`);
    return value;
  };
  const clampedFilters = counter('clampedFilters'),
    isolatedLayers = counter('isolatedLayers'),
    findings = [];
  if (clampedFilters > 0)
    findings.push({
      rule: 'clampedFilters',
      severity: 'warning',
      ids: [],
      message: `${clampedFilters} filter radii were clamped in the rendered frame. Review the intended zoomed appearance.`,
      value: clampedFilters,
      evidence: 'measured-renderer-stats',
    });
  if (isolatedLayers > limit)
    findings.push({
      rule: 'isolatedLayers',
      severity: 'warning',
      ids: [],
      message: `${isolatedLayers} isolated layers were rendered (guide ≤ ${limit}). Consider grouping effects or batching compatible primitives.`,
      value: isolatedLayers,
      evidence: 'measured-renderer-stats',
    });
  return { findings, measures: { clampedFilters, isolatedLayers, source: 'renderer' } };
}

/**
 * Sample a scene over [from, to] at `fps` and audit every frame. Findings that persist are merged into
 * spans; text dwell (time on screen against reading time) and onset bursts are judged across frames.
 * Returns {spans, frames, summary}. `sample(time)` overrides how a frame is taken.
 */
export function auditScene(scene, spec = {}) {
  options(
    spec,
    [
      'from',
      'to',
      'fps',
      'measure',
      'background',
      'displayWidth',
      'rules',
      'ignoreTags',
      'sample',
      'exclude',
      'rendererStats',
    ],
    'audit scene',
  );
  assert(
    spec.rendererStats === undefined || typeof spec.rendererStats === 'function',
    'INVALID_AUDIT',
    'Scene rendererStats must be a callback sampling the current frame.',
  );
  const fps = number(spec.fps ?? 10, 'audit fps', 0.1, 120),
    from = number(spec.from ?? 0, 'audit from', 0, 86400),
    to = number(spec.to ?? scene.duration, 'audit to', from, 86400);
  const rules = { ...RULES, ...(spec.rules ?? {}) },
    exclude = spec.exclude ?? (() => false);
  let cameraId = null;
  const sample =
      spec.sample ??
      ((time) => {
        const sampled = scene.sampleView({ time });
        cameraId = sampled.view ? (sampled.frame.children[0]?.id ?? null) : null;
        return sampled.frame;
      }),
    tagsOf = (id) => scene.tagsOf?.(id) ?? [];
  const open = new Map(),
    spans = [],
    frames = [],
    active = new Map(),
    runs = [],
    onsets = [];
  let lastOpacity = new Map(),
    nextOpacity = new Map();
  const step = 1 / fps,
    count = Math.max(1, Math.floor((to - from) * fps + 1e-9) + 1);
  for (let k = 0; k < count; k++) {
    const time = Math.min(to, from + k * step),
      t0 = performance.now();
    const frame = sample(time),
      sampleMs = performance.now() - t0;
    const marks = frameMarks(frame, { measure: spec.measure, cameraId }).filter((m) => !exclude(m));
    const steady = new Set();
    for (const m of marks)
      if (m.kind === 'text') {
        const before = lastOpacity.get(m.id);
        if (before !== undefined && Math.abs(before - m.opacity) < 0.02) steady.add(m.id);
        nextOpacity.set(m.id, m.opacity);
      }
    lastOpacity = nextOpacity;
    nextOpacity = new Map();
    const widths = Array.isArray(spec.displayWidth)
      ? spec.displayWidth
      : spec.displayWidth === undefined
        ? [1280, 390]
        : [spec.displayWidth];
    assert(widths.length > 0 && widths.length <= 8, 'INVALID_AUDIT', 'Audit 1–8 display widths.');
    const reports = widths.map((displayWidth) => ({
      displayWidth,
      ...auditFrame(frame, {
        marks,
        steady,
        measure: spec.measure,
        background: spec.background,
        displayWidth,
        rules: spec.rules,
        tagsOf,
        ignoreTags: spec.ignoreTags,
        rendererStats: spec.rendererStats?.(time, frame),
      }),
    }));
    const findings = [],
      seenFindings = new Set(),
      measures = reports[0].measures;
    for (const report of reports)
      for (const finding of report.findings) {
        const key = JSON.stringify(finding);
        if (!seenFindings.has(key)) {
          seenFindings.add(key);
          findings.push({ ...finding, displayWidth: report.displayWidth });
        }
      }
    if (sampleMs > rules.cost.sampleMs)
      findings.push({
        rule: 'frameCost',
        severity: 'warning',
        ids: [],
        message: `Sampling took ${sampleMs.toFixed(1)} ms (budget ${rules.cost.sampleMs} ms).`,
        value: sampleMs,
      });
    if (marks.length > rules.cost.marks)
      findings.push({
        rule: 'markCount',
        severity: 'warning',
        ids: [],
        message: `${marks.length} painted marks (budget ${rules.cost.marks}).`,
        value: marks.length,
      });
    frames.push({ time, sampleMs, ...measures });
    // Merge findings into spans by rule and node IDs.
    const now = new Set();
    for (const f of findings) {
      const key = `${f.rule}|${f.ids.join(',')}|${f.displayWidth ?? ''}`;
      now.add(key);
      const span = open.get(key);
      if (span) {
        span.end = time;
        span.frames++;
        if (worse(f, span)) Object.assign(span, { value: f.value, message: f.message, severity: f.severity, at: time });
      } else {
        const s = { ...f, start: time, end: time, at: time, frames: 1 };
        open.set(key, s);
        spans.push(s);
      }
    }
    for (const key of [...open.keys()]) if (!now.has(key)) open.delete(key);
    // Dwell: each continuous run of a settled text is one reading opportunity.
    const present = new Set();
    for (const m of marks)
      if (m.kind === 'text' && m.opacity >= rules.settled) {
        // Keyed by node, so a live counter whose digits change is one reading opportunity.
        const key = m.id;
        present.add(key);
        const run = active.get(key);
        if (run) {
          run.last = time;
          run.text = m.text;
        } else active.set(key, { id: m.id, text: m.text, first: time, last: time });
      }
    for (const [key, run] of active)
      if (!present.has(key)) {
        runs.push(run);
        active.delete(key);
      }
    // Onsets: growth in perceived units since the previous frame.
    if (frames.length > 1) {
      const gain = measures.units - frames[frames.length - 2].units;
      for (let g = 0; g < gain; g++) onsets.push(time);
    }
  }
  // Runs still on screen when the window ends, or already on screen when it began, are not judged.
  for (const d of runs.filter((r) => r.first > from + 1e-9)) {
    const shown = d.last - d.first + step,
      need = Math.max(rules.reading.minimum, rules.reading.lead + words(d.text) / rules.reading.wordsPerSecond);
    if (shown + 1e-9 < need)
      spans.push({
        rule: 'readingTime',
        severity: shown < need * 0.5 ? 'error' : 'warning',
        ids: [d.id],
        message: `“${d.text.length > 32 ? d.text.slice(0, 31) + '…' : d.text}” is readable for ${shown.toFixed(1)} s; it needs about ${need.toFixed(1)} s.`,
        value: shown,
        start: d.first,
        end: d.last,
        at: d.first,
        frames: Math.round(shown * fps),
      });
  }
  // Onset bursts: more new perceived things than the guide within any one-second window.
  const burst = onsets;
  for (let i = 0, j = 0; i < burst.length; i++) {
    while (burst[i] - burst[j] > 1) j++;
    const n = i - j + 1;
    if (n > rules.clutter.onsetsPerSecond && (i + 1 === burst.length || burst[i + 1] - burst[j] > 1))
      spans.push({
        rule: 'onsetBurst',
        severity: 'warning',
        ids: [],
        message: `${n} new things appear within one second (guide ≤ ${rules.clutter.onsetsPerSecond}).`,
        value: n,
        start: burst[j],
        end: burst[i],
        at: burst[j],
        frames: 1,
      });
  }
  // A collision or faint frame seen in a single sample is usually a fade or a pass-through: keep it, as a warning.
  for (const s of spans)
    if (s.frames === 1 && s.severity === 'error' && s.rule !== 'readingTime') {
      s.severity = 'warning';
      s.transient = true;
    }
  spans.sort((a, b) => a.start - b.start || a.rule.localeCompare(b.rule));
  const byRule = {};
  for (const s of spans) {
    byRule[s.rule] ??= { error: 0, warning: 0 };
    byRule[s.rule][s.severity]++;
  }
  const p95 = (xs) => {
    const v = [...xs].sort((a, b) => a - b);
    return v.length ? v[Math.max(0, Math.ceil(0.95 * v.length) - 1)] : null;
  };
  return {
    spans,
    frames,
    summary: {
      from,
      to,
      fps,
      frames: frames.length,
      errors: spans.filter((s) => s.severity === 'error').length,
      warnings: spans.filter((s) => s.severity === 'warning').length,
      byRule,
      peakUnits: Math.max(0, ...frames.map((f) => f.units)),
      peakWords: Math.max(0, ...frames.map((f) => f.words)),
      sampleMsP95: p95(frames.map((f) => f.sampleMs)),
      marksMax: Math.max(0, ...frames.map((f) => f.marks)),
    },
  };
}
const SEVERITY = { warning: 1, error: 2 };
function worse(f, span) {
  if (SEVERITY[f.severity] !== SEVERITY[span.severity]) return SEVERITY[f.severity] > SEVERITY[span.severity];
  return f.rule === 'contrast' || f.rule === 'smallText' || f.rule === 'readingTime'
    ? f.value < span.value
    : f.value > span.value;
}
