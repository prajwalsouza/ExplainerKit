import { rgbaOf } from '../graphics/cloud.js';
import { assert, number, options } from '../core/validate.js';
import { Scene } from '../core/scene.js';
import { character, compileCharacter } from './runtime.js';

/**
 * Rig audit: play every action of a character and measure whether the rig holds together. Heuristics, each
 * with a tolerance relative to the character's height:
 *
 *  connected   every visible, non-detachable part touches the rest of the body (one connected piece)
 *  joints      declared joints (a limb's start or end) sit inside or on their target parts
 *  limbs       drawn limb length stays within a stretch range of its declared length
 *  ground      grounded characters never sink below the ground and keep a contact on it when not airborne
 *  sliding     a contact part resting on the ground does not slide
 *  pops        no part jumps further in one frame than a fast natural motion would
 *  flips       a bent joint does not suddenly reverse its bend direction
 *  depth       declared attachments sink into their parent by a margin, so seams hide (not merely touch)
 *  slivers     filled outlines have no needle-sharp spikes (parts may declare sharp: true)
 *  folds       filled outlines never cross themselves (a smoothing curve that overshot)
 *  rewind      sampling backward gives exactly the same frames as forward
 *
 * Definitions opt in with metadata: joints, contacts, detachable parts, limb lengths. See
 * docs/modules/character-construction.md.
 */
