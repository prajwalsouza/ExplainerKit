import { localMatrix, localBounds } from '../core/transform.js';
// Adaptive layout: a deterministic, bounded planner that re-composes an authored scene for the screen it is
// shown on. It reads sampled frames plus the scene's semantics (its tag tree and adaptive policy), so an
// author draws one composition, say 1600 × 900, and the planner decides how to show it on a phone, a tall
// tablet or a short landscape strip.
//
// Grouping is semantic first, then perceptual (the Gestalt principles), then geometric:
//   - Common region: members of a tag the author marks `together` form one unit. A unit is never split,
//     wrapped or rearranged inside.
//   - Common fate: bounds are unions over the whole scene, so things that travel together, or travel
//     between places, keep those places in one block.
//   - Connectedness: a line or path spanning two regions joins them, because its bounds overlap both.
//   - Proximity: blocks come from clear gaps. When restacked, gaps between unrelated blocks stay larger
//     than gaps between the rows of one wrapped block.
//   - Similarity: things that share a tag keep the same scale wherever they land.
//   - Hierarchy: block scales differ by at most 2×, so a control or caption never dwarfs the main drawing.
//   - Order and alignment: reading order (top to bottom, then left to right) is kept; blocks share one axis.
// And from design §7.1: prefer the author's composition when it is readable; readable size before fit;
// uniform scaling only; report every candidate and the reason for the choice.
import { assert, number, options } from '../core/validate.js';
import { cloudBounds } from '../graphics/cloud.js';

const IDENTITY = [1, 0, 0, 1, 0, 0];
const multiply = (m, n) => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
/** translate(x, y) · rotate(rotation) · scale(scaleX, scaleY), the renderers' transform order. */

const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const scaleOf = (m) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
const union = (a, b) => ({
  x0: Math.min(a.x0, b.x0),
  y0: Math.min(a.y0, b.y0),
  x1: Math.max(a.x1, b.x1),
  y1: Math.max(a.y1, b.y1),
});
const width = (b) => b.x1 - b.x0,
  height = (b) => b.y1 - b.y0;

/** A rough text width when no measurer is supplied: about half an em per character. */
export const estimateText = (text, fontSize, fontWeight = 400) =>
  text.length * fontSize * (fontWeight >= 600 ? 0.58 : 0.54);

/** Corners that bound a node's own drawing, in its local space. */
function outline(node, measure) {
  const p = node.props,
    pad = p.stroke && p.stroke !== 'none' ? (p.strokeWidth ?? 1) / 2 : 0;
  switch (node.type) {
    case 'circle': {
      const r = (p.r ?? 0) + pad;
      return [
        [-r, -r],
        [r, r],
      ];
    }
    case 'cloud': {
      const b = cloudBounds(p.points, p.pointSize ?? 2);
      return b
        ? [
            [b.x, b.y],
            [b.x + b.width, b.y + b.height],
          ]
        : [];
    }
    case 'rect':
      return [
        [-pad, -pad],
        [(p.width ?? 0) + pad, (p.height ?? 0) + pad],
      ];
    case 'line':
      return [
        [Math.min(p.x1, p.x2) - pad, Math.min(p.y1, p.y2) - pad],
        [Math.max(p.x1, p.x2) + pad, Math.max(p.y1, p.y2) + pad],
      ];
    case 'path': {
      const b = localBounds(node);
      return p.commands?.length
        ? [
            [b.x - pad, b.y - pad],
            [b.x + b.width + pad, b.y + b.height + pad],
          ]
        : [];
    }
    case 'text': {
      if (p.textOutline) {
        const b = localBounds(node);
        return p.textOutline.length
          ? [
              [b.x - pad, b.y - pad],
              [b.x + b.width + pad, b.y + b.height + pad],
            ]
          : [];
      }
      if (!p.text) return [];
      const size = p.fontSize ?? 16,
        w = p.textAdvance ?? measure(p.text, size, p.fontWeight ?? 400);
      const x0 = p.align === 'middle' ? -w / 2 : p.align === 'end' ? -w : 0;
      const y0 = p.baseline === 'middle' ? -size / 2 : p.baseline === 'hanging' ? 0 : -size * 0.8;
      return [
        [x0, y0],
        [x0 + w, y0 + size],
      ];
    }
    default:
      return [];
  }
}

