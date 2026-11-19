// A catalogue of radial views for a dropped CSV, after Nadieh Bremer's work. The table's shape decides which
// views fit; the reader moves between them, and every element keeps its identity (`key`), so one view morphs
// into the next instead of being replaced.
//
//   shape        views
//   time         bloom (rings of petals) · stream (a radial streamgraph)
//   membership   onion (entities inside, items outside, a curve per appearance, co-occurrence chords within;
//                after "An Ode to Cardcaptor Sakura") · chord (who appears with whom) · sunburst (entity › item)
//   flow         chord (from → to) · sunburst (from › to)
//   measure      sunburst (category › row) · packed (circles settled in clusters) · bars (radial, sorted)
//   numbers      spiral (sunflower) · packed · bars
//
// Every element is polar about the live point (radius 1 = the room the page leaves free), with a `tag` it
// belongs to and `rel` tags it connects to (for click-to-focus), and a read-out label.
import { hsla } from 'explainerkit/color';
import { randomAt } from 'explainerkit/noise';
import { placeRadialLabels } from 'explainerkit/layout/labels';
import { assert, number, options, safeCopy, text } from './validate.js';

/** Every computed colour goes through here: hue wrapped, saturation, lightness and alpha kept in range. */
export const tone = (h, sat, l, a = 1) =>
  hsla(
    ((h % 360) + 360) % 360,
    Math.max(0, Math.min(100, sat)),
    Math.max(0, Math.min(100, l)),
    Math.max(0, Math.min(1, a)),
  );
/**
 * Text on whole device pixels, at a whole-pixel size. Under the stage's fractional scale, canvas text lands
 * between pixels and reads soft, worst on 1x screens. `draw(k)` runs at the snapped point with an unscaled
 * transform (plus `angle`); `k` is the scale it replaced, for halo widths.
 */
export function crispText(ctx, x, y, size, weight, draw, angle = 0) {
  const m = ctx.getTransform(),
    k = Math.hypot(m.a, m.b),
    p = m.transformPoint({ x, y });
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, Math.round(p.x), Math.round(p.y));
  if (angle) ctx.rotate(angle);
  ctx.font = `${weight} ${Math.round(size * k)}px ${SANS}`;
  draw(k);
  ctx.restore();
}
/** The page's own type: the system sans, set like its captions. */
export const SANS = '-apple-system, "SF Pro Text", Inter, "Segoe UI", system-ui, sans-serif';
const TAU = Math.PI * 2,
  TOP = -Math.PI / 2,
  GOLDEN = Math.PI * (3 - Math.sqrt(5));
// Chord labels: arcs narrower than this (radians) are named along the radius; spokes keep this angle apart.
const WIDE_ARC = 0.16,
  SPOKE_GAP = 0.045;
const TIME_NAME =
  /^(year|month|date|time|day|week|hour|minute|quarter|season|period)s?$|(^|_)(date|time|month|year)($|_)/i;
const MAX_STEPS = 60,
  MAX_GROUPS = 16,
  MAX_ITEMS = 3000;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const finite = (v) => v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v));
const norm =
  ([a, b]) =>
  (v) =>
    b > a ? (v - a) / (b - a) : 0.5;
const extent = (values) => {
  let a = Infinity,
    b = -Infinity;
  for (const v of values)
    if (Number.isFinite(v)) {
      if (v < a) a = v;
      if (v > b) b = v;
    }
  return a <= b ? [a, b] : [0, 1];
};
const mean = (list) => list.reduce((s, v) => s + v, 0) / (list.length || 1);
const unique = (list) => [...new Set(list)];
const fmt = (v) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en') : String(Math.round(v * 10) / 10));
/**
 * One run for every view: the brand blue through purple and magenta to orange (hue 214 round to 28). Groups take
 * places along it in order; a measure runs from soft blue (low) to deep orange (high). The red point is the page's.
 */
const WARM = Object.freeze({ h: 28, s: 82, l: 57 });
const RUN = (u) => {
  const v = clamp(u);
  return { h: (214 + 174 * v) % 360, s: 52 + 24 * v, l: 58 - 4 * Math.sin(v * Math.PI) };
};
/** A measure: light blue (low) to deep orange (high), lightness falling as it warms. */
const temperature = (u) => {
  const c = RUN(u);
  return { h: c.h, s: c.s, l: 70 - 16 * clamp(u) };
};
/** An item's readable name: `3x12` reads "Season 3 · episode 12", `17` under `episode` reads "Episode 17". */
function named(column, item) {
  const m = /^(\d+)x(\d+)$/.exec(String(item));
  if (m) return `Season ${Number(m[1])} · ${column} ${Number(m[2])}`;
  return `${column.charAt(0).toUpperCase()}${column.slice(1)} ${item}`;
}
/** A gradient along a link: warm orange at its first end, the element's own purple-blue at the other. */
function warmTo(ctx, [[x0, y0], [x1, y1]], it, a) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, tone(WARM.h, WARM.s, WARM.l, a));
  g.addColorStop(0.55, tone(it.h - 40, it.s, it.l + 4, a));
  g.addColorStop(1, tone(it.h, it.s, it.l, a));
  return g;
}
/** A gradient along a link from one entity's colour (`h`) to the other's (`h2`). */
function between(ctx, [[x0, y0], [x1, y1]], it, a) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, tone(it.h, it.s, it.l, a));
  g.addColorStop(1, tone(it.h2, it.s, it.l, a));
  return g;
}
/** Group hues along the blue-to-orange run, in order. */
const groupHue = (i, n) => RUN(n > 1 ? i / (n - 1) : 0.5).h;
const jitter = (seed, k, amount) => (randomAt(seed, k) - 0.5) * amount;

// ---------------------------------------------------------------- reading the table

/** Column roles of a parsed CSV (rows of header-keyed strings), its shape, and the views that fit it. */
export function analyse(rows, name, pairWeights = null) {
  rows = rows.filter((r) => r && !Array.isArray(r)).slice(0, MAX_ITEMS);
  const keys = rows.length ? Object.keys(rows[0]).slice(0, 24) : [];
  const numeric = keys.filter((k) => rows.filter((r) => finite(r[k])).length >= rows.length * 0.8);
  const dated = keys.filter(
    (k) => !numeric.includes(k) && rows.filter((r) => Number.isFinite(Date.parse(r[k]))).length >= rows.length * 0.8,
  );
  const time = [...numeric, ...dated].find((k) => TIME_NAME.test(k.trim())) ?? dated[0] ?? null;
  const measures = numeric.filter((k) => k !== time);
  const text = keys.filter((k) => !numeric.includes(k) && !dated.includes(k)),
    count = (k) => unique(rows.map((r) => r[k])).length;
  const categories = text.filter((k) => count(k) >= 2 && count(k) <= 40);
  const t = { rows, name, keys, numeric, time, measures, categories, text };
  if (!rows.length) throw new Error('The file has no rows.');
  // Memberships: items (often chapters or episodes, numbered) that repeat, each with one of a few entities per row.
  const itemCol =
    [...keys].find(
      (k) =>
        (k !== time || !measures.length) && // a season or year with nothing measured is an item, not a time axis
        count(k) >= 6 &&
        count(k) <= 400 &&
        count(k) < rows.length &&
        (numeric.includes(k) || text.includes(k)) &&
        /chapter|episode|season|item|scene|issue|film|book|track|id/i.test(k),
    ) ?? text.find((k) => count(k) >= 8 && count(k) <= 400 && count(k) < rows.length);
  const entityCol = text.find((k) => k !== itemCol && count(k) >= 2 && count(k) <= MAX_GROUPS);
  if (time && measures.length) {
    t.shape = 'time';
    t.views = ['bloom', 'stream'];
  } else if (categories.length >= 2 && sharedValues(rows, categories[0], categories[1])) {
    t.shape = 'flow';
    t.views = ['chord', 'sunburst'];
    t.from = categories[0];
    t.to = categories[1];
  } else if (itemCol && entityCol && measures.filter((k) => k !== itemCol).length === 0) {
    t.shape = 'membership';
    t.views = ['onion', 'chord', 'sunburst'];
    t.items = itemCol;
    t.entities = entityCol;
  } else if (categories.length && measures.length) {
    t.shape = 'measure';
    t.views = ['sunburst', 'packed', 'bars'];
  } else if (numeric.length) {
    t.shape = 'numbers';
    t.views = ['spiral', 'packed', 'bars'];
  } else throw new Error('No numbers or categories to draw.');
  if (pairWeights !== null) {
    if (!['membership', 'flow'].includes(t.shape)) throw new Error('Pair weights need membership or pair data.');
    const entities =
      t.shape === 'membership'
        ? unique(t.rows.map((row) => row[t.entities]))
        : unique([...t.rows.map((row) => row[t.from]), ...t.rows.map((row) => row[t.to])]);
    t.pairWeights = capturePairWeights(pairWeights, entities);
    // An undirected edge list has no meaningful source-to-target hierarchy.
    if (t.shape === 'flow') t.views = ['chord'];
  }
  return t;
}

