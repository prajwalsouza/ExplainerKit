// Parallax for scroll stories: depth layers whose offsets are pure functions of story time, the perspective
// rule that picks their speeds, the artwork size each layer needs, and checks that catch parallax going wrong.
//
// Perspective: a camera translating by T moves a point at distance Z across the image by f·T/Z. Relative to a
// subject plane at distance Z₀ (depth 1), a layer at distance Z moves at speed Z₀/Z, so depth = Z/Z₀ and
// speed = 1/depth. This is the same inverse-depth rule `projectLayer` uses for camera pans
// (src/composition/layers.js), so a rig can drive layer offsets directly or drive the camera.
//
// Every offset is a function of sample time and three scene parameters (motion scale, pointer x, pointer y),
// so seeking, reversing and scroll holds stay exact. Thresholds in PARALLAX_RULES are sourced where a source
// exists and otherwise labelled engineering choices; see docs/modules/parallax.md.
import { assert, number, options } from '../core/validate.js';
import { frameMarks } from '../audit/index.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smoothstep = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * (3 - 2 * u);
};
const NAME = /^[a-zA-Z][\w-]{0,63}$/;
const plain = (v) =>
  v && typeof v === 'object' && !Array.isArray(v) && [Object.prototype, null].includes(Object.getPrototypeOf(v));

// ---- Perspective -----------------------------------------------------------------------------------------
/** Layer depth for an object at `distance`, relative to a subject plane at `subject` (same units). Beyond `far` counts as far. */
export function depthFor(distance, spec = {}) {
  options(spec, ['subject', 'far'], 'depthFor');
  const subject = number(spec.subject ?? 1, 'subject distance', 1e-6, 1e9),
    far = number(spec.far ?? 1e9, 'far distance', 1e-6, 1e9);
  return clamp(Math.min(number(distance, 'distance', 1e-6, 1e9), far) / subject, 0.05, 1000);
}
/** Screen speed of a layer relative to the depth-1 plane: 1/depth. */
export function speedFor(depth) {
  return 1 / number(depth, 'layer depth', 0.05, 1000);
}

// ---- Coverage --------------------------------------------------------------------------------------------
function rangeOf(range) {
  options(range, ['width', 'height', 'x', 'y', 'zoom'], 'parallax range');
  const pair = (v, name, min, max, fallback) => {
    if (v === undefined) return fallback;
    assert(Array.isArray(v) && v.length === 2, 'INVALID_PARALLAX', `${name} is a [min, max] pair.`);
    const a = number(v[0], name, min, max),
      b = number(v[1], name, min, max);
    assert(b >= a, 'INVALID_PARALLAX', `${name} needs min ≤ max.`);
    return [a, b];
  };
  return {
    width: number(range.width, 'range width', 1, 8192),
    height: number(range.height, 'range height', 1, 8192),
    x: pair(range.x, 'range x', -1e6, 1e6, [0, 0]),
    y: pair(range.y, 'range y', -1e6, 1e6, [0, 0]),
    zoom: pair(range.zoom, 'range zoom', 1e-3, 1e3, [1, 1]),
  };
}
/** The layer-space rectangle a layer at `depth` must cover so no edge shows. `range.x`/`range.y` are the depth-1 pan extremes in px. */
function required(depth, r) {
  number(depth, 'layer depth', 0.05, 1000);
  const z = r.zoom[0] ** (1 / depth),
    hw = r.width / 2 / z,
    hh = r.height / 2 / z;
  return {
    x: r.width / 2 + r.x[0] / depth - hw,
    y: r.height / 2 + r.y[0] / depth - hh,
    width: (r.x[1] - r.x[0]) / depth + 2 * hw,
    height: (r.y[1] - r.y[0]) / depth + 2 * hh,
  };
}
/**
 * Does `bounds` (layer space) cover the frame for every pan in `range` (and the smallest zoom)?
 * Returns {required, covered, missing:{left,right,top,bottom}} with missing amounts in layer px.
 * Camera rotation and off-centre anchors are not modelled.
 */
export function coverage(bounds, depth, range) {
  options(bounds, ['x', 'y', 'width', 'height'], 'layer bounds');
  const b = {
    x: number(bounds.x ?? 0, 'bounds x'),
    y: number(bounds.y ?? 0, 'bounds y'),
    width: number(bounds.width, 'bounds width', 0, 1e7),
    height: number(bounds.height, 'bounds height', 0, 1e7),
  };
  const need = required(depth, rangeOf(range)),
    up = (v) => Math.max(0, Math.ceil(v * 100) / 100);
  const missing = Object.freeze({
    left: up(b.x - need.x),
    right: up(need.x + need.width - b.x - b.width),
    top: up(b.y - need.y),
    bottom: up(need.y + need.height - b.y - b.height),
  });
  return Object.freeze({
    required: Object.freeze(need),
    covered: Object.values(missing).every((v) => v === 0),
    missing,
  });
}
/** Bounds sized to cover `range` at `depth`, plus `bleed` px on every side (default 16) for antialiasing and blur. */
export function fitBackdrop(depth, range, spec = {}) {
  options(spec, ['bleed'], 'fitBackdrop');
  const bleed = number(spec.bleed ?? 16, 'bleed', 0, 4096),
    need = required(depth, rangeOf(range));
  const out = {
    x: Math.floor(need.x - bleed),
    y: Math.floor(need.y - bleed),
    width: Math.ceil(need.width + 2 * bleed),
    height: Math.ceil(need.height + 2 * bleed),
  };
  assert(
    out.width <= 8192 && out.height <= 8192,
    'PARALLAX_COVERAGE',
    `A layer at depth ${depth} needs ${out.width}×${out.height} px to cover this travel; layers are limited to 8192. Reduce travel or move the layer farther (raise its depth).`,
  );
  return Object.freeze(out);
}