/** @param {any} definition @param {{actions?:string[],fps?:number,tolerance?:number,duration?:number,background?:string}} [spec] */
export function auditCharacter(definition, spec = {}) {
  options(spec, ['actions', 'fps', 'tolerance', 'duration', 'background'], 'character audit');
  const def = definition.order ? definition : compileCharacter(definition);
  const fps = number(spec.fps ?? 30, 'audit fps', 1, 120),
    height = number(def.height ?? 100, 'character audit height', 0.001, 1e6),
    tol = number(spec.tolerance ?? 0.015, 'audit tolerance', 0, 1) * height;
  if (spec.duration !== undefined) number(spec.duration, 'audit duration', 0, 60);
  const names = spec.actions ?? Object.keys(def.actions).filter((a) => !a.startsWith('__'));
  assert(
    Array.isArray(names) && names.length <= 64 && names.every((name) => typeof def.actions[name] === 'function'),
    'UNKNOWN_ACTION',
    'Audit at most 64 existing named actions.',
  );
  const meta = Object.fromEntries(
    def.parts.map((p) => [p.id, { ...p, auditAlpha: rgbaOf(def.palette[p.slot]?.base ?? '#000000')[3] }]),
  );
  const detachable = new Set(
    def.parts.filter((p) => p.detachable || p.id === 'shadow' || p.slot === 'shadow').map((p) => p.id),
  );
  const contacts = def.contacts ?? [],
    grounded = contacts.length > 0;
  const checks = Object.fromEntries(
    ['connected', 'joints', 'depth', 'slivers', 'folds', 'limbs', 'ground', 'sliding', 'pops', 'flips', 'rewind'].map(
      (k) => [k, { status: 'pass', worst: 0, unit: '', examples: [] }],
    ),
  );
  const fail = (key, value, limit, example, unit) => {
    const c = checks[key];
    c.unit = unit;
    if (value > c.worst) c.worst = value;
    if (value > limit && c.examples.length < 6) c.examples.push(example);
    if (value > limit) c.status = value > limit * 2 ? 'fail' : c.status === 'fail' ? 'fail' : 'warn';
  };

  const runs = [
    ...names.map((name) => ({
      name,
      setup: (c) => c.act(name, { at: 0.2, ...(def.actionDefaults?.[name]?.duration ? {} : { duration: 1.6 }) }),
    })),
    {
      name: 'idle + face',
      setup: (c) =>
        c
          .say('Hello, how are you?', { at: 0.3 })
          .emote('surprised', { at: 1, duration: 1 })
          .look({ at: 1.5, x: 0.9, y: -0.5, until: 2.5 }),
    },
  ];
  for (const run of runs) {
    const drawing = new Scene({ width: 1000, height: 600 }),
      c = character(drawing, def, { x: 300, y: 450, seed: 5 });
    run.setup(c);
    const end = Math.max(drawing.duration + 0.4, spec.duration ?? 2.6),
      times = [];
    for (let t = 0; t <= end + 1e-9; t += 1 / fps) times.push(+t.toFixed(6));
    let previous = null;
    for (const t of times) {
      const v = c.inspect(t),
        geo = geometry(v, meta),
        where = { action: run.name, time: +t.toFixed(3) };
      const active = Object.keys(geo).filter(
        (id) => !detachable.has(id) && geo[id].opacity > 0.02 && geo[id].points.length,
      );
      // connected: union-find over touching pairs.
      const parent = Object.fromEntries(active.map((id) => [id, id])),
        find = (id) => (parent[id] === id ? id : (parent[id] = find(parent[id])));
      for (let i = 0; i < active.length; i++)
        for (let j = i + 1; j < active.length; j++)
          if (
            touching(geo[active[i]], geo[active[j]], tol) ||
            enclosed(active[i], active[j], geo, meta) ||
            enclosed(active[j], active[i], geo, meta)
          )
            parent[find(active[i])] = find(active[j]);
      const groups = {};
      for (const id of active) (groups[find(id)] ??= []).push(id);
      const pieces = Object.values(groups).sort((a, b) => b.length - a.length);
      fail('connected', pieces.length - 1, 0, { ...where, detached: pieces.slice(1).flat() }, 'extra pieces');
      // joints
      for (const j of def.joints ?? []) {
        const g = geo[j.part];
        if (!g || g.opacity <= 0.02 || !g.points.length) continue;
        // A joint is either a limb end that must sit on its target, or (no end) two parts that must overlap.
        const gap = j.end
          ? Math.min(
              ...j.to
                .filter((id) => geo[id]?.points.length)
                .map((id) => distanceToPart(j.end === 'end' ? g.lines.at(-1).at(-1) : g.lines[0][0], geo[id])),
            )
          : Math.min(
              ...j.to
                .filter((id) => geo[id]?.points.length)
                .map((id) => (touching(g, geo[id], 0) ? 0 : linesDistance(g.lines, geo[id].lines))),
            );
        fail(
          'joints',
          gap,
          tol,
          { ...where, joint: `${j.part}.${j.end} → ${j.to.join('|')}`, gap: +gap.toFixed(2) },
          'units',
        );
        // Depth: an attachment must sink into its parent by at least `depth`, so the seam hides under it.
        if (j.depth) {
          const sink = Math.max(
            0,
            ...j.to.filter((id) => geo[id]?.points.length && geo[id].filled).map((id) => penetration(g, geo[id])),
          );
          fail(
            'depth',
            Math.max(0, j.depth - sink),
            tol * 0.2,
            { ...where, joint: `${j.part} → ${j.to.join('|')}`, sunk: +sink.toFixed(2), wanted: j.depth },
            'units short',
          );
        }
      }
      // Slivers and folds in filled outlines (sampled every third frame; parts may declare sharp: true).
      if (times.indexOf(t) % 3 === 0)
        for (const id of active) {
          const g = geo[id];
          if (!g.filled || meta[id].sharp) continue;
          const spike = sharpest(g.lines);
          fail(
            'slivers',
            spike < 22 ? 22 - spike : 0,
            0,
            { ...where, part: id, angle: +spike.toFixed(1) },
            'degrees below 22',
          );
          fail('folds', selfCrossings(g.lines), 0, { ...where, part: id }, 'crossings');
        }
      // limbs
      for (const p of def.parts)
        if (p.length && geo[p.id]) {
          const L = polylineLength(geo[p.id].lines),
            ratio = L / p.length;
          const authored =
            p.stretchChannel === undefined ? 0 : number(v.pose[p.stretchChannel], 'authored limb stretch', 1, 4) - 1;
          const limit =
            p.stretchChannel === undefined ? (p.stretch ?? 0.12) : Math.max(p.stretch ?? 0.12, authored + 1e-5);
          fail('limbs', Math.max(ratio - 1, 0), limit, { ...where, limb: p.id, ratio: +ratio.toFixed(3) }, 'stretch');
        }
      // ground and sliding (character space: ground at y = −root.y)
      const groundY = -(v.pose['root.y'] ?? 0),
        airborne = (v.pose['root.y'] ?? 0) < -tol;
      if (grounded) {
        const lowest = Math.max(...active.map((id) => geo[id].bottom));
        fail(
          'ground',
          lowest - groundY,
          tol,
          { ...where, sinkBy: +(lowest - groundY).toFixed(2) },
          'units below ground',
        );
        if (!airborne) {
          const gap = Math.min(...contacts.filter((id) => geo[id]).map((id) => groundY - geo[id].bottom));
          fail('ground', gap, tol, { ...where, floatBy: +gap.toFixed(2) }, 'units');
        }
      }
      if (previous) {
        const dt = t - previous.t;
        for (const id of contacts) {
          const a = previous.geo[id],
            b = geo[id];
          if (!a || !b) continue;
          const onA = Math.abs(a.bottom - previous.groundY) < tol * 0.3,
            onB = Math.abs(b.bottom - groundY) < tol * 0.3;
          if (onA && onB) {
            const slide = Math.abs(b.worldBottomX(v.root) - a.worldBottomX(previous.root)) / (v.root.scaleY || 1);
            fail(
              'sliding',
              slide / dt,
              0.02 * height,
              { ...where, part: id, speed: +(slide / dt).toFixed(2) },
              'units/s',
            );
          }
        }
        for (const id of active) {
          const a = previous.geo[id],
            b = geo[id];
          if (!a || !b || previous.root.scaleX !== v.root.scaleX) continue;
          const jump = Math.hypot(b.center[0] - a.center[0], b.center[1] - a.center[1]) / dt;
          fail('pops', jump, 12 * height, { ...where, part: id, speed: +jump.toFixed(1) }, 'units/s');
        }
        for (const p of def.parts)
          if (p.length && geo[p.id] && previous.geo[p.id]) {
            const s0 = bendOf(previous.geo[p.id].lines),
              s1 = bendOf(geo[p.id].lines);
            if (Math.abs(s0) > 0.15 && Math.abs(s1) > 0.15 && Math.sign(s0) !== Math.sign(s1))
              fail('flips', 1, 0, { ...where, limb: p.id }, 'flips');
          }
      }
      previous = { t, geo, groundY, root: v.root };
    }
    // rewind: identical frames backward
    const sample = times.filter((_, i) => i % 7 === 0),
      forward = sample.map((t) => JSON.stringify(drawing.sample({ time: t })));
    const backward = sample
      .toReversed()
      .map((t) => JSON.stringify(drawing.sample({ time: t })))
      .toReversed();
    const mismatched = forward.filter((f, i) => f !== backward[i]).length;
    fail('rewind', mismatched, 0, { action: run.name, frames: mismatched }, 'frames');
  }
  const ok = Object.values(checks).every((c) => c.status !== 'fail');
  const { contrast, warnings } = headContrast(def, spec.background);
  return Object.freeze({ name: def.name, ok, height, tolerance: tol, checks, contrast, warnings });
}

