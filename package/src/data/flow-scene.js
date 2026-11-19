// A flowchart drawn as silk light, with a replay of the messages that pass through it. Every visual is a function of
// the scene time, so the replay can be played, paused and scrubbed: step k occupies [k·D, (k+1)·D). In the first part
// of a step its message travels its edge as a comet; then the receiving node lights up and holds its heat, cooling
// over the following steps. Nodes are outlined by strands, edges are strand bundles, and the pointer is the light.
import { hsla, toHex, toHSLA } from '../color/index.js';
import { scene } from '../core/index.js';
import { radialGradient } from '../graphics/index.js';
import { flowLayout } from './flow-layout.js';
import { silkBrush } from './silk-brush.js';

const TAU = 2 * Math.PI;
const TRAVEL = 0.62,
  COOL = 2.6;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function cubicAt([p0, p1, p2, p3], t) {
  const s = 1 - t;
  return [
    s * s * s * p0[0] + 3 * s * s * t * p1[0] + 3 * s * t * t * p2[0] + t * t * t * p3[0],
    s * s * s * p0[1] + 3 * s * s * t * p1[1] + 3 * s * t * t * p2[1] + t * t * t * p3[1],
  ];
}
const line = (a, b) => [
  a,
  [a[0] + (b[0] - a[0]) / 3, a[1] + (b[1] - a[1]) / 3],
  [a[0] + ((b[0] - a[0]) * 2) / 3, a[1] + ((b[1] - a[1]) * 2) / 3],
  b,
];

/** The outline of a node shape as straight sides, in drawing units. */
function outline(node) {
  const { x, y, w, h } = node,
    l = x - w / 2,
    r = x + w / 2,
    t = y - h / 2,
    b = y + h / 2,
    k = Math.min(h * 0.32, w * 0.2);
  switch (node.shape) {
    case 'diamond':
      return [
        [x, t],
        [r, y],
        [x, b],
        [l, y],
      ];
    case 'hexagon':
      return [
        [l + k, t],
        [r - k, t],
        [r, y],
        [r - k, b],
        [l + k, b],
        [l, y],
      ];
    case 'parallelogram':
      return [
        [l + k, t],
        [r, t],
        [r - k, b],
        [l, b],
      ];
    case 'flag':
      return [
        [l, t],
        [r, t],
        [r, b],
        [l, b],
        [l + k, y],
      ];
    case 'stadium':
    case 'round':
      return Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * TAU,
          rx = node.shape === 'stadium' ? w / 2 : w / 2 - k * 0.3,
          ry = h / 2;
        // A superellipse: flat sides, rounded ends.
        const p = node.shape === 'stadium' ? 0.35 : 0.22;
        const c = Math.cos(a),
          s = Math.sin(a);
        return [x + rx * Math.sign(c) * Math.abs(c) ** p, y + ry * Math.sign(s) * Math.abs(s) ** p];
      });
    default:
      return [
        [l, t],
        [r, t],
        [r, b],
        [l, b],
      ];
  }
}

/** Steps without a script: every edge once, in the order a breadth-first walk from the sources meets them. */
export function defaultFlowSteps(layout) {
  const order = [...layout.edges.keys()].sort(
    (a, b) =>
      layout.nodes.find((n) => n.id === layout.edges[a].from).rank -
      layout.nodes.find((n) => n.id === layout.edges[b].from).rank,
  );
  return order.map((k) => ({ from: layout.edges[k].from, to: layout.edges[k].to, label: layout.edges[k].label }));
}

/**
 * @param {ReturnType<import('./flow-mermaid.js').parseMermaidFlow>} graph
 * @param {{theme: any, themeName: string, steps: {from?: string, to?: string, node?: string, label?: string}[],
 *          stepDuration: number, label: string, width?: number, height?: number}} spec
 */