// ---- Motion profile --------------------------------------------------------------------------------------
function pinWindow(t, pin, e) {
  if (t >= pin.at && t <= pin.until) return 1;
  if (e === 0) return 0;
  return t < pin.at ? smoothstep(1 - (pin.at - t) / e) : smoothstep(1 - (t - pin.until) / e);
}
/** Progress 0–1 over [from, to] whose speed eases to zero around each pin and is renormalised to finish on time. */
function progressTable(from, to, pins, ease) {
  if (!(to > from)) return (t) => (t > to ? 1 : 0);
  const N = 1024,
    dt = (to - from) / N,
    cum = new Float64Array(N + 1),
    speed = (t) => pins.reduce((v, p) => v * (1 - pinWindow(t, p, ease)), 1);
  let prev = speed(from);
  for (let i = 1; i <= N; i++) {
    const cur = speed(from + i * dt);
    cum[i] = cum[i - 1] + ((prev + cur) / 2) * dt;
    prev = cur;
  }
  const total = cum[N];
  return (t) => {
    if (total <= 0) return 0;
    const x = clamp((t - from) / dt, 0, N),
      i = Math.min(N - 1, Math.floor(x));
    return clamp((cum[i] + (cum[i + 1] - cum[i]) * (x - i)) / total, 0, 1);
  };
}
/** Pins for a scroll story: an eased stop at each act boundary and at each hold, so layers settle before the reader stops. */
export function storyPins(acts) {
  assert(Array.isArray(acts) && acts.length <= 256, 'INVALID_PARALLAX', 'storyPins needs story acts.');
  const pins = [];
  acts.forEach((act, i) => {
    assert(plain(act), 'INVALID_PARALLAX', 'Each act is a plain record.');
    if (i > 0 && typeof act.from === 'number') pins.push({ at: number(act.from, 'act from', 0, 86400) });
    for (const hold of act.holds ?? []) pins.push({ at: number(hold.at, 'hold at', 0, 86400) });
  });
  return Object.freeze(pins.sort((a, b) => a.at - b.at).map(Object.freeze));
}
/** Story seconds per real second for a storyTimeline, assuming the reader scrolls `viewportsPerSecond` screens a second. */
export function storyRate(timeline, spec = {}) {
  options(spec, ['viewportsPerSecond', 'viewportHeight'], 'storyRate');
  assert(timeline && Array.isArray(timeline.spans), 'INVALID_PARALLAX', 'storyRate needs a storyTimeline result.');
  const pxPerSecond =
    number(spec.viewportsPerSecond ?? 1, 'viewports per second', 0.01, 100) *
    number(spec.viewportHeight ?? 800, 'viewport height', 1, 16384);
  const moving = timeline.spans.filter((s) => !s.holding && s.to > s.from);
  return (time) => {
    const s = moving.find((m) => time >= m.from && time <= m.to);
    return s ? ((s.to - s.from) / (s.end - s.start)) * pxPerSecond : 0;
  };
}

// ---- Rig -------------------------------------------------------------------------------------------------
/**
 * Create ordered depth layers (far first) driven by story time.
 * drive: 'layers' (default) binds each layer's x/y offset to −pan/depth; 'camera' binds the scene camera's x/y
 * to the pan, and the camera's depth projection does the rest; 'none' only creates and sizes the layers.
 */
