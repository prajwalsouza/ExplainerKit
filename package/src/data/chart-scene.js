import { hsla, toHex, toHSLA } from '../color/index.js';
import { scene } from '../core/index.js';
import { radialGradient } from '../graphics/index.js';
import {
  CHART_TYPES,
  blendPose,
  chartGroups,
  chartLook,
  chartPose,
  createSampler,
  morphDelays,
} from './chart-light.js';

export const chartTypes = CHART_TYPES;
const WIDTH = 900,
  HEIGHT = 600;
const MORPH = 1.25,
  UPDATE = 0.8,
  FADE = 0.35,
  COOL = 1.8,
  SPIN_DECAY = 0.9;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const pairKey = (a, b) => (a < b ? a + '\u0000' + b : b + '\u0000' + a);

function distanceToSegment(x, y, ax, ay, bx, by) {
  const dx = bx - ax,
    dy = by - ay,
    length2 = dx * dx + dy * dy;
  const t = length2 > 0 ? clamp01(((x - ax) * dx + (y - ay) * dy) / length2) : 0;
  return Math.hypot(x - ax - t * dx, y - ay - t * dy);
}

/** A value that eases from where it is now toward a target over a fixed time. */
function fader(initial = 0) {
  let from = initial,
    to = initial,
    start = 0,
    span = 0;
  const at = (time) =>
    span <= 0 || time >= start + span ? to : from + (to - from) * ease(clamp01((time - start) / span));
  return {
    at,
    set(value, time, duration) {
      from = at(time);
      to = value;
      start = time;
      span = duration;
    },
  };
}

/**
 * The live light-strand chart. Rows become hair bundles and links become silk strands; every chart type is one pose
 * of the same elements, so type changes and data updates morph instead of cross-fading.
 * @param {{data:any[], connections:any[]}} model
 * @param {{label?:string, motion:boolean, theme:any, type:string, clock?:{now:()=>number, live:()=>boolean}}} spec
 */
