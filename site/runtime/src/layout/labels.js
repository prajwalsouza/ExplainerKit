import { assert, number, options, safeCopy, text } from '../core/validate.js';
import { toRGBA } from '../color/index.js';
import { contrastRGB } from '../color/perceptual.js';

function rectangle(value, label) {
  options(value, ['x', 'y', 'width', 'height'], label);
  return {
    x: number(value.x ?? 0, `${label} x`),
    y: number(value.y ?? 0, `${label} y`),
    width: number(value.width, `${label} width`, 0, 8192),
    height: number(value.height, `${label} height`, 0, 8192),
  };
}
const overlap = (a, b, gap) =>
  a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;

/** Bounded constructive placement. Every returned measured box fits and avoids all prior boxes. */
export function placeLabels(input, spec) {
  options(spec, ['bounds', 'measure', 'obstacles', 'gap'], 'label placement');
  const labels = safeCopy(input),
    bounds = rectangle(spec.bounds, 'label bounds');
  const gap = number(spec.gap ?? 4, 'label gap', 0, 1000);
  assert(Array.isArray(labels) && labels.length <= 256, 'RESOURCE_LIMIT', 'Use at most 256 measured labels.');
  assert(
    typeof spec.measure === 'function',
    'INVALID_LABEL_MEASURE',
    'Supply a synchronous text measurer after loading the intended font.',
  );
  const rawObstacles = safeCopy(spec.obstacles ?? []);
  assert(
    Array.isArray(rawObstacles) && rawObstacles.length <= 256,
    'RESOURCE_LIMIT',
    'Use at most 256 label obstacles.',
  );
  const obstacles = rawObstacles.map((o) => rectangle(o, 'label obstacle')),
    ids = new Set();
  const measured = labels.map((label) => {
    options(label, ['id', 'text', 'anchor'], 'label');
    text(label.id, 'label ID', 200);
    text(label.text, 'label text');
    assert(label.id && !ids.has(label.id), 'DUPLICATE_ID', 'Use distinct nonempty label IDs.');
    ids.add(label.id);
    options(label.anchor, ['x', 'y'], 'label anchor');
    const anchor = { x: number(label.anchor.x, 'anchor x'), y: number(label.anchor.y, 'anchor y') };
    const size = spec.measure(label.text);
    options(size, ['width', 'height'], 'text measurement');
    return {
      id: label.id,
      text: label.text,
      anchor,
      width: number(size.width, 'measured width', 0, 8192),
      height: number(size.height, 'measured height', Number.MIN_VALUE, 8192),
    };
  });
  const placed = [];
  for (const label of measured) {
    const { anchor: a, width: w, height: h } = label;
    const candidates = [
      [a.x + gap, a.y - h / 2],
      [a.x - w - gap, a.y - h / 2],
      [a.x - w / 2, a.y - h - gap],
      [a.x - w / 2, a.y + gap],
      [a.x + gap, a.y - h - gap],
      [a.x - w - gap, a.y - h - gap],
      [a.x + gap, a.y + gap],
      [a.x - w - gap, a.y + gap],
    ];
    const selected = candidates
      .map(([x, y]) => ({ id: label.id, text: label.text, x, y, width: w, height: h }))
      .find(
        (box) =>
          box.x >= bounds.x &&
          box.y >= bounds.y &&
          box.x + w <= bounds.x + bounds.width &&
          box.y + h <= bounds.y + bounds.height &&
          [...obstacles, ...placed].every((other) => !overlap(box, other, gap)),
      );
    assert(
      selected,
      'LABEL_LAYOUT_OVERFLOW',
      `No supported collision-free placement for ${label.id}; enlarge the region, change anchors or author another layout.`,
    );
    placed.push(Object.freeze(selected));
  }
  return Object.freeze(placed);
}

