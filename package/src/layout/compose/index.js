import { labelCallout } from './label-callout.js';
import { applyPresence, presenceSpec } from '../../core/motion.js';
// Composition helpers: decide where things go, instead of checking afterwards where they went.
// They use the same measurements as the composition audit (src/audit), so a placement chosen here is one
// the audit will accept: words in clear space, labels next to what they name, ink that reads on its ground,
// lines that wrap, and panels whose padding comes from their content.
import { pathCommands } from '../../graphics/index.js';
import { assert, number, options, text as textValue } from '../../core/validate.js';
import { estimateText } from '../adaptive.js';
import { frameMarks, parseColor, contrastRatio, RULES } from '../../audit/index.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const area = (b) => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);
const intersect = (a, b) => ({
  x0: Math.max(a.x0, b.x0),
  y0: Math.max(a.y0, b.y0),
  x1: Math.min(a.x1, b.x1),
  y1: Math.min(a.y1, b.y1),
});
const hex = (c) =>
  '#' +
  c
    .slice(0, 3)
    .map((v) =>
      Math.round(clamp(v, 0, 1) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');

// ---- Ink -----------------------------------------------------------------------------------------
// Preserve the historical normalized-S/L helper contract through the shared color kernel.
import { fromRGBA, hslaToRGBA } from '../../color/space.js';
const toHsl = (rgb) => {
  const { h, s, l } = fromRGBA(...rgb);
  return [h, s / 100, l / 100];
};
const fromHsl = ([h, s, l]) => hslaToRGBA({ h, s: s * 100, l: l * 100 }).slice(0, 3);
/**
 * The colour of `hue`'s family that reads on `ground`: same hue and saturation, lightness moved just far
 * enough to reach the WCAG ratio for this text size (4.5:1, or 3:1 for large text). Returns a hex colour.
 * If the hue itself already passes it is returned unchanged.
 */
export function inkFor(ground, hue, spec = {}) {
  options(spec, ['size', 'weight', 'ratio'], 'inkFor');
  const g = parseColor(ground),
    h = parseColor(hue);
  assert(g && h, 'INVALID_COLOR', 'inkFor needs two solid colours.');
  const size = number(spec.size ?? 16, 'text size', 1, 1000),
    bold = (spec.weight ?? 400) >= 600;
  const need = number(
    spec.ratio ??
      (size >= RULES.contrast.largeSize || (bold && size >= RULES.contrast.largeBoldSize)
        ? RULES.contrast.large
        : RULES.contrast.normal),
    'contrast ratio',
    1,
    21,
  );
  if (contrastRatio(h, g) >= need) return hex(h);
  const goal = need * 1.01; // headroom so rounding to 8-bit channels cannot fall back under the ratio
  const [H, S, L] = toHsl(h),
    groundL = toHsl(g)[2];
  // Move away from the ground's lightness; if that end cannot reach the ratio, try the other end.
  for (const dir of groundL > 0.5 ? [-1, 1] : [1, -1]) {
    let lo = L,
      hi = dir < 0 ? 0 : 1;
    if (contrastRatio(fromHsl([H, S, hi]), g) < goal) continue;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (contrastRatio(fromHsl([H, S, mid]), g) >= goal) hi = mid;
      else lo = mid;
    }
    return hex(fromHsl([H, S, hi]));
  }
  return hex(groundL > 0.5 ? [0, 0, 0] : [1, 1, 1]);
}

// ---- Text ----------------------------------------------------------------------------------------
/** Greedy word wrap with the same estimate the audit uses (or a supplied measurer). Returns lines. */
export function wrapText(value, spec = {}) {
  options(spec, ['width', 'fontSize', 'fontWeight', 'measure'], 'wrapText');
  const width = number(spec.width, 'wrap width', 1, 1e5),
    size = number(spec.fontSize ?? 16, 'font size', 1, 1000),
    weight = spec.fontWeight ?? 400,
    measure = spec.measure ?? estimateText;
  const lines = [];
  for (const block of textValue(value, 'text').split(/\r?\n/)) {
    let line = '';
    for (const word of block.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && measure(next, size, weight) > width) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return Object.freeze(lines);
}
/**
 * Several lines of text as one group, one node per line (renderers draw one line per node).
 * `y` is the first line's middle; `lineHeight` is a multiple of `fontSize`. Returns {group, lines, width, height}.
 */
export function paragraph(scene, spec) {
  options(
    spec,
    ['text', 'x', 'y', 'width', 'fontSize', 'fontWeight', 'lineHeight', 'align', 'fill', 'measure', 'letterSpacing'],
    'paragraph',
  );
  const size = spec.fontSize ?? 24,
    weight = spec.fontWeight ?? 400,
    lead = number(spec.lineHeight ?? 1.3, 'line height', 0.8, 4) * size,
    measure = spec.measure ?? estimateText;
  const lines =
    spec.width === undefined
      ? textValue(spec.text, 'text').split(/\r?\n/)
      : wrapText(spec.text, { width: spec.width, fontSize: size, fontWeight: weight, measure });
  const group = scene.shape('group', { x: spec.x ?? 0, y: spec.y ?? 0 });
  lines.forEach((line, i) =>
    group.text({
      text: line,
      y: i * lead,
      fontSize: size,
      fontWeight: weight,
      fill: spec.fill ?? '#17181c',
      align: spec.align ?? 'start',
      baseline: 'middle',
      letterSpacing: spec.letterSpacing ?? 0,
    }),
  );
  return Object.freeze({
    group,
    lines,
    width: Math.max(0, ...lines.map((l) => measure(l, size, weight))),
    height: (lines.length - 1) * lead + size,
  });
}

// ---- Panels --------------------------------------------------------------------------------------
/**
 * A card sized from its words. Padding is in ems of the largest text (default 0.9, above the audit's 0.6
 * minimum) and equal on opposite sides, so it is never cramped or lopsided. `x, y` is the card's centre.
 * `lines` is [{text, fontSize, fontWeight, fill}] top to bottom. Returns {group, card, box}.
 */
export function panel(scene, spec) {
  options(spec, ['x', 'y', 'lines', 'padding', 'gap', 'fill', 'radius', 'measure', 'shade'], 'panel');
  const measure = spec.measure ?? estimateText,
    lines = spec.lines;
  assert(
    Array.isArray(lines) && lines.length > 0 && lines.length <= 64,
    'INVALID_PANEL',
    'A panel needs one to 64 lines.',
  );
  const sizes = lines.map((l) => ({ ...l, fontSize: l.fontSize ?? 24, fontWeight: l.fontWeight ?? 400 }));
  const em = Math.max(...sizes.map((l) => l.fontSize)),
    pad = number(spec.padding ?? 0.9, 'panel padding', 0, 8) * em,
    gap = number(spec.gap ?? 0.35, 'line gap', 0, 4);
  const w = Math.max(...sizes.map((l) => measure(l.text, l.fontSize, l.fontWeight))) + 2 * pad;
  const heights = sizes.map((l) => l.fontSize),
    inner = heights.reduce((a, b) => a + b, 0) + gap * em * (lines.length - 1),
    h = inner + 2 * pad;
  const group = scene.shape('group', { x: number(spec.x, 'panel x'), y: number(spec.y, 'panel y') });
  const r = number(spec.radius ?? Math.min(22, h / 4), 'panel radius', 0, 1e4);
  const card = group.rect({
    x: -w / 2,
    y: -h / 2,
    width: w,
    height: h,
    rx: r,
    fill: spec.fill ?? '#ffffff',
    ...(spec.shade ? { shade: spec.shade } : {}),
  });
  let y = -h / 2 + pad;
  sizes.forEach((l, i) => {
    group.text({
      text: l.text,
      x: 0,
      y: y + l.fontSize / 2,
      fontSize: l.fontSize,
      fontWeight: l.fontWeight,
      fill: l.fill ?? '#17181c',
      align: 'middle',
      baseline: 'middle',
    });
    y += l.fontSize + (i < lines.length - 1 ? gap * em : 0);
  });
  return Object.freeze({
    group,
    card,
    box: Object.freeze({ x: spec.x - w / 2, y: spec.y - h / 2, width: w, height: h }),
  });
}

// ---- Path points ----------------------------------------------------------------------------------
/** Point and unit tangent at arc-length fraction `u` (0–1) along absolute path commands (curves sampled). */
export function pathPoint(commands, u = 1) {
  const pts = [];
  let at = [0, 0];
  for (const c of commands) {
    if (c[0] === 'M' || c[0] === 'L') {
      at = [c[1], c[2]];
      pts.push(at);
    } else if (c[0] === 'Q') {
      const p0 = at;
      for (let i = 1; i <= 12; i++) {
        const t = i / 12,
          v = 1 - t;
        pts.push([v * v * p0[0] + 2 * v * t * c[1] + t * t * c[3], v * v * p0[1] + 2 * v * t * c[2] + t * t * c[4]]);
      }
      at = [c[3], c[4]];
    } else if (c[0] === 'C') {
      const p0 = at;
      for (let i = 1; i <= 12; i++) {
        const t = i / 12,
          v = 1 - t;
        pts.push([
          v ** 3 * p0[0] + 3 * v * v * t * c[1] + 3 * v * t * t * c[3] + t ** 3 * c[5],
          v ** 3 * p0[1] + 3 * v * v * t * c[2] + 3 * v * t * t * c[4] + t ** 3 * c[6],
        ]);
      }
      at = [c[5], c[6]];
    }
  }
  assert(pts.length >= 2, 'INVALID_PATH', 'pathPoint needs a path with at least two points.');
  const lengths = [0];
  for (let i = 1; i < pts.length; i++)
    lengths.push(lengths[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const target = clamp(number(u, 'path fraction', 0, 1), 0, 1) * lengths.at(-1);
  let i = 1;
  while (i < pts.length - 1 && lengths[i] < target) i++;
  const seg = lengths[i] - lengths[i - 1] || 1,
    k = clamp((target - lengths[i - 1]) / seg, 0, 1),
    a = pts[i - 1],
    b = pts[i],
    len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return Object.freeze({
    x: a[0] + (b[0] - a[0]) * k,
    y: a[1] + (b[1] - a[1]) * k,
    tx: (b[0] - a[0]) / len,
    ty: (b[1] - a[1]) / len,
  });
}

// ---- Attachment -----------------------------------------------------------------------------------
const SIDES = ['right', 'left', 'above', 'below', 'center', 'end'];
/**
 * Keep `label` next to `target` at every frame. `side`: right, left, above, below, center, or end (the
 * drawn end of a path, following its trim). `gap` is the clear space in scene units. The label's own
 * alignment is set to suit the side. Returns the label.
 */
export function attach(label, target, spec = {}) {
  options(spec, ['side', 'gap', 'dx', 'dy', 'from', 'until'], 'attach');
  const from = number(spec.from ?? 0, 'attach from', 0, 86400),
    until = number(spec.until ?? 86400, 'attach until', from, 86400);
  let last = { x: 0, y: 0 };
  const scene = label._scene,
    side = spec.side ?? 'right',
    gap = number(spec.gap ?? 14, 'attach gap', 0, 1e4),
    dx = number(spec.dx ?? 0, 'attach dx'),
    dy = number(spec.dy ?? 0, 'attach dy');
  assert(SIDES.includes(side), 'INVALID_ATTACH', `Attach to one of ${SIDES.join(', ')}.`);
  assert(
    target?._scene === scene && target !== label,
    'INVALID_ATTACH',
    'Attach a label to another node of the same scene.',
  );
  if (label._record.type === 'text')
    label.set({
      align: side === 'left' ? 'end' : side === 'right' || side === 'end' ? 'start' : 'middle',
      baseline: 'middle',
    });
  // Outside [from, until] the label holds its last position and the target is not measured (no cost).
  label.bind(['x', 'y'], {
    inputs: [],
    map: (c) => {
      if (c.time < from || c.time > until) return last;
      const at = scene.locate(target, { time: c }),
        b = at.box ?? { x: at.x, y: at.y, width: 0, height: 0 };
      if (side === 'end') {
        const r = target._record;
        assert(r.type === 'path', 'INVALID_ATTACH', 'side: end needs a path target.');
        const props = scene._evaluateOwn(r, c).props,
          p = pathPoint(props.commands, props.trimEnd ?? 1),
          m = at.matrix;
        return (last = { x: m[0] * p.x + m[2] * p.y + m[4] + gap + dx, y: m[1] * p.x + m[3] * p.y + m[5] + dy });
      }
      const cx = b.x + b.width / 2,
        cy = b.y + b.height / 2;
      const pos = {
        right: [b.x + b.width + gap, cy],
        left: [b.x - gap, cy],
        above: [cx, b.y - gap],
        below: [cx, b.y + b.height + gap],
        center: [cx, cy],
      }[side];
      return (last = { x: pos[0] + dx, y: pos[1] + dy });
    },
  });
  return label;
}

// ---- Clear-space placement ------------------------------------------------------------------------
/**
 * Find a position for a box of `width × height` near `near` that stays clear of what is drawn during
 * [from, to]. Obstacles are the scene's marks, except those tagged with `ignore` (default decor and
 * background) and grounds covering more than half the stage. Candidates spiral out from `near`, trying
 * the preferred side first. Returns {x, y, box, clear, overlap}; x, y is the box centre. `clear: false`
 * means no clear spot was found within `radius`; the least obstructed one is returned.
 */
export function place(scene, spec) {
  options(
    spec,
    [
      'width',
      'height',
      'text',
      'fontSize',
      'fontWeight',
      'near',
      'from',
      'to',
      'fps',
      'ignore',
      'avoid',
      'region',
      'margin',
      'prefer',
      'radius',
      'measure',
      'exclude',
    ],
    'place',
  );
  const measure = spec.measure ?? estimateText,
    size = spec.fontSize ?? 24;
  const width =
      spec.width ??
      (spec.text !== undefined ? measure(textValue(spec.text, 'text'), size, spec.fontWeight ?? 400) : undefined),
    height = spec.height ?? (spec.text !== undefined ? size * 1.1 : undefined);
  number(width, 'place width', 1, 1e5);
  number(height, 'place height', 1, 1e5);
  const near = spec.near?._scene
    ? (() => {
        const b = scene.locate(spec.near, { time: spec.from ?? 0 }).box;
        return { x: b.x + b.width / 2, y: b.y + b.height / 2, box: b };
      })()
    : { x: number(spec.near?.x ?? scene.width / 2, 'near x'), y: number(spec.near?.y ?? scene.height / 2, 'near y') };
  const from = number(spec.from ?? 0, 'place from', 0, 86400),
    to = number(spec.to ?? from, 'place to', from, 86400),
    fps = number(spec.fps ?? 4, 'place fps', 0.1, 60);
  const ignore = new Set(spec.ignore ?? ['decor', 'background']),
    margin = number(spec.margin ?? 12, 'place margin', 0, 1e4);
  const region = spec.region ?? {
    x: scene.width * 0.035,
    y: scene.width * 0.035,
    width: scene.width * 0.93,
    height: scene.height - scene.width * 0.07,
  };
  const exclude = new Set((spec.exclude ?? []).map((h) => h.id ?? h));
  // Obstacles across the time span, in scene space (world, before the camera).
  const obstacles = [],
    stage = scene.width * scene.height,
    steps = Math.max(1, Math.min(48, Math.ceil((to - from) * fps) + 1));
  for (let i = 0; i < steps; i++) {
    const time = steps === 1 ? from : from + ((to - from) * i) / (steps - 1);
    for (const m of frameMarks(scene.sampleWorld({ time }), { measure })) {
      if (m.opacity < 0.2 || exclude.has(m.root) || scene.tagsOf(m.root).some((t) => ignore.has(t))) continue;
      if (m.kind === 'fill' && area(m.box) > stage * 0.5) continue;
      obstacles.push({
        box: { x0: m.box.x0 - margin, y0: m.box.y0 - margin, x1: m.box.x1 + margin, y1: m.box.y1 + margin },
        weight: m.kind === 'text' ? 4 : m.kind === 'stroke' ? 1.5 : 1,
      });
    }
  }
  const cost = (b) => obstacles.reduce((sum, o) => sum + o.weight * area(intersect(o.box, b)), 0);
  const inside = (b) =>
    b.x0 >= region.x && b.y0 >= region.y && b.x1 <= region.x + region.width && b.y1 <= region.y + region.height;
  const order =
    { above: [-Math.PI / 2], below: [Math.PI / 2], right: [0], left: [Math.PI] }[spec.prefer ?? 'any'] ?? [];
  const radius = number(spec.radius ?? Math.max(scene.width, scene.height), 'place radius', 0, 1e5);
  let best = null;
  for (let r = 0; r <= radius; r += Math.max(8, Math.min(width, height) * 0.5)) {
    const angles = r === 0 ? [0] : [...order, ...Array.from({ length: 16 }, (_, k) => (k * Math.PI) / 8)];
    for (const a of angles) {
      // The box is pushed off the reference box when one exists, so it never covers what it labels.
      const ox = near.box ? Math.cos(a) * (near.box.width / 2 + width / 2) : 0,
        oy = near.box ? Math.sin(a) * (near.box.height / 2 + height / 2) : 0;
      const cx = near.x + ox + Math.cos(a) * r,
        cy = near.y + oy + Math.sin(a) * r,
        b = { x0: cx - width / 2, y0: cy - height / 2, x1: cx + width / 2, y1: cy + height / 2 };
      if (!inside(b)) continue;
      const c = cost(b),
        score = c * 1e3 + Math.hypot(cx - near.x, cy - near.y) + (order.includes(a) ? 0 : 40);
      if (!best || score < best.score) best = { x: cx, y: cy, box: b, overlap: c, score };
    }
    if (best && best.overlap === 0 && r > 0) break;
  }
  assert(best, 'NO_PLACEMENT_REGION', 'The box does not fit inside the placement region.');
  return Object.freeze({
    x: best.x,
    y: best.y,
    box: Object.freeze({ x: best.box.x0, y: best.box.y0, width, height }),
    clear: best.overlap === 0,
    overlap: best.overlap,
  });
}

/** A target-local anchor, scene-space ring and measured moving panel with an edge-to-edge leader.
 * @param {any} scene
 * @param {{target:any,anchor?:number[],ring?:number,panel?:{width?:number,height?:number,side?:string,content?:any,fill?:string},route?:string,at?:number,style?:string,label?:{text:string,font:any,size?:number,at?:number[],offset?:number[],fill?:any,gap?:number},timing?:{ring?:number,line?:number,panel?:number,word?:number},gap?:number,stroke?:string,strokeWidth?:number}} spec
 */
export function callout(scene, spec) {
  if (Object.getOwnPropertyDescriptor(spec ?? {}, 'style')?.value === 'label') return labelCallout(scene, spec);
  options(
    spec,
    ['target', 'anchor', 'ring', 'panel', 'route', 'at', 'style', 'timing', 'gap', 'stroke', 'strokeWidth'],
    'callout',
  );
  const target = spec.target;
  assert(
    target?._scene === scene && scene._containsRecord(target._record),
    'INVALID_CALLOUT',
    'Use a live target of this scene.',
  );
  const anchor = spec.anchor ?? [0, 0];
  assert(Array.isArray(anchor) && anchor.length === 2, 'INVALID_CALLOUT', 'Anchor must contain two local coordinates.');
  const ax = number(Object.getOwnPropertyDescriptor(anchor, 0)?.value, 'anchor x'),
    ay = number(Object.getOwnPropertyDescriptor(anchor, 1)?.value, 'anchor y');
  const ps = spec.panel ?? {};
  options(ps, ['width', 'height', 'side', 'content', 'fill'], 'callout panel');
  const width = number(ps.width ?? 240, 'panel width', 1, 8192),
    height = number(ps.height ?? 140, 'panel height', 1, 8192),
    radius = number(spec.ring ?? 24, 'ring radius', 0.01, 8192),
    gap = number(spec.gap ?? 20, 'callout gap', 0, 8192),
    at = number(spec.at ?? 0, 'callout time', 0, 86400),
    route = spec.route ?? 'elbow',
    side = ps.side ?? 'auto';
  assert(['elbow', 'straight'].includes(route), 'INVALID_CALLOUT', 'Use elbow or straight routing.');
  assert(
    ['auto', 'left', 'right', 'above', 'below'].includes(side),
    'INVALID_CALLOUT',
    'Use auto, left, right, above or below panel side.',
  );
  assert(spec.style === undefined || spec.style === 'hud', 'INVALID_CALLOUT', 'The supported callout style is hud.');
  const timing = spec.timing ?? {};
  options(timing, ['ring', 'line', 'panel'], 'callout timing');
  const ringDuration = number(timing.ring ?? 0.25, 'ring duration', 0.001, 60),
    lineDuration = number(timing.line ?? 0.5, 'line duration', 0.001, 60),
    panelDuration = number(timing.panel ?? 0.3, 'panel duration', 0.001, 60);
  assert(
    at + ringDuration + lineDuration + panelDuration <= 86400,
    'INVALID_CALLOUT',
    'Callout reveal exceeds the timeline.',
  );
  const stroke = spec.stroke ?? '#ffffff',
    strokeWidth = number(spec.strokeWidth ?? 2, 'callout stroke width', 0, 100);
  // Preflight paints, sizing, capacity and content before adding any scene records.
  const probe = scene.component({ type: 'circle', props: { r: radius, fill: 'none', stroke, strokeWidth } });
  void probe;
  const content = ps.content;
  if (content?._record) {
    assert(
      content._scene === scene &&
        scene._isAdoptableRoot(content) &&
        !content._record.detached &&
        !scene._pathTo(target._record).includes(content._record),
      'INVALID_CALLOUT',
      'Panel content must be a distinct live root outside the target ancestry.',
    );
    const depth = (r) => Math.max(0, ...[...r.children.values()].map((c) => 1 + depth(c)));
    assert(depth(content._record) + 1 <= 24, 'RESOURCE_LIMIT', 'Panel content exceeds hierarchy depth.');
  } else if (content !== undefined)
    assert(
      content?.scene === scene && content.definition,
      'INVALID_CALLOUT',
      'Use a component or root handle as panel content.',
    );
  const contentCount =
    content && !content._record
      ? (function count(b) {
          return 1 + Object.values(b.children).reduce((n, c) => n + count(c), 0);
        })(content.definition)
      : 0;
  if (content && !content._record) {
    const depth = (b) => Math.max(0, ...Object.values(b.children).map((c) => 1 + depth(c)));
    assert(depth(content.definition) + 1 <= 24, 'RESOURCE_LIMIT', 'Panel component exceeds hierarchy depth.');
  }
  scene._capacity(4 + contentCount);
  scene.component({ type: 'rect', props: { width, height, fill: ps.fill ?? '#182c3b' } });
  const initial = scene.locate(target, { time: at });
  assert(initial.box, 'INVALID_CALLOUT', 'Callout target needs measurable geometry.');
  let preferred = side;
  if (side === 'auto') {
    const placement = place(scene, {
      width,
      height,
      near: target,
      from: at,
      margin: gap,
      exclude: content?._record ? [content] : [],
    });
    const dx = placement.x - (initial.box.x + initial.box.width / 2),
      dy = placement.y - (initial.box.y + initial.box.height / 2);
    preferred = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'below' : 'above';
  }
  const ringPresence = {
      enter: presenceSpec('enter', at, { style: 'pop', duration: ringDuration }),
      exit: null,
      dim: null,
    },
    panelPresence = {
      enter: presenceSpec('enter', at + ringDuration + lineDuration, { style: 'pop', duration: panelDuration }),
      exit: null,
      dim: null,
    };
  const geometry = (context) => {
    const rp = { scaleX: 1, scaleY: 1 },
      pp = { scaleX: 1, scaleY: 1 };
    applyPresence(ringPresence, rp, context.time);
    applyPresence(panelPresence, pp, context.time);
    const ringRadius = radius * rp.scaleX,
      pw = width * pp.scaleX,
      ph = height * pp.scaleY;
    const located = scene.locate(target, { time: context }),
      m = located.matrix,
      b = located.box;
    assert(b, 'INVALID_CALLOUT', 'Callout target lost its geometry.');
    const x = m[0] * ax + m[2] * ay + m[4],
      y = m[1] * ax + m[3] * ay + m[5];
    const candidate = (direction) => {
      let px = x,
        py = y;
      if (direction === 'right') px = Math.max(b.x + b.width, x + ringRadius) + gap + pw / 2;
      if (direction === 'left') px = Math.min(b.x, x - ringRadius) - gap - pw / 2;
      if (direction === 'below') py = Math.max(b.y + b.height, y + ringRadius) + gap + ph / 2;
      if (direction === 'above') py = Math.min(b.y, y - ringRadius) - gap - ph / 2;
      return { x: px, y: py };
    };
    let center = candidate(preferred);
    if (side === 'auto') {
      const overflow = (p) =>
        Math.max(0, pw / 2 - p.x) +
        Math.max(0, p.x + pw / 2 - context.width) +
        Math.max(0, ph / 2 - p.y) +
        Math.max(0, p.y + ph / 2 - context.height);
      for (const direction of ['right', 'left', 'above', 'below']) {
        const p = candidate(direction);
        if (overflow(p) < overflow(center)) center = p;
      }
    }
    const end = {
        x: clamp(x, center.x - pw / 2, center.x + pw / 2),
        y: clamp(y, center.y - ph / 2, center.y + ph / 2),
      },
      dx = end.x - x,
      dy = end.y - y,
      len = Math.hypot(dx, dy);
    assert(len >= ringRadius, 'INVALID_CALLOUT', 'Panel intersects the ring.');
    const start = { x: x + (dx / len) * ringRadius, y: y + (dy / len) * ringRadius };
    const commands = [['M', start.x, start.y]];
    if (route === 'elbow' && Math.abs(dx) > 0.01 && Math.abs(dy) > 0.01) commands.push(['L', end.x, start.y]);
    commands.push(['L', end.x, end.y]);
    for (const value of [x, y, center.x, center.y]) number(value, 'callout world coordinate');
    return { x, y, center, commands: pathCommands(commands) };
  };
  // Validate the complete geometry before mutation; every binding later shares one immutable sample context.
  geometry(scene._context());
  return scene._batch(() => {
    const ring = scene.circle({ r: radius, fill: 'none', stroke, strokeWidth }),
      line = scene.path({ commands: [], fill: 'none', stroke, strokeWidth }),
      panelHandle = scene.shape('group', {});
    panelHandle.rect({ x: -width / 2, y: -height / 2, width, height, fill: ps.fill ?? '#182c3b' });
    if (content?._record) panelHandle.add(content);
    else if (content) panelHandle.instance(content);
    ring.bind(['x', 'y'], {
      map: (context) => {
        const g = geometry(context);
        return { x: g.x, y: g.y };
      },
    });
    panelHandle.bind(['x', 'y'], {
      map: (context) => {
        const p = geometry(context).center;
        return { x: p.x, y: p.y };
      },
    });
    line.bind('commands', { map: (context) => geometry(context).commands });
    ring.enter(at, { style: 'pop', duration: ringDuration });
    line
      .animate('trimEnd', { from: 0, to: 1, at: at + ringDuration, duration: lineDuration, ease: 'linear' })
      .enter(at + ringDuration, { style: 'cut' });
    panelHandle.enter(at + ringDuration + lineDuration, { style: 'pop', duration: panelDuration });
    return Object.freeze({ ring, line, panel: panelHandle });
  });
}

export { stage } from './staging.js';

/** Place a speech panel in clear space over a sampled interval, with a moving angled tail.
 * @param {import('../../characters/runtime.js').CharacterHandle} actor
 * @param {string} value
 * @param {{from?:number,to?:number,fontSize?:number,width?:number,padding?:number,fill?:string,ink?:string,prefer?:string,region?:{x:number,y:number,width:number,height:number},margin?:number,radius?:number,measure?:(text:string,size:number,weight:number)=>number}} [spec]
 */
export function bubble(actor, value, spec = {}) {
  options(
    spec,
    ['from', 'to', 'fontSize', 'width', 'padding', 'fill', 'ink', 'prefer', 'region', 'margin', 'radius', 'measure'],
    'speech bubble',
  );
  const target = actor?.handle,
    scene = target?._scene;
  assert(scene && typeof actor.inspect === 'function', 'INVALID_BUBBLE', 'bubble takes a live character.');
  target._live();
  const from = number(spec.from ?? 0, 'bubble from', 0, 86400),
    to = number(spec.to ?? from, 'bubble to', from, 86400),
    fontSize = number(spec.fontSize ?? 24, 'bubble font size', 1, 1000),
    measure = spec.measure ?? estimateText;
  const lines = wrapText(textValue(value, 'speech'), {
    width: number(spec.width ?? 240, 'speech width', 1, 8192),
    fontSize,
    measure,
  });
  assert(lines.length <= 64, 'RESOURCE_LIMIT', 'Speech bubble supports at most 64 lines.');
  const padding = number(spec.padding ?? 0.9, 'bubble padding', 0.6, 8),
    width = Math.max(...lines.map((line) => measure(line, fontSize, 400))) + padding * fontSize * 2,
    height = fontSize * lines.length + fontSize * 0.35 * (lines.length - 1) + padding * fontSize * 2;
  // Keep all scene marks, including other speakers' faces, as placement obstacles.
  const placement = place(scene, {
    width,
    height,
    near: target,
    from,
    to,
    measure,
    ignore: ['background', 'decor'],
    prefer: spec.prefer ?? 'above',
    region: spec.region,
    margin: spec.margin ?? 12,
    radius: spec.radius,
  });
  assert(
    placement.clear,
    'NO_CLEAR_SPACE',
    'No speech-bubble position clears the sampled scene; shorten the text or widen its region.',
  );
  const fill = spec.fill ?? '#ffffff',
    ink = spec.ink ?? '#17181c',
    body = panel(scene, {
      x: placement.x,
      y: placement.y,
      lines: lines.map((text) => ({ text, fontSize, fill: ink })),
      padding,
      fill,
      measure,
    });
  const tail = scene.path({ fill, commands: [] });
  const shape = scene.derive([], (context) => {
    const view = actor.inspect(context.time),
      part = view.parts.head ?? view.parts.body,
      px = view.root.x + (part?.x ?? 0) * view.root.scaleX,
      py = view.root.y + (part?.y ?? 0) * view.root.scaleY,
      b = placement.box,
      cx = placement.x,
      cy = placement.y,
      dx = px - cx,
      dy = py - cy,
      k = 1 / Math.max(Math.abs(dx) / (b.width / 2), Math.abs(dy) / (b.height / 2), 1),
      x = cx + dx * k,
      y = cy + dy * k,
      length = Math.hypot(dx, dy) || 1,
      nx = (-dy / length) * fontSize * 0.22,
      ny = (dx / length) * fontSize * 0.22;
    return [['M', x + nx, y + ny], ['L', px, py], ['L', x - nx, y - ny], ['Z']];
  });
  tail.bind('commands', { inputs: [shape], map: (commands) => commands });
  return Object.freeze({ ...body, tail, placement });
}
export { effectBatch } from './effect-batch.js';
