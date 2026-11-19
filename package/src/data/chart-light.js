// Light-strand charts: every chart type is the same set of hairs (one bundle per row) and silk strands (one bundle
// per link), placed in a shared "bent" coordinate space. A point (u, v) sits u along a baseline and v away from it;
// the baseline's curvature k turns the same layout into a circle (k = 1/R) or a straight line (k = 0). Changing
// chart type therefore never cross-fades: each element interpolates its own coordinates and its own curvature, so a
// circle unrolls into a line and polar layouts swing around their rim. The sampler turns the current pose into
// dense glowing points whose brightness follows an anisotropic sheen, so strands catch light like silk.
import { toRGBA } from '../color/index.js';

const TAU = 2 * Math.PI;
export const CHART_TYPES = Object.freeze(['radial', 'chord', 'sunburst', 'arc', 'bar']);
const LINE_TYPES = new Set(['arc', 'bar']);
const ROW_FIELDS = ['k', 'ax', 'ay', 'sg', 'u', 'w', 'v0', 'v1', 'taper', 'ragged', 'alpha', 'lv', 'la', 'lrot'];
const LINK_FIELDS = ['k', 'ax', 'ay', 'sg', 'ua', 'ub', 'wa', 'wb', 'v', 'depth', 'alpha', 'trim', 'strands'];
const MAX_STRANDS = 14;
const STRAND_BUDGET = 150000;
const HAIR_BUDGET = 70000;
const MIN_SPACING = 0.6;

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a, b, t) => a + (b - a) * t;
/** Deterministic value noise in [0, 1) so every frame of a seeded chart is reproducible. */
function hash(i, salt = 0) {
  const x = Math.sin(i * 127.1 + salt * 311.7 + 0.5) * 43758.5453123;
  return x - Math.floor(x);
}

/** Group membership for the sunburst: named groups keep first-seen order; ungrouped rows share one ring. */
export function chartGroups(data) {
  const names = [],
    index = new Map();
  const of = data.map((row) => {
    const name = row.group ?? 'All';
    if (!index.has(name)) {
      index.set(name, names.length);
      names.push(name);
    }
    return index.get(name);
  });
  return { names, of };
}

/** Allocate proportional spans with gaps around a rim or along a line of the given length. */
function spans(values, order, length, gapShare) {
  const n = values.length,
    total = values.reduce((sum, v) => sum + v, 0);
  const gap = Math.min((length * gapShare) / n, length * 0.025);
  const free = length - gap * n;
  const width = values.map((v) => (total > 0 ? (free * v) / total : free / n));
  const centre = new Array(n);
  let cursor = -length / 2 + gap / 2;
  for (const i of order) {
    centre[i] = cursor + width[i] / 2;
    cursor += width[i] + gap;
  }
  return { centre, width, gap };
}

/**
 * The target pose for a chart type: per-row, per-group and per-link coordinates in bent space.
 * @param {{values:number[], links:{a:number,b:number,value:number}[], groups:{names:string[],of:number[]}}} data
 */