const pairKey = (a, b) => JSON.stringify(a < b ? [a, b] : [b, a]);
function capturePairWeights(value, entities) {
  const spec = safeCopy(value);
  options(spec, ['rows', 'from', 'to', 'measure', 'unit', 'detail'], 'pair weights');
  const from = text(spec.from, 'pair source column', 64),
    to = text(spec.to, 'pair target column', 64),
    measure = text(spec.measure, 'pair measure column', 64);
  assert(
    from && to && measure && from !== to && from !== measure && to !== measure,
    'INVALID_DATA',
    'Pair columns must be distinct.',
  );
  assert(Array.isArray(spec.rows) && spec.rows.length <= 512, 'RESOURCE_LIMIT', 'Use at most 512 pair rows.');
  const known = new Set(entities),
    pairs = new Map();
  for (const row of spec.rows) {
    options(row, [from, to, measure], 'pair row');
    const a = text(row[from], 'pair endpoint', 128),
      b = text(row[to], 'pair endpoint', 128);
    assert(
      a !== b && known.has(a) && known.has(b),
      'INVALID_DATA',
      'Weighted pair endpoints must be distinct visible entities.',
    );
    assert(row[measure] !== '', 'INVALID_DATA', 'Pair weights must be supplied.');
    const weight = number(Number(row[measure]), 'pair weight', 0, 1e9),
      key = pairKey(a, b);
    const previous = pairs.get(key) ?? { [from]: a < b ? a : b, [to]: a < b ? b : a, [measure]: 0 };
    previous[measure] = number(previous[measure] + weight, 'aggregate pair weight', 0, 1e9);
    pairs.set(key, previous);
  }
  return Object.freeze({
    rows: Object.freeze([...pairs.values()].filter((row) => row[measure] > 0).map(Object.freeze)),
    from,
    to,
    measure,
    unit: text(spec.unit, 'pair unit', 80),
    detail: text(spec.detail ?? '', 'pair detail', 80),
  });
}
const sharedValues = (rows, a, b) => {
  const A = new Set(rows.map((r) => r[a])),
    B = new Set(rows.map((r) => r[b]));
  return [...A].filter((v) => B.has(v)).length >= Math.min(A.size, B.size) * 0.5;
};

/** Lay a table out as one of its views. */
/** A catch-all group ("Others"): drawn in a quiet grey, so it reads as a block of everyone else, not a character. */
const CATCH_ALL = /^(others?|other characters|rest|everyone else)$/i;
export function layout(t, view) {
  const model = LAYOUTS[view](t);
  for (const it of model.items) {
    const rest = CATCH_ALL.test(String(it.tag)),
      touches = it.rel?.some((r) => CATCH_ALL.test(String(r)));
    if (rest && (!touches || it.kind !== 'curve' || it.h2 === undefined)) Object.assign(it, { s: 6, l: 68 });
    else if (touches && it.h2 !== undefined) Object.assign(it, { s: Math.min(it.s, 26) });
  }
  return { ...model, view, shape: t.shape, views: t.views, title: `${t.name} · ${model.title}` };
}