/** A readable table of an audit, one line per check. */
export function formatAudit(report) {
  const lines = [`${report.name}: ${report.ok ? 'PASS' : 'FAIL'} (tolerance ${report.tolerance.toFixed(2)} units)`];
  for (const [k, c] of Object.entries(report.checks))
    lines.push(
      `  ${c.status.padEnd(4)} ${k.padEnd(10)} worst ${+c.worst.toFixed(3)} ${c.unit}${c.examples.length ? `  e.g. ${JSON.stringify(c.examples[0])}` : ''}`,
    );
  for (const warning of report.warnings ?? []) lines.push(`  warn ${warning.code}: ${warning.message}`);
  return lines.join('\n');
}

// An explicitly declared outline may contain face details without painting a solid interior.
function enclosed(container, detail, geo, meta) {
  return (
    meta[container].encloses === true &&
    meta[container].bone === meta[detail].bone &&
    geo[detail].points.every((point) => inside(point, geo[container].lines))
  );
}
function headContrast(def, background) {
  const warnings = [];
  if (!def.parts.some((part) => part.id === 'headLine'))
    return { contrast: Object.freeze({ status: 'notApplicable' }), warnings: Object.freeze(warnings) };
  if (background === undefined)
    return {
      contrast: Object.freeze({
        status: 'unverified',
        reason: 'Supply an opaque solid background to assess head-fill contrast.',
      }),
      warnings: Object.freeze(warnings),
    };
  const bg = rgbaOf(background);
  if (bg[3] !== 1)
    return {
      contrast: Object.freeze({ status: 'unverified', reason: 'Background is translucent.' }),
      warnings: Object.freeze(warnings),
    };
  const composite = (value) => {
    const rgba = rgbaOf(value);
    return rgba.slice(0, 3).map((v, i) => v * rgba[3] + bg[i] * (1 - rgba[3]));
  };
  const luminance = (rgb) =>
    rgb
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const fill = luminance(composite(def.palette.headFill.base)),
    ink = luminance(composite(def.palette.ink.base)),
    stage = luminance(bg.slice(0, 3));
  const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
    inkRatio = ratio(fill, ink),
    backgroundRatio = ratio(fill, stage);
  // Artistic warning threshold, not a text-accessibility compliance assertion.
  if (rgbaOf(def.palette.headFill.base)[3] > 0 && inkRatio >= 3 && backgroundRatio >= 3)
    warnings.push(
      Object.freeze({
        code: 'HEAD_FILL_CONTRAST',
        message: 'Outlined head fill forms a contrasting disc against both ink and background.',
        inkRatio,
        backgroundRatio,
      }),
    );
  return {
    contrast: Object.freeze({ status: 'verified', inkRatio, backgroundRatio }),
    warnings: Object.freeze(warnings),
  };
}