export function parallaxRig(scene, spec = {}) {
  assert(
    scene && typeof scene.layer === 'function' && typeof scene.parameter === 'function',
    'INVALID_PARALLAX',
    'parallaxRig needs an ExplainerKit scene.',
  );
  options(
    spec,
    [
      'layers',
      'axis',
      'travel',
      'from',
      'to',
      'pins',
      'ease',
      'pointer',
      'drive',
      'reducedMotion',
      'reduced',
      'rest',
      'subject',
      'bleed',
      'zoom',
    ],
    'parallax rig',
  );
  const axis = spec.axis ?? 'x';
  assert(['x', 'y', 'both'].includes(axis), 'INVALID_PARALLAX', 'axis is x, y or both.');
  const drive = spec.drive ?? 'layers';
  assert(['layers', 'camera', 'none'].includes(drive), 'INVALID_PARALLAX', 'drive is layers, camera or none.');
  let travel;
  if (axis === 'both') {
    assert(plain(spec.travel), 'INVALID_PARALLAX', 'axis both needs travel {x, y}.');
    options(spec.travel, ['x', 'y'], 'travel');
    travel = {
      x: number(spec.travel.x ?? 0, 'travel x', -1e5, 1e5),
      y: number(spec.travel.y ?? 0, 'travel y', -1e5, 1e5),
    };
  } else {
    const t = number(spec.travel ?? (axis === 'x' ? scene.width : scene.height) * 0.5, 'travel', -1e5, 1e5);
    travel = { x: axis === 'x' ? t : 0, y: axis === 'y' ? t : 0 };
  }
  const from = number(spec.from ?? 0, 'parallax from', 0, 86400),
    fixedTo = spec.to === undefined ? null : number(spec.to, 'parallax to', from, 86400);
  const ease = number(spec.ease ?? 0.6, 'pin ease', 0, 60),
    pointer = number(spec.pointer ?? 0, 'pointer amplitude', 0, 4096);
  const rest = number(spec.rest ?? 0, 'rest progress', 0, 1),
    reduced = number(spec.reduced ?? 0, 'reduced motion scale', 0, 1),
    subject = spec.subject ?? 1;
  const zoom = spec.zoom ?? [1, 1];
  assert(
    Array.isArray(spec.layers) && spec.layers.length >= 1 && spec.layers.length <= 16,
    'INVALID_PARALLAX',
    'A rig takes one to 16 layers.',
  );
  const names = new Set();
  const defs = spec.layers.map((l) => {
    assert(plain(l), 'INVALID_PARALLAX', 'Each layer is a plain record.');
    options(l, ['name', 'depth', 'distance', 'bounds'], 'parallax layer');
    assert(
      typeof l.name === 'string' && NAME.test(l.name) && !names.has(l.name),
      'INVALID_PARALLAX',
      'Layer names are unique short names (a letter, then letters, digits, - or _).',
    );
    names.add(l.name);
    assert(
      (l.depth === undefined) !== (l.distance === undefined),
      'INVALID_PARALLAX',
      `Layer ${l.name}: give depth or distance, not both.`,
    );
    const depth =
      l.depth !== undefined ? number(l.depth, 'layer depth', 0.05, 1000) : depthFor(l.distance, { subject });
    return { name: l.name, depth, bounds: l.bounds };
  });
  const pins = (spec.pins ?? []).map((p) => {
    assert(plain(p), 'INVALID_PARALLAX', 'Each pin is a plain record.');
    options(p, ['at', 'until', 'layers'], 'parallax pin');
    const at = number(p.at, 'pin at', 0, 86400),
      until = number(p.until ?? at, 'pin until', at, 86400),
      layers = p.layers ?? null;
    assert(
      layers === null || (Array.isArray(layers) && layers.every((n) => names.has(n))),
      'UNKNOWN_PARALLAX_LAYER',
      'Pin layers must name layers of this rig.',
    );
    assert(
      layers === null || drive === 'layers',
      'INVALID_PARALLAX',
      'Per-layer pins need drive: layers; a camera moves every layer together.',
    );
    return { at, until, layers };
  });
  assert(pins.length <= 256, 'RESOURCE_LIMIT', 'Use at most 256 pins.');

  // Depth-1 pan extremes, for sizing. Pointer offsets add on both sides.
  const span = (t) => [Math.min(0, t), Math.max(0, t)];
  const range = Object.freeze({
    width: scene.width,
    height: scene.height,
    x: Object.freeze([span(travel.x)[0] - pointer, span(travel.x)[1] + pointer]),
    y: Object.freeze([span(travel.y)[0] - pointer, span(travel.y)[1] + pointer]),
    zoom: Object.freeze([...zoom]),
  });
  rangeOf(range);
  const bleed = spec.bleed ?? 16;

  // Scene parameters keep the reader's settings seekable; they are restored after a story's reset.
  const motion = scene.parameter(1, { min: 0, max: 1 }),
    px = scene.parameter(0, { min: -1, max: 1 }),
    py = scene.parameter(0, { min: -1, max: 1 });
  const state = { reduced: spec.reducedMotion ?? false, x: 0, y: 0 };
  assert(
    typeof state.reduced === 'boolean',
    'INVALID_PARALLAX',
    'reducedMotion is a boolean; use reduced for the scale it applies.',
  );
  const reapply = () => {
    const m = state.reduced ? reduced : 1;
    if (m !== 1) motion.set(m);
    else motion.reset();
    if (state.x || state.y) {
      px.set(state.x);
      py.set(state.y);
    }
  };
  reapply();
  scene.onReset(reapply);

  const tables = new Map();
  const tableFor = (name, to) => {
    const key = `${name ?? '*'}|${to}`;
    if (!tables.has(key)) {
      if (tables.size > 64) tables.clear();
      tables.set(
        key,
        progressTable(
          from,
          to,
          pins.filter((p) => p.layers === null || (name !== null && p.layers.includes(name))),
          ease,
        ),
      );
    }
    return tables.get(key);
  };
  // Inside a pin the progress is the pin's start value exactly, not an interpolated neighbour.
  const progress = (name, time) => {
    const pin = pins.find((p) => (p.layers === null || p.layers.includes(name)) && time >= p.at && time <= p.until);
    return tableFor(name, fixedTo ?? Math.max(from, scene.duration))(pin ? pin.at : time);
  };
  const panAt = (name, time, m, ux, uy) => {
    const u = rest + m * (progress(name, time) - rest);
    return { x: travel.x * u + pointer * m * ux, y: travel.y * u + pointer * m * uy };
  };

  const layers = scene._batch ? scene._batch(build) : build();
  function build() {
    return [...defs]
      .sort((a, b) => b.depth - a.depth)
      .map((def) => {
        const bounds = def.bounds ?? fitBackdrop(def.depth, range, { bleed });
        const handle = scene.layer({ depth: def.depth, bounds });
        if (drive === 'layers')
          handle.bind(['x', 'y'], {
            inputs: [motion, px, py],
            map: (m, ux, uy, c) => {
              const p = panAt(def.name, c.time, m, ux, uy);
              return { x: -p.x / def.depth || 0, y: -p.y / def.depth || 0 };
            },
          });
        return Object.freeze({
          name: def.name,
          depth: def.depth,
          speed: 1 / def.depth,
          bounds: Object.freeze({ ...bounds }),
          handle,
          id: handle.id,
        });
      });
  }
  if (drive === 'camera') {
    const cam = scene.camera();
    cam.bind(['x', 'y'], {
      inputs: [motion, px, py],
      map: (m, ux, uy, c) => {
        const p = panAt(null, c.time, m, ux, uy);
        return { x: c.width / 2 + p.x, y: c.height / 2 + p.y };
      },
    });
  }
  const byName = new Map(layers.map((l) => [l.name, l]));
  const find = (name) => {
    const l = byName.get(name);
    assert(l, 'UNKNOWN_PARALLAX_LAYER', `No parallax layer named ${name}.`);
    return l;
  };
  const rig = {
    scene,
    drive,
    axis,
    travel: Object.freeze(travel),
    range,
    pointer,
    layers: Object.freeze(layers),
    /** The layer group: draw into it, or `add` existing top-level drawings. */
    layer: (name) => find(name).handle,
    bounds: (name) => find(name).bounds,
    /** Bounds check for one layer against this rig's travel. */
    coverage: (name) => coverage(find(name).bounds, find(name).depth, range),
    /** Depth-1 pan in px at a time, with the current motion scale and pointer. */
    pan(time, name = null, opts = {}) {
      options(opts, ['pointer'], 'pan');
      const on = opts.pointer ?? true;
      return Object.freeze(
        panAt(
          name === null ? null : find(name).name,
          number(time, 'time', 0, 86400),
          motion.sample(time),
          on ? px.sample(time) : 0,
          on ? py.sample(time) : 0,
        ),
      );
    },
    /** Raw travel progress 0–1 at a time (pins applied; no motion scale, rest or pointer). */
    progress: (time, name = null) => progress(name === null ? null : find(name).name, number(time, 'time', 0, 86400)),
    /** A layer's screen offset in px at a time (what drive: 'layers' applies). */
    offset(name, time) {
      const l = find(name),
        p = rig.pan(time, drive === 'layers' ? name : null);
      return Object.freeze({ x: -p.x / l.depth || 0, y: -p.y / l.depth || 0 });
    },
    /** Pointer position in [−1, 1]; scaled by `pointer` px at depth 1 and by the motion scale. */
    setPointer(x, y = 0) {
      state.x = clamp(number(x, 'pointer x', -1e6, 1e6), -1, 1);
      state.y = clamp(number(y, 'pointer y', -1e6, 1e6), -1, 1);
      px.set(state.x);
      py.set(state.y);
      return rig;
    },
    /** Collapse parallax to `reduced` × its motion (0 by default: a still composition at `rest` progress). */
    setReducedMotion(on) {
      assert(typeof on === 'boolean', 'INVALID_PARALLAX', 'setReducedMotion takes a boolean.');
      state.reduced = on;
      const m = on ? reduced : 1;
      if (m === 1) motion.reset();
      else motion.set(m);
      return rig;
    },
    get reducedMotion() {
      return state.reduced;
    },
    /** Run the parallax heuristics over this rig's window. */
    check: (s = {}) => auditParallax(scene, { rig, ...s }),
  };
  return Object.freeze(rig);
}