const LAYOUTS = {
  bloom(t) {
    const [m1, m2] = t.measures,
      group = t.categories.find((k) => k !== t.time) ?? null,
      time = timeOf(t);
    const groups = group ? unique(t.rows.map((r) => r[group])).slice(0, MAX_GROUPS) : [''],
      steps = stepsOf(t);
    const v1 = norm(extent(t.rows.map((r) => Number(r[m1])))),
      v2 = m2 ? norm(extent(t.rows.map((r) => Number(r[m2])))) : null;
    const items = [],
      G = groups.length,
      S = steps.length,
      band = 0.8 / (G + 1.1),
      WEDGE = group ? 0.9 : 0,
      span = TAU - WEDGE;
    groups.forEach((g, gi) =>
      steps.forEach((step, si) => {
        const here = t.rows.filter((r) => (!group || r[group] === g) && time(r) === step);
        if (!here.length) return;
        const a = mean(here.map((r) => Number(r[m1]))),
          b = m2 ? mean(here.map((r) => Number(r[m2]))) : null,
          u = v1(a),
          k = items.length;
        const c = v2 ? temperature(v2(b)) : { h: groupHue(gi, G), s: 50, l: 55 };
        const angle = TOP + WEDGE / 2 + ((si + 0.5 + (gi % 2 ? 0.25 : -0.25)) / S) * span,
          r0 = 0.2 + gi * band;
        items.push({
          kind: 'petal',
          key: `${g}|${step}`,
          tag: g,
          a: angle,
          w: (span / S / 2) * (0.42 + 0.3 * u),
          r0,
          r1: r0 + band * (0.7 + 1.4 * u),
          h: c.h + jitter(51, k, 8),
          s: c.s + jitter(52, k, 8),
          l: c.l + jitter(53, k, 7),
          order: (gi / G) * 0.45 + (si / S) * 0.55,
          band: si / S,
          label: [
            group ? g : t.name,
            `${t.time} ${here[0][t.time]}`,
            `${m1} ${fmt(a)}`,
            ...(m2 ? [`${m2} ${fmt(b)}`] : []),
          ],
        });
      }),
    );
    const labels = rimLabels(t, steps, (si) => TOP + WEDGE / 2 + ((si + 0.5) / S) * span);
    if (group)
      groups.forEach((g, gi) => labels.push({ a: TOP, r: 0.2 + gi * band + band * 0.55, text: g, align: 'center' }));
    return { title: `${m1} by ${t.time}${group ? ` · ${G} ${group}` : ''}`, items, labels };
  },

  stream(t) {
    // Groups stacked outward round the circle, each a smooth band whose thickness is its measure at that step.
    const [m1] = t.measures,
      group = t.categories.find((k) => k !== t.time) ?? null,
      time = timeOf(t),
      steps = stepsOf(t);
    const groups = group ? unique(t.rows.map((r) => r[group])).slice(0, MAX_GROUPS) : [''],
      S = steps.length,
      G = groups.length;
    const value = (g, s) =>
      mean(
        t.rows
          .filter((r) => (!group || r[group] === g) && time(r) === s)
          .map((r) => Number(r[m1]))
          .filter(Number.isFinite),
      ) || 0;
    const grid = groups.map((g) => steps.map((s) => Math.max(0, value(g, s)))),
      totals = steps.map((_, si) => grid.reduce((s, row) => s + row[si], 0)),
      max = Math.max(...totals, 1e-9);
    // A streamgraph bent into a ring: the stack is centred on a middle radius, so the silhouette swells on both
    // sides like a breathing loop rather than piling outward.
    const centre = 0.6,
      depth = 0.66,
      items = [],
      base = totals.map((tot) => centre - ((tot / max) * depth) / 2);
    groups
      .map((_, gi) => gi)
      .sort((a, b) => mean(grid[a]) - mean(grid[b]))
      .forEach((gi, n) => {
        const r0 = base.slice(),
          r1 = base.map((b, si) => b + (grid[gi][si] / max) * depth);
        items.push({
          kind: 'band',
          key: `stream|${groups[gi]}`,
          tag: groups[gi],
          angles: steps.map((_, si) => TOP + ((si + 0.5) / S) * TAU),
          r0,
          r1,
          h: groupHue(gi, G) + jitter(55, gi, 10),
          s: 38,
          l: 64 + (n % 2) * 6,
          order: n / G,
          band: n / G,
          label: [groups[gi] || t.name, `${m1} mean ${fmt(mean(grid[gi]))}`, `peak ${fmt(Math.max(...grid[gi]))}`],
        });
        r1.forEach((v, si) => {
          base[si] = v;
        });
      });
    return {
      title: `${m1} stacked by ${t.time}${group ? ` · ${G} ${group}` : ''}`,
      items,
      labels: rimLabels(t, steps, (si) => TOP + ((si + 0.5) / S) * TAU),
    };
  },

  onion(t) {
    // Entities on an inner ring, items round the rim; a curve for every appearance; chords for shared items.
    const entities = unique(t.rows.map((r) => r[t.entities])).slice(0, MAX_GROUPS),
      itemList = unique(t.rows.map((r) => r[t.items])).slice(0, 400);
    const has = new Map(itemList.map((i) => [i, new Set()]));
    for (const r of t.rows) has.get(r[t.items])?.add(r[t.entities]);
    const appearances = entities.map((e) => itemList.filter((i) => has.get(i).has(e)).length),
      total = appearances.reduce((s, v) => s + v, 0) || 1;
    const items = [],
      labels = [],
      pad = 0.05,
      free = TAU - pad * entities.length,
      at = new Map();
    let a = TOP + pad / 2;
    entities.forEach((e, ei) => {
      const span = (appearances[ei] / total) * free;
      at.set(e, { a0: a, a1: a + span, used: 0, n: appearances[ei], hue: groupHue(ei, entities.length) });
      items.push({
        kind: 'arc',
        key: `entity|${e}`,
        tag: e,
        a0: a,
        a1: a + span,
        r0: 0.5,
        r1: 0.57,
        h: groupHue(ei, entities.length),
        s: 52,
        l: 52,
        order: (ei / entities.length) * 0.3,
        band: (a + span / 2 - TOP) / TAU,
        label: [
          e,
          `in ${appearances[ei]} of ${itemList.length} ${t.items}${itemList.length === 1 || /s$/.test(t.items) ? '' : 's'}`,
        ],
      });
      // Wide arcs carry a level name; narrow ones (a guest in a few episodes) read along the radius, clear of each other.
      labels.push({ a: a + span / 2, r: 0.6, text: e, span, wide: 0.32, priority: span });
      a += span + pad;
    });
    // A hover card per item: who is in it and who is not, each in their own colour.
    const whoIs = (item) =>
      Object.freeze({
        title: named(t.items, item),
        people: entities.map((e) => ({ name: e, hue: at.get(e).hue, here: has.get(item).has(e) })),
      });
    const I = itemList.length,
      // Seeds stack outward; the tallest stack stays within the rim band, so many speakers never reach the caption.
      tallest = Math.max(1, ...itemList.map((i) => has.get(i).size)),
      step = Math.min(0.034, 0.2 / tallest);
    // A long series (more than 60 items) is drawn as a radial barcode: each entity owns a thin track round the rim
    // and each item is a tick on the tracks of those in it. Items are grouped (`3x12` is season 3) with a small gap
    // between groups.
    const dense = I > 60,
      groupOf = (item) => /^(\d+)x\d+$/.exec(String(item))?.[1] ?? null,
      breaks = itemList.map((it, ii) => ii > 0 && groupOf(it) !== groupOf(itemList[ii - 1])),
      gap = dense ? 0.035 : 0,
      slotW = (TAU - gap * (breaks.filter(Boolean).length + 1)) / I,
      tw = 0.24 / Math.max(1, entities.length);
    let cursor = TOP + gap / 2;
    const angles = itemList.map((_, ii) => {
      if (breaks[ii]) cursor += gap;
      cursor += slotW;
      return cursor - slotW / 2;
    });
    itemList.forEach((item, ii) => {
      const ang = angles[ii],
        present = [...has.get(item)];
      present.forEach((e, k) => {
        const E = at.get(e);
        if (!E) return;
        const track = entities.indexOf(e);
        items.push(
          dense
            ? {
                kind: 'arc',
                key: `${item}|${e}`,
                tag: e,
                rel: [e, String(item)],
                a0: ang - slotW * 0.42,
                a1: ang + slotW * 0.42,
                r0: 0.74 + track * tw,
                r1: 0.74 + track * tw + tw * 0.8,
                h: E.hue,
                s: 52,
                l: 56,
                order: 0.5 + (ii / I) * 0.45,
                band: ii / I,
                label: [named(t.items, item), present.join(', ')],
                card: whoIs(item),
              }
            : {
                // The item: one seed per entity present, stacked outward in that entity's colour (Bremer's cover dots).
                kind: 'dot',
                key: `${item}|${e}`,
                tag: e,
                rel: [e, String(item)],
                a: ang,
                r: 0.88 + k * step,
                size: Math.min(0.015, step * 0.55),
                h: E.hue + jitter(91, items.length, 10),
                s: 52,
                l: 55,
                order: 0.5 + (ii / I) * 0.45,
                band: ii / I,
                label: [named(t.items, item), present.join(', ')],
                card: whoIs(item),
              },
        );
        // A long series draws no appearance links: the tracks show who is in each item, and the chords who with whom.
        if (dense) return;
        // The appearance: from the entity's arc, bending through the ring, out to the item.
        const slot = E.a0 + ((E.used++ + 0.5) / E.n) * (E.a1 - E.a0);
        items.push({
          kind: 'curve',
          key: `link|${item}|${e}`,
          tag: e,
          rel: [e, String(item)],
          from: [slot, 0.58],
          to: [ang, dense ? 0.735 : 0.86],
          bend: 0.5,
          h: E.hue,
          s: 46,
          l: 58,
          width: dense ? 0.7 : 0.9,
          order: 0.3 + (ii / I) * 0.5,
          band: ii / I,
          label: [`${e} · ${named(t.items, item)}`],
          card: whoIs(item),
        });
      });
      if (I <= 60)
        labels.push({ a: ang, r: 0.9 + present.length * step + 0.03, text: String(item), small: true, rotate: true });
    });
    // Group names (seasons) outside a dense rim, at the middle of each group.
    if (dense)
      for (const g of new Set(itemList.map(groupOf).filter(Boolean))) {
        const own = angles.filter((_, ii) => groupOf(itemList[ii]) === g);
        labels.push({ a: (own[0] + own.at(-1)) / 2, r: 1.04, text: `Season ${g}`, small: true });
      }
    const weights = t.pairWeights;
    const measured = weights
      ? new Map(weights.rows.map((row) => [pairKey(row[weights.from], row[weights.to]), row[weights.measure]]))
      : null;
    const largest = measured ? Math.max(1, ...measured.values()) : I;
    // Explicit measured pairs can weight the inner chords without changing episode membership arcs.
    entities.forEach((e1, i) =>
      entities.slice(i + 1).forEach((e2) => {
        const shared = measured
          ? (measured.get(pairKey(e1, e2)) ?? 0)
          : itemList.filter((it) => has.get(it).has(e1) && has.get(it).has(e2)).length;
        if (!shared) return;
        const A = at.get(e1),
          B = at.get(e2);
        items.push({
          kind: 'curve',
          key: `pair|${e1}|${e2}`,
          tag: e1,
          rel: [e1, e2],
          from: [(B.a0 + B.a1) / 2, 0.49], // warm at the later (guest) end, cool at the lead
          to: [(A.a0 + A.a1) / 2, 0.49],
          bend: 0.85,
          h: B.hue,
          h2: A.hue, // shaded from one person's colour to the other's
          s: 50,
          l: 56,
          width: 0.5 + 7 * (shared / largest) ** 1.5,
          value: shared,
          order: 0.2,
          band: i / entities.length,
          label: weights
            ? [`${e1} & ${e2}`, `${fmt(shared)} ${weights.unit}`, ...(weights.detail ? [weights.detail] : [])]
            : [`${e1} & ${e2}`, `together in ${shared} ${t.items}`],
        });
      }),
    );
    return { title: `${t.entities} across ${I} ${t.items}${I === 1 || /s$/.test(t.items) ? '' : 's'}`, items, labels };
  },

  chord(t) {
    const membership = t.shape === 'membership';
    const weighted = t.pairWeights;
    const undirected = membership || !!weighted;
    let from = t.from,
      to = t.to,
      rows = t.rows;
    const m = weighted?.measure ?? (membership ? null : (t.measures[0] ?? null));
    if (weighted) {
      rows = weighted.rows;
      from = weighted.from;
      to = weighted.to;
    } else if (membership) {
      // who appears with whom: one pairing per shared item
      const byItem = new Map();
      for (const r of t.rows) {
        if (!byItem.has(r[t.items])) byItem.set(r[t.items], new Set());
        byItem.get(r[t.items]).add(r[t.entities]);
      }
      rows = [];
      for (const set of byItem.values()) {
        const list = [...set];
        list.forEach((a, i) => list.slice(i + 1).forEach((b) => rows.push({ from: a, to: b })));
      }
      from = 'from';
      to = 'to';
    }
    const weight = (r) => (m ? Math.max(0, Number(r[m])) || 0 : 1);
    const nodes = (
        weighted && membership
          ? unique(t.rows.map((row) => row[t.entities]))
          : unique([...rows.map((r) => r[from]), ...rows.map((r) => r[to])])
      ).slice(0, 24),
      index = new Map(nodes.map((n, i) => [n, i]));
    const outFlow = nodes.map(() => 0),
      inFlow = nodes.map(() => 0);
    for (const r of rows) {
      const i = index.get(r[from]),
        j = index.get(r[to]);
      if (i === undefined || j === undefined) continue;
      outFlow[i] += weight(r);
      inFlow[j] += weight(r);
    }
    const sizes = nodes.map((_, i) => outFlow[i] + inFlow[i]),
      total = sizes.reduce((s, v) => s + v, 0) || 1,
      pad = 0.03,
      free = TAU - pad * nodes.length;
    const items = [],
      labels = [],
      cursor = [];
    let a = TOP;
    nodes.forEach((n, i) => {
      const span = (sizes[i] / total) * free,
        hue = groupHue(i, nodes.length);
      items.push({
        kind: 'arc',
        key: membership ? `entity|${n}` : `node|${n}`,
        tag: n,
        a0: a,
        a1: a + span,
        r0: 0.86,
        r1: 0.93,
        h: hue,
        s: 50,
        l: 52,
        order: (i / nodes.length) * 0.4,
        band: (a + span / 2 - TOP) / TAU,
        label: [
          n,
          ...(weighted
            ? [`${fmt(sizes[i])} ${weighted.unit}`, ...(weighted.detail ? [weighted.detail] : [])]
            : membership
              ? [`${fmt(sizes[i])} pairings`]
              : [`out ${fmt(outFlow[i])}`, `in ${fmt(inFlow[i])}`]),
        ],
      });
      // Wide arcs keep an upright name at the rim. Narrow ones get a name along the radius, like a spoke, so neighbours
      // stack side by side instead of on top of each other; a spoke too close to the previous one is left to hover.
      // The library's radial placer applies the rule (upright when wide, a spoke when narrow, spokes kept apart)
      // and nudges or hides names that would collide, larger arcs first.
      labels.push({ a: a + span / 2, r: 1.0, text: n, span, wide: WIDE_ARC, priority: span });
      cursor.push({ out: a, in: a + (outFlow[i] / total) * free, hue });
      a += span + pad;
    });
    const flows = new Map();
    for (const r of rows) {
      const i = index.get(r[from]),
        j = index.get(r[to]);
      if (i === undefined || j === undefined) continue;
      const k = `${i}>${j}`;
      flows.set(k, (flows.get(k) ?? 0) + weight(r));
    }
    // The strongest few flows warm toward orange along their length; the rest keep their source's purple-blue.
    [...flows]
      .sort((x, y) => y[1] - x[1])
      .forEach(([k, w], rank) => {
        const warm = rank < Math.min(3, Math.ceil(flows.size / 8));
        const [i, j] = k.split('>').map(Number),
          s = (w / total) * free,
          A = cursor[i],
          B = cursor[j];
        items.push({
          kind: 'ribbon',
          key: `pair|${nodes[i]}|${nodes[j]}`,
          tag: nodes[i],
          rel: [nodes[i], nodes[j]],
          a0: A.out,
          a1: A.out + s,
          b0: B.in,
          b1: B.in + s,
          r: 0.85,
          h: A.hue + jitter(71, items.length, 8),
          s: 48,
          l: 58,
          warm,
          value: w,
          order: 0.35 + randomAt(72, items.length) * 0.5,
          band: (A.out - TOP) / TAU,
          label: [
            `${nodes[i]} ${undirected ? '&' : '→'} ${nodes[j]}`,
            weighted ? `${fmt(w)} ${weighted.unit}` : `${m ?? (membership ? 'together' : 'rows')} ${fmt(w)}`,
            ...(weighted?.detail ? [weighted.detail] : []),
          ],
        });
        A.out += s;
        B.in += s;
      });
    return {
      title: weighted
        ? `${weighted.unit}${weighted.detail ? ` · ${weighted.detail}` : ''}`
        : membership
          ? 'who appears with whom'
          : `${from} → ${to}${m ? ` · ${m}` : ''}`,
      items,
      labels,
    };
  },

  sunburst(t) {
    const membership = t.shape === 'membership',
      flow = t.shape === 'flow';
    const inner = membership ? t.entities : flow ? t.from : t.categories[0],
      outer = membership ? t.items : flow ? t.to : (t.categories[1] ?? null);
    const m = membership ? null : (t.measures[0] ?? null),
      weight = (r) => (m ? Math.max(0, Number(r[m])) || 0 : 1);
    const parents = unique(t.rows.map((r) => r[inner])).slice(0, MAX_GROUPS * 2),
      total = t.rows.reduce((s, r) => s + weight(r), 0) || 1,
      pad = 0.012,
      items = [],
      labels = [];
    const label = t.keys.find((k) => k !== inner && !t.numeric.includes(k));
    let a = TOP;
    parents.forEach((parent, pi) => {
      const mine = t.rows.filter((r) => r[inner] === parent),
        sum = mine.reduce((s, r) => s + weight(r), 0),
        span = (sum / total) * TAU,
        hue = groupHue(pi, parents.length);
      if (span <= 0) return;
      items.push({
        kind: 'arc',
        key: membership ? `entity|${parent}` : flow ? `node|${parent}` : `cat|${parent}`,
        tag: parent,
        a0: a + Math.min(pad, span * 0.15),
        a1: a + span - Math.min(pad, span * 0.15),
        r0: 0.2,
        r1: 0.48,
        h: hue,
        s: 46,
        l: 54,
        order: ((a - TOP) / TAU) * 0.5,
        band: (a + span / 2 - TOP) / TAU,
        label: [parent, `${m ?? 'rows'} ${fmt(sum)}`, `${Math.round((sum / total) * 100)}%`],
      });
      // Names run along their ray, centred in the band, wrapping to two lines (then an ellipsis) to stay inside it.
      if (span > 0.12)
        labels.push({ a: a + span / 2, r: 0.34, text: parent, inside: true, ray: { r0: 0.2, r1: 0.48, span }, hue });
      // A long series of grouped items (`3x12`) rings each parent by group (season) rather than by hairline item.
      const season = (v) => /^(\d+)x\d+$/.exec(String(v))?.[1] ?? null,
        grouped = membership && unique(t.rows.map((r) => r[outer])).length > 60 && mine.every((r) => season(r[outer])),
        kids = outer
          ? grouped
            ? unique(mine.map((r) => season(r[outer]))).map((g) => [
                `Season ${g}`,
                mine.filter((r) => season(r[outer]) === g).length,
              ])
            : unique(mine.map((r) => r[outer])).map((c) => [
                c,
                mine.filter((r) => r[outer] === c).reduce((s, r) => s + weight(r), 0),
              ])
          : mine.map((r, i) => [r[label] ?? `${inner} ${i + 1}`, weight(r), i]);
      let b = a;
      const max = Math.max(...kids.map(([, v]) => v), 1e-9);
      kids.forEach(([child, v], ci) => {
        const s2 = (v / total) * TAU,
          k = items.length;
        if (s2 <= 0) return;
        items.push({
          kind: 'arc',
          key: membership ? `${child}|${parent}` : flow ? `pair|${parent}|${child}` : `row|${child}`,
          tag: parent,
          rel: [parent, String(child)],
          // The gap shrinks with the slice: a gap wider than its slice would turn the arc inside out.
          a0: b + Math.min(pad * 0.5, s2 * 0.15),
          a1: b + s2 - Math.min(pad * 0.5, s2 * 0.15),
          r0: 0.52,
          r1: 0.56 + 0.4 * Math.sqrt(v / max),
          h: hue + jitter(61, k, 18),
          s: 40 + randomAt(62, k) * 12,
          l: 62 + (ci % 3) * 4,
          order: 0.35 + ((b - TOP) / TAU) * 0.65,
          band: (b + s2 / 2 - TOP) / TAU,
          label: [String(child), String(parent), `${m ?? 'rows'} ${fmt(v)}`],
        });
        b += s2;
      });
      a += span;
    });
    return { title: `${inner}${outer ? ` › ${outer}` : ''}${m ? ` · ${m}` : ''}`, items, labels };
  },

  packed(t) {
    // Circles by size, settled into one cluster per category round the point (relaxed once, deterministically).
    const m = t.measures[0] ?? t.numeric[0],
      cat = t.categories[0] ?? null,
      label = t.keys.find((k) => k !== cat && !t.numeric.includes(k));
    const rows = t.rows.slice(0, 400),
      groups = cat ? unique(rows.map((r) => r[cat])) : [''],
      v = norm([0, extent(rows.map((r) => Number(r[m])))[1]]);
    const nodes = rows.map((r, i) => ({
      r,
      i,
      g: cat ? groups.indexOf(r[cat]) : 0,
      size: (0.03 + 0.1 * Math.sqrt(clamp(v(Number(r[m]))))) * Math.min(1, 7 / Math.sqrt(rows.length)),
    }));
    const G = groups.length,
      home = groups.map((_, g) =>
        G === 1 ? [0, 0] : [Math.cos(TOP + (g / G) * TAU) * 0.36, Math.sin(TOP + (g / G) * TAU) * 0.36],
      );
    nodes.forEach((n, k) => {
      const a = k * GOLDEN,
        d = 0.02 * Math.sqrt(k);
      n.x = home[n.g][0] + Math.cos(a) * d;
      n.y = home[n.g][1] + Math.sin(a) * d;
    });
    for (let step = 0; step < 90; step++) {
      for (const n of nodes) {
        n.x += (home[n.g][0] - n.x) * 0.04;
        n.y += (home[n.g][1] - n.y) * 0.04;
        const d = Math.hypot(n.x, n.y),
          clear = 0.14 + n.size;
        if (G > 1 && d < clear) {
          const k = clear / (d || 1e-6);
          n.x *= k;
          n.y *= k;
        }
      } // a clearing round the point
      for (let i = 0; i < nodes.length; i++)
        for (let j = i + 1; j < nodes.length; j++) {
          const A = nodes[i],
            B = nodes[j],
            dx = B.x - A.x,
            dy = B.y - A.y,
            d = Math.hypot(dx, dy) || 1e-6,
            min = A.size + B.size + 0.006;
          if (d < min) {
            const push = (min - d) / 2,
              ux = dx / d,
              uy = dy / d;
            A.x -= ux * push;
            A.y -= uy * push;
            B.x += ux * push;
            B.y += uy * push;
          }
        }
    }
    const reach = Math.max(...nodes.map((n) => Math.hypot(n.x, n.y) + n.size), 1e-6),
      k0 = 0.92 / reach; // fill the room, whichever way
    const items = nodes.map((n) => ({
      kind: 'dot',
      key: rowKey(t, n.r, n.i),
      tag: groups[n.g],
      a: Math.atan2(n.y, n.x),
      r: Math.hypot(n.x, n.y) * k0,
      size: n.size * k0,
      h: groupHue(n.g, G) + jitter(81, n.i, 10),
      s: 48,
      l: 56 + jitter(82, n.i, 8),
      order: Math.hypot(n.x, n.y) * 0.8,
      band: ((Math.atan2(n.y, n.x) - TOP + TAU) % TAU) / TAU,
      label: [
        String(n.r[label] ?? `row ${n.i + 1}`),
        ...(cat ? [String(n.r[cat])] : []),
        `${m} ${fmt(Number(n.r[m]))}`,
      ],
    }));
    const labels =
      G > 1
        ? groups.map((g, gi) => {
            const ns = nodes.filter((n) => n.g === gi),
              far = Math.max(...ns.map((n) => (Math.hypot(n.x, n.y) + n.size) * k0));
            return { a: TOP + (gi / G) * TAU, r: far + 0.07, text: g, align: 'center' };
          })
        : [];
    return { title: `${m}${cat ? ` by ${cat}` : ''} · packed`, items, labels };
  },

  bars(t) {
    // One bar per row, sorted, radiating from a ring.
    const m = t.measures[0] ?? t.numeric[0],
      cat = t.categories[0] ?? null,
      label = t.keys.find((k) => !t.numeric.includes(k)) ?? null;
    const rows = t.rows
        .map((r, i) => ({ r, i, v: Number(r[m]) }))
        .filter((x) => Number.isFinite(x.v))
        .sort((a, b) => b.v - a.v)
        .slice(0, 180),
      n = rows.length;
    const v = norm([Math.min(0, ...rows.map((x) => x.v)), Math.max(...rows.map((x) => x.v))]),
      groups = cat ? unique(t.rows.map((r) => r[cat])) : [];
    const items = rows.map(({ r, i, v: value }, k) => {
      const a0 = TOP + (k / n) * TAU * 0.92,
        a1 = a0 + ((TAU * 0.92) / n) * 0.7,
        hue = cat ? groupHue(groups.indexOf(r[cat]), groups.length) : 200 + 70 * (k / n);
      return {
        kind: 'arc',
        key: rowKey(t, r, i),
        tag: cat ? r[cat] : 'all',
        a0,
        a1,
        r0: 0.3,
        r1: 0.32 + 0.64 * v(value),
        h: hue + jitter(41, k, 8),
        s: 46,
        l: 55,
        order: k / n,
        band: k / n,
        label: [String(label ? r[label] : `row ${i + 1}`), ...(cat ? [String(r[cat])] : []), `${m} ${fmt(value)}`],
      };
    });
    return {
      title: `${m} sorted${cat ? ` · by ${cat}` : ''}`,
      items,
      labels:
        n <= 24
          ? rows.map(({ r, i }, k) => ({
              a: TOP + ((k + 0.35) / n) * TAU * 0.92,
              r: 0.25,
              text: String(label ? r[label] : i + 1),
              small: true,
              rotate: true,
            }))
          : [],
    };
  },

  spiral(t) {
    const [m1, m2] = t.measures.length ? t.measures : t.numeric,
      cat = t.categories[0] ?? null;
    const sorted = t.rows
      .map((r, i) => ({ r, i, v: Number(r[m1]) }))
      .filter((x) => Number.isFinite(x.v))
      .sort((a, b) => b.v - a.v);
    const v1 = norm(extent(sorted.map((x) => x.v))),
      v2 = m2 ? norm(extent(t.rows.map((r) => Number(r[m2])))) : null,
      groups = cat ? unique(t.rows.map((r) => r[cat])) : [];
    const n = sorted.length,
      items = sorted.map(({ r, i, v }, k) => {
        const c = v2
          ? temperature(v2(Number(r[m2])))
          : cat
            ? { h: groupHue(groups.indexOf(r[cat]), groups.length), s: 48, l: 55 }
            : { h: 236, s: 50, l: 56 };
        return {
          kind: 'dot',
          key: rowKey(t, r, i),
          tag: cat ? r[cat] : 'all',
          a: TOP + k * GOLDEN,
          r: 0.12 + 0.86 * Math.sqrt((k + 0.5) / n),
          size: (0.012 + 0.05 * Math.sqrt(v1(v))) * Math.min(1, 9 / Math.sqrt(n)),
          h: c.h + jitter(81, k, 8),
          s: c.s,
          l: c.l + jitter(82, k, 8),
          order: k / n,
          band: ((k * GOLDEN) % TAU) / TAU,
          label: [
            cat ? String(r[cat]) : `row ${i + 1}`,
            `${m1} ${fmt(v)}`,
            ...(m2 ? [`${m2} ${fmt(Number(r[m2]))}`] : []),
          ],
        };
      });
    return { title: `${n} rows by ${m1} · spiral`, items, labels: [] };
  },
};