/** Frame-space bounds of a node and its descendants, whether any of it is visible, and the text sizes it shows. */
export function measureNode(node, measure = estimateText, parent = IDENTITY, alpha = 1) {
  const m = multiply(parent, localMatrix(node.props, node)),
    opacity = alpha * (node.props.opacity ?? 1);
  let box = null,
    visible = false;
  const texts = [],
    corners = outline(node, measure);
  if (corners.length) {
    const [[x0, y0], [x1, y1]] = corners;
    const pts = [
      [x0, y0],
      [x1, y0],
      [x0, y1],
      [x1, y1],
    ].map(([x, y]) => apply(m, x, y));
    box = {
      x0: Math.min(...pts.map((q) => q[0])),
      y0: Math.min(...pts.map((q) => q[1])),
      x1: Math.max(...pts.map((q) => q[0])),
      y1: Math.max(...pts.map((q) => q[1])),
    };
    if (opacity > 0.02) {
      visible = true;
      if (node.type === 'text') texts.push((node.props.fontSize ?? 16) * scaleOf(m));
    }
  }
  for (const child of node.children ?? []) {
    const inner = measureNode(child, measure, m, opacity);
    if (!inner) continue;
    visible ||= inner.visible;
    texts.push(...inner.texts);
    if (inner.box) box = box ? union(box, inner.box) : inner.box;
  }
  return box ? { box, visible, texts } : null;
}

/**
 * Study a scene over time. For each root node: the union of its visible bounds across the samples (common
 * fate), its last bounds, the text sizes it shows, and its tags. `exclude` skips nodes such as title cards.
 */
export function analyse(frames, { measure = estimateText, exclude = new Set(), tagsOf = () => [] } = {}) {
  assert(Array.isArray(frames) && frames.length > 0, 'INVALID_LAYOUT', 'Analyse at least one sampled frame.');
  const items = new Map();
  frames.forEach((frame) =>
    frame.children.forEach((node, order) => {
      if (exclude.has(node.id)) return;
      const m = measureNode(node, measure);
      if (!m) return;
      const item = items.get(node.id) ?? {
        id: node.id,
        order,
        box: null,
        last: null,
        texts: [],
        tags: tagsOf(node.id),
      };
      item.last = m.box;
      if (m.visible) {
        item.box = item.box ? union(item.box, m.box) : m.box;
        item.texts.push(...m.texts);
      }
      items.set(node.id, item);
    }),
  );
  return [...items.values()];
}

/** Common region: items that share a `together` tag become one unit. Everything else is its own unit. */
export function units(items, together = []) {
  const visible = items.filter((i) => i.box),
    byTag = new Map(),
    out = [];
  for (const item of visible) {
    const key = together.find((t) => item.tags.includes(t));
    if (!key) {
      out.push({ items: [item], box: { ...item.box }, tags: new Set(item.tags) });
      continue;
    }
    if (!byTag.has(key)) {
      const u = { items: [], box: { ...item.box }, tags: new Set(), together: key };
      byTag.set(key, u);
      out.push(u);
    }
    const u = byTag.get(key);
    u.items.push(item);
    u.box = union(u.box, item.box);
    item.tags.forEach((t) => u.tags.add(t));
  }
  return out;
}

/** Merge units whose extents overlap along one axis (with tolerance) into blocks, in reading order. */
function merge(list, axis, tolerance) {
  const [lo, hi, cross] = axis === 'y' ? ['y0', 'y1', 'x0'] : ['x0', 'x1', 'y0'];
  const sorted = [...list].sort((a, b) => a.box[lo] - b.box[lo] || a.box[cross] - b.box[cross]),
    out = [];
  for (const u of sorted) {
    const last = out.at(-1);
    if (last && u.box[lo] <= last.box[hi] + tolerance) {
      last.units.push(u);
      last.box = union(last.box, u.box);
    } else out.push({ units: [u], box: { ...u.box } });
  }
  return out;
}
/**
 * Proximity: horizontal bands of related content. Overlapping units share a band; then, as in Gestalt
 * proximity, distance is judged relatively: a gap much smaller than the scene's largest gap (a label under
 * its drawing) joins its neighbours, while the large gaps separate ideas.
 */
