import { toRGBA } from '../color/index.js';
import { assert, number, options, text } from '../core/validate.js';
import { chartTheme } from './chart-themes.js';
import { parseMermaidFlow } from './flow-mermaid.js';
import { defaultFlowSteps, flowScene } from './flow-scene.js';
import { flowLayout } from './flow-layout.js';

const THEMES = ['silk', 'pearl', 'signal', 'midnight', 'paper'];
const NAMES = { silk: 'Silk', pearl: 'Pearl', signal: 'Signal', midnight: 'Midnight', paper: 'Paper' };
const MAX_STEPS = 2000;

function validateSteps(list, ids) {
  assert(Array.isArray(list) && list.length <= MAX_STEPS, 'RESOURCE_LIMIT', `Use at most ${MAX_STEPS} replay steps.`);
  return Array.from({ length: list.length }, (_, i) => {
    const descriptor = Object.getOwnPropertyDescriptor(list, i);
    assert(descriptor && 'value' in descriptor, 'INVALID_DATA', 'Replay steps must be dense.');
    const step = descriptor.value;
    options(step, ['from', 'to', 'node', 'label', 'input', 'output'], 'replay step');
    const out = {};
    for (const key of ['from', 'to', 'node']) {
      if (step[key] === undefined) continue;
      out[key] = text(step[key], `step ${key}`, 128);
      assert(ids.has(out[key]), 'INVALID_DATA', `Replay step ${i + 1} names an unknown node: ${out[key]}.`);
    }
    assert(out.node || (out.from && out.to), 'INVALID_DATA', 'A replay step needs from and to, or a node.');
    for (const key of ['label', 'input', 'output'])
      if (step[key] !== undefined) out[key] = text(step[key], `step ${key}`, 4000);
    return out;
  });
}

/**
 * Mount a Mermaid flowchart drawn as silk light, with a replay of the steps that pass through it: each step's
 * message travels its edge, the receiving node lights up, and a readout shows the step's input and output.
 * @param {HTMLElement} container
 * @param {string} source Mermaid flowchart text (flowchart TD …)
 * @param {{theme?: 'silk'|'pearl'|'signal'|'midnight'|'paper', label?: string, motion?: boolean,
 *          steps?: ReadonlyArray<{from?: string, to?: string, node?: string, label?: string, input?: string,
 *                                 output?: string}>, stepDuration?: number}} [spec]
 */
