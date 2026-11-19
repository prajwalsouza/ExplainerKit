// The live chapter: the story's last point listens. Everything here arrives through explainerkit/inputs
// as ordinary scene parameters and data rows:
//   · pointerInput → the point leans toward the cursor; the element under it lifts and reads out its row;
//     a click focuses everything connected to it; a click on the point turns the data to its next view;
//   · a ghost sample file rides with the cursor when the chapter opens. A field of small dots strains toward it
//     and tethers tug it toward the point; a click lets it go, and the point gulps it;
//   · dragInput → a real file in the air wakes the same field; dropped, the dots rush in with it;
//   · fileInput (CSV) or a sample, through one caller-fed inputSource → bindData → the table's views
//     (live-forms.js), grown out of the point on springs, and morphing from one view to the next;
//   · microphoneInput with bands and a waveform → the voice drawn round the point, a radar spectrogram while
//     there is no data, and each part of a view reaching with its own band.
// Live observations are not part of story time: they react, they do not rewind.
import {
  pointerInput,
  dragInput,
  fileInput,
  inputSource,
  microphoneInput,
  mapInput,
  smoothInput,
  bindInputs,
  bindData,
  readInputFile,
} from 'explainerkit/inputs';
import { spring } from 'explainerkit/physics';
import { stagger } from 'explainerkit/motion';
import { randomAt } from 'explainerkit/noise';
import { points } from 'explainerkit/procedural';
import { silkBrush } from 'explainerkit/data';
import { analyse, layout, paintForm, anchorOf, tone, SANS, crispText, SILK_VIEWS } from './live-forms.js';
import { surface, brand, theme } from './theme.js';
import { createLatestLoad, prepareBundledSample, readBundledResponse } from './live-samples.js';

const MAX_ROWS = 3000,
  BANDS = 12,
  WAVE = 96,
  HISTORY = 90,
  TAU = Math.PI * 2,
  TOP = -Math.PI / 2;
const settle = spring({ from: 0, to: 1, stiffness: 140, damping: 12, at: 0 }),
  sweep = stagger([0, 1], { from: 'first' });
const isCSV = (file) => /\.csv$/i.test(file?.name ?? '') || /^text\/csv/i.test(file?.type ?? '');
const smooth01 = (u) => {
  const x = Math.max(0, Math.min(1, u));
  return x * x * (3 - 2 * x);
};

/**
 * Four small samples, one per data shape. The first two are real (Friends, season one) and load from ./data when
 * used; the climate means are approximate and the energy mix is illustrative.
 */
/** A sample's CSV text: inline, or fetched once from the page's own origin. */
const texts = new Map();
const preparedSamples = new Map(),
  bundleLoads = new Map();
function sampleText([name, source]) {
  if (typeof source === 'string') return Promise.resolve(source);
  if (!texts.has(name)) {
    texts.set(
      name,
      fetch(source.url)
        .then((r) => readBundledResponse(r, name))
        .catch((error) => {
          texts.delete(name); // a later click may try again
          throw error;
        }),
    );
  }
  return texts.get(name);
}
function bundledSample(entry) {
  const [name] = entry;
  if (!preparedSamples.has(name)) {
    bundleLoads.set(name, 'loading');
    preparedSamples.set(
      name,
      prepareBundledSample(entry, {
        loadText: sampleText,
        sourceFor: DATA,
        parseText: (text, filename) =>
          readInputFile(new File([text], filename, { type: 'text/csv' }), {
            format: 'csv',
            maxRows: MAX_ROWS,
            maxBytes: 2_000_000,
          }),
      }).then(
        (value) => {
          bundleLoads.set(name, 'ready');
          return value;
        },
        (error) => {
          bundleLoads.set(name, 'failed');
          preparedSamples.delete(name);
          throw error;
        },
      ),
    );
  }
  return preparedSamples.get(name);
}
const seasonFile = (n) =>
  n === 'all' ? 'friends-all-episodes.csv' : `friends-s${Math.min(10, Math.max(1, Math.round(n) || 1))}-speakers.csv`;
const idle = () =>
  new Promise((done) => (globalThis.requestIdleCallback ?? ((f) => setTimeout(f, 120)))(done, { timeout: 800 }));
/** Readable titles for the bundled samples (a dropped file shows its own name): what it is, and what is drawn. */
const ABOUT = Object.freeze({
  ...Object.fromEntries(
    Array.from({ length: 10 }, (_, i) => [
      `friends-s${i + 1}-speakers`,
      { title: `Friends · Season ${i + 1}`, what: 'who speaks in each episode', season: i + 1 },
    ]),
  ),
  'friends-all-episodes': {
    title: 'Friends · All ten seasons',
    what: 'who speaks in each of 236 episodes',
    season: 'all',
  },
  'friends-s1-conversations': {
    title: 'Friends · Season 1',
    what: 'consecutive speaker turns, either direction',
    season: 1,
  },
  'climate-sample': { title: 'Four cities, month by month', what: 'rainfall and temperature, approximate' },
  'energy-mix-illustrative': { title: 'An energy mix', what: 'four regions by source, illustrative' },
});
const aboutOf = (name) => ABOUT[name.replace(/\.csv$/i, '')] ?? null;
const DATA = (file) => Object.freeze({ url: new URL(`./data/${file}`, import.meta.url).href });
const SAMPLES = [
  // Real data first (the ghost card carries SAMPLES[0]): Friends season one, from Emory NLP's Character Mining
  // corpus (Apache-2.0 plus its separate transcript notice); see data/README.md. Membership arcs count speaking
  // episodes; inner chords and the chord view use the coordinated companion's undirected consecutive turns.
  ['friends-s1-speakers.csv', DATA('friends-s1-speakers.csv')],
  ['friends-s1-conversations.csv', DATA('friends-s1-conversations.csv')],
  [
    'climate-sample.csv',
    (() => {
      const cities = {
        Zurich: [
          [0, 70],
          [1, 65],
          [5, 75],
          [9, 90],
          [13, 110],
          [17, 125],
          [19, 120],
          [18, 125],
          [15, 100],
          [10, 85],
          [5, 80],
          [1, 75],
        ],
        Reykjavik: [
          [0, 90],
          [0, 85],
          [1, 85],
          [3, 60],
          [7, 45],
          [10, 50],
          [12, 50],
          [11, 60],
          [8, 70],
          [5, 90],
          [2, 75],
          [0, 90],
        ],
        Singapore: [
          [27, 240],
          [27, 115],
          [28, 175],
          [28, 165],
          [28, 160],
          [28, 135],
          [28, 145],
          [28, 145],
          [28, 125],
          [28, 155],
          [27, 255],
          [27, 290],
        ],
        'Cape Town': [
          [22, 15],
          [22, 17],
          [21, 20],
          [18, 40],
          [16, 70],
          [14, 95],
          [13, 85],
          [14, 75],
          [15, 45],
          [17, 30],
          [19, 20],
          [21, 15],
        ],
      };
      const lines = ['city,month,rainfall_mm,temperature_c'];
      for (const [city, months] of Object.entries(cities))
        months.forEach(([t, r], m) => lines.push(`${city},${m + 1},${r},${t}`));
      return lines.join('\n');
    })(),
  ],
  [
    'energy-mix-illustrative.csv',
    [
      'region,source,twh',
      'North,Hydro,42',
      'North,Wind,31',
      'North,Nuclear,18',
      'North,Solar,6',
      'South,Solar,48',
      'South,Gas,36',
      'South,Wind,14',
      'South,Hydro,9',
      'East,Coal,40',
      'East,Gas,28',
      'East,Solar,22',
      'East,Wind,17',
      'West,Wind,39',
      'West,Solar,27',
      'West,Nuclear,25',
      'West,Hydro,12',
      'Coast,Wind,34',
      'Coast,Gas,15',
      'Coast,Solar,11',
    ].join('\n'),
  ],
];

