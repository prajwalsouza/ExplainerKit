import { assert, number, options, text } from '../core/validate.js';
import { chartData } from './chart-data.js';
import { chartScene, chartTypes } from './chart-scene.js';
import { chartTheme } from './chart-themes.js';

const labels = {
  radial: 'Radial',
  chord: 'Chord',
  sunburst: 'Sunburst',
  arc: 'Arc',
  bar: 'Bars',
  silk: 'Silk',
  pearl: 'Pearl',
  signal: 'Signal',
  paper: 'Paper',
  midnight: 'Midnight',
};
const themeNames = ['silk', 'pearl', 'signal', 'midnight', 'paper'];
const MAX_FRAMES = 1000;

/** @param {'radial' | 'chord' | 'sunburst' | 'arc' | 'bar'} type */
function validateType(type) {
  assert(chartTypes.includes(type), 'INVALID_OPTIONS', 'Choose radial, chord, sunburst, arc or bar.');
  return type;
}

function frameEntry(list, index) {
  const descriptor = Object.getOwnPropertyDescriptor(list, index);
  assert(descriptor && 'value' in descriptor, 'INVALID_DATA', 'Chart frames must be dense.');
  return descriptor.value;
}

/** Validate every frame up front against the base rows, so playback never meets bad data. */
function prepareFrames(base, frames) {
  if (frames === undefined) return null;
  assert(Array.isArray(frames) && frames.length >= 1, 'INVALID_DATA', 'Frames must be a nonempty array.');
  assert(frames.length <= MAX_FRAMES, 'RESOURCE_LIMIT', `Use at most ${MAX_FRAMES} chart frames.`);
  return Array.from({ length: frames.length }, (_, index) => {
    const frame = frameEntry(frames, index);
    options(frame, ['label', 'rows', 'links'], 'chart frame');
    const label = text(frame.label ?? String(index + 1), 'frame label', 64);
    const rows = frame.rows ?? [];
    assert(Array.isArray(rows) && rows.length <= 128, 'INVALID_DATA', 'A frame names at most 128 rows.');
    const values = new Map();
    for (let i = 0; i < rows.length; i++) {
      const row = frameEntry(rows, i);
      options(row, ['id', 'value', 'heat'], 'frame row');
      const id = text(row.id, 'frame row ID', 128);
      assert(base.byId.has(id), 'INVALID_DATA', 'Frame rows must name a chart row.');
      values.set(id, row);
    }
    const merged = base.data.map((row) => {
      const next = values.get(row.id);
      const entry = { id: row.id, value: next ? next.value : row.value };
      if (row.label !== undefined) entry.label = row.label;
      if (next?.heat !== undefined) entry.heat = next.heat;
      return entry;
    });
    return { label, model: chartData(merged, frame.links ?? [], true) };
  });
}

/**
 * Mount a light-strand chart with chart-type, theme, focus, motion and (optionally) frame controls.
 * @param {HTMLElement} container
 * @param {ReadonlyArray<{id: string, value: number, label?: string, highlight?: boolean, group?: string, heat?: number}>} rows
 * @param {{links?: ReadonlyArray<{from: string, to: string, value?: number, heat?: number}>,
 *          theme?: Parameters<typeof chartTheme>[0], type?: 'radial'|'chord'|'sunburst'|'arc'|'bar', motion?: boolean,
 *          label?: string, valueLabel?: string, linkLabel?: string,
 *          frames?: ReadonlyArray<{label?: string, rows?: ReadonlyArray<{id: string, value: number, heat?: number}>,
 *                                  links?: ReadonlyArray<{from: string, to: string, value?: number, heat?: number}>}>,
 *          frame?: number, frameDuration?: number, frameLabel?: string}} [spec]
 */