export function chartPose(data, type, width, height) {
  const { values, links, groups } = data;
  const n = values.length,
    g = groups.names.length;
  const max = Math.max(...values, 0) || 1,
    maxLink = Math.max(...links.map((l) => l.value), 0) || 1;
  const size = Math.min(width, height);
  const line = LINE_TYPES.has(type);
  const order =
    type === 'sunburst' ? [...values.keys()].sort((a, b) => groups.of[a] - groups.of[b] || a - b) : [...values.keys()];
  const R = type === 'chord' ? size * 0.36 : type === 'sunburst' ? size * 0.29 : size * 0.27;
  const frame = line
    ? { k: 0, ax: width / 2, ay: type === 'bar' ? height * 0.8 : height * 0.36, sg: 0 }
    : { k: 1 / R, ax: width / 2, ay: height * 0.5 - R, sg: 1 };
  const rimLength = line ? width * 0.86 : TAU * R;
  const rows = new Array(n);
  const row = (i, fields) => (rows[i] = { ...frame, alpha: 1, la: 1, lrot: 0, ...fields });
  let crowded = false;

  if (type === 'radial' || type === 'bar') {
    const slot = rimLength / n;
    const reach = type === 'bar' ? height * 0.6 : size * 0.17;
    crowded = type === 'bar' && slot < 54;
    order.forEach((i, position) => {
      const u = (position + 0.5) * slot - rimLength / 2;
      const v1 = 4 + reach * (values[i] / max);
      row(i, {
        u,
        w: Math.min(slot * 0.6, 44),
        v0: 4,
        v1,
        taper: type === 'bar' ? 0.45 : 1,
        ragged: 0.22,
        lv: type === 'bar' ? -12 : v1 + 12,
        lrot: crowded ? -0.72 : 0,
      });
    });
  } else {
    const share = type === 'sunburst' ? 0.06 : 0.12;
    const { centre, width: span } = spans(values, order, rimLength, share);
    const base = type === 'sunburst' ? -R * 0.18 : 4;
    crowded = type === 'arc' && rimLength / n < 64;
    for (let i = 0; i < n; i++) {
      const v1 = type === 'sunburst' ? base + R * 0.2 + R * 0.3 * (values[i] / max) : base + 26;
      row(i, {
        u: centre[i],
        w: Math.max(span[i], 1.5),
        v0: base,
        v1,
        taper: 0,
        ragged: type === 'sunburst' ? 0.14 : 0.6,
        lv: v1 + 12,
        lrot: crowded ? -0.72 : 0,
      });
    }
  }

  // Sunburst groups form an inner ring under their rows; elsewhere they fold into the rim, invisible.
  const groupPose = new Array(g);
  for (let j = 0; j < g; j++) {
    const members = [...values.keys()].filter((i) => groups.of[i] === j);
    const lo = Math.min(...members.map((i) => rows[i].u - rows[i].w / 2)),
      hi = Math.max(...members.map((i) => rows[i].u + rows[i].w / 2));
    const show = type === 'sunburst';
    groupPose[j] = {
      ...frame,
      u: (lo + hi) / 2,
      w: show ? Math.max(hi - lo, 1.5) : 0,
      v0: show ? -R * 0.44 : rows[members[0]].v0,
      v1: show ? -R * 0.24 : rows[members[0]].v0,
      taper: 0,
      ragged: 0.1,
      alpha: show ? 0.85 : 0,
      lv: show ? -R * 0.34 : 0,
      la: show && hi - lo > 46 && g > 1 ? 1 : 0,
      lrot: 0,
    };
  }

  // Links leave each row from a sub-span sized by their value, ordered by where they go, so ribbons never twist.
  const ribbon = type !== 'radial' && type !== 'bar';
  const ends = links.map(() => [null, null]);
  for (let i = 0; i < n; i++) {
    const own = [];
    links.forEach((l, index) => {
      if (l.a === i) own.push([index, 0, l.b]);
      else if (l.b === i) own.push([index, 1, l.a]);
    });
    const offset = (j) => {
      let d = rows[j].u - rows[i].u;
      if (!line) d = ((((d + rimLength / 2) % rimLength) + rimLength) % rimLength) - rimLength / 2;
      return d;
    };
    own.sort((p, q) => offset(q[2]) - offset(p[2]));
    const total = own.reduce((sum, [index]) => sum + links[index].value, 0) || 1;
    let cursor = rows[i].u - rows[i].w * 0.46;
    for (const [index, side] of own) {
      const share = ribbon ? (rows[i].w * 0.92 * links[index].value) / total : 0;
      const narrow = rows[i].w * 0.8 * (0.3 + 0.7 * Math.sqrt(links[index].value / maxLink));
      ends[index][side] = ribbon ? [cursor + share / 2, share] : [rows[i].u, narrow];
      cursor += share;
    }
  }
  const linkPose = links.map((l, index) => {
    const [[ua, wa], [ub0, wb]] = ends[index];
    let ub = ub0;
    if (!line) {
      if (ub - ua > rimLength / 2) ub -= rimLength;
      else if (ua - ub > rimLength / 2) ub += rimLength;
    }
    const reach = Math.abs(ub - ua);
    const v = type === 'sunburst' ? rows[l.a].v0 - 3 : -4;
    const inner = line ? 0 : R + v;
    const depth = line
      ? Math.min(reach * 0.5, height * 0.58)
      : inner * (ribbon ? 0.97 : 0.95) * Math.min(1, reach / (rimLength / 2)) ** (ribbon ? 0.42 : 0.55);
    const shown = l.value > 0 && type !== 'bar' && type !== 'sunburst';
    return {
      ...frame,
      ua,
      ub,
      wa,
      wb,
      v,
      depth,
      alpha: shown ? 1 : 0,
      trim: shown ? 1 : 0,
      strands: 2 + (MAX_STRANDS - 2) * Math.sqrt(l.value / maxLink),
    };
  });
  return { type, rows, groups: groupPose, links: linkPose, rim: { ...frame, span: rimLength / 2 } };
}