export async function mountFlowChart(container, source, spec = {}) {
  options(spec, ['theme', 'label', 'motion', 'steps', 'stepDuration'], 'flow chart');
  assert(
    container?.ownerDocument && typeof container.append === 'function',
    'INVALID_CONTAINER',
    'Mount into a DOM element.',
  );
  const graph = parseMermaidFlow(source);
  const ids = new Set(graph.nodes.map((n) => n.id));
  let themeName = spec.theme ?? 'silk';
  let theme = chartTheme(themeName);
  const motion = spec.motion ?? true;
  assert(typeof motion === 'boolean', 'INVALID_OPTIONS', 'Flow motion must be boolean.');
  const label = text(spec.label ?? 'Flowchart replay', 'flow label', 300);
  const stepDuration = number(spec.stepDuration ?? 1.6, 'step duration', 0.3, 60);
  const steps = spec.steps
    ? validateSteps(spec.steps, ids)
    : defaultFlowSteps(flowLayout(graph, 960, 600)).slice(0, MAX_STEPS);
  assert(steps.length > 0, 'INVALID_DATA', 'The flowchart has no edges to replay; supply steps.');
  const flow = flowScene(graph, { theme, themeName, steps, stepDuration, label });

  const doc = container.ownerDocument,
    win = doc.defaultView;
  const host = doc.createElement('section');
  host.className = 'ek-flow-chart';
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
  const button = (name) => {
    const b = doc.createElement('button');
    b.type = 'button';
    b.textContent = name;
    return b;
  };
  const themeGroup = doc.createElement('div');
  themeGroup.setAttribute('role', 'group');
  themeGroup.setAttribute('aria-label', 'Flow theme');
  Object.assign(themeGroup.style, { display: 'flex', gap: '.25rem', flexWrap: 'wrap' });
  const themeButtons = new Map(THEMES.map((name) => [name, button(NAMES[name])]));
  themeGroup.append(...themeButtons.values());
  const prev = button('Previous'),
    play = button('Play'),
    next = button('Next');
  prev.setAttribute('aria-label', 'Previous step');
  next.setAttribute('aria-label', 'Next step');
  const scrub = doc.createElement('input');
  scrub.type = 'range';
  scrub.min = '0';
  scrub.max = String(flow.drawing.duration);
  scrub.step = '0.01';
  scrub.setAttribute('aria-label', 'Replay time');
  Object.assign(scrub.style, { flex: '1', minWidth: '8rem' });
  const counter = doc.createElement('output');
  Object.assign(counter.style, { minWidth: '4.5rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' });
  // Zoom: buttons, a pinch or Ctrl/⌘ with the wheel, and double-click to frame a node (or the whole chart).
  const zoomGroup = doc.createElement('div');
  zoomGroup.setAttribute('role', 'group');
  zoomGroup.setAttribute('aria-label', 'Zoom');
  Object.assign(zoomGroup.style, { display: 'flex', gap: '.25rem', marginLeft: 'auto' });
  const zoomOut = button('−'),
    zoomIn = button('+'),
    fit = button('Fit');
  zoomOut.setAttribute('aria-label', 'Zoom out');
  zoomIn.setAttribute('aria-label', 'Zoom in');
  fit.setAttribute('aria-label', 'Fit the whole chart');
  zoomGroup.append(zoomOut, zoomIn, fit);
  bar.append(themeGroup, zoomGroup);
  const transport = doc.createElement('div');
  Object.assign(transport.style, {
    display: 'flex',
    gap: '.5rem',
    alignItems: 'center',
    padding: '0 .85rem .6rem',
    fontSize: '.85rem',
  });
  transport.append(prev, play, next, scrub, counter);
  const stage = doc.createElement('div');
  stage.tabIndex = 0;
  stage.setAttribute('role', 'img');
  stage.setAttribute(
    'aria-label',
    label + '. Left and right arrow keys step through the replay; plus, minus and 0 zoom in, out and back to fit.',
  );
  Object.assign(stage.style, { outline: 'none', touchAction: 'pan-y' });
  const readout = doc.createElement('div');
  readout.setAttribute('aria-live', 'polite');
  Object.assign(readout.style, { padding: '.2rem .85rem .9rem', fontSize: '.88rem', display: 'grid', gap: '.35rem' });
  const title = doc.createElement('p');
  title.style.margin = '0';
  const io = doc.createElement('div');
  Object.assign(io.style, {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))',
    gap: '.5rem',
  });
  const panel = (name) => {
    const box = doc.createElement('div');
    const head = doc.createElement('div');
    head.textContent = name;
    Object.assign(head.style, { fontSize: '.75rem', opacity: '.65', marginBottom: '.15rem' });
    const body = doc.createElement('pre');
    Object.assign(body.style, {
      margin: '0',
      whiteSpace: 'pre-wrap',
      font: '0.8rem/1.4 ui-monospace, SFMono-Regular, Menlo, monospace',
      maxHeight: '8rem',
      overflow: 'auto',
      padding: '.45rem .55rem',
      borderRadius: '.35rem',
    });
    box.append(head, body);
    return { box, body };
  };
  const input = panel('Input'),
    output = panel('Output');
  io.append(input.box, output.box);
  readout.append(title, io);
  host.append(bar, stage, transport, readout);
  container.append(host);
  let player;
  try {
    player = await flow.drawing.mount(stage, { pixelRatio: Math.min(2, Math.max(1.5, win?.devicePixelRatio || 1)) });
  } catch (error) {
    host.remove();
    throw error;
  }
  const nodeName = (id) => graph.nodes.find((n) => n.id === id)?.label ?? id;
  let shownStep = -1,
    hover = null,
    focus = null;
  const remove = [];

  function showStep() {
    const k = flow.stepAt(player.time);
    scrub.value = String(player.time);
    counter.textContent = `${k + 1} / ${steps.length}`;
    if (k === shownStep) return;
    shownStep = k;
    const step = steps[k];
    const route = step.node ? nodeName(step.node) : `${nodeName(step.from)} → ${nodeName(step.to)}`;
    title.textContent = route + (step.label ? ' · ' + step.label : '');
    input.body.textContent = step.input ?? '—';
    output.body.textContent = step.output ?? '—';
    io.style.display = step.input === undefined && step.output === undefined ? 'none' : 'grid';
  }
  function style() {
    host.style.background = theme.background;
    host.style.color = theme.text;
    host.style.colorScheme = themeName === 'pearl' || themeName === 'paper' ? 'light' : 'dark';
    const paint = (b, active) =>
      Object.assign(b.style, {
        font: 'inherit',
        minHeight: '2rem',
        padding: '.2rem .75rem',
        borderRadius: '999px',
        cursor: 'pointer',
        background: active ? theme.text : 'transparent',
        color: active ? theme.background : theme.text,
        border: '1px solid ' + (active ? theme.text : theme.grid),
      });
    for (const [name, b] of themeButtons) {
      paint(b, name === themeName);
      b.setAttribute('aria-pressed', String(name === themeName));
    }
    for (const b of [prev, play, next, zoomOut, zoomIn, fit]) paint(b, false);
    play.textContent = player.playing ? 'Pause' : 'Play';
    scrub.style.accentColor = theme.accent;
    // Explicit colours: a host page's own pre and paragraph styles must not leave pale text on a pale panel.
    const grid = toRGBA(theme.grid);
    for (const p of [input, output])
      Object.assign(p.body.style, {
        background: `rgba(${grid
          .slice(0, 3)
          .map((c) => Math.round(c * 255))
          .join(', ')}, 0.45)`,
        color: theme.text,
        border: '0',
      });
    title.style.color = theme.text;
  }
  const seekStep = (k) => {
    const target = Math.max(0, Math.min(steps.length - 1, k));
    player.seek(target * stepDuration + 0.001);
    showStep();
  };
  const api = {
    player,
    get theme() {
      return themeName;
    },
    get step() {
      return flow.stepAt(player.time);
    },
    layout: flow.layout,
    /** @param {'silk'|'pearl'|'signal'|'midnight'|'paper'} name */
    setTheme(name) {
      assert(THEMES.includes(name), 'INVALID_OPTIONS', 'Choose silk, pearl, signal, midnight or paper.');
      themeName = name;
      theme = chartTheme(name);
      flow.setTheme(theme, name);
      style();
    },
    /** Show the start of one step, paused there. @param {number} index */
    setStep(index) {
      player.pause();
      seekStep(Math.round(number(index, 'step', 0, steps.length - 1)));
      style();
    },
    play() {
      if (player.time >= flow.drawing.duration - 0.01) player.seek(0);
      player.play();
      style();
    },
    pause() {
      player.pause();
      style();
    },
    dispose() {
      for (const cleanup of remove.splice(0)) cleanup();
      if (!player.disposed) player.dispose();
      host.remove();
    },
  };
  const listen = (target, event, handler) => {
    target.addEventListener(event, handler);
    remove.push(() => target.removeEventListener(event, handler));
  };
  remove.push(player.on('frame', showStep));
  for (const [name, b] of themeButtons) listen(b, 'click', () => api.setTheme(name));
  listen(play, 'click', () => (player.playing ? api.pause() : api.play()));
  listen(prev, 'click', () => api.setStep(flow.stepAt(player.time) - 1));
  listen(next, 'click', () => api.setStep(flow.stepAt(player.time) + 1));
  listen(scrub, 'input', () => {
    player.pause();
    player.seek(Number(scrub.value));
    style();
    showStep();
  });
  const toScene = (event) => {
    const rect = stage.getBoundingClientRect();
    return [
      ((event.clientX - rect.left) * flow.width) / rect.width,
      ((event.clientY - rect.top) * flow.height) / rect.height,
    ];
  };
  // A drag pans the view; a press that does not move is a click, which focuses the node under it.
  let drag = null;
  listen(stage, 'pointerdown', (event) => {
    drag = { id: event.pointerId, last: toScene(event), moved: false };
  });
  listen(stage, 'pointermove', (event) => {
    const point = toScene(event);
    if (drag && drag.id === event.pointerId) {
      const dx = point[0] - drag.last[0],
        dy = point[1] - drag.last[1];
      if (drag.moved || Math.hypot(dx, dy) > 4) {
        if (!drag.moved) stage.setPointerCapture?.(event.pointerId);
        drag.moved = true;
        drag.last = point;
        flow.pan(dx, dy);
        stage.style.cursor = 'grabbing';
        return;
      }
    }
    if (event.pointerType !== 'touch') flow.setPointer(point);
    const id = flow.pick(...point);
    stage.style.cursor = id ? 'pointer' : 'grab';
    if (id !== hover) {
      hover = id;
      flow.setSelection(hover, focus);
    }
  });
  const release = (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    if (!drag.moved) {
      const id = flow.pick(...toScene(event));
      focus = id === focus ? null : id;
      flow.setSelection(hover, focus);
    }
    drag = null;
    stage.style.cursor = 'grab';
  };
  listen(stage, 'pointerup', release);
  listen(stage, 'pointercancel', () => {
    drag = null;
  });
  listen(stage, 'pointerleave', () => {
    flow.setPointer(null);
    hover = null;
    flow.setSelection(null, focus);
  });
  listen(stage, 'dblclick', (event) => {
    const id = flow.pick(...toScene(event));
    flow.frame(id);
  });
  // The page keeps ordinary scrolling; a trackpad pinch (which arrives with ctrlKey) or Ctrl/⌘ + wheel zooms.
  listen(stage, 'wheel', (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    flow.zoom(Math.exp(-Math.max(-60, Math.min(60, event.deltaY)) * 0.01), toScene(event));
  });
  listen(zoomIn, 'click', () => flow.zoom(1.4));
  listen(zoomOut, 'click', () => flow.zoom(1 / 1.4));
  listen(fit, 'click', () => flow.frame(null));
  listen(stage, 'keydown', (event) => {
    if (event.key === 'ArrowRight') api.setStep(flow.stepAt(player.time) + 1);
    else if (event.key === 'ArrowLeft') api.setStep(flow.stepAt(player.time) - 1);
    else if (event.key === ' ') player.playing ? api.pause() : api.play();
    else if (event.key === '+' || event.key === '=') flow.zoom(1.4);
    else if (event.key === '-') flow.zoom(1 / 1.4);
    else if (event.key === '0') flow.frame(null);
    else return;
    event.preventDefault();
  });
  style();
  showStep();
  if (motion && !player.reducedMotion) api.play();
  else {
    flow.setAmbientPaused(0);
    seekStep(0);
  }
  return Object.freeze(api);
}