const timeOf = (t) => (r) => (finite(r[t.time]) ? Number(r[t.time]) : Date.parse(r[t.time]));
const stepsOf = (t) =>
  unique(t.rows.map(timeOf(t)))
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
    .slice(0, MAX_STEPS);
const rimLabels = (t, steps, angle) =>
  steps.length <= 24
    ? steps.map((s, si) => ({ a: angle(si), r: 1.08, text: String(t.rows.find((r) => timeOf(t)(r) === s)[t.time]) }))
    : [];
const rowKey = (t, r, i) => {
  const k = t.keys.find((c) => !t.numeric.includes(c));
  return k ? `row|${r[k]}|${i}` : `row|${i}`;
};

// ---------------------------------------------------------------- painting

/** The polar point an element is seen to come from, or go to, in a morph between views. */
export function anchorOf(it) {
  if (it.kind === 'petal') return [it.a, (it.r0 + it.r1) / 2];
  if (it.kind === 'arc') return [(it.a0 + it.a1) / 2, (it.r0 + it.r1) / 2];
  if (it.kind === 'ribbon') return [(it.a0 + it.a1) / 2, it.r];
  if (it.kind === 'curve') return it.to;
  if (it.kind === 'band') {
    const m = Math.floor(it.angles.length / 2);
    return [it.angles[m], (it.r0[m] + it.r1[m]) / 2];
  }
  return [it.a, it.r];
}