function blendElement(a, b, t, fields, rim = null) {
  const out = {};
  for (const f of fields) out[f] = lerp(a[f], b[f], t);
  // Between two circles, interpolate the radius so the centre stays put while the ring grows or shrinks.
  if (a.k > 0 && b.k > 0) out.k = 1 / lerp(1 / a.k, 1 / b.k, t);
  // Unrolling: every element hangs from the rim's shared anchor, so the circle opens in place and then settles.
  if (rim) {
    out.ax = rim.ax;
    out.ay = rim.ay;
  }
  return out;
}

/** Morph between two poses at per-element progress; long moves around a rim lift outward so marks pass over each other. */
export function blendPose(from, to, progress) {
  const rim = blendElement(from.rim, to.rim, progress.rim, ['k', 'ax', 'ay', 'sg', 'span']);
  const shared = from.rim.k > 0 !== to.rim.k > 0 ? rim : null;
  const rows = to.rows.map((b, i) => {
    const a = from.rows[i],
      t = progress.rows[i];
    const out = blendElement(a, b, t, ROW_FIELDS, shared);
    if (a.k > 0 && b.k > 0) {
      const lift = Math.min(36, Math.abs(b.u - a.u) * 0.08) * Math.sin(Math.PI * t);
      out.v0 += lift * 0.4;
      out.v1 += lift;
      out.lv += lift;
    }
    return out;
  });
  const groups = to.groups.map((b, i) => blendElement(from.groups[i], b, progress.groups[i], ROW_FIELDS, shared));
  const links = to.links.map((b, i) => blendElement(from.links[i], b, progress.links[i], LINK_FIELDS, shared));
  return { type: to.type, rows, groups, links, rim };
}

/**
 * Per-element delays for a transition. Within one family the change sweeps around the rim; between a circle and a
 * line the elements nearest the top unroll first, so the circle peels open from its anchor.
 */
export function morphDelays(from, to, kind) {
  const span = Math.max(from.rim.span, 1);
  const position = (u) => clamp01((u + span) / (2 * span));
  const unroll = from.rim.k > 0 !== to.rim.k > 0;
  const delay = (u) =>
    kind === 'data' ? 0.14 * position(u) : unroll ? 0.55 * Math.abs(position(u) - 0.5) * 2 : 0.42 * position(u);
  const rows = from.rows.map((r) => delay(r.u));
  const groups = from.groups.map((r) => delay(r.u) + (kind === 'data' ? 0 : 0.12));
  const links = to.links.map((l, i) => {
    const a = from.links[i];
    return delay((a.ua + a.ub) / 2) + (kind === 'data' ? 0.04 : 0.1);
  });
  return { rows, groups, links, rim: kind === 'data' ? 0 : unroll ? 0.12 : 0 };
}

/** Map bent-space (u, v) to the screen for an element's own curvature and anchor. */
function place(e, spin, u, v, out, offset) {
  if (e.k < 1e-7) {
    out[offset] = e.ax + u;
    out[offset + 1] = e.ay - v;
    return;
  }
  const r = 1 / e.k,
    th = e.k * u + spin * e.sg;
  out[offset] = e.ax + (r + v) * Math.sin(th);
  out[offset + 1] = e.ay + r - (r + v) * Math.cos(th);
}

const rgb = (color) => toRGBA(color).slice(0, 3);
/** Light colors for a theme: dark themes add light; paper lays down ink. */
export function chartLook(theme) {
  const background = rgb(theme.background);
  const additive = (background[0] + background[1] + background[2]) / 3 < 0.45;
  const mark = rgb(theme.mark),
    accent = rgb(theme.accent);
  // Heat runs from the theme's mark through its accent to a brighter, warmer accent, then white-hot (or deep ink).
  const ember = additive ? accent.map((c, i) => Math.min(1, c * 0.9 + (i === 0 ? 0.08 : 0))) : accent;
  const amber = additive
    ? [1, Math.min(1, accent[1] + 0.32), Math.min(1, accent[2] + 0.1)]
    : accent.map((c) => c * 0.75);
  const hot = additive ? accent.map((c) => c + (1 - c) * 0.85) : accent.map((c) => c * 0.5);
  return {
    additive,
    mark,
    ramp: [mark, ember, amber, hot],
    strand: additive ? (theme.motion === 'silk' ? 0.2 : 0.17) : 0.42,
    hair: additive ? 0.26 : 0.55,
    glow: additive ? 0.034 : 0,
    ambient: additive && theme.motion !== 'grow',
    sheen: theme.motion === 'grow' ? 0.55 : 1,
  };
}