export function bandsOf(unitList, { tolerance = 8, near = 24, relative = 0.4, far = 96 } = {}) {
  const bands = merge(unitList, 'y', tolerance);
  const gaps = bands.slice(1).map((b, i) => b.box.y0 - bands[i].box.y1),
    widest = Math.max(0, ...gaps);
  const out = bands.length ? [bands[0]] : [];
  bands.slice(1).forEach((b, i) => {
    const gap = gaps[i];
    if (gap <= near || (gap < widest * relative && gap <= far)) {
      const last = out.at(-1);
      last.units.push(...b.units);
      last.box = union(last.box, b.box);
    } else out.push(b);
  });
  return out;
}
/** Columns inside a band, separated by clear horizontal gaps. Units are atomic, so together-groups never split. */
const columnsOf = (band, tolerance = 24) => merge(band.units, 'x', tolerance);

/** Wrap a band's columns into balanced rows, keeping their order. Rows of one band stay a family. */
function wrap(band, rows, family) {
  const cols = columnsOf(band);
  if (cols.length < 2 || rows < 2) return [{ ...band, family }];
  const per = Math.ceil(cols.length / rows),
    out = [];
  for (let i = 0; i < cols.length; i += per) {
    const part = cols.slice(i, i + per);
    out.push({ units: part.flatMap((c) => c.units), box: part.map((c) => c.box).reduce(union), family });
  }
  return out;
}

const tagsIn = (block) => new Set(block.units.flatMap((u) => [...u.tags]));

/**
 * Stack blocks top to bottom on one centre axis. Each block is scaled to the width (or all share the smallest
 * scale). Similarity: blocks that share a tag share the smallest of their scales. Proximity: rows of one
 * wrapped band sit closer together than separate bands.
 */
function stack(blocks, container, { shared, cap, gap, pad, ratio }) {
  const room = container.width - 2 * pad;
  let scales = blocks.map((b) => Math.min(cap, room / Math.max(1, width(b.box))));
  if (shared) {
    const s = Math.min(...scales);
    scales = scales.map(() => s);
  }
  const tags = blocks.map(tagsIn);
  for (let pass = 0; pass < 2; pass++) {
    blocks.forEach((_, i) =>
      blocks.forEach((__, j) => {
        if (i !== j && [...tags[i]].some((t) => tags[j].has(t))) scales[i] = scales[j] = Math.min(scales[i], scales[j]);
      }),
    );
  }
  // Hierarchy: no block may grow past `ratio` times the smallest, so a caption or control never dwarfs the main drawing.
  const smallest = Math.min(...scales);
  scales = scales.map((s) => Math.min(s, smallest * ratio));
  const gapAfter = (i) =>
    i < blocks.length - 1
      ? blocks[i].family !== undefined && blocks[i].family === blocks[i + 1].family
        ? gap * 0.5
        : gap
      : 0;
  const gaps = blocks.reduce((n, _, i) => n + gapAfter(i), 0);
  const total = () => blocks.reduce((n, b, i) => n + height(b.box) * scales[i], 0);
  const free = container.height - 2 * pad - gaps;
  if (total() > free) {
    const k = Math.max(0, free) / total();
    scales = scales.map((s) => s * k);
  }
  let y = (container.height - total() - gaps) / 2;
  return blocks.map((b, i) => {
    const s = scales[i],
      placed = {
        source: b.box,
        scale: s,
        x: (container.width - width(b.box) * s) / 2,
        y,
        family: b.family ?? i,
        ids: b.units.flatMap((u) => u.items.map((it) => it.id)),
      };
    y += height(b.box) * s + gapAfter(i);
    return placed;
  });
}