/** Browser wiring: follows prefers-reduced-motion and (when the rig has a pointer amplitude) the pointer over `element`. */
export function connectParallax(rig, spec = {}) {
  options(spec, ['element', 'window', 'pointer', 'smoothing'], 'connectParallax');
  assert(rig && typeof rig.setPointer === 'function', 'INVALID_PARALLAX', 'connectParallax needs a parallax rig.');
  const win = spec.window ?? spec.element?.ownerDocument?.defaultView ?? globalThis.window;
  assert(
    win && typeof win.requestAnimationFrame === 'function',
    'UNSUPPORTED_BROWSER',
    'connectParallax needs a browser window.',
  );
  const smoothing = number(spec.smoothing ?? 0.25, 'pointer smoothing', 0, 2),
    usePointer = spec.pointer ?? rig.pointer > 0,
    el = spec.element;
  assert(
    !usePointer || (el && typeof el.getBoundingClientRect === 'function'),
    'INVALID_PARALLAX',
    'Pointer parallax needs an element.',
  );
  const media = win.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null,
    cleanups = [];
  const sync = () => {
    rig.setReducedMotion(!!media?.matches);
    if (media?.matches) rig.setPointer(0, 0);
  };
  sync();
  media?.addEventListener?.('change', sync);
  cleanups.push(() => media?.removeEventListener?.('change', sync));
  if (usePointer) {
    let target = { x: 0, y: 0 },
      now = { x: 0, y: 0 },
      frame = null,
      last = null;
    const step = (stamp) => {
      frame = null;
      const dt = last === null ? 16 : clamp(stamp - last, 1, 100);
      last = stamp;
      const k = smoothing ? 1 - Math.exp(-dt / (smoothing * 1000)) : 1;
      now = { x: now.x + (target.x - now.x) * k, y: now.y + (target.y - now.y) * k };
      rig.setPointer(now.x, now.y);
      if (Math.abs(target.x - now.x) + Math.abs(target.y - now.y) > 0.002) frame = win.requestAnimationFrame(step);
      else last = null;
    };
    const go = () => {
      if (frame === null) frame = win.requestAnimationFrame(step);
    };
    const move = (e) => {
      if (media?.matches) return;
      const r = el.getBoundingClientRect();
      target = {
        x: clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1),
        y: clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1),
      };
      go();
    };
    const leave = () => {
      target = { x: 0, y: 0 };
      go();
    };
    el.addEventListener('pointermove', move, { passive: true });
    el.addEventListener('pointerleave', leave, { passive: true });
    cleanups.push(() => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
      if (frame !== null) win.cancelAnimationFrame(frame);
    });
  }
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    for (const c of cleanups) c();
  };
}