/** A begun silk brush for a view drawn in silk on a context that can take GPU points, otherwise null. */
function silkFor(brush, view, ctx, { time, cx, cy, R, light }) {
  if (!SILK_VIEWS.has(view.view) || !brush.ready(ctx)) return null;
  return brush.begin({ time, light, centre: [cx, cy], size: R * 2 });
}

export function createLive({
  stage,
  drawing,
  player,
  units,
  onNotice = () => {},
  onView = () => {},
  reducedMotion = () => false,
}) {
  // Parameters the inputs drive. The painter reads these and the rows, nothing else.
  const param = (min, max) => drawing.parameter(0, { min, max });
  const p = {
    x: param(-1e5, 1e5),
    y: param(-1e5, 1e5),
    on: param(0, 1),
    hover: param(0, 1),
    hx: param(-1e5, 1e5),
    hy: param(-1e5, 1e5),
    items: param(0, 1e4),
    voice: param(0, 1),
  };
  // Membership and flow views are drawn as silk light: Silk on the dark page, Pearl (ink fibres) on the light one.
  // One brush for the view and one for the view folding away during a morph, each sampled once per frame.
  // The flat painted look stays as the Classic skin; the reader's choice is remembered.
  const SKIN_KEY = 'explainerkit-landing-skin';
  let skin = 'silk';
  try {
    if (localStorage.getItem(SKIN_KEY) === 'classic') skin = 'classic';
  } catch {
    /* A private window keeps the default skin. */
  }
  const silkTheme = () => (theme.night ? 'silk' : 'pearl');
  const silk = silkBrush({ theme: silkTheme() }),
    silkFrom = silkBrush({ theme: silkTheme(), budget: 60000 });
  theme.onChange(() => {
    silk.setTheme(silkTheme());
    silkFrom.setTheme(silkTheme());
  });
  const rows = drawing.data([], { key: 'id', maxRows: MAX_ROWS });
  let table = null,
    model = null,
    viewIndex = 0;
  const latestLoad = createLatestLoad();
  const pointer = pointerInput(stage, { id: 'live-pointer' }),
    drag = dragInput(stage, { id: 'live-drag' });
  const file = fileInput(stage, { id: 'live-file', format: 'csv', maxRows: MAX_ROWS, maxBytes: 2_000_000 });
  const incoming = inputSource({
    id: 'rows',
    kind: 'event',
    unit: 'rows',
    space: 'data',
    maxAge: 86400,
    maxBytes: 4_000_000,
  });
  const mic = microphoneInput({ id: 'voice', bands: BANDS, waveform: WAVE }),
    loudness = mapInput(mic, (v) => Math.min(1, v.rms * 4), { id: 'voice-rms' }),
    level = smoothInput(loudness, { id: 'voice-level', halfLife: 0.06 });
  bindInputs(
    drawing,
    [pointer],
    [
      { parameter: p.x, map: ([s]) => units(s.value.x) },
      { parameter: p.y, map: ([s]) => units(s.value.y) },
      { parameter: p.on, map: ([s]) => (s.value.active ? 1 : 0) },
    ],
    { player },
  );
  const dragBinding = bindInputs(
    drawing,
    [drag],
    [
      { parameter: p.hover, map: ([s]) => (s.value.active && s.value.files ? 1 : 0) },
      { parameter: p.hx, map: ([s]) => units(s.value.x) },
      { parameter: p.hy, map: ([s]) => units(s.value.y) },
      { parameter: p.items, map: ([s]) => s.value.items },
    ],
    { player },
  );
  bindInputs(drawing, [level], [{ parameter: p.voice, map: ([s]) => s.value }], { player });
  bindData(rows, incoming, {
    map: (sample) => {
      const { rows: raw, name, pairWeights } = sample.value;
      const next = analyse(raw, name.replace(/\.csv$/i, ''), pairWeights ?? null);
      if (sample.value.keepView && model && table && next.views.includes(table.views[viewIndex])) {
        const view = table.views[viewIndex];
        table = next;
        viewIndex = Math.max(0, table.views.indexOf(view));
        morphTo(layout(table, table.views[viewIndex]));
        swapped = true;
      } else {
        swapped = false;
        table = next;
        viewIndex = 0;
        model = layout(table, table.views[0]);
        onView(model);
      }
      return model.items.map((_, id) => ({ id }));
    },
    onError: (e) => onNotice(`That CSV could not be drawn: ${e.message ?? e.code}`),
    player,
  });
  file.subscribe(() => {
    const v = file.snapshot().latest?.value;
    if (!v) return;
    if (!isCSV(v)) onNotice('Only CSV files for now.');
    else if (v.error) onNotice(`Couldn't read ${v.name}: ${v.error.code ?? v.error.message ?? 'unsupported'}`);
    else {
      latestLoad.cancel();
      wanted = null;
      onNotice('');
      ghost.state = 'gone';
      incoming.push(v);
    }
  });

  // ---- State that reacts on the wall clock (input is live, not story time). ----
  let active = false,
    listening = false,
    shown = null,
    bornAt = 0,
    sampleIndex = 0,
    hoverItem = -1,
    focus = null,
    paths = [],
    clock = 0,
    lastAt = { x: 0, y: 0 };
  const look = {
    lean: { x: 0, y: 0, vx: 0, vy: 0 },
    hover: 0,
    hv: 0,
    voice: 0,
    bands: new Float32Array(BANDS),
    gulp: -9,
    lastHover: -9,
    slump: -9,
    ripples: [],
    loud: false,
  };
  const history = []; // band frames for the radar spectrogram
  let pointColour = { h: 10, s: 72, l: 56 };
  const pageLabels = []; // this frame's view labels, for the page to set as text (crisp at any pixel ratio)
  let hovered = null,
    wanted = null, // the season file last asked for, while it loads
    prefetching = false,
    swapped = false;
  let morph = null; // { from: model, at: time, pairs: [[fromAnchor, toAnchor, colour]] }
  // The ghost: a sample file card that rides with the cursor until it is let go into the point.
  const ghost = {
    state: 'waiting',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    tilt: 0,
    vt: 0,
    flyFrom: null,
    flyAt: 0,
    name: SAMPLES[0][0],
    pending: null,
  };
  // The eager field: Poisson-spaced dots across the view, asleep until a file comes near.
  const field = points({ seed: 23, count: 190, in: { rect: [0, 0, 1000, 1000] }, method: 'poisson', minDistance: 48 });
  const N = field.count,
    fx = field.x,
    fy = field.y,
    ox = new Float32Array(N),
    oy = new Float32Array(N),
    vx = new Float32Array(N),
    vy = new Float32Array(N);
  const homes = new Float32Array(N * 2);

  /** The eager dots: they reach for whatever file is near (a real drag or the ghost), rush in on a drop, slump if it leaves. */
  function paintField(ctx, { view, keep = [], clear = 0, cx, cy, time, dt, hover, tx, ty }) {
    const sinceGulp = time - look.gulp,
      sinceSlump = time - look.slump,
      gulping = sinceGulp < 1.1,
      slumping = sinceSlump < 1.4 && !gulping;
    const awake = Math.max(hover, gulping ? 1 - sinceGulp / 1.1 : 0, slumping ? 1 - sinceSlump / 1.4 : 0);
    if (awake <= 0.01) {
      ox.fill(0);
      oy.fill(0);
      vx.fill(0);
      vy.fill(0);
      return [];
    }
    const W = view.x1 - view.x0,
      H = view.y1 - view.y0,
      k = Math.min(1, dt * 60),
      calm = reducedMotion(),
      near = [];
    for (let i = 0; i < N; i++) {
      const hx = view.x0 + (fx[i] / 1000) * W,
        hy = view.y0 + (fy[i] / 1000) * H;
      homes[i * 2] = NaN;
      if (keep.some((b) => hx > b.x0 && hx < b.x1 && hy > b.y0 && hy < b.y1) || Math.hypot(hx - cx, hy - cy) < clear)
        continue; // never over text or the data
      const dx = tx - hx,
        dy = ty - hy,
        d = Math.hypot(dx, dy) || 1,
        close = Math.exp(-d / 420),
        phase = randomAt(31, i) * TAU;
      let gx = 0,
        gy = 0;
      if (gulping) {
        const u = Math.min(1, Math.max(0, (sinceGulp - (1 - close) * 0.25) / 0.5)),
          e = u * u;
        gx = (cx - hx) * e;
        gy = (cy - hy) * e;
      } else if (hover > 0.05) {
        // Reaching: further for dots near the file, with an eager shiver and little hops.
        const reach = Math.min(d * 0.42, 30 + 70 * close) * hover;
        gx = (dx / d) * reach + (calm ? 0 : Math.sin(time * 15 + phase) * 2.2 * hover);
        gy = (dy / d) * reach - (calm ? 0 : Math.abs(Math.sin(time * 8 + phase * 2)) * 6 * close * hover);
      } else if (slumping) gy = 10 * Math.sin((Math.min(1, sinceSlump / 0.5) * Math.PI) / 2);
      const stiff = 0.09 + 0.06 * randomAt(32, i);
      vx[i] += ((gx - ox[i]) * stiff - vx[i] * 0.22) * k;
      vy[i] += ((gy - oy[i]) * stiff - vy[i] * 0.22) * k;
      ox[i] += vx[i] * k;
      oy[i] += vy[i] * k;
      const x = hx + ox[i],
        y = hy + oy[i],
        stretch = Math.min(1, Math.hypot(vx[i], vy[i]) * 0.25 + hover * close * 0.6);
      homes[i * 2] = x;
      homes[i * 2 + 1] = y;
      const r = (2 + 1.4 * close + randomAt(33, i)) * (gulping ? Math.max(0, 1 - sinceGulp * 0.9) : 1),
        warm = Math.min(1, close * 1.6 * hover + (gulping ? 0.6 : 0));
      const alpha = Math.min(1, awake * (0.35 + 0.5 * close) * (slumping ? 1 - sinceSlump / 1.4 : 1));
      if (r <= 0.1 || alpha <= 0.01) continue;
      if (d < 260 && hover > 0.3 && !gulping) near.push([d, x, y, alpha]);
      // Eager dots are a quiet grey with a trace of the point's own hue (vermilion by day, blue on a dark page), and
      // take on its colour as they strain toward the file: saturation and lightness move, the hue never sweeps.
      ctx.strokeStyle = tone(
        pointColour.h + (randomAt(34, i) - 0.5) * 10,
        8 + (pointColour.s - 8) * warm,
        52 + (pointColour.l - 52) * warm,
        alpha,
      );
      ctx.lineCap = 'round';
      ctx.lineWidth = r * 2;
      let tx2 = vx[i] * 1.6 + (dx / d) * stretch * 5,
        ty2 = vy[i] * 1.6 + (dy / d) * stretch * 5;
      const tail = Math.hypot(tx2, ty2),
        cap = 4 + 8 * close;
      if (tail > cap) {
        tx2 *= cap / tail;
        ty2 *= cap / tail;
      }
      ctx.beginPath();
      ctx.moveTo(x - tx2, y - ty2);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    return near.sort((a, b) => a[0] - b[0]).slice(0, 9);
  }

  /** The ghost file card: paper, a folded corner, the file's name; tethered to the nearest dots that tug it. */
  function paintGhost(ctx, x, y, tilt, alpha, scale, tethers) {
    if (alpha <= 0.01) return;
    for (const [, dx, dy, a] of tethers) {
      ctx.strokeStyle = tone(brand().h, 60, 55, 0.25 * a * alpha);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(dx, dy);
      ctx.quadraticCurveTo((dx + x) / 2, (dy + y) / 2 + 8, x, y);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.scale(scale, scale);
    ctx.globalAlpha *= alpha;
    const w = 40,
      h = 50,
      f = 11;
    ctx.fillStyle = tone(30, 30, 30, 0.12);
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 3, -h / 2 + 5, w, h, 4);
    ctx.fill();
    ctx.fillStyle = tone(40, 35, 97);
    ctx.strokeStyle = tone(30, 15, 70);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h / 2 + 3);
    ctx.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + 3, -h / 2);
    ctx.lineTo(w / 2 - f, -h / 2);
    ctx.lineTo(w / 2, -h / 2 + f);
    ctx.lineTo(w / 2, h / 2 - 3);
    ctx.quadraticCurveTo(w / 2, h / 2, w / 2 - 3, h / 2);
    ctx.lineTo(-w / 2 + 3, h / 2);
    ctx.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = tone(30, 20, 88);
    ctx.beginPath();
    ctx.moveTo(w / 2 - f, -h / 2);
    ctx.lineTo(w / 2 - f, -h / 2 + f);
    ctx.lineTo(w / 2, -h / 2 + f);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // A few rows of tiny data marks, and the badge.
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 3; c++) {
        ctx.fillStyle = tone([10, 196, 42][c], 50, 60, 0.7);
        ctx.fillRect(-w / 2 + 6 + c * 9, -h / 2 + 14 + r * 6, 6 - randomAt(5, r * 3 + c) * 3, 2.2);
      }
    ctx.fillStyle = tone(brand().h, 72, 54);
    ctx.font = '600 9px ui-monospace, Menlo, monospace';
    ctx.fillText('CSV', -w / 2 + 6, h / 2 - 7);
    ctx.globalAlpha /= Math.max(alpha, 1e-3);
    ctx.restore();
    ctx.fillStyle = surface(240, 10, 36, 0.8 * alpha);
    ctx.textAlign = 'center';
    crispText(ctx, x, y + 40 * scale, 12, 500, () => ctx.fillText(aboutOf(ghost.name)?.title ?? ghost.name, 0, 0));
    ctx.textAlign = 'left';
  }

  /** Voice: the waveform drawn round the point, and (with no data) a radar spectrogram sweeping out to the room. */
  function paintVoice(ctx, { cx, cy, r, room, time, withData }) {
    const v = mic.snapshot().latest?.value;
    if (v?.bands) {
      history.push(v.bands.slice());
      if (history.length > HISTORY) history.shift();
    }
    if (!withData && history.length) {
      const sweepAt = time * 1.4,
        inner = r * 3.2,
        outer = room * 0.95,
        ring = (outer - inner) / BANDS;
      history.forEach((frame, f) => {
        const age = (history.length - 1 - f) / HISTORY,
          a = sweepAt - age * TAU * 0.8;
        frame.forEach((level, b) => {
          if (level < 0.08) return;
          ctx.strokeStyle = tone(186 + 96 * (b / BANDS), 52, 58, level * (1 - age) * 0.85);
          ctx.lineWidth = ring * 0.7;
          ctx.beginPath();
          ctx.arc(cx, cy, inner + ring * (b + 0.5), a - 0.03, a + 0.03);
          ctx.stroke();
        });
      });
    }
    if (v?.waveform) {
      const w = v.waveform,
        base = r * 2.3;
      ctx.strokeStyle = tone(brand().h, 70, 54, 0.75);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      w.forEach((s, i) => {
        const a = TOP + (i / w.length) * TAU,
          rr = base + s * r * 1.6;
        const x = cx + Math.cos(a) * rr,
          y = cy + Math.sin(a) * rr;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();
    }
  }

  /**
   * Hover by intent, not by every pixel crossed: a new element takes over only once the pointer has stayed on it
   * a moment, longer when the pointer is moving fast; leaving to empty space waits a little too. So a sweep across a
   * dense form does not flicker through every element under it.
   */
  const intent = { shown: -1, pending: -1, since: 0, x: 0, y: 0, speed: 0 };
  function intend(hit, x, y, time, dt) {
    const step = Math.hypot(x - intent.x, y - intent.y) / Math.max(dt, 1 / 240);
    intent.speed += (step - intent.speed) * Math.min(1, dt * 12);
    intent.x = x;
    intent.y = y;
    if (hit === intent.shown) {
      intent.pending = hit;
      return intent.shown;
    }
    if (hit !== intent.pending) {
      intent.pending = hit;
      intent.since = time;
    }
    const wait = hit < 0 ? 0.14 : intent.speed > 900 ? 0.32 : intent.speed > 300 ? 0.14 : 0.05;
    if (time - intent.since >= wait) intent.shown = hit;
    return intent.shown;
  }
  /** Morph from the current model to `next`: each old element sends a seed to its new home, by identity. */
  function morphTo(next) {
    const before = model;
    // Pair elements by identity; fall back to the first element of the same tag.
    const byKey = new Map(before.items.map((it) => [it.key, it])),
      byTag = new Map();
    for (const it of before.items) if (!byTag.has(it.tag)) byTag.set(it.tag, it);
    // Every old element sends a seed to its new home (by identity, else the first of its tag), and every new
    // element without a source receives one from its tag: many petals can pour into one band, and back.
    const nextByKey = new Map(next.items.map((it) => [it.key, it])),
      nextByTag = new Map();
    for (const it of next.items) if (it.kind !== 'curve' && !nextByTag.has(it.tag)) nextByTag.set(it.tag, it);
    const pairs = [];
    for (const was of before.items) {
      if (was.kind === 'curve') continue;
      const to = nextByKey.get(was.key) ?? nextByTag.get(was.tag);
      if (to) pairs.push([anchorOf(was), anchorOf(to), to]);
    }
    for (const it of next.items) {
      if (it.kind === 'curve' || byKey.has(it.key)) continue;
      const was = byTag.get(it.tag);
      if (was) pairs.push([anchorOf(was), anchorOf(it), it]);
    }
    morph = { from: before, at: clock, pairs };
    model = next;
    focus = null;
    hoverItem = -1;
    intent.shown = intent.pending = -1; // element indices change with the model
    onView(model);
  }
  const api = {
    /** Start the pointer, drag and file sources while the chapter is on stage; stop them after. */
    async enter() {
      if (active) return;
      active = true;
      void bundledSample(SAMPLES[0]).catch(() => {}); // prepare membership and measured-pair files together
      for (const s of [pointer, drag, file, incoming]) await s.start();
    },
    leave() {
      if (!active) return;
      active = false;
      latestLoad.cancel();
      wanted = null;
      if (!model) {
        ghost.state = 'waiting';
        ghost.pending = null;
      }
      for (const s of [pointer, drag, file, level, loudness, mic]) s.stop();
      listening = false;
    },
    get listening() {
      return listening;
    },
    get form() {
      return model?.view ?? null;
    },
    /** The file the view is drawn from (its name), for a source credit. */
    get source() {
      return model ? (table?.name ?? null) : null;
    },
    get hasMeasuredPairs() {
      return Boolean(table?.pairWeights);
    },
    get views() {
      return table?.views ?? [];
    },
    debug: (t = player.time) => ({
      binding: dragBinding.snapshot(),
      hover: p.hover.sample(t),
      view: model?.view,
      shape: table?.shape,
      pairMeasure: table?.pairWeights?.measure ?? null,
      items: model?.items.length,
      hoverItem,
      focus,
      ghost: ghost.state,
      mic: mic.snapshot().status,
    }),
    /** Read a chosen file (from the picker) through the same source a dropped file uses. CSV only. */
    async open(chosen) {
      if (!isCSV(chosen)) {
        onNotice('Only CSV files for now.');
        return;
      }
      if (!active) await this.enter();
      try {
        onNotice('');
        ghost.state = 'gone';
        ghost.pending = null;
        wanted = null;
        await latestLoad.run(
          () => readInputFile(chosen, { format: 'csv', maxRows: MAX_ROWS, maxBytes: 2_000_000 }),
          (value) => incoming.push(value),
        );
      } catch (e) {
        onNotice(`Couldn't read ${chosen.name}: ${e.code ?? e.message}`);
      }
    },
    /** The next sample: its ghost card flies from `from` (stage units, e.g. the menu) into the point, then lands. */
    async sample(from = null) {
      if (!active) await this.enter();
      const entry = SAMPLES[sampleIndex++ % SAMPLES.length],
        [name] = entry;
      wanted = name;
      ghost.state = 'gone';
      ghost.pending = null;
      try {
        const value = await latestLoad.run(
          () => bundledSample(entry),
          (parsed) => {
            onNotice('');
            wanted = null;
            ghost.name = name;
            ghost.pending = parsed;
            ghost.state = 'flying';
            ghost.flyFrom =
              from ?? (ghost.x || ghost.y ? { x: ghost.x, y: ghost.y } : { x: lastAt.x + 260, y: lastAt.y - 160 });
            ghost.flyAt = clock;
          },
        );
        return value ? name : null;
      } catch (error) {
        wanted = null;
        onNotice(`Couldn't load ${name}: ${error.code ?? error.message}`);
        return null;
      }
    },
    /** Turn the current data to its next view (a morph, every element keeping its identity). */
    nextView() {
      if (!table) return null;
      viewIndex = (viewIndex + 1) % table.views.length;
      morphTo(layout(table, table.views[viewIndex]));
      return model.view;
    },
    /** Another season of the same show (1–10, or 'all'): the view stays, and every element morphs to its new place. */
    async season(n) {
      // The last season asked for wins: a click while another is still loading replaces it.
      const name = seasonFile(n);
      wanted = name;
      ghost.state = 'gone';
      ghost.pending = null;
      try {
        const value = await latestLoad.run(
          () => bundledSample([name, DATA(name)]),
          (parsed) => {
            onNotice('');
            wanted = null;
            incoming.push({ ...parsed, keepView: true });
          },
        );
        return value ? name : null;
      } catch (error) {
        wanted = null;
        throw error;
      }
    },
    /** A season's file: 'idle' (not asked for yet), 'loading', 'ready' or 'failed'; and whether it was asked for. */
    seasonState(n) {
      const name = seasonFile(n);
      return { load: bundleLoads.get(name) ?? 'idle', pending: wanted === name };
    },
    /**
     * Fetch the other seasons one at a time in idle moments, nearest to `from` first, so a click usually finds its
     * season ready. Each file is about 2 KB; nothing loads until the reader is looking at the show.
     */
    async prefetchSeasons(from = 1) {
      if (prefetching) return;
      prefetching = true;
      const order = Array.from({ length: 10 }, (_, i) => i + 1).sort((a, b) => Math.abs(a - from) - Math.abs(b - from));
      for (const n of [...order, 'all']) {
        if (!active) break;
        await idle();
        await bundledSample([seasonFile(n), DATA(seasonFile(n))]).catch(() => {});
      }
      prefetching = false;
    },
    /** This frame's view labels (stage units), for the page to set as text: { x, y, text, size, weight, align, angle, opacity, inside }. */
    get labels() {
      return pageLabels;
    },
    /** The element under the pointer and where the pointer is (stage units), for a page card; else null. */
    get hovered() {
      return hovered;
    },
    /** The look of the membership and flow views: 'silk' (light strands) or 'classic' (flat painted forms). */
    get skin() {
      return skin;
    },
    setSkin(next) {
      if (next !== 'silk' && next !== 'classic') return skin;
      skin = next;
      try {
        localStorage.setItem(SKIN_KEY, skin);
      } catch {
        /* A private window keeps the choice for this visit only. */
      }
      return skin;
    },
    /** Show one of the data's views by name, morphing every element to its place there. */
    showView(name) {
      if (!table || !table.views.includes(name) || table.views[viewIndex] === name) return model?.view ?? null;
      viewIndex = table.views.indexOf(name);
      morphTo(layout(table, name));
      return model.view;
    },
    /** What the page should caption the view with: a readable title, what is drawn, the view's place, the season. */
    get caption() {
      if (!model || !table) return null;
      const about = !table.name.startsWith('friends-') || table.pairWeights ? aboutOf(table.name) : null;
      return Object.freeze({
        title: about?.title ?? table.name,
        what:
          table.pairWeights && model.view === 'chord'
            ? 'consecutive speaker turns, either direction'
            : table.pairWeights && model.view === 'onion'
              ? 'speaking episodes; inner chords count consecutive turns'
              : (about?.what ?? model.title.split(' · ').slice(1).join(' · ')),
        view: model.view,
        views: table.views,
        season: about?.season ?? null,
      });
    },
    /** Start or stop listening. Must be called from a click: the browser asks for permission. */
    async listen() {
      if (listening) {
        for (const s of [level, loudness, mic]) s.stop();
        listening = false;
        history.length = 0;
        return false;
      }
      try {
        await mic.start();
        await loudness.start();
        await level.start();
        listening = true;
      } catch (error) {
        onNotice(`Microphone unavailable: ${error.code ?? error.message}`);
        listening = false;
      }
      return listening;
    },
    /** Let the ghost go by itself (the reader scrolled on without dropping it): from where it is, or beside the point. */
    release() {
      if (!active || model || (ghost.state !== 'held' && ghost.state !== 'waiting')) return false;
      if (ghost.state === 'waiting') Object.assign(ghost, { x: lastAt.x + 220, y: lastAt.y - 140, vx: 0, vy: 0 });
      Object.assign(ghost, { state: 'dropping', flyFrom: { x: ghost.x, y: ghost.y }, flyAt: clock });
      return true;
    },
    /** A click on the stage (stage units): let the ghost go, turn the view (on the point), or focus. */
    click(x, y, at, r) {
      if (!active) return false;
      // A press before the ghost has caught up with the pointer still lets it go, from where the press was.
      if (ghost.state === 'waiting' && !model) Object.assign(ghost, { state: 'held', x, y, vx: 0, vy: 0 });
      if (ghost.state === 'held') {
        ghost.state = 'dropping';
        ghost.flyFrom = { x: ghost.x, y: ghost.y };
        ghost.flyAt = clock;
        return true;
      }
      if (Math.hypot(x - at.x, y - at.y) < r * 2.4 && table) {
        this.nextView();
        return true;
      }
      if (hoverItem >= 0 && model) {
        const tag = model.items[hoverItem].tag;
        focus = focus === tag ? null : tag;
        return true;
      }
      if (focus) {
        focus = null;
        return true;
      }
      return false;
    },
    /**
     * Paint the live point at `at` (stage units) with rest radius `r`, the eager field across `view`, and the
     * data within `room` (the radius the page leaves clear). `retract` in [0, 1] folds it all into the point.
     */
    paint(ctx, { at, r, time, dt, view, room, keep, alpha = 1, retract = 0, brandMix = 1 }) {
      // The point: the Earth core's red where it takes over, turning to the brand colour by `brandMix` (0–1).
      const CORE = { h: 10, s: 72, l: 56 },
        B = brand(),
        dh = ((((B.h - CORE.h) % 360) + 540) % 360) - 180;
      pointColour = {
        h: CORE.h + dh * brandMix,
        s: CORE.s + (B.s - CORE.s) * brandMix,
        l: CORE.l + (B.l - CORE.l) * brandMix,
      };
      pageLabels.length = 0;
      clock = time;
      lastAt = at;
      if (alpha <= 0) return;
      const calm = reducedMotion(),
        k = Math.min(1, dt * 60);
      const on = active && p.on.sample(time) > 0.5,
        px = p.x.sample(time),
        py = p.y.sample(time);
      // The ghost is offered once the chapter is open and nothing has been dropped yet.
      if (ghost.state === 'waiting' && active && on && !model) {
        ghost.state = 'held';
        ghost.x = px;
        ghost.y = py;
      }
      const realDrag = p.hover.sample(time) > 0.5,
        ghostNear = ghost.state === 'held' && !realDrag;
      // Springs on top of the live values, so input reads as weight, not jitter.
      const tx = on ? Math.max(-1, Math.min(1, (px - at.x) / 400)) * 22 : 0,
        ty = on ? Math.max(-1, Math.min(1, (py - at.y) / 300)) * 16 : 0,
        L = look.lean;
      L.vx += ((tx - L.x) * 0.09 - L.vx * 0.2) * k;
      L.vy += ((ty - L.y) * 0.09 - L.vy * 0.2) * k;
      L.x += L.vx * k;
      L.y += L.vy * k;
      const hoverNow = realDrag ? 1 : ghostNear ? 0.75 : 0;
      if (hoverNow > 0.5) look.lastHover = time;
      else if (look.hover > 0.5 && time - look.gulp > 0.2) look.slump = time;
      look.hv += ((hoverNow - look.hover) * 0.12 - look.hv * 0.22) * k;
      look.hover += look.hv * k;
      look.voice += (p.voice.sample(time) - look.voice) * Math.min(1, dt * 18);
      const bands = listening ? mic.snapshot().latest?.value?.bands : null;
      for (let b = 0; b < BANDS; b++) look.bands[b] += ((bands?.[b] ?? 0) - look.bands[b]) * Math.min(1, dt * 14);
      if (look.voice > 0.18 && !look.loud) look.ripples.push(time);
      look.loud = look.voice > 0.12 ? look.loud || look.voice > 0.18 : false;
      look.ripples = look.ripples.filter((t) => time - t < 1.4);
      const hover = Math.min(1, Math.max(0, look.hover)),
        voice = Math.min(1, Math.max(0, look.voice));
      // The file the dots reach for: a real drag, else the ghost.
      const fileX = realDrag ? p.hx.sample(time) : ghost.x,
        fileY = realDrag ? p.hy.sample(time) : ghost.y;
      const cx = at.x + L.x + (fileX - at.x) * 0.2 * hover,
        cy = at.y + L.y + (fileY - at.y) * 0.2 * hover;

      // The ghost follows the cursor a beat behind, pulled a little toward the point, and swings as it moves.
      if (ghost.state === 'held') {
        const pull = 0.12 + 0.1 * Math.sin(time * 3),
          gx = px + 18 + (cx - px) * pull,
          gy = py + 26 + (cy - py) * pull;
        ghost.vx += ((gx - ghost.x) * 0.14 - ghost.vx * 0.3) * k;
        ghost.vy += ((gy - ghost.y) * 0.14 - ghost.vy * 0.3) * k;
        ghost.x += ghost.vx * k;
        ghost.y += ghost.vy * k;
        ghost.vt += ((-ghost.vx * 0.02 + Math.sin(time * 2.3) * 0.03 - ghost.tilt) * 0.2 - ghost.vt * 0.25) * k;
        ghost.tilt += ghost.vt * k;
      }
      // Flying in (a sample from the menu, or a let-go ghost): an arc into the point, shrinking, then the gulp.
      let flight = null;
      if (ghost.state === 'flying' || ghost.state === 'dropping') {
        const u = Math.min(1, (time - ghost.flyAt) / (ghost.state === 'flying' ? 0.9 : 0.6)),
          e = smooth01(u),
          lift = Math.sin(Math.PI * e) * 70;
        flight = {
          x: ghost.flyFrom.x + (cx - ghost.flyFrom.x) * e,
          y: ghost.flyFrom.y + (cy - ghost.flyFrom.y) * e - lift,
          s: 1 - 0.8 * e,
          tilt: (1 - e) * 0.3 + e * 1.4,
        };
        if (u >= 1) {
          if (ghost.state === 'dropping' && !ghost.pending) ghost.pending = SAMPLES[0];
          const pending = ghost.pending;
          ghost.pending = null;
          ghost.state = 'gone';
          look.lastHover = time;
          if (Array.isArray(pending)) {
            sampleIndex = Math.max(sampleIndex, 1);
            latestLoad
              .run(
                () => bundledSample(pending),
                (value) => {
                  onNotice('');
                  incoming.push(value);
                },
              )
              .catch((e) => onNotice(`Couldn't load ${pending[0]}: ${e.code ?? e.message}`));
          } else if (pending) incoming.push(pending);
        }
      }

      // New rows: the dots rush in first (a drop or a ghost landing), then the view grows.
      const list = rows.rows;
      if (list !== shown && swapped) {
        shown = list; // a season swap: the morph carries the change, nothing regrows
        swapped = false;
      } else if (list !== shown) {
        shown = list;
        const dropped = time - look.lastHover < 0.8;
        if (dropped) {
          look.gulp = time;
          look.slump = -9;
        }
        bornAt = time + (dropped ? 0.55 : 0);
        hoverItem = -1;
        intent.shown = intent.pending = -1; // element indices change with the model
        focus = null;
        morph = null;
      }
      ctx.save();
      ctx.globalAlpha = alpha;
      const tethers = paintField(ctx, {
        view,
        keep,
        clear: model && list.length && time - look.gulp > 1.1 ? room * 1.12 : 0,
        cx,
        cy,
        time,
        dt,
        hover,
        tx: fileX,
        ty: fileY,
      });
      if (ghost.state === 'held' && !realDrag) paintGhost(ctx, ghost.x, ghost.y, ghost.tilt, 1, 1, tethers);
      if (flight)
        paintGhost(ctx, flight.x, flight.y, flight.tilt, 1 - Math.max(0, (time - ghost.flyAt - 0.5) * 2), flight.s, []);
      if (listening) paintVoice(ctx, { cx, cy, r, room, time, withData: !!(model && list.length) });

      // The view, growing out of the point on staggered springs, folding back as the chapter ends.
      if (model && list.length) {
        const R = room,
          out = 1 - retract,
          n = model.items.length,
          morphing = morph && time - morph.at < 1.6;
        const age = morphing ? time - morph.at - 0.35 : time - bornAt;
        const ang = Math.atan2(py - cy, px - cx),
          dist = Math.hypot(px - cx, py - cy) / R;
        const grow = (it, i) =>
          (calm
            ? out
            : Math.max(
                0,
                settle.sample(
                  Math.max(0, age - (i < 0 ? 1 : sweep(Math.round(it.order * (n - 1)), n)) * (morphing ? 0.7 : 1.3)),
                ),
              )) * out;
        const lift = (it, i) => {
          const band = look.bands[Math.min(BANDS - 1, Math.floor(it.band * BANDS))] ?? 0,
            a = it.a ?? (it.a0 !== undefined ? (it.a0 + it.a1) / 2 : it.angles ? TOP : (it.to?.[0] ?? 0));
          const near =
            on && dist < 1.25 ? Math.exp(-(Math.atan2(Math.sin(a - ang), Math.cos(a - ang)) ** 2 / 0.05)) * 0.06 : 0;
          return (calm ? 0 : band * 0.22 * (0.4 + voice)) + near + (i === hoverItem ? 0.05 : 0);
        };
        // A morph: the old view folds away while a seed per element flies from where it was to where it will be.
        if (morphing) {
          const u = (time - morph.at) / 1.6,
            fade = 1 - smooth01(u / 0.3);
          if (fade > 0)
            paintForm(ctx, morph.from, {
              cx,
              cy,
              R,
              grow: () => fade,
              lift: () => 0,
              alpha: fade * out,
              labelsAlpha: 0,
              silk: skin === 'silk' ? silkFor(silkFrom, morph.from, ctx, { time, cx, cy, R, light: on ? [px, py] : null }) : null,
            });
          morph.pairs.forEach(([[a0, r0], [a1, r1], it], j) => {
            const e = smooth01((u - 0.05 - (j % 23) * 0.006) / 0.55);
            if (e <= 0 || e >= 1) return;
            let da = a1 - a0;
            da = Math.atan2(Math.sin(da), Math.cos(da));
            const a = a0 + da * e,
              rr = r0 + (r1 - r0) * e + Math.sin(Math.PI * e) * 0.08,
              x = cx + Math.cos(a) * rr * R,
              y = cy + Math.sin(a) * rr * R;
            ctx.fillStyle = tone(it.h, it.s, it.l, 0.85 * Math.sin(Math.PI * e));
            ctx.beginPath();
            ctx.arc(x, y, 2.4, 0, TAU);
            ctx.fill();
          });
        }
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1 + voice * 0.04, 1 + voice * 0.04);
        ctx.translate(-cx, -cy);
        paths = paintForm(ctx, model, {
          cx,
          cy,
          R,
          grow,
          lift,
          hover: hoverItem,
          focus,
          alpha: out,
          labelsAlpha: Math.min(1, Math.max(0, age - 0.6)) * out,
          labelSink: pageLabels,
          silk: skin === 'silk' ? silkFor(silk, model, ctx, { time, cx, cy, R, light: on ? [px, py] : null }) : null,
        });
        ctx.restore();
        let hit = -1;
        if (on && out > 0.9 && age > 0.8 && ghost.state !== 'held') {
          const m = ctx.getTransform(),
            sx = m.a * px + m.c * py + m.e,
            sy = m.b * px + m.d * py + m.f;
          for (let i = paths.length - 1; i >= 0; i--) {
            if (!paths[i]) continue;
            const it = model.items[i],
              inside =
                it.kind === 'curve' ? ctx.isPointInStroke(paths[i], sx, sy) : ctx.isPointInPath(paths[i], sx, sy);
            if (inside) {
              hit = i;
              break;
            }
          }
        }
        hoverItem = intend(hit, px, py, time, dt);
        // The read-out of the hovered element (the title and seasons are page text: see `caption`).
        // The hovered element's card is page text (see `hovered`), placed by the pointer.
        hovered =
          hoverItem >= 0
            ? Object.freeze({
                item: model.items[hoverItem],
                x: Math.min(view.x1, px),
                y: Math.min(view.y1, py),
              })
            : null;
      } else hovered = null;
      // A file in the air: a catcher ring opens round the point, a dot per item it carries.
      if (hover > 0.01) {
        const ringR = r * (2.6 + 0.4 * Math.sin(time * 5)),
          items = Math.max(1, Math.min(12, Math.round(realDrag ? p.items.sample(time) : 1)));
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = tone(brand().h, 70, 52, 0.45 * hover);
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, TAU);
        ctx.stroke();
        for (let i = 0; i < items; i++) {
          const a = (i / items) * TAU + time * 1.2;
          ctx.fillStyle = tone(brand().h, 70, 56, 0.8 * hover);
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * ringR, cy + Math.sin(a) * ringR, 3.5, 0, TAU);
          ctx.fill();
        }
      }
      for (const t of look.ripples) {
        const a = (time - t) / 1.4;
        ctx.strokeStyle = tone(brand().h, 70, 56, 0.5 * (1 - a));
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r * (1 + voice * 1.2) * (1 + a * 3.5), 0, TAU);
        ctx.stroke();
      }
      // The point: soft clay like the 3D core it replaces; it swells for a file, gulps on a drop, pulses with voice.
      const gulp = time - look.gulp < 1.2 ? Math.sin(Math.min(1, (time - look.gulp - 0.35) / 0.4) * Math.PI) : 0;
      const radius =
        r * (1 + 0.025 * Math.sin(time * 2.1)) * (1 + 1.1 * hover) * (1 + voice * 1.4) * (1 + 0.5 * Math.max(0, gulp));
      const stretch =
        Math.min(0.18, Math.hypot(L.vx, L.vy) * 0.02 + Math.hypot(L.x, L.y) * 0.004) + (gulp < 0 ? -gulp * 0.12 : 0);
      // With data on stage there is no point: it opens into the view. As the chapter closes, one of the view's own
      // seeds on the rim travels in and becomes the red point the page ends on.
      const withData = model && list.length,
        away = withData ? smooth01((time - bornAt) / 0.6) * (1 - smooth01(retract * 4)) : 0;
      let px0 = cx,
        py0 = cy,
        rad = radius * (1 - away),
        col = { ...pointColour }, // the core's red handing over to the brand colour (see paint's `brandMix`)
        clay = 1;
      if (withData && retract > 0) {
        const seed = model.items.find((it) => it.kind === 'dot') ?? model.items[0],
          [sa, sr] = anchorOf(seed),
          e = smooth01(retract),
          f = (u, v) => u + (v - u) * e;
        px0 = f(cx + Math.cos(sa) * sr * room, cx);
        py0 = f(cy + Math.sin(sa) * sr * room, cy);
        rad = f((seed.size ?? 0.015) * room, radius);
        col = {
          h: f(seed.h, seed.h + ((((pointColour.h - seed.h) % 360) + 540) % 360) - 180),
          s: f(seed.s, pointColour.s),
          l: f(seed.l, pointColour.l),
        }; // to the point's colour, the short way round
        clay = e;
      }
      if (rad > 0.3) {
        ctx.save();
        ctx.translate(px0, py0);
        ctx.rotate(Math.atan2(L.y, L.x));
        ctx.scale(1 + stretch * clay, 1 - stretch * 0.7 * clay);
        const g = ctx.createRadialGradient(-rad * 0.35, -rad * 0.4, rad * 0.1, 0, 0, rad);
        g.addColorStop(0, tone(col.h + 4 * clay, col.s + 8 * clay, col.l + 12 * clay));
        g.addColorStop(0.55, tone(col.h, col.s, col.l));
        g.addColorStop(1, tone(col.h - 2 * clay, col.s - 12 * clay, col.l - 12 * clay));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, rad, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    },
  };
  return api;
}