// ---- geometry in character space -------------------------------------------------------------

function flatten(commands) {
  const lines = [];
  let line = null,
    start = null;
  for (const [c, ...v] of commands) {
    if (c === 'M') {
      line = [[v[0], v[1]]];
      start = line[0];
      lines.push(line);
      continue;
    }
    if (!line) {
      line = [[0, 0]];
      lines.push(line);
    }
    const p0 = line.at(-1);
    if (c === 'L') line.push([v[0], v[1]]);
    else if (c === 'Q')
      for (let i = 1; i <= 8; i++) {
        const t = i / 8,
          u = 1 - t;
        line.push([u * u * p0[0] + 2 * u * t * v[0] + t * t * v[2], u * u * p0[1] + 2 * u * t * v[1] + t * t * v[3]]);
      }
    else if (c === 'C')
      for (let i = 1; i <= 10; i++) {
        const t = i / 10,
          u = 1 - t;
        line.push([
          u ** 3 * p0[0] + 3 * u * u * t * v[0] + 3 * u * t * t * v[2] + t ** 3 * v[4],
          u ** 3 * p0[1] + 3 * u * u * t * v[1] + 3 * u * t * t * v[3] + t ** 3 * v[5],
        ]);
      }
    else if (c === 'Z') {
      line.closed = true;
      if (start) line.push([...start]);
    }
  }
  return lines.filter((l) => l.length);
}
function geometry(v, meta) {
  const out = {};
  for (const [id, e] of Object.entries(v.parts)) {
    const part = meta[id],
      c = Math.cos(e.rotation),
      s = Math.sin(e.rotation);
    const lines = flatten(e.commands ?? []).map((l) =>
      Object.assign(
        l.map(([x, y]) => [e.x + c * x * e.scaleX - s * y * e.scaleY, e.y + s * x * e.scaleX + c * y * e.scaleY]),
        { closed: l.closed },
      ),
    );
    const points = lines.flat(),
      xs = points.map((p) => p[0]),
      ys = points.map((p) => p[1]);
    if (!points.length) {
      out[id] = { points, lines, opacity: e.opacity };
      continue;
    }
    const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
      radius = (part.stroke ?? 0) / 2,
      bottomIndex = ys.indexOf(Math.max(...ys));
    out[id] = {
      points,
      lines,
      radius,
      filled: !part.stroke,
      opacity: e.opacity * (part.auditAlpha ?? 1),
      box,
      bottom: box[3] + radius,
      center: [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2],
      worldBottomX: (root) => root.x + points[bottomIndex][0] * root.scaleX,
    };
  }
  return out;
}
function inside(p, lines) {
  let hit = false;
  for (const l of lines)
    if (l.closed)
      for (let i = 0, j = l.length - 1; i < l.length; j = i++) {
        const a = l[i],
          b = l[j];
        if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) hit = !hit;
      }
  return hit;
}
function segmentDistance(p, a, b) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    L = dx * dx + dy * dy,
    t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function distanceToLines(p, lines) {
  let d = Infinity;
  for (const l of lines) {
    if (l.length === 1) d = Math.min(d, Math.hypot(p[0] - l[0][0], p[1] - l[0][1]));
    for (let i = 1; i < l.length; i++) d = Math.min(d, segmentDistance(p, l[i - 1], l[i]));
  }
  return d;
}
function distanceToPart(p, g) {
  if (g.filled && inside(p, g.lines)) return 0;
  return Math.max(0, distanceToLines(p, g.lines) - g.radius);
}
function segmentsDistance(a, b, c, d) {
  const cross = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const d1 = cross(c, d, a),
    d2 = cross(c, d, b),
    d3 = cross(a, b, c),
    d4 = cross(a, b, d);
  if (d1 > 0 !== d2 > 0 && d3 > 0 !== d4 > 0) return 0;
  return Math.min(
    segmentDistance(a, c, d),
    segmentDistance(b, c, d),
    segmentDistance(c, a, b),
    segmentDistance(d, a, b),
  );
}
function linesDistance(A, B) {
  let best = Infinity;
  for (const l of A)
    for (let i = Math.min(1, l.length - 1); i < l.length; i++)
      for (const m of B)
        for (let j = Math.min(1, m.length - 1); j < m.length; j++) {
          best = Math.min(best, segmentsDistance(l[Math.max(0, i - 1)], l[i], m[Math.max(0, j - 1)], m[j]));
          if (best === 0) return 0;
        }
  return best;
}
function touching(a, b, tol) {
  const r = tol + a.radius + b.radius;
  if (a.box[0] > b.box[2] + r || b.box[0] > a.box[2] + r || a.box[1] > b.box[3] + r || b.box[1] > a.box[3] + r)
    return false;
  if (b.filled && a.points.some((p) => inside(p, b.lines))) return true;
  if (a.filled && b.points.some((p) => inside(p, a.lines))) return true;
  return linesDistance(a.lines, b.lines) <= r;
}
/** How deep any point of a sits inside the filled part b (0 when nothing is inside). */
function penetration(a, b) {
  let best = 0;
  for (const p of a.points) if (inside(p, b.lines)) best = Math.max(best, distanceToLines(p, b.lines));
  return best;
}
/** Smallest interior angle (degrees) at any vertex of the closed outlines, skipping near-straight joins. */
function sharpest(lines) {
  let best = 180;
  for (const l of lines) {
    if (!l.closed) continue;
    const pts = l.slice(0, -1),
      n = pts.length;
    if (n < 3) continue;
    for (let i = 0; i < n; i++) {
      const a = pts[(i + n - 1) % n],
        p = pts[i],
        b = pts[(i + 1) % n],
        u = [a[0] - p[0], a[1] - p[1]],
        v = [b[0] - p[0], b[1] - p[1]],
        lu = Math.hypot(...u),
        lv = Math.hypot(...v);
      if (lu < 1e-6 || lv < 1e-6) continue;
      best = Math.min(
        best,
        (Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (lu * lv)))) * 180) / Math.PI,
      );
    }
  }
  return best;
}
/** Proper crossings between non-adjacent edges of each closed outline: a fold where a curve overshot. */
function selfCrossings(lines) {
  let count = 0;
  for (const l of lines) {
    if (!l.closed) continue;
    const n = l.length - 1;
    for (let i = 0; i < n; i++)
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        const a = l[i],
          b = l[i + 1],
          c = l[j],
          d = l[j + 1],
          cr = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
        const d1 = cr(c, d, a),
          d2 = cr(c, d, b),
          d3 = cr(a, b, c),
          d4 = cr(a, b, d);
        if (d1 * d2 < -1e-9 && d3 * d4 < -1e-9) count++;
      }
  }
  return count;
}
function polylineLength(lines) {
  let L = 0;
  for (const l of lines)
    for (let i = 1; i < l.length; i++) L += Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]);
  return L;
}
/** Signed bend of a limb: cross product of its middle point against the start–end chord, normalized. */
function bendOf(lines) {
  const pts = lines.flat();
  if (pts.length < 3) return 0;
  const a = pts[0],
    b = pts.at(-1),
    m = pts[Math.floor(pts.length / 2)],
    chord = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return ((b[0] - a[0]) * (m[1] - a[1]) - (b[1] - a[1]) * (m[0] - a[0])) / (chord * chord);
}