function fitPlacement(authored, container) {
  const s = Math.min(container.width / authored.width, container.height / authored.height);
  return {
    source: { x0: 0, y0: 0, x1: authored.width, y1: authored.height },
    scale: s,
    x: (container.width - authored.width * s) / 2,
    y: (container.height - authored.height * s) / 2,
    ids: [],
  };
}

function score(candidate, items, container, rules) {
  const { placements } = candidate,
    byId = new Map(placements.flatMap((p) => p.ids.map((id) => [id, p.scale])));
  const fit = placements[0].scale;
  const sizes = items.flatMap((it) => it.texts.map((t) => t * (byId.get(it.id) ?? fit)));
  const minText = sizes.length ? Math.min(...sizes) : Infinity;
  const used = placements.reduce((n, p) => n + width(p.source) * height(p.source) * p.scale ** 2, 0);
  const inside = placements.every(
    (p) =>
      p.x >= -0.5 &&
      p.y >= -0.5 &&
      p.x + width(p.source) * p.scale <= container.width + 0.5 &&
      p.y + height(p.source) * p.scale <= container.height + 0.5,
  );
  return {
    ...candidate,
    minText,
    coverage: used / (container.width * container.height),
    inside,
    readable: minText >= rules.minText,
  };
}

const PREFERENCE = ['authored', 'stacked-shared', 'stacked', 'wrapped'];
/** Fits first; then readable text (up to the target); then use of space; then closeness to the author's composition. */
function rank(a, b, target) {
  const ta = Math.min(a.minText, target),
    tb = Math.min(b.minText, target);
  if (Math.abs(ta - tb) > 0.25) return tb - ta;
  if (Math.abs(a.coverage - b.coverage) > 0.02) return b.coverage - a.coverage;
  return PREFERENCE.indexOf(a.mode) - PREFERENCE.indexOf(b.mode);
}

/**
 * Plan how an authored composition is shown in a container.
 * - `items`: from `analyse(frames, { tagsOf })`
 * - `authored`, `container`: { width, height }; the container in CSS pixels
 * - `policy`: a scene's `adaptivePolicy`: { together: [tags], minText, targetText }
 * Returns placements per root node ID, the fallback fit, and a report of every candidate considered.
 */
