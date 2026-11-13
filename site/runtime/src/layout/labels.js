import { assert, number, options, safeCopy, text } from '../core/validate.js';

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