/**
 * Brightness of a fibre at (x, y) running along the unit tangent (tx, ty), lit from `view.light`. The highlight is
 * strongest where the fibre runs across the direction to the light, as on silk or brushed metal.
 */
export function shadeFibre(view, x, y, tx, ty) {
  const L = view.light;
  let lx = L[0] - x,
    ly = L[1] - y;
  const lz = view.lightHeight,
    planar = lx * lx + ly * ly,
    d = Math.sqrt(planar + lz * lz);
  lx /= d;
  ly /= d;
  const z = lz / d;
  let hx = lx,
    hy = ly;
  const h = Math.sqrt(hx * hx + hy * hy + (z + 1) * (z + 1));
  hx /= h;
  hy /= h;
  const th = tx * hx + ty * hy;
  let s = 1 - th * th;
  s *= s;
  s *= s;
  s *= s;
  s *= s;
  const tl = tx * lx + ty * ly;
  const diffuse = Math.sqrt(Math.max(0, 1 - tl * tl));
  const near = 1 / (1 + planar / (view.lightReach * view.lightReach));
  return 0.36 + 0.34 * diffuse * near + view.look.sheen * view.lightGain * s * near;
}

export function heatColor(look, h, out) {
  const ramp = look.ramp,
    x = clamp01(h) * (ramp.length - 1),
    i = Math.min(ramp.length - 2, Math.floor(x)),
    t = x - i;
  for (let c = 0; c < 3; c++) out[c] = lerp(ramp[i][c], ramp[i + 1][c], t);
  return out;
}

/** Growable float buffers reused across frames. */
export function buffer(stride) {
  const b = {
    data: new Float32Array(stride * 4096),
    count: 0,
    reset() {
      b.count = 0;
    },
    /** Make room for one more entry and return its offset. */
    slot() {
      const o = b.count * stride;
      if (o + stride > b.data.length) {
        const next = new Float32Array(b.data.length * 2);
        next.set(b.data);
        b.data = next;
      }
      b.count++;
      return o;
    },
    push(x, y, z, w) {
      const o = b.slot(),
        d = b.data;
      d[o] = x;
      if (stride > 1) d[o + 1] = y;
      if (stride > 2) {
        d[o + 2] = z;
        d[o + 3] = w;
      }
    },
    view() {
      return b.data.subarray(0, b.count * stride);
    },
  };
  return b;
}

/**
 * Sample the current pose into point clouds.
 * @param {object} pose blended pose
 * @param {object} view {look, width, height, ambient, spin, light:[x,y]|null, pointer:[x,y]|null,
 *   rowLight:number[], linkLight:number[], rowHeat:number[], linkHeat:number[], highlight:boolean[]}
 */