export function planLayout({ items, authored, container, policy = {}, gap = 28, pad = 12, cap = 1, ratio = 2 }) {
  options(policy, ['together', 'minText', 'targetText'], 'policy');
  for (const key of ['width', 'height']) {
    number(authored?.[key], `authored ${key}`, 1, 16384);
    number(container?.[key], `container ${key}`, 1, 16384);
  }
  const rules = {
    together: policy.together ?? [],
    minText: number(policy.minText ?? 12, 'minText', 1, 200),
    targetText: number(policy.targetText ?? 16, 'targetText', 1, 200),
  };
  const fit = fitPlacement(authored, container);
  const bands = bandsOf(units(items, rules.together));
  const settings = { cap: Math.max(cap, fit.scale), gap, pad, ratio: number(ratio, 'ratio', 1, 100) };

  const candidates = [{ mode: 'authored', placements: [fit] }];
  if (bands.length) {
    candidates.push({ mode: 'stacked', placements: stack(bands, container, { ...settings, shared: false }) });
    candidates.push({ mode: 'stacked-shared', placements: stack(bands, container, { ...settings, shared: true }) });
    // Wrap only bands that would otherwise drop below readable text, or below half size for drawings.
    const wrapped = bands.flatMap((b, family) => {
      const s = (container.width - 2 * pad) / width(b.box),
        sizes = b.units.flatMap((u) => u.items.flatMap((it) => it.texts));
      const needs = (sizes.length ? Math.min(...sizes) : Infinity) * s < rules.targetText || s < 0.5;
      return needs
        ? wrap(b, Math.min(3, Math.max(2, Math.round(0.5 / Math.max(s, 1e-6)))), family)
        : [{ ...b, family }];
    });
    if (wrapped.length > bands.length)
      candidates.push({ mode: 'wrapped', placements: stack(wrapped, container, { ...settings, shared: false }) });
  }
  const scored = candidates.map((c) => score(c, items, container, rules));
  const authoredPlan = scored[0];
  const chosen = authoredPlan.readable
    ? authoredPlan
    : (scored.filter((c) => c.inside).sort((a, b) => rank(a, b, rules.targetText))[0] ?? authoredPlan);

  const placements = chosen.mode === 'authored' ? [] : chosen.placements,
    assignment = new Map();
  for (const it of items) {
    const p = placements.find((q) => q.ids.includes(it.id));
    if (p) assignment.set(it.id, p);
  }
  // Nodes never visible while planning: members of a together group follow their group; others join the
  // block nearest their last known position.
  const groupHome = new Map();
  for (const it of items)
    for (const t of rules.together)
      if (it.tags.includes(t) && assignment.has(it.id)) groupHome.set(t, assignment.get(it.id));
  const centre = (b) => [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
  const distance = (a, b) => {
    const [ax, ay] = centre(a),
      [bx, by] = centre(b);
    return Math.hypot(ax - bx, ay - by);
  };
  for (const it of items) {
    if (assignment.has(it.id) || !placements.length || !it.last) continue;
    const group = rules.together.find((t) => it.tags.includes(t) && groupHome.has(t));
    assignment.set(
      it.id,
      group
        ? groupHome.get(group)
        : placements.reduce((best, q) => (distance(it.last, q.source) < distance(it.last, best.source) ? q : best)),
    );
  }
  return Object.freeze({
    mode: chosen.mode,
    container: { ...container },
    authored: { ...authored },
    fit,
    placements,
    assignment,
    readable: rules,
    report: Object.freeze({
      chosen: chosen.mode,
      reason:
        chosen === authoredPlan && authoredPlan.readable
          ? 'the authored composition is readable'
          : chosen.readable
            ? 'the most readable candidate that fits'
            : 'no candidate reaches the readable minimum; text is lifted to it',
      blocks: bands.length,
      candidates: scored.map((c) => ({
        mode: c.mode,
        minText: +c.minText.toFixed(2),
        coverage: +c.coverage.toFixed(3),
        inside: c.inside,
        readable: c.readable,
      })),
    }),
  });
}

function transformFor(plan, id) {
  const p = plan.assignment.get(id) ?? plan.fit;
  return { scale: p.scale, x: p.x - p.source.x0 * p.scale, y: p.y - p.source.y0 * p.scale };
}

/** Lift text below the readable minimum, in the node's own units, keeping its anchor. */
function floorText(node, scale, minText) {
  const s = scale * Math.abs(node.props.scaleY ?? 1);
  const props =
    node.type === 'text' && (node.props.fontSize ?? 16) * s < minText
      ? { ...node.props, fontSize: minText / s }
      : node.props;
  const children = node.children?.map((c) => floorText(c, s, minText));
  const same = props === node.props && (!children || children.every((c, i) => c === node.children[i]));
  return same ? node : { ...node, props, ...(children ? { children } : {}) };
}

/**
 * Re-compose one sampled frame with a plan. Each root node is wrapped in a placement group, so draw order and
 * node IDs are kept; text is lifted to the readable minimum. The result has the container's size.
 */
export function applyLayout(frame, plan) {
  return {
    width: plan.container.width,
    height: plan.container.height,
    children: frame.children.map((node) => {
      const t = transformFor(plan, node.id);
      return {
        id: `layout:${node.id}`,
        type: 'group',
        props: { x: t.x, y: t.y, scaleX: t.scale, scaleY: t.scale, rotation: 0, opacity: 1 },
        children: [floorText(node, t.scale, plan.readable.minText)],
      };
    }),
  };
}

/** Map a container point back to authored coordinates, through whichever placement it falls in. */
export function toAuthored(plan, point) {
  const hit =
    plan.placements.find(
      (p) =>
        point.x >= p.x - 16 &&
        point.x <= p.x + width(p.source) * p.scale + 16 &&
        point.y >= p.y - 16 &&
        point.y <= p.y + height(p.source) * p.scale + 16,
    ) ?? plan.fit;
  return { x: (point.x - hit.x) / hit.scale + hit.source.x0, y: (point.y - hit.y) / hit.scale + hit.source.y0 };
}