export function flowScene(graph, { theme, themeName, steps, stepDuration, label, width = 960, height = 600 }) {
  const layout = flowLayout(graph, width, height);
  const byId = new Map(layout.nodes.map((n, i) => [n.id, i]));
  const edgeOf = new Map(layout.edges.map((e, k) => [e.from + '\u0000' + e.to, k]));
  const D = stepDuration;
  const duration = Math.max(1, steps.length * D + 1.5);
  const drawing = scene({ width, height, renderer: 'canvas', label, duration });
  const background = drawing.rect({ width, height });
  // Everything but the background lives in one group, so the view can zoom and pan without moving the layout.
  const world = drawing.group();
  const glowCloud = world.cloud({ pointShape: 'glow', pointSize: 4.6 });
  const fibreCloud = world.cloud({ pointShape: 'glow', pointSize: 1.05 });
  const fontSize = Math.round(13 * Math.min(1.1, Math.max(0.8, layout.scale)));
  const groupTitles = layout.groups.map((g) =>
    world.text({ x: g.x + 10, y: g.y + 12, text: g.title, fontSize: fontSize - 2, baseline: 'middle' }),
  );
  const nodeText = layout.nodes.map((node) => {
    const words = node.label.split(' ');
    let lines = [node.label];
    if (node.lines === 2 && words.length > 1) {
      let best = 1,
        diff = Infinity;
      for (let i = 1; i < words.length; i++) {
        const d = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length);
        if (d < diff) [best, diff] = [i, d];
      }
      lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')];
    }
    return lines.map((value, i) =>
      world.text({
        x: node.x,
        y: node.y + (i - (lines.length - 1) / 2) * fontSize * 1.15,
        text: value.length > 30 ? value.slice(0, 29) + '…' : value,
        fontSize,
        align: 'middle',
        baseline: 'middle',
      }),
    );
  });
  const edgeText = layout.edges.map((e) => {
    const [x, y] = cubicAt(e.points, 0.5);
    return world.text({ x, y: y - 8, text: e.label, fontSize: fontSize - 2, align: 'middle', baseline: 'middle' });
  });
  const message = world.text({ fontSize: fontSize - 1, align: 'middle', baseline: 'middle' });

  const brush = silkBrush({ theme: themeName });
  const view = { x: 0, y: 0, k: 1 };
  let pointer = null,
    hover = null,
    focus = null,
    frozen = null,
    cache = null,
    version = 0;

  /** Where the replay is: the step, how far its message has travelled, and the heat every element carries. */
  function stateAt(time) {
    const k = Math.min(steps.length - 1, Math.max(0, Math.floor(time / D)));
    const u = clamp01((time - k * D) / D);
    const nodeHeat = new Float64Array(layout.nodes.length),
      edgeHeat = new Float64Array(layout.edges.length);
    for (let j = Math.max(0, k - 16); j <= k && j < steps.length; j++) {
      const step = steps[j];
      const arrive = j * D + D * TRAVEL;
      const ek = step.from && step.to ? edgeOf.get(step.from + '\u0000' + step.to) : undefined;
      if (ek !== undefined && time >= j * D) {
        const lit = time < arrive ? 1 : Math.exp(-(time - arrive) / COOL);
        edgeHeat[ek] = Math.max(edgeHeat[ek], lit);
      }
      const target = byId.get(step.to ?? step.node);
      if (target !== undefined && time >= arrive) {
        const since = time - arrive;
        nodeHeat[target] = Math.max(nodeHeat[target], since < 0.35 ? since / 0.35 : Math.exp(-(since - 0.35) / COOL));
      }
      const source = byId.get(step.from);
      if (source !== undefined && time >= j * D && time < arrive) nodeHeat[source] = Math.max(nodeHeat[source], 0.55);
    }
    return { k, u, nodeHeat, edgeHeat };
  }

  function frameAt(time) {
    if (cache && cache.time === time && cache.version === version) return cache.frame;
    const ambient = frozen ?? time;
    const state = stateAt(time);
    const chosen = hover ?? focus;
    const touches = (e) => chosen === null || e.from === chosen || e.to === chosen;
    const near = (id) =>
      chosen === null ||
      id === chosen ||
      layout.edges.some((e) => (e.from === chosen && e.to === id) || (e.to === chosen && e.from === id));
    brush.begin({
      time: ambient + 3.7,
      light: pointer,
      centre: [width / 2, height / 2],
      size: Math.max(width, height),
      scale: view.k,
    });
    const mark = theme.mark;

    // One tight strand per line: a flowchart, drawn in light. Heat only brightens and warms what a message touched.
    const strand = (from, to, alpha, heat, seed, extra = {}) => {
      const [p0, p1, p2, p3] = line(from, to);
      brush.strands({
        from: p0,
        c1: p1,
        c2: p2,
        to: p3,
        count: 1,
        spread: 0,
        color: mark,
        alpha,
        heat,
        seed,
        ...extra,
      });
    };
    for (const [gi, g] of layout.groups.entries()) {
      const corners = [
        [g.x, g.y],
        [g.x + g.w, g.y],
        [g.x + g.w, g.y + g.h],
        [g.x, g.y + g.h],
      ];
      corners.forEach((p, i) => strand(p, corners[(i + 1) % 4], 0.45, 0, 900 + gi * 4 + i));
    }
    layout.edges.forEach((e, k) => {
      const heat = state.edgeHeat[k];
      const dim = touches(e) ? 1 : 0.2;
      const alpha = dim * (1.1 + heat * 1.2);
      const warm = heat * 0.9 + (chosen !== null && touches(e) && chosen !== undefined ? 0.25 : 0);
      const [a, c1, c2, b] = e.points;
      // The line stops at the arrowhead's base so the head reads as a solid point.
      const head = e.arrow ? 9 : 0;
      const [qx, qy] = cubicAt(e.points, 0.97);
      const angle = Math.atan2(b[1] - qy, b[0] - qx);
      const base = [b[0] - Math.cos(angle) * head, b[1] - Math.sin(angle) * head];
      const curve = { from: a, c1, c2, to: base, color: mark, heat: warm, seed: k, spread: 0 };
      if (e.style === 'dotted') {
        for (let t = 0; t < 1; t += 0.07)
          brush.strands({ ...curve, count: 1, trimStart: t, trim: Math.min(1, t + 0.035), alpha });
      } else
        brush.strands({ ...curve, count: e.style === 'thick' ? 3 : 1, spread: e.style === 'thick' ? 1.6 : 0, alpha });
      if (e.arrow) {
        const wing = (side) => [
          base[0] + Math.cos(angle + (side * Math.PI) / 2) * head * 0.45,
          base[1] + Math.sin(angle + (side * Math.PI) / 2) * head * 0.45,
        ];
        const [l, r] = [wing(-1), wing(1)];
        strand(l, b, alpha * 1.3, warm, k * 7 + 1);
        strand(r, b, alpha * 1.3, warm, k * 7 + 2);
        strand(l, r, alpha * 1.3, warm, k * 7 + 3);
        strand(base, b, alpha * 1.3, warm, k * 7 + 4);
      }
    });
    layout.nodes.forEach((node, i) => {
      const heat = Math.max(state.nodeHeat[i], node.id === chosen ? 0.35 : 0);
      const alpha = (near(node.id) ? 1.2 : 0.3) * (1 + heat);
      const sides =
        node.shape === 'circle'
          ? Array.from({ length: 32 }, (_, j) => [
              node.x + (Math.cos((j / 32) * TAU) * node.w) / 2,
              node.y + (Math.sin((j / 32) * TAU) * node.h) / 2,
            ])
          : outline(node);
      sides.forEach((p, j) => strand(p, sides[(j + 1) % sides.length], alpha, heat, i * 61 + j));
      if (node.shape === 'subroutine')
        for (const dx of [7, -7]) {
          const x = node.x + (Math.sign(dx) * node.w) / 2 - dx;
          strand([x, node.y - node.h / 2], [x, node.y + node.h / 2], alpha * 0.8, heat, i * 61 + 40 + Math.sign(dx));
        }
      if (node.shape === 'database')
        strand(
          [node.x - node.w / 2, node.y - node.h / 2 + 7],
          [node.x + node.w / 2, node.y - node.h / 2 + 7],
          alpha * 0.8,
          heat,
          i * 61 + 45,
        );
    });
    // The message in flight: a comet along its edge, or a straight flight between unconnected nodes.
    const step = steps[state.k];
    let carrier = null;
    if (step && state.u < TRAVEL && step.from && step.to && byId.has(step.from) && byId.has(step.to)) {
      const ek = edgeOf.get(step.from + '\u0000' + step.to);
      const pts =
        ek !== undefined
          ? layout.edges[ek].points
          : line(...[step.from, step.to].map((id) => [layout.nodes[byId.get(id)].x, layout.nodes[byId.get(id)].y]));
      const p = ease(state.u / TRAVEL);
      const [a, c1, c2, b] = pts;
      brush.strands({
        from: a,
        c1,
        c2,
        to: b,
        count: 1,
        spread: 0,
        trimStart: Math.max(0, p - 0.22),
        trim: p,
        taper: true,
        color: mark,
        alpha: 3.2,
        heat: 1,
        seed: 7000 + state.k,
      });
      carrier = cubicAt(pts, p);
      brush.glow({ x: carrier[0], y: carrier[1], r: 5, color: mark, alpha: 1.4, heat: 1 });
    }
    const frame = brush.sample();
    // Copy out of the brush's buffers: the next frame reuses them.
    const fibres = { positions: frame.fibres.positions.slice(), colors: frame.fibres.colors.slice() };
    const glow = { positions: frame.glow.positions.slice(), colors: frame.glow.colors.slice() };
    const result = { fibres, glow, carrier, state };
    cache = { time, version, frame: result };
    return result;
  }

  glowCloud.bind('points', { map: ({ time }) => frameAt(time).glow });
  fibreCloud.bind('points', { map: ({ time }) => frameAt(time).fibres });
  message.bind(['x', 'y', 'text', 'opacity'], {
    map: ({ time }) => {
      const { carrier, state } = frameAt(time);
      const step = steps[state.k];
      const text = (step?.label ?? '').slice(0, 48);
      if (!carrier || !text) return { x: 0, y: 0, text: '', opacity: 0 };
      return { x: carrier[0], y: carrier[1] - 16, text, opacity: Math.sin((Math.PI * state.u) / TRAVEL) };
    },
  });
  layout.nodes.forEach((node, i) =>
    nodeText[i].forEach((t) =>
      t.bind(['opacity'], {
        map: ({ time }) => {
          const chosen = hover ?? focus;
          const heat = frameAt(time).state.nodeHeat[i];
          const near =
            chosen === null ||
            node.id === chosen ||
            layout.edges.some(
              (e) => (e.from === chosen && e.to === node.id) || (e.to === chosen && e.from === node.id),
            );
          return { opacity: (near ? 0.82 : 0.3) + 0.18 * heat };
        },
      }),
    ),
  );

  // Fibres stay about one device pixel wide at any zoom: the cloud's point size shrinks as the view scales up.
  function sizeClouds() {
    const dark = brush.additive;
    fibreCloud.set({ pointSize: (dark ? 1.05 : 0.78) / view.k });
    glowCloud.set({ pointSize: (dark ? 4.6 : 3) / view.k });
  }
  function paintTheme() {
    const record = toHSLA(theme.background);
    const dark = brush.additive;
    drawing._batch(() => {
      background.set({
        fill: radialGradient({
          x: width / 2,
          y: height / 2,
          r: width * 0.65,
          stops: [
            { offset: 0, color: toHex(hsla(record.h, record.s, Math.min(100, record.l + (dark ? 6 : 2)))) },
            { offset: 0.6, color: theme.background },
            { offset: 1, color: toHex(hsla(record.h, record.s, Math.max(0, record.l - (dark ? 3 : 6)))) },
          ],
        }),
      });
      for (const node of [glowCloud, fibreCloud]) node.set({ pointBlend: dark ? 'add' : 'normal' });
      sizeClouds();
      for (const t of [...nodeText.flat(), ...groupTitles]) t.set({ fill: theme.text });
      for (const t of edgeText) t.set({ fill: theme.text, opacity: 0.62 });
      message.set({ fill: theme.accent });
    });
    version++;
  }
  paintTheme();
  const changed = () => {
    version++;
    drawing._changed();
  };
  function toWorld([x, y]) {
    return [(x - view.x) / view.k, (y - view.y) / view.k];
  }
  function applyView() {
    drawing._batch(() => {
      world.set({ x: view.x, y: view.y, scaleX: view.k, scaleY: view.k });
      sizeClouds();
    });
    changed();
  }
  return {
    drawing,
    layout,
    steps,
    width,
    height,
    stepDuration: D,
    stepAt: (time) => stateAt(time).k,
    setTheme(nextTheme, name) {
      theme = nextTheme;
      brush.setTheme(name);
      paintTheme();
      changed();
    },
    /** Pointer in drawing units (null when it leaves), turned into layout units for the light. */
    setPointer(point) {
      pointer = point ? toWorld(point) : null;
      changed();
    },
    get view() {
      return { ...view };
    },
    /** Zoom by `factor` about a point in drawing units, within 0.5–6 times. */
    zoom(factor, at = [width / 2, height / 2]) {
      const k = Math.min(6, Math.max(0.5, view.k * factor));
      const [wx, wy] = toWorld(at);
      view.k = k;
      view.x = at[0] - wx * k;
      view.y = at[1] - wy * k;
      applyView();
    },
    /** Move the view by a distance in drawing units. */
    pan(dx, dy) {
      view.x += dx;
      view.y += dy;
      applyView();
    },
    /** Frame one node, or the whole chart when `id` is null. */
    frame(id = null) {
      const node = id === null ? null : layout.nodes.find((n) => n.id === id);
      if (!node) {
        Object.assign(view, { x: 0, y: 0, k: 1 });
      } else {
        const k = Math.min(3.2, Math.max(1.6, Math.min(width / (node.w * 5), height / (node.h * 6))));
        Object.assign(view, { k, x: width / 2 - node.x * k, y: height / 2 - node.y * k });
      }
      applyView();
    },
    toWorld,
    setSelection(nextHover, nextFocus) {
      hover = nextHover;
      focus = nextFocus;
      changed();
    },
    setAmbientPaused(time) {
      frozen = time;
      changed();
    },
    /** The node under a point in drawing units, or null. */
    pick(px, py) {
      const [x, y] = toWorld([px, py]);
      for (const node of layout.nodes)
        if (Math.abs(x - node.x) <= node.w / 2 + 4 && Math.abs(y - node.y) <= node.h / 2 + 4) return node.id;
      return null;
    },
  };
}