/** Caller owns the context and font loading. A fixed lineHeight bounds a single unwrapped line. */
export function canvasTextMeasurer(context, spec) {
  options(spec, ['font', 'lineHeight'], 'canvas text measurer');
  assert(
    context && typeof context.measureText === 'function',
    'INVALID_LABEL_MEASURE',
    'Use a Canvas 2D text measurement context.',
  );
  const font = text(spec.font, 'font', 300),
    height = number(spec.lineHeight, 'line height', Number.MIN_VALUE, 8192);
  assert(font.length > 0, 'INVALID_LABEL_MEASURE', 'Supply an explicit font.');
  return (value) => {
    text(value, 'label text');
    assert(
      !/[\r\n]/.test(value),
      'INVALID_LABEL_MEASURE',
      'Measure one line at a time; supply explicit multiline boxes to placeLabels.',
    );
    const previous = context.font;
    try {
      context.font = font;
      return { width: number(context.measureText(value).width, 'measured width', 0, 8192), height };
    } finally {
      context.font = previous;
    }
  };
}

/**
 * Place names around a circle, following the rules of a well-set radial chart.
 *
 * A rim label belongs to a mark that covers `span` radians. When that arc is at least `wideArc` wide, or the name
 * fits along it, the name stands upright just outside the rim, aligned away from the centre. A narrower mark gets
 * its name along the radius, like a spoke, so neighbours stack side by side instead of on top of each other.
 * Neighbours that would still collide slide apart around the rim by at most `maxShift` radians, spokes keep at
 * least `spokeGap` radians apart, and whatever still collides gives way to the neighbour with the higher
 * `priority`. The `keep` ID is never hidden.
 *
 * A label with a `band` ({r0, r1}) is set inside its own mark instead: along the radius at the band's middle, as a
 * box as long as the band (86%) that wraps to two lines when the arc is wide enough, and hidden when the arc cannot
 * hold one line. Give the mark's `fill` and the label returns `ink`, the `light` or `dark` text colour with the
 * higher contrast against it.
 *
 * Work is bounded: at most 256 labels, 40 relaxation passes and one hiding pass per label.
 * @param {ReadonlyArray<{id: string, text: string, angle: number, span?: number, priority?: number, r?: number,
 *          band?: {r0: number, r1: number}, fill?: string}>} input
 * @param {{cx: number, cy: number, r: number, measure: (text: string) => {width: number, height: number},
 *          gap?: number, maxShift?: number, wideArc?: number, spokeGap?: number, keep?: string | null,
 *          light?: string, dark?: string}} spec
 */