export async function mountDataChart(container, rows, spec = {}) {
  options(
    spec,
    [
      'links',
      'theme',
      'type',
      'motion',
      'label',
      'valueLabel',
      'linkLabel',
      'frames',
      'frame',
      'frameDuration',
      'frameLabel',
    ],
    'data chart',
  );
  assert(
    container?.ownerDocument && typeof container.append === 'function',
    'INVALID_CONTAINER',
    'Mount into a DOM element.',
  );
  const base = chartData(rows, spec.links ?? [], true);
  const frames = prepareFrames(base, spec.frames);
  let frameIndex = frames ? Math.round(number(spec.frame ?? 0, 'chart frame', 0, frames.length - 1)) : 0;
  const frameDuration = number(spec.frameDuration ?? 0.9, 'frame duration', 0.1, 60);
  const frameLabel = text(spec.frameLabel ?? 'Frame', 'frame control label', 64);
  let model = frames ? frames[frameIndex].model : base;
  if (frames)
    model = {
      ...model,
      data: model.data.map((row, i) => ({ ...row, highlight: base.data[i].highlight, group: base.data[i].group })),
    };
  model.byId = new Map(model.data.map((row) => [row.id, row]));
  let type = validateType(spec.type ?? 'radial');
  let theme = spec.theme ?? 'silk';
  let palette = chartTheme(theme);
  const motion = spec.motion ?? true;
  assert(typeof motion === 'boolean', 'INVALID_OPTIONS', 'Chart motion must be boolean.');
  const label = text(spec.label ?? 'Interactive data chart', 'chart label', 300);
  const valueLabel = text(spec.valueLabel ?? 'Value', 'chart value label', 64);
  const linkLabel = text(spec.linkLabel ?? 'Link value', 'chart link label', 64);
  /** @type {any} */
  let player;
  const chart = chartScene(model, {
    label,
    motion,
    type,
    theme: palette,
    clock: { now: () => player?.time ?? 0, live: () => Boolean(player && !player.reducedMotion) },
  });
  const doc = container.ownerDocument;
  const win = doc.defaultView;
  const host = doc.createElement('section');
  host.className = 'ek-data-chart';
  host.setAttribute('aria-label', label);
  Object.assign(host.style, { borderRadius: '.6rem', overflow: 'hidden' });

  const bar = doc.createElement('div');
  Object.assign(bar.style, {
    display: 'flex',
    gap: '.5rem .9rem',
    flexWrap: 'wrap',
    alignItems: 'center',
    padding: '.7rem .85rem',
    fontSize: '.85rem',
  });
  /** Segmented buttons for a set of values. */
  function pills(name, values) {
    const group = doc.createElement('div');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', name);
    Object.assign(group.style, { display: 'flex', gap: '.25rem', flexWrap: 'wrap' });
    const buttons = new Map();
    for (const value of values) {
      const button = doc.createElement('button');
      button.type = 'button';
      button.textContent = labels[value];
      button.dataset.value = value;
      group.append(button);
      buttons.set(value, button);
    }
    return { group, buttons };
  }
  const typePills = pills('Chart type', chartTypes);
  const themePills = pills('Chart theme', themeNames);
  const focusWrap = doc.createElement('label');
  Object.assign(focusWrap.style, { display: 'flex', gap: '.4rem', alignItems: 'center' });
  focusWrap.append('Focus');
  const focusSelect = doc.createElement('select');
  focusSelect.setAttribute('aria-label', 'Focus');
  for (const [value, name] of [['', 'All'], ...base.data.map((row, i) => [String(i), row.label ?? row.id])]) {
    const option = doc.createElement('option');
    option.value = value;
    option.textContent = name;
    focusSelect.append(option);
  }
  focusWrap.append(focusSelect);
  const pause = doc.createElement('button');
  pause.type = 'button';
  bar.append(typePills.group, themePills.group, focusWrap, pause);

  // Frames: a play button, a scrubber and the current frame's label.
  const timeline = doc.createElement('div');
  const play = doc.createElement('button');
  const scrub = doc.createElement('input');
  const stamp = doc.createElement('output');
  if (frames) {
    Object.assign(timeline.style, {
      display: 'flex',
      gap: '.7rem',
      alignItems: 'center',
      padding: '0 .85rem .6rem',
      fontSize: '.85rem',
    });
    play.type = 'button';
    scrub.type = 'range';
    scrub.min = '0';
    scrub.max = String(frames.length - 1);
    scrub.step = '1';
    scrub.setAttribute('aria-label', frameLabel);
    Object.assign(scrub.style, { flex: '1', minWidth: '8rem' });
    Object.assign(stamp.style, { minWidth: '4.5rem', fontVariantNumeric: 'tabular-nums', textAlign: 'right' });
    timeline.append(play, scrub, stamp);
  }

  const stage = doc.createElement('div');
  stage.tabIndex = 0;
  stage.setAttribute('role', 'img');
  stage.setAttribute('aria-label', label + '. Arrow keys move the focus; Escape clears it.');
  Object.assign(stage.style, { touchAction: 'pan-y', outline: 'none' });
  const info = doc.createElement('div');
  Object.assign(info.style, { padding: '.6rem .85rem .8rem', minHeight: '2.8rem', fontSize: '.9rem' });
  info.setAttribute('aria-live', 'polite');
  const details = doc.createElement('p');
  Object.assign(details.style, { margin: '0', color: 'inherit' });
  const partners = doc.createElement('p');
  Object.assign(partners.style, { margin: '.2rem 0 0', color: 'inherit', opacity: '0.75' });
  info.append(details, partners);
  host.append(bar, stage, ...(frames ? [timeline] : []), info);
  container.append(host);
  try {
    player = await chart.drawing.mount(stage, {
      pixelRatio: Math.min(2, Math.max(1.5, win?.devicePixelRatio || 1)),
    });
  } catch (error) {
    host.remove();
    throw error;
  }

  const format = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
  const remove = [];
  /** @type {string | null} */
  let hover = null;
  /** @type {number | null} */
  let hoverLink = null;
  /** @type {string | null} */
  let focus = null;
  let paused = false;
  let playing = false;
  let timer = null;
  const current = () => model;

  function related(id) {
    const out = [];
    for (const l of chart.links)
      if (l.value > 0 && (l.source.id === id || l.target.id === id)) {
        const other = l.source.id === id ? l.target : l.source;
        out.push([other.label ?? other.id, l.value]);
      }
    return out.sort((a, b) => b[1] - a[1]);
  }

  function updateSelection() {
    const focusRow = focus === null ? null : base.byId.get(focus);
    focusSelect.value = focusRow ? String(focusRow.index) : '';
    chart.setSelection(hover, focus);
    const id = hover ?? focus;
    if (id === null && hoverLink !== null) {
      const l = chart.links[hoverLink];
      details.textContent =
        (l.source.label ?? l.source.id) +
        ' and ' +
        (l.target.label ?? l.target.id) +
        ' · ' +
        linkLabel +
        ' ' +
        format.format(l.value);
      partners.textContent = '';
      return;
    }
    if (id === null) {
      details.textContent = valueLabel + '. Point at a strand or bundle, drag the ring to turn it, or choose a view.';
      partners.textContent = '';
      return;
    }
    const row = current().data[base.byId.get(id).index];
    details.textContent = (row.label ?? row.id) + ' · ' + valueLabel + ' ' + format.format(row.value);
    const pairs = related(id)
      .slice(0, 3)
      .map(([name, value]) => name + ' ' + format.format(value));
    partners.textContent = pairs.length ? linkLabel + ' · ' + pairs.join('  /  ') : '';
  }

  function styleButton(button, active) {
    Object.assign(button.style, {
      font: 'inherit',
      minHeight: '2rem',
      padding: '.2rem .75rem',
      borderRadius: '999px',
      cursor: button.disabled ? 'default' : 'pointer',
      background: active ? palette.text : 'transparent',
      color: active ? palette.background : palette.text,
      border: '1px solid ' + (active ? palette.text : palette.grid),
      opacity: button.disabled ? '0.5' : '1',
    });
    button.setAttribute('aria-pressed', String(active));
  }

  function applyAppearance() {
    host.style.background = palette.background;
    host.style.color = palette.text;
    host.style.colorScheme = theme === 'paper' || theme === 'pearl' ? 'light' : 'dark';
    for (const [value, button] of typePills.buttons) styleButton(button, value === type);
    for (const [value, button] of themePills.buttons) styleButton(button, value === theme);
    const reduced = player.reducedMotion;
    pause.disabled = !motion || reduced;
    pause.textContent = reduced ? 'Reduced motion' : paused ? 'Play light' : 'Pause light';
    styleButton(pause, false);
    pause.removeAttribute('aria-pressed');
    for (const control of [focusSelect]) {
      Object.assign(control.style, {
        font: 'inherit',
        minHeight: '2rem',
        borderRadius: '.4rem',
        padding: '.15rem .4rem',
        background: palette.background,
        color: palette.text,
        border: '1px solid ' + palette.grid,
      });
    }
    if (frames) {
      play.textContent = playing ? 'Pause' : 'Play';
      styleButton(play, playing);
      scrub.style.accentColor = palette.accent;
      scrub.value = String(frameIndex);
      stamp.textContent = frames[frameIndex].label;
    }
    if (motion && !reduced) player.play();
    else player.pause();
    chart.setAmbientPaused(paused || !motion || reduced);
  }

  function showFrame(index) {
    frameIndex = index;
    model = frames[index].model;
    chart.setData(model);
    scrub.value = String(index);
    stamp.textContent = frames[index].label;
    updateSelection();
  }

  function stopPlaying() {
    playing = false;
    if (timer !== null) win?.clearInterval(timer);
    timer = null;
    applyAppearance();
  }

  const api = {
    get type() {
      return type;
    },
    get theme() {
      return theme;
    },
    get focus() {
      return focus;
    },
    get frame() {
      return frameIndex;
    },
    player,
    /** @param {'radial' | 'chord' | 'sunburst' | 'arc' | 'bar'} next */
    setType(next) {
      validateType(next);
      if (type === next) return;
      type = next;
      hover = null;
      hoverLink = null;
      chart.setView(type, palette);
      updateSelection();
      applyAppearance();
    },
    /** @param {'silk' | 'pearl' | 'signal' | 'paper' | 'midnight'} next */
    setTheme(next) {
      assert(next !== undefined, 'INVALID_OPTIONS', 'Choose a chart theme.');
      const color = chartTheme(next);
      if (theme === next) return;
      theme = next;
      palette = color;
      chart.setView(type, palette);
      applyAppearance();
    },
    /** @param {string | null} id */
    setFocus(id) {
      assert(id === null || base.byId.has(id), 'INVALID_DATA', 'Focus must name a chart row or be null.');
      focus = id;
      hover = null;
      updateSelection();
    },
    /** Show one frame; values morph and rising values flare. @param {number} index */
    setFrame(index) {
      assert(frames, 'INVALID_OPTIONS', 'This chart has no frames.');
      showFrame(Math.round(number(index, 'chart frame', 0, frames.length - 1)));
    },
    play() {
      assert(frames, 'INVALID_OPTIONS', 'This chart has no frames.');
      if (playing) return;
      playing = true;
      if (frameIndex >= frames.length - 1) showFrame(0);
      timer = win?.setInterval(() => {
        if (frameIndex >= frames.length - 1) stopPlaying();
        else showFrame(frameIndex + 1);
      }, frameDuration * 1000);
      applyAppearance();
    },
    pause() {
      if (playing) stopPlaying();
    },
    /**
     * Replace the values. Rows and links are matched by ID and endpoint pair, so marks move rather than restart.
     * @param {ReadonlyArray<{id: string, value: number, heat?: number}>} nextRows
     * @param {ReadonlyArray<{from: string, to: string, value?: number, heat?: number}>} [nextLinks]
     */
    update(nextRows, nextLinks = []) {
      const [frame] = prepareFrames(base, [{ rows: nextRows, links: nextLinks }]);
      model = frame.model;
      chart.setData(model);
      updateSelection();
    },
    dispose() {
      if (timer !== null) win?.clearInterval(timer);
      for (const cleanup of remove.splice(0)) cleanup();
      if (!player.disposed) player.dispose();
      host.remove();
    },
  };

  function listen(target, event, handler, opts) {
    target.addEventListener(event, handler, opts);
    remove.push(() => target.removeEventListener(event, handler, opts));
  }
  const toScene = (event) => {
    const rect = stage.getBoundingClientRect();
    return [
      ((event.clientX - rect.left) * chart.width) / rect.width,
      ((event.clientY - rect.top) * chart.height) / rect.height,
    ];
  };
  for (const [value, button] of typePills.buttons) listen(button, 'click', () => api.setType(value));
  for (const [value, button] of themePills.buttons) listen(button, 'click', () => api.setTheme(value));
  listen(focusSelect, 'change', () =>
    api.setFocus(focusSelect.value === '' ? null : base.data[Number(focusSelect.value)].id),
  );
  listen(pause, 'click', () => {
    paused = !paused;
    applyAppearance();
  });
  if (frames) {
    listen(play, 'click', () => (playing ? api.pause() : api.play()));
    listen(scrub, 'input', () => {
      if (playing) stopPlaying();
      showFrame(Number(scrub.value));
    });
  }

  // Pointer: light and hover on move; a drag on a circular view turns it, with inertia; a tap selects.
  let drag = null;
  const angleOf = ([x, y]) => Math.atan2(y - chart.centre[1], x - chart.centre[0]);
  listen(stage, 'pointerdown', (event) => {
    const point = toScene(event);
    drag = {
      id: event.pointerId,
      start: point,
      angle: angleOf(point),
      moved: false,
      last: performance.now(),
      speed: 0,
    };
  });
  listen(stage, 'pointermove', (event) => {
    const point = toScene(event);
    if (event.pointerType !== 'touch' || drag) chart.setPointer(point);
    if (drag && drag.id === event.pointerId) {
      if (!drag.moved && Math.hypot(point[0] - drag.start[0], point[1] - drag.start[1]) > 5 && chart.spins) {
        drag.moved = true;
        chart.beginSpin();
        stage.setPointerCapture?.(event.pointerId);
      }
      if (drag.moved) {
        const angle = angleOf(point);
        let delta = angle - drag.angle;
        if (delta > Math.PI) delta -= 2 * Math.PI;
        if (delta < -Math.PI) delta += 2 * Math.PI;
        const now = performance.now();
        const dt = Math.max(1, now - drag.last) / 1000;
        drag.speed = drag.speed * 0.6 + (delta / dt) * 0.4;
        drag.last = now;
        drag.angle = angle;
        chart.turn(delta);
        stage.style.cursor = 'grabbing';
        return;
      }
    }
    if (event.pointerType === 'touch') return;
    const hit = chart.pick(...point);
    const id = hit?.row ?? null,
      link = hit?.link ?? null;
    stage.style.cursor = hit ? 'pointer' : chart.spins ? 'grab' : 'default';
    if (id === hover && link === hoverLink) return;
    hover = id;
    hoverLink = link;
    updateSelection();
  });
  const release = (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    if (drag.moved) chart.endSpin(performance.now() - drag.last > 120 ? 0 : drag.speed);
    else {
      const hit = chart.pick(...toScene(event));
      const id = hit?.row ?? null;
      api.setFocus(id === focus ? null : id);
    }
    drag = null;
    stage.style.cursor = 'default';
  };
  listen(stage, 'pointerup', release);
  listen(stage, 'pointercancel', (event) => {
    if (drag?.moved) chart.endSpin(0);
    drag = null;
    release(event);
  });
  listen(stage, 'pointerleave', () => {
    chart.setPointer(null);
    if (hover === null && hoverLink === null) return;
    hover = null;
    hoverLink = null;
    stage.style.cursor = 'default';
    updateSelection();
  });
  listen(stage, 'keydown', (event) => {
    const n = base.data.length;
    const at = focus === null ? -1 : base.byId.get(focus).index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') api.setFocus(base.data[(at + 1) % n].id);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') api.setFocus(base.data[(at - 1 + n) % n].id);
    else if (event.key === 'Escape') api.setFocus(null);
    else return;
    event.preventDefault();
  });
  const media = win?.matchMedia?.('(prefers-reduced-motion: reduce)');
  if (media) listen(media, 'change', applyAppearance);
  updateSelection();
  applyAppearance();
  return Object.freeze(api);
}