// ---- Heuristics ------------------------------------------------------------------------------------------
export const PARALLAX_RULES = Object.freeze({
  // Edge reveal: a backdrop band's artwork leaves a frame edge it covers elsewhere. Gaps above `tolerance`
  // frame px are reported (engineering: 1 px hides antialiasing); above `errorShare` of the frame, errors.
  edge: Object.freeze({ tolerance: 1, errorShare: 0.01 }),
  // Depth order: a nearer layer painted under a farther one, where they overlap by this share of the frame.
  order: Object.freeze({ overlap: 0.01 }),
  // Differential motion between large layers (each covering ≥ `field` of the frame), in frame widths per
  // real second. Engineering cap, not a measured threshold: about 11°/s for a 1280 px stage seen at 60 cm.
  // Large-field differential motion is what drives vection (Brandt, Dichgans & Koenig 1973); WCAG 2.3.3 asks
  // that interaction-driven motion can be turned off, and `reduced` is the cap with reduced motion on.
  differential: Object.freeze({ cap: 0.35, field: 0.2, reduced: 0.02 }),
  // Text on a moving layer, in CSS px per real second at the display width. Engineering cap (about 3°/s at
  // 60 cm), well under the velocities where dynamic visual acuity falls (Ludvigh & Miller 1958).
  text: Object.freeze({ cap: 120, settled: 0.6 }),
  // Depth separation: adjacent layers whose speeds differ by less than this share read as one plane. Speed
  // discrimination Weber fractions are about 5–10% in the lab (McKee 1981); 15% allows for a busy page.
  // More than `maxLayers` layers is cost without a new cue (engineering).
  separation: Object.freeze({ minRatio: 0.15, maxLayers: 8 }),
  // Continuity: a seam opening between ground bands that meet elsewhere (`seam` frame px), or a layer whose
  // speed changes by more than `lurch` frame widths per second within one sample (an un-eased handoff).
  continuity: Object.freeze({ seam: 1, lurch: 0.2 }),
});

const IDENTITY = [1, 0, 0, 1, 0, 0];
const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const local = (p) => {
  const c = Math.cos(p.rotation ?? 0),
    s = Math.sin(p.rotation ?? 0),
    sx = p.scaleX ?? 1,
    sy = p.scaleY ?? 1;
  return [c * sx, s * sx, -s * sy, c * sy, p.x ?? 0, p.y ?? 0];
};
const apply = (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const invert = (m) => {
  const d = m[0] * m[3] - m[1] * m[2];
  return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[3] * m[4]) / d, (m[1] * m[4] - m[0] * m[5]) / d];
};
const scaleOf = (m) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
const boxOf = (pts) => ({
  x0: Math.min(...pts.map((p) => p[0])),
  y0: Math.min(...pts.map((p) => p[1])),
  x1: Math.max(...pts.map((p) => p[0])),
  y1: Math.max(...pts.map((p) => p[1])),
});
const meet = (a, b) => ({
  x0: Math.max(a.x0, b.x0),
  y0: Math.max(a.y0, b.y0),
  x1: Math.min(a.x1, b.x1),
  y1: Math.min(a.y1, b.y1),
});
const area = (b) => (b ? Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0) : 0);
const clock = (t) => {
  const m = Math.floor(t / 60),
    s = t - m * 60,
    r = Math.round(s * 10) / 10;
  return `${m}:${String(Math.floor(r)).padStart(2, '0')}${r % 1 ? '.' + Math.round((r % 1) * 10) : ''}`;
};

/** Depth layers in a sampled frame, in paint order, with frame-space matrix, clip box and artwork box. */
function frameLayers(frame, marks) {
  const out = [],
    stage = { x0: 0, y0: 0, x1: frame.width, y1: frame.height };
  const visit = (node, parent, path) => {
    const m = mul(parent, local(node.props ?? {})),
      here = path ? `${path}/${node.id}` : node.id;
    if (node.layerCache) {
      out.push({ id: node.id, depth: node.layerCache.depth, matrix: m, path: here, clip: node.props?.clip });
      return;
    }
    for (const child of node.children ?? []) visit(child, m, here);
  };
  for (const node of frame.children) visit(node, IDENTITY, '');
  for (const l of out) {
    const c = l.clip;
    l.clipBox =
      c && c.type === 'rect'
        ? boxOf(
            [
              [c.x, c.y],
              [c.x + c.width, c.y],
              [c.x + c.width, c.y + c.height],
              [c.x, c.y + c.height],
            ].map((p) => apply(l.matrix, p)),
          )
        : null;
    l.marks = marks.filter((k) => k.path === l.path || k.path.startsWith(l.path + '/'));
    // Artwork: opaque fills clipped to the layer, merged where their boxes touch. The largest piece on stage
    // stands for the layer, so sparse props (tufts, lamps) never read as a backdrop with gaps.
    const pieces = [];
    for (const k of l.marks) {
      if (k.kind !== 'fill' || k.cloud || k.color[3] * k.opacity < 0.5) continue;
      const b = l.clipBox ? meet(k.box, l.clipBox) : k.box;
      if (area(b) > 0) pieces.push({ ...b });
    }
    for (let merged = true; merged;) {
      merged = false;
      for (let i = 0; i < pieces.length && !merged; i++)
        for (let j = i + 1; j < pieces.length; j++) {
          const a = pieces[i],
            o = pieces[j];
          if (a.x0 > o.x1 + 2 || o.x0 > a.x1 + 2 || a.y0 > o.y1 + 2 || o.y0 > a.y1 + 2) continue;
          pieces[i] = {
            x0: Math.min(a.x0, o.x0),
            y0: Math.min(a.y0, o.y0),
            x1: Math.max(a.x1, o.x1),
            y1: Math.max(a.y1, o.y1),
          };
          pieces.splice(j, 1);
          merged = true;
          break;
        }
    }
    l.art = pieces.reduce((best, p) => (!best || area(meet(p, stage)) > area(meet(best, stage)) ? p : best), null);
    l.onStage = area(l.art && meet(l.art, stage));
  }
  return out;
}