export function placeRadialLabels(input, spec) {
  options(
    spec,
    ['cx', 'cy', 'r', 'measure', 'gap', 'maxShift', 'wideArc', 'spokeGap', 'keep', 'light', 'dark'],
    'radial label placement',
  );
  const labels = safeCopy(input);
  assert(Array.isArray(labels) && labels.length <= 256, 'RESOURCE_LIMIT', 'Use at most 256 radial labels.');
  assert(typeof spec.measure === 'function', 'INVALID_LABEL_MEASURE', 'Supply a synchronous text measurer.');
  const TAU = 2 * Math.PI;
  const cx = number(spec.cx, 'label centre x'),
    cy = number(spec.cy, 'label centre y'),
    rim = number(spec.r, 'label radius', 1, 1e6),
    gap = number(spec.gap ?? 3, 'label gap', 0, 1000),
    maxShift = number(spec.maxShift ?? 0.12, 'label shift', 0, Math.PI),
    wideArc = number(spec.wideArc ?? 0.16, 'wide arc', 0, TAU),
    spokeGap = number(spec.spokeGap ?? 0.045, 'spoke gap', 0, Math.PI),
    keep = spec.keep ?? null;
  const light = toRGBA(spec.light ?? '#fdfaf6'),
    dark = toRGBA(spec.dark ?? '#26232a');
  const ids = new Set();
  const items = labels.map((label) => {
    options(label, ['id', 'text', 'angle', 'span', 'priority', 'r', 'band', 'fill'], 'radial label');
    const id = text(label.id, 'label ID', 200);
    assert(id && !ids.has(id), 'DUPLICATE_ID', 'Use distinct nonempty label IDs.');
    ids.add(id);
    const name = text(label.text, 'label text');
    const size = spec.measure(name);
    options(size, ['width', 'height'], 'text measurement');
    const width = number(size.width, 'measured width', 0, 8192),
      height = number(size.height, 'measured height', 0, 8192);
    const angle = ((number(label.angle, 'label angle', -1e3, 1e3) % TAU) + TAU) % TAU;
    const span = number(label.span ?? 0, 'label span', 0, TAU);
    const r = number(label.r ?? rim, 'label radius', 0, 1e6);
    const base = { id, text: name, want: angle, angle, span, r, width, height, visible: true };
    base.priority = number(label.priority ?? 0, 'label priority', -1e9, 1e9);
    if (label.band) {
      options(label.band, ['r0', 'r1'], 'label band');
      const r0 = number(label.band.r0, 'band inner radius', 0, 1e6),
        r1 = number(label.band.r1, 'band outer radius', r0, 1e6);
      const middle = (r0 + r1) / 2,
        across = span * middle;
      let ink = null;
      if (label.fill !== undefined) {
        const fill = toRGBA(label.fill);
        ink = contrastRGB(fill, light) >= contrastRGB(fill, dark) ? 'light' : 'dark';
      }
      return {
        ...base,
        inside: true,
        r: middle,
        box: { width: (r1 - r0) * 0.86, lines: across > 2.6 * height ? 2 : 1 },
        visible: across >= height * 0.9 && r1 - r0 > height,
        ink,
      };
    }
    const upright = span === 0 || span >= wideArc || span * r >= width * 0.9;
    // The angular room a label needs: its width for upright names at the rim, a line (or spokeGap) along a ray.
    const need = upright
      ? (Math.min(width, height * 2.2 + width * 0.35) + gap) / r
      : Math.max(spokeGap, (height * 0.8) / r);
    return { ...base, inside: false, upright, need };
  });
  const order = items.filter((l) => !l.inside).sort((a, b) => a.want - b.want);
  // Relax: neighbours closer than their combined half-needs push apart, each staying within maxShift of its mark.
  for (let pass = 0; pass < 40 && order.length > 1; pass++) {
    let moved = false;
    for (let i = 0; i < order.length; i++) {
      const a = order[i],
        b = order[(i + 1) % order.length];
      let d = b.angle - a.angle;
      if (i === order.length - 1) d += TAU;
      const room = (a.need + b.need) / 2;
      if (d >= room - 1e-9) continue;
      const push = (room - d) / 2;
      a.angle = Math.max(a.want - maxShift, a.angle - push);
      b.angle = Math.min(b.want + maxShift, b.angle + push);
      moved = true;
    }
    if (!moved) break;
  }
  for (let pass = 0; pass < order.length; pass++) {
    const shown = order.filter((l) => l.visible);
    let hid = false;
    for (let i = 0; i < shown.length && shown.length > 1; i++) {
      const a = shown[i],
        b = shown[(i + 1) % shown.length];
      let d = b.angle - a.angle;
      if (i === shown.length - 1) d += TAU;
      if (d + 1e-6 >= (a.need + b.need) / 2) continue;
      const loser =
        a.id === keep
          ? b
          : b.id === keep
            ? a
            : a.priority < b.priority || (a.priority === b.priority && a.width > b.width)
              ? a
              : b;
      loser.visible = false;
      hid = true;
      break;
    }
    if (!hid) break;
  }
  return Object.freeze(
    items.map((l) => {
      const c = Math.cos(l.angle),
        s = Math.sin(l.angle),
        flip = c < 0;
      const ray = l.inside || !l.upright;
      return Object.freeze({
        id: l.id,
        text: l.text,
        x: cx + c * l.r,
        y: cy + s * l.r,
        angle: l.angle,
        orientation: l.inside ? 'inside' : l.upright ? 'upright' : 'ray',
        rotation: ray ? l.angle + (flip ? Math.PI : 0) : 0,
        align: l.inside
          ? 'middle'
          : l.upright
            ? c > 0.2
              ? 'start'
              : c < -0.2
                ? 'end'
                : 'middle'
            : flip
              ? 'end'
              : 'start',
        box: l.box ?? null,
        ink: l.ink ?? null,
        visible: l.visible,
      });
    }),
  );
}
