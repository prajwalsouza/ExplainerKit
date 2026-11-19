// A silk brush for pages that paint their own canvas. Callers describe marks (hair arcs, strand bundles, glows) in
// the context's current user space; the brush samples them into glowing points with the same fibre lighting as
// mountDataChart, then composites them onto the context in one GPU pass. It owns no clock and no page: the caller
// passes the time and the light, and decides when to draw.
import { toRGBA } from '../color/index.js';
import { assert, number, options } from '../core/validate.js';
import { createPointRasterizer } from '../renderers/gpu-points.js';
import { buffer, chartLook, heatColor, shadeFibre } from './chart-light.js';
import { chartTheme } from './chart-themes.js';

const TAU = 2 * Math.PI;
const MAX_POINTS = 200000;
const MAX_COLORS = 512;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
function hash(i, salt = 0) {
  const x = Math.sin(i * 127.1 + salt * 311.7 + 0.5) * 43758.5453123;
  return x - Math.floor(x);
}

/**
 * Create a silk brush for one theme. Light themes (Pearl, Paper) lay the fibres down as ink; dark themes add light.
 * @param {{theme?: Parameters<typeof chartTheme>[0], budget?: number}} [spec]
 */
export function silkBrush(spec = {}) {
  options(spec, ['theme', 'budget'], 'silk brush');
  let theme = chartTheme(spec.theme ?? 'silk');
  let look = chartLook(theme);
  const budget = Math.round(number(spec.budget ?? 160000, 'silk brush budget', 1000, MAX_POINTS));
  const xy = buffer(2),
    rgba = buffer(4),
    glowXY = buffer(2),
    glowRGBA = buffer(4);
  const colors = new Map();
  const tint = [0, 0, 0],
    mixed = [0, 0, 0];
  let rasterizer = null,
    view = null,
    spacing = 0.6,
    zoom = 1,
    marks = [];

  /** A CSS colour as linear-ish RGB in [0, 1], cached because pages repeat a few dozen colours. */
  function rgbOf(color) {
    if (Array.isArray(color)) return color;
    let rgb = colors.get(color);
    if (!rgb) {
      if (colors.size >= MAX_COLORS) colors.clear();
      rgb = toRGBA(color).slice(0, 3);
      colors.set(color, rgb);
    }
    return rgb;
  }

  /** The fibre colour: the mark's own colour drawn toward the theme's silk, then warmed by heat. */
  function fibreColor(color, heat, out) {
    const own = rgbOf(color);
    heatColor(look, heat, tint);
    const keep = look.additive ? 0.5 : 0.75;
    for (let c = 0; c < 3; c++) {
      const base = own[c] * keep + look.mark[c] * (1 - keep);
      out[c] = heat > 0 ? base + (tint[c] - base) * clamp01(heat * 1.25) : base;
    }
    return out;
  }

  function emit(x, y, color, a, lit) {
    let r = color[0],
      g = color[1],
      b = color[2];
    if (!look.additive && lit > 1) {
      // Ink catches the light by paling toward the paper, not by glowing.
      const pale = Math.min(0.7, (lit - 1) * 0.5);
      r += (1 - r) * pale;
      g += (1 - g) * pale;
      b += (1 - b) * pale;
    }
    xy.push(x, y);
    rgba.push(r > 1 ? 1 : r, g > 1 ? 1 : g, b > 1 ? 1 : b, a > 1 ? 1 : a < 0 ? 0 : a);
  }

  function lightAt(x, y, tx, ty) {
    return shadeFibre(view, x, y, tx, ty);
  }

  const api = {
    get theme() {
      return theme;
    },
    /** True when the theme adds light on a dark ground; false when it lays ink on a light one. */
    get additive() {
      return look.additive;
    },
    /** Change the theme between frames. */
    setTheme(name) {
      theme = chartTheme(name);
      look = chartLook(theme);
      colors.clear();
    },
    /**
     * Start a frame. `light` is a point in the same user space as the marks, or null for a slow orbiting light
     * about `centre`. `size` is the drawing's rough extent in user units, used for the light's reach. `scale` is how
     * many device-independent pixels one user unit covers (1 by default), so a zoomed view is sampled finely enough.
     * @param {{time?: number, light?: [number, number] | null, centre?: [number, number], size?: number,
     *          scale?: number}} frame
     */
    begin(frame = {}) {
      options(frame, ['time', 'light', 'centre', 'size', 'scale'], 'silk frame');
      // Zoomed in, a unit of drawing covers more pixels, so fibres are sampled more finely.
      zoom = number(frame.scale ?? 1, 'silk scale', 0.05, 64);
      const time = number(frame.time ?? 0, 'silk time', -1e7, 1e7);
      const size = number(frame.size ?? 600, 'silk size', 1, 1e6);
      const centre = frame.centre ?? [size / 2, size / 2];
      const pointer = frame.light ?? null;
      for (const p of pointer ? [pointer, centre] : [centre])
        assert(
          Array.isArray(p) && p.length === 2 && p.every(Number.isFinite),
          'INVALID_OPTIONS',
          'Light points are [x, y].',
        );
      const orbit = [centre[0] + size * 0.95 * Math.cos(time * 0.19), centre[1] + size * 0.75 * Math.sin(time * 0.13)];
      view = {
        look,
        time,
        light: pointer ?? orbit,
        lightHeight: pointer ? size * 0.1 : size * 0.45,
        lightReach: pointer ? size * 0.3 : size * 2.6,
        lightGain: pointer ? 2.8 : 1.45,
      };
      marks = [];
      return api;
    },
    /**
     * Radial hairs filling the polar band between angles a0..a1 and radii r0..r1 about (cx, cy). Hair lengths
     * vary by `ragged` (0–1) and sway slowly; `heat` (0–1) warms them; `alpha` scales their light.
     */
    hairs(m) {
      options(m, ['cx', 'cy', 'a0', 'a1', 'r0', 'r1', 'color', 'alpha', 'heat', 'ragged', 'seed', 'density'], 'hairs');
      marks.push({ kind: 'hairs', ...m });
      return api;
    },
    /**
     * A bundle of strands along the cubic from `from` through `c1`, `c2` to `to`. All `count` strands (1–48) meet at
     * the two end points and fan out by `spread` user units in the middle. To attach a ribbon along a rim, give
     * `fromArc` and `toArc` as {cx, cy, r, a0, a1}: strand ends are then spaced along those arcs, exactly on the rim.
     * `trim` (0–1) ends the strands part of the way along; `trimStart` (0–1) starts them part of the way along, so
     * a short window can travel the curve like a comet. With `taper`, light fades toward the start of the window.
     */
    strands(m) {
      options(
        m,
        [
          'from',
          'c1',
          'c2',
          'to',
          'count',
          'spread',
          'color',
          'alpha',
          'heat',
          'seed',
          'trim',
          'trimStart',
          'taper',
          'fromArc',
          'toArc',
        ],
        'strands',
      );
      marks.push({ kind: 'strands', ...m });
      return api;
    },
    /** A soft glowing dot. */
    glow(m) {
      options(m, ['x', 'y', 'r', 'color', 'alpha', 'heat'], 'glow');
      marks.push({ kind: 'glow', ...m });
      return api;
    },
    /** Sample the frame's marks into point clouds: `{fibres, glow}`, each `{positions, colors}`. */
    sample() {
      assert(view, 'INVALID_STATE', 'Call begin() before sampling a silk frame.');
      for (const b of [xy, rgba, glowXY, glowRGBA]) b.reset();
      // Estimate the total fibre length, then space samples so the frame fits the point budget.
      let total = 0;
      for (const m of marks) {
        if (m.kind === 'hairs') {
          const span = Math.abs(m.a1 - m.a0) * Math.max(Math.abs(m.r0), Math.abs(m.r1));
          m.count = Math.max(2, Math.min(400, Math.round(span / 1.6) * (m.density ?? 1)));
          total += m.count * Math.abs(m.r1 - m.r0);
        } else if (m.kind === 'strands') {
          const d = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1]);
          m.length = (d(m.from, m.c1) + d(m.c1, m.c2) + d(m.c2, m.to) + d(m.from, m.to)) / 2;
          total += m.length * (m.count ?? 6) * Math.max(0, (m.trim ?? 1) - (m.trimStart ?? 0));
        }
      }
      // Lines must stay continuous: past a fine sample spacing, a crowded frame draws fewer fibres, never sparser ones.
      spacing = Math.min(0.85 / zoom, Math.max(0.6 / zoom, total / budget));
      const thin = Math.min(1, budget / Math.max(1, total / spacing));
      const t = view.time;
      for (const m of marks) {
        const alpha = number(m.alpha ?? 1, 'silk alpha', 0, 4);
        if (alpha <= 0.002) continue;
        const heat = clamp01(m.heat ?? 0);
        fibreColor(m.color ?? theme.mark, heat, mixed);
        if (m.kind === 'glow') {
          glowXY.push(m.x, m.y);
          glowRGBA.push(mixed[0], mixed[1], mixed[2], clamp01(alpha * 0.6));
          continue;
        }
        if (m.kind === 'hairs') {
          const seed = m.seed ?? 0,
            ragged = m.ragged ?? 0.5,
            n = Math.max(2, Math.round(m.count * thin)),
            depth = m.r1 - m.r0;
          // Narrow bands hold proportionally fewer hairs, so a thin slice never burns white.
          const base = (look.additive ? 0.26 : 0.45) * alpha * spacing * zoom * 1.7;
          for (let h = 0; h < n; h++) {
            const f = (h + 0.5 + (hash(seed * 997 + h, 5) - 0.5) * 0.9) / n;
            const a = m.a0 + (m.a1 - m.a0) * f;
            const sway = 0.012 * Math.sin(t * (0.6 + 0.5 * hash(seed + h, 8)) + hash(seed + h, 9) * TAU);
            const reach = 1 - ragged * hash(seed * 31 + h, 6);
            const length = depth * reach * (1 + 0.05 * Math.sin(t * (0.8 + hash(h, 7)) + h * 0.6));
            const count = Math.max(3, Math.ceil(Math.abs(length) / spacing));
            const fibre = 0.55 + 0.45 * hash(seed * 13 + h, 10);
            const tx = Math.cos(a),
              ty = Math.sin(a),
              phase = hash(seed + h, 25);
            for (let k = 0; k < count; k++) {
              const u = Math.min(1, (k + phase) / count);
              const r = m.r0 + length * u,
                ang = a + sway * u * u;
              const x = m.cx + Math.cos(ang) * r,
                y = m.cy + Math.sin(ang) * r;
              const lit = lightAt(x, y, tx, ty);
              const strength = base * fibre * (0.3 + 0.7 * u) * lit;
              emit(x, y, mixed, strength, lit);
              if (look.additive && (k + h) % 6 === 0) {
                glowXY.push(x, y);
                glowRGBA.push(mixed[0], mixed[1], mixed[2], clamp01(strength * 0.3));
              }
            }
          }
          continue;
        }
        // Strands: each fibre is offset across the bundle at its ends and fans further in the middle.
        const count = Math.max(1, Math.min(48, Math.round((m.count ?? 6) * thin))),
          trim = clamp01(m.trim ?? 1),
          trimStart = Math.min(trim, clamp01(m.trimStart ?? 0)),
          spread = m.spread ?? 4,
          seed = m.seed ?? 0;
        const steps = Math.max(4, Math.ceil((m.length * (trim - trimStart)) / spacing));
        const [x0, y0] = m.from,
          [x1, y1] = m.c1,
          [x2, y2] = m.c2,
          [x3, y3] = m.to;
        let nx = -(y3 - y0),
          ny = x3 - x0;
        const nl = Math.hypot(nx, ny) || 1;
        nx /= nl;
        ny /= nl;
        const base = ((look.additive ? 0.2 : 0.28) * alpha * spacing * zoom * 2.3) / Math.sqrt(count);
        const along = (arc, f) => {
          if (!arc) return null;
          const angle = arc.a0 + (arc.a1 - arc.a0) * f;
          return [arc.cx + Math.cos(angle) * arc.r, arc.cy + Math.sin(angle) * arc.r];
        };
        for (let s = 0; s < count; s++) {
          const o = count === 1 ? 0 : s / (count - 1) - 0.5;
          // Each strand's own ends: on the spans when given, else the shared end points. Control points move with
          // their end, so the strand leaves the rim in the same direction as the bundle.
          const f = o + 0.5,
            a = along(m.fromArc, f) ?? m.from,
            b = along(m.toArc, 1 - f) ?? m.to;
          const dax = a[0] - x0,
            day = a[1] - y0,
            dbx = b[0] - x3,
            dby = b[1] - y3;
          const jitter = hash(seed * 53 + s, 1) - 0.5;
          // Strands sway with the bundle's spread; a single tight strand (spread 0) runs true.
          const wave =
            (1 + 3 * hash(seed * 17 + s, 2)) *
            Math.min(1, spread / 4) *
            Math.sin(t * (0.35 + 0.3 * hash(s, 3)) + s * 1.3);
          const fibre = 0.5 + 0.5 * hash(seed * 7 + s, 4);
          let px = 0,
            py = 0;
          for (let i = 0; i <= steps; i++) {
            const u = trimStart + ((trim - trimStart) * i) / steps,
              v = 1 - u;
            const b0 = v * v * v,
              b1 = 3 * v * v * u,
              b2 = 3 * v * u * u,
              b3 = u * u * u;
            const bell = Math.sin(Math.PI * u);
            const off = (o * spread + jitter * spread * 0.4 + wave) * bell * (m.fromArc ? 0.35 : 1);
            const x = b0 * (x0 + dax) + b1 * (x1 + dax) + b2 * (x2 + dbx) + b3 * (x3 + dbx) + nx * off,
              y = b0 * (y0 + day) + b1 * (y1 + day) + b2 * (y2 + dby) + b3 * (y3 + dby) + ny * off;
            if (i > 0) {
              let tx = x - px,
                ty = y - py;
              const tl = Math.sqrt(tx * tx + ty * ty) || 1;
              tx /= tl;
              ty /= tl;
              const lit = lightAt(x, y, tx, ty);
              const sparkle = 0.82 + 0.18 * Math.sin(u * 29 + s * 1.7 + t * 1.6);
              const tail = m.taper ? (i / steps) ** 2 : 1;
              const strength = base * fibre * lit * sparkle * tail;
              emit(x, y, mixed, strength, lit);
              if (look.additive && i % 8 === 0) {
                glowXY.push(x, y);
                glowRGBA.push(mixed[0], mixed[1], mixed[2], clamp01(strength * 0.3));
              }
            }
            px = x;
            py = y;
          }
        }
      }
      return {
        fibres: { positions: xy.view(), colors: rgba.view() },
        glow: { positions: glowXY.view(), colors: glowRGBA.view() },
      };
    },
    /**
     * Sample the frame and composite it onto a 2D context in its current transform. Returns false, drawing
     * nothing, when the platform has no WebGL2 point rasterizer, so the caller can paint its own fallback.
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {
      if (!api.ready(ctx)) return false;
      const { fibres, glow } = api.sample();
      const blend = look.additive ? 'add' : 'normal';
      const m = ctx.getTransform(),
        scale = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
      if (glow.positions.length)
        rasterizer.draw(ctx, cloudOf(glow), { radius: 4.6, shape: 'glow', color: [1, 1, 1, 1], blend });
      if (fibres.positions.length)
        rasterizer.draw(ctx, cloudOf(fibres), {
          // Ink fibres stay about one device pixel wide at any zoom, soft-edged so they read as thread, not wire.
          radius: look.additive ? 1.05 : 1.15 / scale,
          shape: 'glow',
          color: [1, 1, 1, 1],
          blend,
        });
      return true;
    },
    /** True when this context can take GPU points. */
    ready(ctx) {
      if (!rasterizer) {
        const doc = ctx?.canvas?.ownerDocument;
        if (!doc) return false;
        rasterizer = createPointRasterizer(doc);
      }
      const m = ctx.getTransform(),
        scale = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
      return rasterizer.accepts({ count: 0, radii: null }, 4.6, scale);
    },
    /** Release the GPU context. */
    dispose() {
      rasterizer?.dispose();
      rasterizer = null;
    },
  };
  return api;
}

const cloudOf = ({ positions, colors }) => ({ count: positions.length / 2, positions, colors, radii: null });