/**
 * Sample a scene over [from, to] at `fps` and check its depth layers. With `rig`, findings use layer names and
 * the window defaults to the rig's. `rate` is story seconds per real second (a number or function of time; see
 * storyRate). Returns {spans, summary}; each span has rule, severity, ids, message (with a fix), fix, value, start, end.
 */
export function auditParallax(scene, spec = {}) {
  options(spec, ['rig', 'from', 'to', 'fps', 'rate', 'rules', 'displayWidth', 'reducedMotion'], 'audit parallax');
  const rig = spec.rig ?? null,
    R = { ...PARALLAX_RULES, ...(spec.rules ?? {}) };
  const fps = number(spec.fps ?? 10, 'audit fps', 0.1, 120),
    from = number(spec.from ?? 0, 'audit from', 0, 86400),
    to = number(spec.to ?? scene.duration, 'audit to', from, 86400);
  const rate =
    typeof spec.rate === 'function'
      ? spec.rate
      : (
          (r) => () =>
            r
        )(number(spec.rate ?? 1, 'rate', 0, 1000));
  const displayWidth = number(spec.displayWidth ?? 1280, 'display width', 120, 8192);
  const nameOf = (id) => rig?.layers.find((l) => l.id === id)?.name ?? `layer ${id}`,
    quote = (id) => `‘${nameOf(id)}’`;
  let restore = null;
  if (spec.reducedMotion !== undefined) {
    assert(rig && typeof spec.reducedMotion === 'boolean', 'INVALID_PARALLAX', 'reducedMotion checks need a rig.');
    const before = rig.reducedMotion;
    rig.setReducedMotion(spec.reducedMotion);
    restore = () => rig.setReducedMotion(before);
  }
  const diffCap = spec.reducedMotion ? R.differential.reduced : R.differential.cap;
  const samples = [];
  try {
    const count = Math.max(1, Math.floor((to - from) * fps + 1e-9) + 1);
    for (let k = 0; k < count; k++) {
      const time = Math.min(to, from + k / fps),
        sampled = scene.sampleView({ time }),
        frame = sampled.frame;
      const cameraId = sampled.view ? (frame.children[0]?.id ?? null) : null,
        marks = frameMarks(frame, { cameraId });
      samples.push({ time, frame, marks, layers: frameLayers(frame, marks) });
    }
  } finally {
    restore?.();
  }
  const spans = [],
    open = new Map();
  const report = (k, f) => {
    const key = `${f.rule}|${f.ids.join(',')}|${f.kind ?? ''}`,
      time = samples[k].time,
      s = open.get(key);
    if (s && s.lastK === k - 1) {
      s.end = time;
      s.lastK = k;
      s.frames++;
      if (f.value > s.value) Object.assign(s, f, { at: time });
      return;
    }
    const span = { ...f, start: time, end: time, at: time, frames: 1, lastK: k };
    open.set(key, span);
    spans.push(span);
  };
  if (!samples.length) return { spans: [], summary: { from, to, fps, frames: 0, errors: 0, warnings: 0, byRule: {} } };
  const W = samples[0].frame.width,
    H = samples[0].frame.height,
    stageArea = W * H,
    tol = R.edge.tolerance;
  const ids = [...new Set(samples.flatMap((s) => s.layers.map((l) => l.id)))];
  const track = (id) => samples.map((s) => s.layers.find((l) => l.id === id) ?? null);
  const dtOf = (a, b) => samples[b].time - samples[a].time;

  // Velocity of the content under the frame centre, in frame px per story second.
  const velocity = (series, k) => {
    const a = Math.max(0, k - 1),
      b = Math.min(samples.length - 1, k + 1);
    if (a === b || !series[a] || !series[b] || !series[k]) return null;
    const p = apply(invert(series[k].matrix), [W / 2, H / 2]),
      pa = apply(series[a].matrix, p),
      pb = apply(series[b].matrix, p),
      dt = dtOf(a, b);
    return dt > 0 ? [(pb[0] - pa[0]) / dt, (pb[1] - pa[1]) / dt] : null;
  };
  const forward = (series, k) => {
    if (!series[k] || !series[k + 1]) return null;
    const p = apply(invert(series[k].matrix), [W / 2, H / 2]),
      q = apply(series[k + 1].matrix, p),
      dt = dtOf(k, k + 1);
    return dt > 0 ? [(q[0] - W / 2) / dt, (q[1] - H / 2) / dt] : null;
  };
  const per = new Map(ids.map((id) => [id, track(id)]));

  // Edge reveal and continuity per layer.
  const bands = [];
  for (const [id, series] of per) {
    const present = series.map((l, k) => [l, k]).filter(([l]) => l?.art);
    if (!present.length) continue;
    const [best] = present.reduce((a, b) => (b[0].onStage > a[0].onStage ? b : a));
    const art = best.art,
      touch = { left: art.x0 <= tol, right: art.x1 >= W - tol, top: art.y0 <= tol, bottom: art.y1 >= H - tol };
    const xBand = touch.left && touch.right,
      yBand = touch.top && touch.bottom;
    if (xBand) bands.push({ id, depth: best.depth, series });
    if (!xBand && !yBand) continue;
    const excursion = { x: 0, y: 0 };
    {
      const xs = present.map(([l]) => l.matrix[4]),
        ys = present.map(([l]) => l.matrix[5]);
      excursion.x = Math.max(...xs) - Math.min(...xs);
      excursion.y = Math.max(...ys) - Math.min(...ys);
    }
    for (const [l, k] of present)
      for (const edge of ['left', 'right', 'top', 'bottom']) {
        if (!touch[edge]) continue;
        const gap =
          edge === 'left' ? l.art.x0 : edge === 'right' ? W - l.art.x1 : edge === 'top' ? l.art.y0 : H - l.art.y1;
        if (gap <= tol) continue;
        const s = scaleOf(l.matrix),
          more = Math.ceil(gap / s) + 16,
          clipped =
            l.clipBox &&
            Math.abs(
              edge === 'left'
                ? l.clipBox.x0 - l.art.x0
                : edge === 'right'
                  ? l.clipBox.x1 - l.art.x1
                  : edge === 'top'
                    ? l.clipBox.y0 - l.art.y0
                    : l.clipBox.y1 - l.art.y1,
            ) < 1;
        const exc = edge === 'left' || edge === 'right' ? excursion.x : excursion.y,
          scale = exc > gap ? Math.floor((1 - gap / exc) * 100) / 100 : 0;
        const dim = edge === 'left' || edge === 'right' ? 'width' : 'height',
          size = l.clip ? Math.ceil(l.clip[dim] + gap / s) + 16 : null;
        const fix = `${clipped && size ? `widen its bounds ${dim} to ≥ ${size} px` : `extend its artwork ${more} px to the ${edge}`}${scale > 0 ? ` or scale its travel to ×${scale}` : ''}`;
        report(k, {
          rule: 'edgeReveal',
          kind: edge,
          severity: gap > W * R.edge.errorShare ? 'error' : 'warning',
          ids: [id],
          value: gap,
          fix,
          message: `${quote(id)} shows its ${edge} edge (a ${gap.toFixed(0)} px gap); ${fix}.`,
        });
      }
    // Lurch: an abrupt change of speed in one sample, from forward differences so a step is not halved.
    let prev = null;
    for (let k = 0; k + 1 < samples.length; k++) {
      const v = forward(series, k);
      if (!v) {
        prev = null;
        continue;
      }
      const r = rate(samples[k].time),
        vr = [v[0] * r, v[1] * r];
      if (prev) {
        const dv = Math.hypot(vr[0] - prev[0], vr[1] - prev[1]) / W;
        if (dv > R.continuity.lurch)
          report(k, {
            rule: 'continuity',
            kind: 'lurch',
            severity: 'warning',
            ids: [id],
            value: dv,
            fix: 'ease the handoff (a pin with ease ≥ 0.4 s) or remove the step in its binding',
            message: `${quote(id)} changes speed by ${dv.toFixed(2)} frame widths/s within one sample; ease the handoff (a pin with ease ≥ 0.4 s) or remove the step in its binding.`,
          });
      }
      prev = vr;
    }
  }
  // Seams: a farther ground band that meets a nearer one somewhere must keep meeting it.
  bands.sort((a, b) => b.depth - a.depth);
  for (let i = 0; i + 1 < bands.length; i++) {
    const F = bands[i],
      N = bands[i + 1];
    const meets = samples.some(
      (_, k) => F.series[k]?.art && N.series[k]?.art && F.series[k].art.y1 >= N.series[k].art.y0 - R.continuity.seam,
    );
    if (!meets) continue;
    samples.forEach((_, k) => {
      const f = F.series[k],
        n = N.series[k];
      if (!f?.art || !n?.art || f.art.y1 >= H - tol) return;
      const gap = n.art.y0 - f.art.y1;
      if (gap <= R.continuity.seam) return;
      const more = Math.ceil(gap / scaleOf(f.matrix)) + 16,
        fix = `extend ${quote(F.id)} ${more} px down, or give both bands the same vertical travel`;
      report(k, {
        rule: 'continuity',
        kind: 'seam',
        severity: 'error',
        ids: [F.id, N.id],
        value: gap,
        fix,
        message: `A ${gap.toFixed(0)} px seam opens between ${quote(F.id)} and ${quote(N.id)}; ${fix}.`,
      });
    });
  }
  // Depth order and differential motion, frame by frame.
  samples.forEach((s, k) => {
    const L = s.layers;
    for (let i = 0; i < L.length; i++)
      for (let j = i + 1; j < L.length; j++) {
        const a = L[i],
          b = L[j];
        if (!(a.depth < b.depth - 1e-9)) continue; // a is painted first but nearer
        const shared = area(a.art && b.art && meet(meet(a.art, b.art), { x0: 0, y0: 0, x1: W, y1: H }));
        if (shared > R.order.overlap * stageArea) {
          const fix = `paint ${quote(b.id)} before ${quote(a.id)} (create it first), or give ${quote(a.id)} a depth above ${b.depth.toFixed(2)}`;
          report(k, {
            rule: 'depthOrder',
            severity: 'error',
            ids: [a.id, b.id],
            value: shared / stageArea,
            fix,
            message: `${quote(a.id)} (depth ${a.depth.toFixed(2)}) is nearer than ${quote(b.id)} (depth ${b.depth.toFixed(2)}) but painted behind it; ${fix}.`,
          });
        }
      }
    const big = L.filter((l) => l.onStage >= R.differential.field * stageArea)
      .map((l) => ({ l, v: velocity(per.get(l.id), k) }))
      .filter((x) => x.v);
    let worst = null;
    for (let i = 0; i < big.length; i++)
      for (let j = i + 1; j < big.length; j++) {
        const d = (Math.hypot(big[i].v[0] - big[j].v[0], big[i].v[1] - big[j].v[1]) * rate(s.time)) / W;
        if (!worst || d > worst.d) worst = { d, a: big[i].l, b: big[j].l };
      }
    if (worst && worst.d > diffCap) {
      const [near, far] = worst.a.depth < worst.b.depth ? [worst.a, worst.b] : [worst.b, worst.a],
        f = diffCap / worst.d;
      const sNear = 1 / far.depth + f * (1 / near.depth - 1 / far.depth),
        depth = sNear > 0 ? 1 / sNear : null,
        factor = Math.floor(f * 100) / 100;
      const fix = spec.reducedMotion
        ? 'collapse parallax with reduced motion (rig reduced: 0) or lower the cap'
        : `${depth ? `raise ${quote(near.id)}'s depth to ≥ ${depth.toFixed(2)} or ` : ''}scale the travel to ×${factor}`;
      report(k, {
        rule: 'differentialMotion',
        severity: worst.d > diffCap * 2 ? 'error' : 'warning',
        ids: [near.id, far.id],
        value: worst.d,
        fix,
        message: `${quote(near.id)} and ${quote(far.id)} slide ${worst.d.toFixed(2)} frame widths/s apart (cap ${diffCap}); ${fix}.`,
      });
    }
  });
  // Text riding a moving layer.
  const px = displayWidth / W,
    texts = new Map();
  samples.forEach((s, k) => {
    for (const l of s.layers)
      for (const m of l.marks)
        if (m.kind === 'text' && m.opacity >= R.text.settled) {
          const list = texts.get(m.id) ?? [];
          list[k] = { c: [(m.box.x0 + m.box.x1) / 2, (m.box.y0 + m.box.y1) / 2], layer: l, text: m.text };
          texts.set(m.id, list);
        }
  });
  for (const [id, list] of texts)
    for (let k = 0; k < samples.length; k++) {
      const a = list[k - 1] ? k - 1 : k,
        b = list[k + 1] ? k + 1 : k;
      if (!list[k] || a === b) continue;
      const speed =
        (Math.hypot(list[b].c[0] - list[a].c[0], list[b].c[1] - list[a].c[1]) / dtOf(a, b)) *
        rate(samples[k].time) *
        px;
      if (speed <= R.text.cap) continue;
      const l = list[k].layer,
        depth = (l.depth * speed) / R.text.cap,
        words = list[k].text.length > 28 ? list[k].text.slice(0, 27) + '…' : list[k].text;
      const fix = `put it in a camera overlay or HTML, pin ${quote(l.id)} while it is read, or move it to a layer at depth ≥ ${depth.toFixed(1)}`;
      report(k, {
        rule: 'movingText',
        severity: speed > R.text.cap * 2 ? 'error' : 'warning',
        ids: [id, l.id],
        value: speed,
        fix,
        message: `“${words}” on ${quote(l.id)} moves ${speed.toFixed(0)} CSS px/s (cap ${R.text.cap}); ${fix}.`,
      });
    }
  // Depth separation: static, from the first frame's layers.
  const first = [...samples[0].layers].sort((a, b) => a.depth - b.depth);
  for (let i = 0; i + 1 < first.length; i++) {
    const n = first[i],
      f = first[i + 1],
      sn = 1 / n.depth,
      sf = 1 / f.depth,
      ratio = (sn - sf) / sn;
    if (ratio >= R.separation.minRatio) continue;
    const fix = `merge them, or set ${quote(f.id)} to depth ≥ ${(n.depth / (1 - R.separation.minRatio)).toFixed(2)}`;
    report(0, {
      rule: 'depthSeparation',
      severity: 'warning',
      ids: [n.id, f.id],
      value: ratio,
      fix,
      message: `${quote(n.id)} (depth ${n.depth.toFixed(2)}) and ${quote(f.id)} (depth ${f.depth.toFixed(2)}) move within ${(ratio * 100).toFixed(0)}% of each other's speed, so they read as one plane; ${fix}.`,
    });
  }
  if (first.length > R.separation.maxLayers)
    report(0, {
      rule: 'depthSeparation',
      kind: 'count',
      severity: 'warning',
      ids: [],
      value: first.length,
      fix: 'merge layers with similar depths',
      message: `${first.length} depth layers (guide ≤ ${R.separation.maxLayers}); merge layers with similar depths.`,
    });
  for (const s of spans) {
    delete s.lastK;
    if (s.start !== s.end || s.frames > 1) s.message = s.message.replace(/^/, `${clock(s.start)}–${clock(s.end)} `);
    else s.message = `${clock(s.start)} ${s.message}`;
  }
  spans.sort((a, b) => a.start - b.start || a.rule.localeCompare(b.rule));
  const byRule = {};
  for (const s of spans) {
    byRule[s.rule] ??= { error: 0, warning: 0 };
    byRule[s.rule][s.severity]++;
  }
  return {
    spans,
    summary: {
      from,
      to,
      fps,
      frames: samples.length,
      errors: spans.filter((s) => s.severity === 'error').length,
      warnings: spans.filter((s) => s.severity === 'warning').length,
      byRule,
    },
  };
}

/** One line per finding, for a console while authoring. */
export function formatParallax(result) {
  assert(result && Array.isArray(result.spans), 'INVALID_PARALLAX', 'Format an auditParallax result.');
  if (!result.spans.length)
    return `parallax: clean (${result.summary.frames} frames, ${result.summary.from}–${result.summary.to} s)`;
  return [
    `parallax: ${result.summary.errors} errors, ${result.summary.warnings} warnings`,
    ...result.spans.map((s) => `  ${s.severity === 'error' ? 'error  ' : 'warning'} ${s.rule.padEnd(18)} ${s.message}`),
  ].join('\n');
}