export function createSampler() {
  const strands = { xy: buffer(2), rgba: buffer(4) },
    hairs = { xy: buffer(2), rgba: buffer(4) },
    glow = { xy: buffer(2), rgba: buffer(4) },
    sparks = { xy: buffer(2), rgba: buffer(4), r: buffer(1) },
    dust = { xy: buffer(2), rgba: buffer(4), r: buffer(1) };
  const p = new Float64Array(2),
    q = new Float64Array(2),
    color = [0, 0, 0];
  let path = new Float64Array(4096);

  function emit(target, x, y, r, g, b, a) {
    target.xy.push(x, y);
    target.rgba.push(r > 1 ? 1 : r, g > 1 ? 1 : g, b > 1 ? 1 : b, a > 1 ? 1 : a);
  }

  /** Points of one strand: a cubic in bent space, mapped through the element's frame. */
  function strandPath(e, spin, uA, uB, v, depth, wave, trim, count) {
    if (path.length < count * 2 + 4) path = new Float64Array(count * 4);
    for (let i = 0; i < count; i++) {
      const t = (trim * i) / Math.max(1, count - 1),
        s = 1 - t;
      const b0 = s * s * s,
        b1 = 3 * s * s * t,
        b2 = 3 * s * t * t,
        b3 = t * t * t;
      const u = (b0 + b1) * uA + (b2 + b3) * uB;
      const vv = v - (b1 + b2) * depth + wave * Math.sin(Math.PI * t) * Math.sin(TAU * (t * 1.15) + wave * 0.9);
      place(e, spin, u, vv, path, i * 2);
    }
    return path;
  }

  function estimate(e, spin, uA, uB, v, depth) {
    let length = 0;
    for (let i = 0; i <= 8; i++) {
      const t = i / 8,
        s = 1 - t;
      const u = (s * s * s + 3 * s * s * t) * uA + (3 * s * t * t + t * t * t) * uB;
      place(e, spin, u, v - 3 * s * t * depth, q, 0);
      if (i) length += Math.hypot(q[0] - p[0], q[1] - p[1]);
      p[0] = q[0];
      p[1] = q[1];
    }
    return length * 1.04;
  }

  return function sample(pose, view) {
    for (const cloud of [strands, hairs, glow, sparks, dust]) for (const b of Object.values(cloud)) b.reset();
    const { look, spin, ambient } = view;
    const pick = { rows: pose.rows.map(() => []), links: pose.links.map(() => []) };

    // Strands: estimate total length first, then space samples to fit the point budget.
    const lengths = pose.links.map((e) =>
      e.alpha * e.trim > 0.002 ? estimate(e, spin, e.ua, e.ub, e.v, e.depth) * e.trim * e.strands : 0,
    );
    const strandSpacing = Math.max(MIN_SPACING, lengths.reduce((a, b) => a + b, 0) / STRAND_BUDGET);
    pose.links.forEach((e, index) => {
      if (!lengths[index]) return;
      const light = view.linkLight[index],
        heat = view.linkHeat[index];
      heatColor(look, heat, color);
      const visible = e.strands;
      const strandLength = lengths[index] / Math.max(1, e.strands);
      const count = Math.max(4, Math.ceil(strandLength / strandSpacing));
      for (let s = 0; s < MAX_STRANDS; s++) {
        const weight = clamp01(visible - s);
        if (weight <= 0) break;
        const rank = (s + 1) >> 1,
          side = s & 1 ? 1 : -1;
        const o = s === 0 ? 0 : (side * rank) / Math.max(1, visible - 1);
        const jitter = hash(index * 31 + s, 1) - 0.5;
        const uA = e.ua + o * e.wa * 0.5,
          uB = e.ub - o * e.wb * 0.5;
        const wave = (2 + 5 * hash(index * 17 + s, 2)) * Math.sin(ambient * (0.35 + 0.3 * hash(s, 3)) + s * 1.3);
        const pts = strandPath(e, spin, uA, uB, e.v, e.depth * (1 + jitter * 0.24), wave, e.trim, count);
        const fiber = (0.5 + 0.5 * hash(index * 7 + s, 4)) * weight;
        // Brightness per unit length stays constant however densely the strand is sampled; heavy bundles share it.
        const base = (look.strand * e.alpha * fiber * light * strandSpacing * 2.3) / Math.sqrt(Math.max(1, visible));
        for (let i = 0; i < count; i++) {
          const x = pts[i * 2],
            y = pts[i * 2 + 1];
          const j = i < count - 1 ? i + 1 : i - 1;
          let tx = pts[j * 2] - x,
            ty = pts[j * 2 + 1] - y;
          const tl = Math.sqrt(tx * tx + ty * ty) || 1;
          tx /= tl;
          ty /= tl;
          const t = i / (count - 1);
          const sparkle = 0.82 + 0.18 * Math.sin(t * 29 + s * 1.7 + ambient * 1.6);
          const a = base * shadeFibre(view, x, y, tx, ty) * sparkle;
          emit(strands, x, y, color[0], color[1], color[2], a);
          if (look.glow && i % 8 === 0) emit(glow, x, y, color[0], color[1], color[2], a * look.glow * 9);
          if (s === 0 && i % Math.max(1, Math.floor(count / 14)) === 0) pick.links[index].push(x, y);
        }
      }
    });

    // Hairs: fixed count per row so they can morph; spacing adapts to the budget.
    const n = pose.rows.length;
    const perRow = Math.max(14, Math.min(72, Math.round(2600 / n)));
    const all = [...pose.rows.map((e, i) => [e, i, false]), ...pose.groups.map((e, i) => [e, i, true])];
    const hairLength = all.reduce((sum, [e]) => sum + e.alpha * Math.abs(e.v1 - e.v0) * perRow, 0);
    const hairSpacing = Math.max(MIN_SPACING, hairLength / HAIR_BUDGET);
    const ptr = view.pointer;
    for (const [e, i, group] of all) {
      if (e.alpha < 0.002) continue;
      const light = group ? 0.7 + 0.3 * view.groupLight[i] : view.rowLight[i];
      heatColor(look, group ? 0 : view.rowHeat[i] + (view.highlight[i] ? 0.18 : 0), color);
      for (let h = 0; h < perRow; h++) {
        const seed = (group ? 9000 : 0) + i * 101 + h;
        const f = (h + 0.5 + (hash(seed, 5) - 0.5) * 0.9) / perRow;
        const across = (f - 0.5) * 2;
        const lengthFactor = clamp01(1 - e.ragged * hash(seed, 6) - e.taper * across * across * 0.55);
        const breathe = 1 + 0.05 * Math.sin(ambient * (0.8 + hash(seed, 7)) + h * 0.6);
        const tip = e.v0 + (e.v1 - e.v0) * lengthFactor * breathe;
        const u = e.u + (f - 0.5) * e.w;
        const sway = 2.2 * Math.sin(ambient * (0.6 + 0.5 * hash(seed, 8)) + hash(seed, 9) * TAU);
        const count = Math.max(3, Math.ceil(Math.abs(tip - e.v0) / hairSpacing));
        place(e, spin, u + sway, tip, q, 0);
        let leanX = 0,
          leanY = 0;
        if (ptr) {
          const dx = ptr[0] - q[0],
            dy = ptr[1] - q[1],
            d = Math.hypot(dx, dy);
          const pull = Math.max(0, 1 - d / 90) ** 2 * 0.35;
          leanX = dx * pull;
          leanY = dy * pull;
        }
        const fiber = 0.55 + 0.45 * hash(seed, 10);
        // Narrow rows hold the same number of hairs as wide ones, so their hairs dim to keep the density even.
        const density = Math.max(0.06, Math.min(1, Math.abs(e.w) / (perRow * 1.1)));
        const base = look.hair * e.alpha * fiber * light * hairSpacing * 1.7 * density;
        const phase = hash(seed, 25);
        place(e, spin, u, e.v0, p, 0);
        const bx = p[0],
          by = p[1];
        let tx = q[0] + leanX - bx,
          ty = q[1] + leanY - by;
        const tl = Math.sqrt(tx * tx + ty * ty) || 1;
        tx /= tl;
        ty /= tl;
        for (let k = 0; k < count; k++) {
          // Each hair starts its samples at its own phase, so neighbouring hairs never line up into bands.
          const t = Math.min(1, (k + phase) / count);
          place(e, spin, u + sway * t * t, e.v0 + (tip - e.v0) * t, p, 0);
          const x = p[0] + leanX * t * t,
            y = p[1] + leanY * t * t;
          const along = 0.3 + 0.7 * t;
          const a = base * along * shadeFibre(view, x, y, tx, ty);
          emit(hairs, x, y, color[0], color[1], color[2], a);
          if (look.glow && (k + h) % 6 === 0) emit(glow, x, y, color[0], color[1], color[2], a * look.glow * 8);
        }
        if (!group && h % Math.max(1, Math.floor(perRow / 6)) === 0) {
          place(e, spin, u, e.v0, p, 0);
          place(e, spin, u, tip, q, 0);
          pick.rows[i].push(p[0], p[1], q[0], q[1]);
        }
      }
    }

    // The rim: a fine double line with ticks, morphing with the layout.
    const rim = pose.rim;
    const rimCount = Math.ceil((rim.span * 2) / 1.1);
    const rimAlpha = look.additive ? 0.1 : 0.12;
    for (let i = 0; i < rimCount; i++) {
      const u = -rim.span + (2 * rim.span * i) / rimCount;
      for (const v of [-1.5, 1]) {
        place(rim, spin, u, v, p, 0);
        emit(hairs, p[0], p[1], look.mark[0], look.mark[1], look.mark[2], rimAlpha);
      }
    }

    // Comets: bright heads travel the strongest and hottest links.
    const ranked = pose.links
      .map((e, i) => [e.alpha * e.trim * (e.strands + 10 * view.linkHeat[i]) * view.linkLight[i], i])
      .filter(([w]) => w > 0.5)
      .sort((a, b) => b[0] - a[0])
      .slice(0, 18);
    for (const [, index] of ranked) {
      const e = pose.links[index];
      const period = 2.6 + 2.2 * hash(index, 11) - 1.2 * view.linkHeat[index];
      const head = (((ambient + hash(index, 12) * 9) / period) % 1) * 1.5 - 0.25;
      if (head <= 0 || head > e.trim) continue;
      const tail = Math.min(head, 0.32);
      const steps = 34;
      const pts = strandPath(e, spin, e.ua, e.ub, e.v, e.depth, 0, 1, 160);
      heatColor(look, Math.max(0.55, view.linkHeat[index]), color);
      for (let k = 0; k < steps; k++) {
        const t = head - (tail * k) / steps;
        const at = Math.min(159, Math.max(0, t * 159));
        const i0 = Math.floor(at),
          i1 = Math.min(159, i0 + 1),
          w = at - i0;
        const x = lerp(pts[i0 * 2], pts[i1 * 2], w),
          y = lerp(pts[i0 * 2 + 1], pts[i1 * 2 + 1], w);
        const fade = (1 - k / steps) ** 2;
        const hot = k < 3 ? 1 : 0;
        sparks.xy.push(x, y);
        sparks.r.push(k === 0 ? 5 : 0.9 + 1.4 * fade);
        sparks.rgba.push(
          lerp(color[0], 1, hot * 0.6),
          lerp(color[1], 1, hot * 0.6),
          lerp(color[2], 1, hot * 0.6),
          Math.min(1, (k === 0 ? 0.55 : 0.7 * fade) * view.linkLight[index] * (look.additive ? 1 : 0.6)),
        );
      }
    }

    // Ambient light: dust that twinkles and long streaks drifting across the dark, like the space around a lens.
    if (look.ambient) {
      for (let i = 0; i < 320; i++) {
        const x = hash(i, 13) * view.width,
          y = hash(i, 14) * view.height;
        const tw = 0.5 + 0.5 * Math.sin(ambient * (0.4 + hash(i, 15)) + i);
        dust.xy.push(x, y);
        dust.r.push(0.5 + 1.1 * hash(i, 16) ** 3);
        dust.rgba.push(0.8, 0.84, 0.95, 0.1 + 0.32 * tw * hash(i, 17));
      }
      for (let i = 0; i < 26; i++) {
        const radius = 260 + 900 * hash(i, 18);
        const cx = view.width * (hash(i, 19) * 1.6 - 0.3),
          cy = view.height * (hash(i, 20) * 1.6 - 0.3);
        const speed = (16 + 34 * hash(i, 21)) / radius;
        const dir = hash(i, 22) > 0.5 ? 1 : -1;
        const angle = hash(i, 23) * TAU + dir * speed * ambient;
        const trail = Math.min(0.5, (90 + 160 * hash(i, 24)) / radius);
        const steps = Math.ceil((trail * radius) / 1.4);
        for (let k = 0; k < steps; k++) {
          const a = angle - (dir * (trail * k)) / steps;
          const x = cx + radius * Math.cos(a),
            y = cy + radius * Math.sin(a);
          if (x < -10 || y < -10 || x > view.width + 10 || y > view.height + 10) continue;
          const fade = (1 - k / steps) ** 1.6;
          dust.xy.push(x, y);
          dust.r.push(k === 0 ? 2.4 : 0.85);
          dust.rgba.push(0.86, 0.9, 1, (k === 0 ? 0.5 : 0.16) * fade);
        }
      }
    }

    const pack = (cloud) => ({
      positions: cloud.xy.view(),
      colors: cloud.rgba.view(),
      ...(cloud.r ? { radii: cloud.r.view() } : {}),
    });
    return {
      strands: pack(strands),
      hairs: pack(hairs),
      glow: pack(glow),
      sparks: pack(sparks),
      dust: pack(dust),
      pick,
      place: (e, u, v) => {
        place(e, spin, u, v, p, 0);
        return [p[0], p[1]];
      },
    };
  };
}