/**
 * Paint a laid-out view about (cx, cy) with radius R (stage units). `grow(item, i)` is each element's arrival in
 * [0, 1]; `lift(item, i)` adds radial reach (voice bands, the pointer). `focus` is a tag: elements that are not it
 * and do not connect to it step back. Returns a Path2D per element for hit-testing.
 */
export function paintForm(
  ctx,
  model,
  { cx, cy, R, grow, lift, hover = -1, focus = null, alpha = 1, labelsAlpha = 1, labelSink = null, silk = null },
) {
  const paths = new Array(model.items.length),
    P = (a, r) => [cx + Math.cos(a) * r * R, cy + Math.sin(a) * r * R];
  const lit = (it) => !focus || it.tag === focus || it.rel?.includes(focus);
  // Many crossing strands add up to white: share the light among the curves so dense views stay silky.
  // In silk, hovering acts like a light focus: the hovered element's connections stay lit and warm, the rest dim.
  const hoverTag = silk && hover >= 0 ? (model.items[hover]?.tag ?? null) : null,
    near = (it) => !hoverTag || it.tag === hoverTag || it.rel?.includes(hoverTag);
  const curves = silk ? model.items.filter((it) => it.kind === 'curve').length : 0,
    share = Math.min(1, Math.sqrt(50 / Math.max(1, curves)));
  model.items.forEach((it, i) => {
    const e = grow(it, i);
    if (e <= 0.002) return;
    let ends = null; // a link's two ends, for a warm-to-cool gradient along it
    const up = lift(it, i),
      hot = hover === i,
      dim = (hover >= 0 && !hot ? 0.6 : 1) * (lit(it) ? 1 : 0.12),
      path = new Path2D();
    if (it.kind === 'petal') {
      const r0 = it.r0 * e,
        r1 = r0 + (it.r1 - it.r0 + up) * e,
        w = it.w * (0.4 + 0.6 * e),
        mid = r0 + (r1 - r0) * 0.55,
        sway = Math.sin(it.order * 40) * 0.02;
      path.moveTo(...P(it.a, r0));
      path.bezierCurveTo(
        ...P(it.a - w * 1.15, r0 + (r1 - r0) * 0.25),
        ...P(it.a - w + sway, mid),
        ...P(it.a + sway, r1),
      );
      path.bezierCurveTo(...P(it.a + w + sway, mid), ...P(it.a + w * 1.15, r0 + (r1 - r0) * 0.25), ...P(it.a, r0));
    } else if (it.kind === 'arc') {
      if (!(it.a1 > it.a0)) return; // an empty or inverted slice draws nothing, never the long way round
      const r0 = it.r0 * e,
        r1 = it.r0 + (it.r1 - it.r0 + up) * e,
        a1 = it.a0 + (it.a1 - it.a0) * Math.min(1, e * 1.2);
      path.arc(cx, cy, Math.max(0.1, r1 * R), it.a0, a1);
      path.arc(cx, cy, Math.max(0.05, r0 * R), a1, it.a0, true);
      path.closePath();
    } else if (it.kind === 'dot') {
      const [x, y] = P(it.a, it.r * e);
      path.arc(x, y, Math.max(0.2, (it.size + up * 0.04) * R * Math.min(1, e * 1.4)), 0, TAU);
    } else if (it.kind === 'ribbon') {
      const r = it.r * (0.6 + 0.4 * e),
        bend = 0.18 + 0.3 * (1 - e);
      ends = [P((it.a0 + it.a1) / 2, r), P((it.b0 + it.b1) / 2, r)];
      path.moveTo(...P(it.a0, r));
      path.arc(cx, cy, r * R, it.a0, it.a1);
      path.quadraticCurveTo(
        cx + Math.cos((it.a1 + it.b0) / 2) * R * bend * r,
        cy + Math.sin((it.a1 + it.b0) / 2) * R * bend * r,
        ...P(it.b0, r),
      );
      path.arc(cx, cy, r * R, it.b0, it.b1);
      path.quadraticCurveTo(
        cx + Math.cos((it.b1 + it.a0) / 2) * R * bend * r,
        cy + Math.sin((it.b1 + it.a0) / 2) * R * bend * r,
        ...P(it.a0, r),
      );
    } else if (it.kind === 'band') {
      // A closed ribbon round the circle: outer edge one way, inner edge back, both smoothed.
      const outer = it.angles.map((a, k) => P(a, it.r0[k] * e + (it.r1[k] - it.r0[k] + up * 0.5) * e)),
        inner = it.angles.map((a, k) => P(a, it.r0[k] * e));
      smoothLoop(path, outer, true);
      smoothLoop(path, inner.reverse(), false);
      path.closePath();
      // Fine radial ticks across the band at each step: the grain of the references.
      const ticks = new Path2D();
      it.angles.forEach((a, k) => {
        const r0 = it.r0[k] * e,
          r1 = r0 + (it.r1[k] - it.r0[k]) * e;
        if (r1 - r0 > 0.012) {
          ticks.moveTo(...P(a, r0 + 0.006));
          ticks.lineTo(...P(a, r1 - 0.006));
        }
      });
      it.ticks = ticks;
    } else if (it.kind === 'curve') {
      // An appearance or a pairing: drawn out from its start as it arrives, bending in toward the centre.
      const [a0, r0] = it.from,
        [a1, r1] = it.to,
        A = P(a0, r0),
        B = P(a1, r1 + up * 0.3),
        C1 = P(a0, r0 * (1 - it.bend)),
        C2 = P(a1, r1 * (1 - it.bend * 0.5));
      ends = [A, B];
      path.moveTo(...A);
      if (e >= 0.999) path.bezierCurveTo(...C1, ...C2, ...B);
      else {
        const q = (p0, p1) => [p0[0] + (p1[0] - p0[0]) * e, p0[1] + (p1[1] - p0[1]) * e],
          c1 = q(A, C1),
          m = q(C1, C2),
          c2 = q(c1, m),
          end = q(c2, q(m, q(C2, B)));
        path.bezierCurveTo(...c1, ...c2, ...end);
      }
    }
    const line = it.kind === 'curve',
      ribbon = it.kind === 'ribbon';
    if (silk && SILK_KINDS.has(it.kind)) {
      // Silk: the same element as fibres of light. The path above stays for hit-testing.
      const close = near(it);
      silkElement(silk, it, i, {
        e,
        up,
        hot,
        dim: alpha * (lit(it) ? 1 : 0.12) * (close ? 1 : 0.16),
        lit: (!!focus && lit(it)) || (!!hoverTag && close),
        cx,
        cy,
        R,
        P,
        share: hoverTag && close ? 1 : share,
      });
      paths[i] = path;
      return;
    }
    const a = clamp(
      alpha * dim * (ribbon ? 0.5 + (hot ? 0.35 : 0) : line ? 0.5 + (hot ? 0.45 : 0) : 0.9) * Math.min(1, e * 1.6),
    );
    if (line) {
      ctx.strokeStyle =
        it.h2 !== undefined && ends
          ? between(ctx, ends, it, a)
          : it.warm && ends
            ? warmTo(ctx, ends, it, a)
            : tone(it.h, it.s, it.l, a);
      // Never thinner than a device pixel: hairlines between pixels smear into a blur.
      ctx.lineWidth = Math.max(it.width * Math.max(1, R / 240), 1.1 / ctx.getTransform().a) * (hot ? 2.2 : 1);
      ctx.lineCap = 'round';
      ctx.stroke(path);
      paths[i] = path;
      return;
    }
    const band = it.kind === 'band';
    ctx.fillStyle =
      it.warm && ends
        ? warmTo(ctx, ends, it, a)
        : tone(it.h, it.s + (hot ? 10 : 0), it.l + (hot ? 4 : 0), band ? a * 0.82 : a);
    ctx.fill(path);
    if (band) {
      ctx.strokeStyle = tone(it.h, it.s * 0.6, 92, 0.55 * a);
      ctx.lineWidth = 1.2;
      ctx.stroke(path);
      ctx.strokeStyle = tone(it.h, it.s, it.l - 14, 0.22 * a);
      ctx.lineWidth = 0.7;
      ctx.stroke(it.ticks);
      paths[i] = path;
      return;
    }
    // No glow and no pale rim: soft strokes round a fill read as blur. A hovered element gets a crisp ink edge.
    if (hot && !ribbon) {
      ctx.strokeStyle = tone(it.h, it.s, Math.max(20, it.l - 22), 0.9 * a);
      ctx.lineWidth = 1.4 / ctx.getTransform().a;
      ctx.stroke(path);
    }
    paths[i] = path;
  });
  if (silk) silk.draw(ctx);
  // Quiet labels, never boxed: rim steps, group names, item names along the rim. Names that belong to a mark (a rim
  // name with its arc's `span`, or a name set inside its band) are placed by the library's radial placer, which
  // keeps the page's rules and resolves collisions; numbers and group titles keep their authored places.
  const shown = clamp(labelsAlpha);
  if (shown > 0.02) {
    const sizeOf = (l) => Math.max(10.5, R * (l.small ? 0.032 : 0.042));
    const placed = new Map();
    const rings = new Map();
    model.labels.forEach((l, k) => {
      if (l.small || (l.span === undefined && !l.inside)) return;
      const key = l.inside ? 'inside' : `${l.r}|${l.wide ?? WIDE_ARC}`;
      if (!rings.has(key)) rings.set(key, []);
      rings.get(key).push([l, k]);
    });
    for (const list of rings.values()) {
      const [first] = list[0],
        size = sizeOf(first);
      ctx.font = `560 ${size}px ${SANS}`;
      const result = placeRadialLabels(
        list.map(([l, k]) => ({
          id: String(k),
          text: l.text,
          angle: l.a,
          span: l.inside ? l.ray.span : l.span,
          priority: l.priority ?? 0,
          r: l.r * R,
          ...(l.inside
            ? {
                band: { r0: l.ray.r0 * R, r1: l.ray.r1 * R },
                // What the name sits on: the painted band, or silk hairs over the page (dark or light).
                fill: silk
                  ? silk.additive
                    ? tone(l.hue ?? 240, 40, 30)
                    : tone(l.hue ?? 240, 30, 82)
                  : tone(l.hue ?? 240, 46, 54),
              }
            : {}),
        })),
        {
          cx,
          cy,
          r: first.r * R,
          measure: (value) => ({ width: ctx.measureText(value).width, height: size * 1.15 }),
          wideArc: first.wide ?? WIDE_ARC,
          spokeGap: SPOKE_GAP,
          keep: focus ? (list.find(([l]) => l.text === focus)?.[1]?.toString() ?? null) : null,
        },
      );
      for (const p of result) placed.set(Number(p.id), p);
    }
    model.labels.forEach((l, k) => {
      const p = placed.get(k);
      if (p && !p.visible) return;
      const lifted = !focus || l.text === focus,
        size = sizeOf(l),
        weight = l.small ? 400 : 560,
        opacity = (l.inside ? 0.9 : lifted ? 0.88 : 0.3) * alpha * shown;
      let x, y, align, angle, box, ink;
      if (p) {
        // Rim spokes start just inside the rim, as the page always set them.
        const inset = p.orientation === 'ray' ? 0.045 * R : 0;
        x = p.x - Math.cos(p.angle) * inset;
        y = p.y - Math.sin(p.angle) * inset;
        align = p.align === 'start' ? 'left' : p.align === 'end' ? 'right' : 'center';
        angle = p.rotation;
        box = p.box ? { width: p.box.width, lines: p.box.lines } : null;
        ink = p.ink;
      } else {
        [x, y] = P(l.a, l.r);
        // Numbers round the rim read upright; only names along a narrow arc follow its radius.
        const upright = !l.ray && (l.small || !l.rotate),
          flip = Math.cos(l.a) < 0;
        align = l.ray
          ? 'center'
          : upright
            ? (l.align ?? (Math.cos(l.a) > 0.2 ? 'left' : Math.cos(l.a) < -0.2 ? 'right' : 'center'))
            : flip
              ? 'right'
              : 'left';
        angle = upright ? 0 : l.a + (flip ? Math.PI : 0);
        box = null;
        ink = null;
      }
      // Labels go to the page as text when it can take them (crisp at any pixel ratio); else into the canvas.
      if (labelSink) {
        labelSink.push({ x, y, text: l.text, size, weight, align, angle, opacity, inside: !!l.inside, box, ink });
        return;
      }
      ctx.textBaseline = 'middle';
      ctx.textAlign = align;
      ctx.fillStyle =
        ink === 'dark' ? tone(240, 10, 18, opacity) : l.inside ? tone(30, 30, 98, opacity) : tone(240, 10, 34, opacity);
      crispText(ctx, x, y, size, weight, () => ctx.fillText(l.text, 0, 0), angle);
    });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
  return paths;
}

/** Element kinds the silk brush draws; any other kind keeps its painted form. */
const SILK_KINDS = new Set(['arc', 'curve', 'ribbon', 'dot']);
/** Views drawn in silk when the page offers a brush. */
export const SILK_VIEWS = new Set(['onion', 'chord', 'sunburst']);

/**
 * One element as silk: arcs become radial hairs, curves and ribbons become strand bundles, dots become glows.
 * Hover heats an element; a focused element's relatives warm a little.
 */
function silkElement(silk, it, i, { e, up, hot, dim, lit, cx, cy, R, P, share }) {
  const color = tone(it.h, it.s, it.l),
    heat = hot ? 0.75 : lit ? 0.32 : it.warm ? 0.18 : 0,
    alpha = dim * (hot ? 1.5 : 1) * Math.min(1, e * 1.6);
  if (it.kind === 'arc') {
    if (!(it.a1 > it.a0)) return;
    const r0 = it.r0 * e,
      r1 = it.r0 + (it.r1 - it.r0 + up) * e;
    silk.hairs({
      cx,
      cy,
      a0: it.a0,
      a1: it.a0 + (it.a1 - it.a0) * Math.min(1, e * 1.2),
      r0: r0 * R,
      r1: r1 * R,
      color,
      alpha,
      heat,
      ragged: 0.4,
      seed: i,
    });
  } else if (it.kind === 'dot') {
    const [x, y] = P(it.a, it.r * e);
    silk.glow({ x, y, r: Math.max(0.2, it.size * R), color, alpha, heat });
  } else if (it.kind === 'curve') {
    const [a0, r0] = it.from,
      [a1, r1] = it.to;
    silk.strands({
      from: P(a0, r0),
      c1: P(a0, r0 * (1 - it.bend)),
      c2: P(a1, r1 * (1 - it.bend * 0.5)),
      to: P(a1, r1 + up * 0.3),
      count: Math.max(2, Math.min(9, Math.round(it.width * 2.4 * share + 1))),
      spread: 2 + it.width * 2.2 * Math.max(1, R / 240),
      trim: e,
      color,
      alpha: alpha * (hot ? 1.4 : 1.4 * share),
      heat,
      seed: i,
    });
  } else if (it.kind === 'ribbon') {
    const r = it.r * (0.6 + 0.4 * e),
      bend = 0.18 + 0.3 * (1 - e),
      ma = (it.a0 + it.a1) / 2,
      mb = (it.b0 + it.b1) / 2,
      span = Math.max(it.a1 - it.a0, it.b1 - it.b0) * r * R;
    // Strand ends are spaced along each ribbon's own arc, so the bundle stays attached to the rim.
    silk.strands({
      from: P(ma, r),
      c1: P(ma, r * bend),
      c2: P(mb, r * bend),
      to: P(mb, r),
      fromArc: { cx, cy, r: r * R, a0: it.a0, a1: it.a1 },
      toArc: { cx, cy, r: r * R, a0: it.b0, a1: it.b1 },
      count: Math.max(3, Math.min(48, Math.round(span / 1.4))),
      spread: span * 0.5,
      color,
      alpha: alpha * 1.6,
      heat,
      seed: i,
    });
  }
}

/** Catmull-Rom through closed points, appended to a path (moveTo when `start`, else a line to the first). */
function smoothLoop(path, pts, start) {
  const n = pts.length,
    at = (k) => pts[(k + n) % n];
  if (start) path.moveTo(...pts[0]);
  else path.lineTo(...pts[0]);
  for (let k = 0; k < n; k++) {
    const p0 = at(k - 1),
      p1 = at(k),
      p2 = at(k + 1),
      p3 = at(k + 2);
    path.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) / 6,
      p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6,
      p2[1] - (p3[1] - p1[1]) / 6,
      p2[0],
      p2[1],
    );
  }
}