export function chartScene(model, { label, motion, theme, type, clock }) {
  const time = () => clock?.now() ?? 0;
  const live = () => motion && (clock ? clock.live() : false);
  const { data } = model;
  const groups = chartGroups(data);
  const linkIndex = new Map();
  const links = [];
  const addLink = (source, target, value, heat) => {
    const key = pairKey(source.id, target.id);
    if (!linkIndex.has(key)) {
      linkIndex.set(key, links.length);
      links.push({ source, target, value, heat });
    }
    return linkIndex.get(key);
  };
  for (const { source, target, value, heat } of model.connections) {
    const index = linkIndex.get(pairKey(source.id, target.id));
    if (index === undefined) addLink(source, target, value, heat);
    else links[index].value += value;
  }

  const drawing = scene({ width: WIDTH, height: HEIGHT, renderer: 'canvas', label, duration: motion ? 86400 : 0 });
  const background = drawing.rect({ width: WIDTH, height: HEIGHT });
  const clouds = {
    dust: drawing.cloud({ pointShape: 'glow', pointSize: 1 }),
    glow: drawing.cloud({ pointShape: 'glow', pointSize: 4.6 }),
    strands: drawing.cloud({ pointShape: 'glow', pointSize: 1.05 }),
    hairs: drawing.cloud({ pointShape: 'glow', pointSize: 1 }),
    sparks: drawing.cloud({ pointShape: 'glow', pointSize: 1 }),
  };
  const fontSize = data.length > 28 ? 10 : 12;
  const names = data.map((row) => row.label ?? row.id);
  const rowLabels = data.map(() => drawing.text({ baseline: 'middle', fontSize }));
  const groupLabels = groups.names.map((name) =>
    drawing.text({ baseline: 'middle', align: 'middle', fontSize: fontSize - 1, text: name }),
  );

  let look = chartLook(theme);
  const sampler = createSampler();
  const values = () => ({
    values: data.map((row) => row.value),
    links: links.map((l) => ({ a: l.source.index, b: l.target.index, value: l.value })),
    groups,
  });
  let goal = chartPose(values(), type, WIDTH, HEIGHT);
  let morph = null;
  const rowHeat = data.map((row) => ({ set: fader(row.heat ?? 0), burst: 0, at: 0 }));
  const linkHeat = links.map((l) => ({ set: fader(l.heat ?? 0), burst: 0, at: 0 }));
  let hover = null,
    focus = null,
    previous = null,
    selected = null,
    selectedAt = -Infinity,
    frozen = null,
    offset = 0,
    pointer = null,
    light = null,
    lightAt = 0,
    spin = 0,
    spinVelocity = 0,
    spinAt = 0,
    dragging = false,
    version = 0,
    cache = null,
    lastFrame = null;
  const pointerPresence = fader(0);
  const neighbors = data.map(() => new Set());
  const relink = () => {
    for (const set of neighbors) set.clear();
    for (const l of links)
      if (l.value > 0) {
        neighbors[l.source.index].add(l.target.index);
        neighbors[l.target.index].add(l.source.index);
      }
  };
  relink();

  function poseAt(now) {
    if (!morph) return goal;
    const { from, to, delays, start, span } = morph;
    const progress = (delay) => (span <= 0 ? 1 : ease(clamp01((now - start - delay) / span)));
    if (span <= 0 || now >= start + span + morph.longest) {
      morph = null;
      return goal;
    }
    return blendPose(from, to, {
      rows: delays.rows.map(progress),
      groups: delays.groups.map(progress),
      links: delays.links.map(progress),
      rim: progress(delays.rim),
    });
  }

  function startMorph(next, kind) {
    const now = time();
    const from = poseAt(now);
    const delays = morphDelays(from, next, kind);
    const longest = Math.max(...delays.rows, ...delays.groups, ...delays.links, delays.rim, 0);
    morph = live() ? { from, to: next, delays, start: now, span: kind === 'data' ? UPDATE : MORPH, longest } : null;
    goal = next;
    version++;
  }

  const ambientAt = (now) => (frozen ?? now + offset) + 3.7;
  const spinAt_ = (now) =>
    dragging || !spinVelocity ? spin : spin + spinVelocity * SPIN_DECAY * (1 - Math.exp(-(now - spinAt) / SPIN_DECAY));

  function heatAt(entry, now) {
    const burst = entry.burst * Math.exp(-Math.max(0, now - entry.at) / COOL);
    return Math.min(1, Math.max(entry.set.at(now), burst));
  }

  function selection(now) {
    const w = live() ? ease(clamp01((now - selectedAt) / FADE)) : 1;
    return { w, prev: previous, cur: selected };
  }

  function lightFor(now) {
    const presence = pointerPresence.at(now);
    const amb = ambientAt(now);
    const orbit = [WIDTH * (0.5 + 0.95 * Math.cos(amb * 0.19)), HEIGHT * (0.5 + 0.75 * Math.sin(amb * 0.13))];
    const aim = pointer ?? light ?? orbit;
    if (!light || !live()) light = [...aim];
    else {
      const k = 1 - Math.exp(-Math.max(0, now - lightAt) / 0.12);
      light[0] += (aim[0] - light[0]) * k;
      light[1] += (aim[1] - light[1]) * k;
    }
    lightAt = now;
    const at = [light[0] * presence + orbit[0] * (1 - presence), light[1] * presence + orbit[1] * (1 - presence)];
    return { at, height: 260 - 200 * presence, reach: 1600 - 1420 * presence, gain: 1.45 + 1.4 * presence };
  }

  function frameAt(now) {
    if (cache && cache.time === now && cache.version === version) return cache.frame;
    const pose = poseAt(now);
    const sel = selection(now);
    const lit = (chosen, i) => (chosen === null ? 1 : i === chosen ? 1.7 : neighbors[chosen].has(i) ? 1.15 : 0.28);
    const litLink = (chosen, l) =>
      chosen === null ? 1 : l.source.index === chosen || l.target.index === chosen ? 2 : 0.1;
    const warm = (chosen, l) =>
      chosen !== null && (l.source.index === chosen || l.target.index === chosen) ? 0.42 : 0;
    const mixSel = (f) => (x) => f(sel.prev, x) * (1 - sel.w) + f(sel.cur, x) * sel.w;
    const lightState = lightFor(now);
    const view = {
      look,
      width: WIDTH,
      height: HEIGHT,
      ambient: ambientAt(now),
      spin: spinAt_(now),
      light: lightState.at,
      lightHeight: lightState.height,
      lightReach: lightState.reach,
      lightGain: lightState.gain,
      pointer,
      highlight: data.map((row) => row.highlight),
      rowLight: data.map((_, i) => mixSel(lit)(i)),
      groupLight: groups.names.map(() => (sel.cur === null ? 1 : 0.5)),
      linkLight: links.map(mixSel(litLink)),
      rowHeat: data.map((_, i) => Math.min(1, heatAt(rowHeat[i], now) + (i === sel.cur ? 0.35 * sel.w : 0))),
      linkHeat: links.map((l, i) => Math.min(1, heatAt(linkHeat[i], now) + mixSel(warm)(l))),
    };
    const frame = sampler(pose, view);
    const spinNow = view.spin;
    frame.labels = pose.rows.map((e, i) => {
      const [x, y] = frame.place(e, e.u, e.lv);
      const th = e.k > 1e-7 ? e.k * e.u + spinNow * e.sg : 0;
      const nx = Math.sin(th) * (e.lv < e.v0 ? -1 : 1);
      const rotated = Math.abs(e.lrot) > 0.05;
      const chosen = sel.cur === i;
      const quiet = data.length > 32 && !chosen ? 0 : 1;
      return {
        x,
        y,
        rotation: e.lrot,
        align: rotated ? (e.lv < e.v0 ? 'end' : 'start') : nx > 0.3 ? 'start' : nx < -0.3 ? 'end' : 'middle',
        opacity: clamp01(e.la * quiet * Math.min(1, 0.25 + 0.75 * view.rowLight[i])),
        fill: chosen ? theme.accent : theme.text,
      };
    });
    // Labels that would overlap give way to larger values; the selected row always keeps its label.
    const placed = [];
    const order = [...data.keys()].sort((a, b) => (b === sel.cur) - (a === sel.cur) || data[b].value - data[a].value);
    for (const i of order) {
      const l = frame.labels[i];
      if (l.opacity <= 0.01) continue;
      const w = names[i].length * fontSize * 0.56 + 6,
        h = fontSize + 2;
      const rotated = Math.abs(l.rotation) > 0.05;
      const cx = l.x + (l.align === 'start' ? w / 2 : l.align === 'end' ? -w / 2 : 0);
      const hit = placed.some((b) =>
        rotated && b.rotated
          ? Math.abs(b.x - l.x) * Math.abs(Math.sin(l.rotation)) < h * 0.95
          : Math.abs(b.cx - cx) * 2 < b.w + w && Math.abs(b.y - l.y) < h,
      );
      if (hit && i !== sel.cur) l.opacity = 0;
      else placed.push({ x: l.x, cx, y: l.y, w, rotated });
    }
    frame.groupLabels = pose.groups.map((e) => {
      const [x, y] = frame.place(e, e.u, e.lv);
      return { x, y, opacity: clamp01(e.la) };
    });
    lastFrame = frame;
    cache = { time: now, version, frame };
    return frame;
  }

  for (const [name, node] of Object.entries(clouds))
    node.bind('points', { map: ({ time: now }) => frameAt(now)[name] });
  rowLabels.forEach((node, i) => {
    node.set({ text: names[i] });
    node.bind(['x', 'y', 'rotation', 'align', 'opacity', 'fill'], { map: ({ time: now }) => frameAt(now).labels[i] });
  });
  groupLabels.forEach((node, i) =>
    node.bind(['x', 'y', 'opacity'], { map: ({ time: now }) => frameAt(now).groupLabels[i] }),
  );

  function paintTheme() {
    look = chartLook(theme);
    const dark = look.additive;
    const record = toHSLA(theme.background);
    const centre = toHex(hsla(record.h, record.s, Math.min(100, record.l + (dark ? 6 : 2))));
    const edge = toHex(hsla(record.h, record.s, Math.max(0, record.l - (dark ? 3 : 6))));
    drawing._batch(() => {
      background.set({
        fill: radialGradient({
          x: WIDTH * 0.5,
          y: HEIGHT * 0.5,
          r: WIDTH * 0.62,
          stops: [
            { offset: 0, color: centre },
            { offset: 0.55, color: theme.background },
            { offset: 1, color: edge },
          ],
        }),
      });
      for (const node of Object.values(clouds))
        node.set({ pointBlend: dark ? 'add' : 'normal', pointShape: dark ? 'glow' : 'circle' });
      clouds.glow.set({ pointSize: dark ? 4.6 : 3 });
      clouds.strands.set({ pointSize: dark ? 1.05 : 0.62 });
      clouds.hairs.set({ pointSize: dark ? 1 : 0.6 });
      for (const node of groupLabels) node.set({ fill: theme.text });
      version++;
    });
  }
  paintTheme();

  const changed = () => {
    version++;
    drawing._changed();
  };

  return {
    drawing,
    get width() {
      return WIDTH;
    },
    get height() {
      return HEIGHT;
    },
    links,
    setView(nextType, nextTheme) {
      if (nextTheme !== theme) {
        theme = nextTheme;
        paintTheme();
      }
      if (nextType !== type) {
        type = nextType;
        if (type === 'arc' || type === 'bar') {
          spin = spinAt_(time());
          spinVelocity = 0;
        }
        startMorph(chartPose(values(), type, WIDTH, HEIGHT), 'type');
      }
      changed();
    },
    /** Replace values: rows by ID and links by endpoint pair. Rising values flare with heat, then cool. */
    setData(next) {
      const now = time();
      const max = Math.max(...next.data.map((row) => row.value), 0) || 1;
      const maxLink = Math.max(...next.connections.map((l) => l.value), 0) || 1;
      const seen = new Set();
      for (const row of next.data) {
        const i = model.byId.get(row.id)?.index;
        if (i === undefined) continue;
        const rise = row.value - data[i].value;
        data[i].value = row.value;
        const heat = rowHeat[i];
        if (row.heat !== undefined) heat.set.set(row.heat, now, live() ? UPDATE : 0);
        else if (rise > 0) {
          heat.burst = Math.min(1, heatAt(heat, now) + (2.5 * rise) / max);
          heat.at = now;
        }
      }
      for (const { source, target, value, heat: explicit } of next.connections) {
        const a = model.byId.get(source.id),
          b = model.byId.get(target.id);
        if (!a || !b) continue;
        let index = linkIndex.get(pairKey(a.id, b.id));
        if (index === undefined) {
          index = addLink(a, b, 0, undefined);
          linkHeat.push({ set: fader(0), burst: 0, at: 0 });
          const grown = chartPose(values(), type, WIDTH, HEIGHT);
          // A new pair starts folded into its first endpoint, so it weaves out instead of appearing.
          const fresh = { ...grown.links[index], trim: 0, alpha: 0 };
          for (const pose of new Set([goal, morph?.from, morph?.to])) if (pose) pose.links.push({ ...fresh });
          if (morph) morph.delays.links.push(0);
        }
        seen.add(index);
        const l = links[index],
          heat = linkHeat[index];
        const rise = value - l.value;
        l.value = value;
        if (explicit !== undefined) heat.set.set(explicit, now, live() ? UPDATE : 0);
        else if (rise > 0) {
          heat.burst = Math.min(1, heatAt(heat, now) + (2.5 * rise) / maxLink);
          heat.at = now;
        }
      }
      links.forEach((l, index) => {
        if (!seen.has(index)) l.value = 0;
      });
      relink();
      startMorph(chartPose(values(), type, WIDTH, HEIGHT), 'data');
      changed();
    },
    setSelection(nextHover, nextFocus) {
      if (nextHover === hover && nextFocus === focus) return;
      hover = nextHover;
      focus = nextFocus;
      const id = hover ?? focus;
      const index = id === null ? null : model.byId.get(id).index;
      if (index !== selected) {
        const now = time();
        const w = selection(now).w;
        previous = w < 0.5 ? previous : selected;
        selected = index;
        selectedAt = now;
      }
      changed();
    },
    /** Pointer in scene units, or null when it leaves: it lights the silk and draws nearby hairs toward it. */
    setPointer(point) {
      const now = time();
      if ((point === null) !== (pointer === null)) pointerPresence.set(point ? 1 : 0, now, live() ? 0.5 : 0);
      pointer = point;
      changed();
    },
    setAmbientPaused(paused) {
      const now = time();
      if (paused && frozen === null) frozen = now + offset;
      if (!paused && frozen !== null) {
        offset = frozen - now;
        frozen = null;
      }
      changed();
    },
    /** True when the current layout is a circle that a drag can turn. */
    get spins() {
      return type !== 'arc' && type !== 'bar';
    },
    get centre() {
      return [WIDTH / 2, HEIGHT / 2];
    },
    beginSpin() {
      spin = spinAt_(time());
      spinVelocity = 0;
      dragging = true;
    },
    turn(delta) {
      spin += delta;
      changed();
    },
    endSpin(velocity) {
      dragging = false;
      spinAt = time();
      spinVelocity = live() ? Math.max(-6, Math.min(6, velocity)) : 0;
      changed();
    },
    /** The row or link under a point in scene units. */
    pick(x, y) {
      const frame = lastFrame ?? frameAt(time());
      let best = null,
        distance = 14;
      frame.pick.rows.forEach((points, index) => {
        for (let i = 0; i < points.length; i += 4) {
          const d = distanceToSegment(x, y, points[i], points[i + 1], points[i + 2], points[i + 3]);
          if (d < distance) {
            distance = d;
            best = { row: data[index].id };
          }
        }
      });
      if (best) return best;
      distance = 6;
      frame.pick.links.forEach((points, index) => {
        for (let i = 0; i + 3 < points.length; i += 2) {
          const d = distanceToSegment(x, y, points[i], points[i + 1], points[i + 2], points[i + 3]);
          if (d < distance && links[index].value > 0) {
            distance = d;
            best = { link: index };
          }
        }
      });
      return best;
    },
  };
}
