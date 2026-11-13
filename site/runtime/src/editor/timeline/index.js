import { assert, number, text, options } from '../../core/validate.js';
import { cubicBezier, easings, prepareKeyframes } from '../../core/timing.js';
import { validateProperty } from '../../core/geometry.js';

const channelOwners = new WeakMap(),
  containerOwners = new WeakMap();
let nextId = 0;
const fallbackCurve = Object.freeze([0.42, 0, 0.58, 1]);
const namedCurves = Object.freeze({
  linear: [0, 0, 1, 1],
  smooth: [1 / 3, 0, 2 / 3, 1],
  easeOut: [1 / 3, 1, 2 / 3, 1],
});

/** Capture the bounded editable representation; tuples remain serializable cubic controls. */
export function prepareTimelineKeys(keys) {
  assert(
    Array.isArray(keys) && keys.length >= 2 && keys.length <= 128,
    'INVALID_TIMELINE',
    'A timeline track needs 2–128 keys.',
  );
  const copy = [];
  for (let i = 0; i < keys.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(keys, i);
    assert(descriptor && 'value' in descriptor, 'INVALID_TIMELINE', 'Use dense key data without accessors.');
    const key = descriptor.value;
    options(key, ['at', 'value', 'ease'], 'timeline key');
    let ease = key.ease ?? 'smooth';
    if (Array.isArray(ease)) {
      assert(ease.length === 4, 'INVALID_EASING', 'A cubic curve needs four controls.');
      const values = [];
      for (let j = 0; j < 4; j++) {
        const d = Object.getOwnPropertyDescriptor(ease, j);
        assert(d && 'value' in d, 'INVALID_EASING', 'Curve controls cannot be accessors or holes.');
        values.push(d.value);
      }
      cubicBezier(...values);
      ease = Object.freeze(values);
    }
    copy.push(Object.freeze({ at: key.at, value: key.value, ease }));
  }
  prepareKeyframes([], undefined, runtimeKeys(copy), 0);
  return Object.freeze(copy);
}
const runtimeKeys = (keys) =>
  keys.map((key) => ({ ...key, ease: Array.isArray(key.ease) ? cubicBezier(...key.ease) : key.ease }));

function validateTrack(record, property, keys) {
  for (const key of keys) validateProperty(record.type, property, key.value);
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i],
      next = keys[i + 1],
      ease = key.ease,
      values = [0, 1];
    if (Array.isArray(ease)) {
      // y extrema are independent of x inversion, so this catches all cubic overshoot.
      const [, y1, , y2] = ease,
        a = 3 * y1 - 3 * y2 + 1,
        b = -6 * y1 + 3 * y2,
        c = 3 * y1,
        roots = [];
      if (Math.abs(a) < 1e-14) {
        if (Math.abs(b) > 1e-14) roots.push(-c / (2 * b));
      } else {
        const discriminant = 4 * b * b - 12 * a * c;
        if (discriminant >= 0) {
          const q = Math.sqrt(discriminant);
          roots.push((-2 * b + q) / (6 * a), (-2 * b - q) / (6 * a));
        }
      }
      for (const t of roots)
        if (t > 0 && t < 1) values.push(3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t * t * y2 + t ** 3);
    } else if (typeof ease === 'function') {
      // Trusted functions have no analytic bound; sampled preflight complements runtime validation.
      for (let j = 0; j <= 64; j++) values.push(number(ease(j / 64), 'easing preview'));
    }
    for (const progress of values)
      validateProperty(
        record.type,
        property,
        number(key.value + (next.value - key.value) * progress, 'keyframe preview'),
      );
  }
}

const styles = `
.ek-timeline{container-type:inline-size;background:#f6f2e9;color:#292c28;padding:18px 20px;font:14px/1.4 'Avenir Next','Trebuchet MS',sans-serif;border:1px solid #d4d3c6;border-radius:8px;max-width:100%;box-sizing:border-box}
.ek-timeline *{box-sizing:border-box}.ek-timeline button,.ek-timeline input,.ek-timeline summary{font:inherit}.ek-timeline button,.ek-timeline summary{cursor:pointer}.ek-timeline button:focus-visible,.ek-timeline input:focus-visible,.ek-timeline summary:focus-visible{outline:3px solid #965226;outline-offset:3px}.ek-timeline button:disabled,.ek-timeline input:disabled{opacity:.45;cursor:default}
.ek-timeline .ek-transport{display:flex;gap:14px;align-items:center;margin-bottom:15px}.ek-timeline .ek-play{min-width:72px;min-height:44px;border:0;border-radius:5px;background:#303d34;color:#fff9ee;padding:8px 14px}.ek-timeline .ek-seek{flex:1;min-width:30px;accent-color:#8c441e}.ek-timeline output{font-variant-numeric:tabular-nums;white-space:nowrap;font-size:12px}
.ek-timeline .ek-row{display:grid;grid-template-columns:minmax(80px,20%) 1fr;align-items:center;border-top:1px solid #d9d9cd;min-height:50px;gap:10px}.ek-timeline .ek-track-label{overflow-wrap:anywhere;font-size:12px}.ek-timeline .ek-rail{position:relative;height:46px;margin:0 18px;background:linear-gradient(#c6cbbf,#c6cbbf) center/100% 1px no-repeat}.ek-timeline .ek-key{position:absolute;top:0;width:32px;height:44px;transform:translateX(-50%);background:none;border:0;padding:0}.ek-timeline .ek-key:after{content:'';position:absolute;width:11px;height:11px;left:10px;top:16px;transform:rotate(45deg);background:#657565;border:1px solid #3f5041}.ek-timeline .ek-key[aria-pressed=true]:after{background:#a45123;outline:2px solid #a45123;outline-offset:3px}.ek-timeline .ek-key:hover:after{background:#a45123}
.ek-timeline .ek-edit{border-top:1px solid #c9cdbf;margin-top:4px;padding-top:16px}.ek-timeline .ek-selection{margin:0 0 10px;font-weight:600}.ek-timeline .ek-fields{display:flex;gap:18px;flex-wrap:wrap}.ek-timeline label{display:grid;gap:4px;font-size:12px}.ek-timeline input[type=number]{width:110px;padding:8px;border:1px solid #b7beb1;border-radius:4px;background:#fffdf7;color:inherit;min-height:42px;font-variant-numeric:tabular-nums}.ek-timeline details{margin-top:14px}.ek-timeline summary{min-height:44px;padding:11px 0;font-size:12px}.ek-timeline .ek-curve-layout{display:flex;align-items:center;gap:22px;flex-wrap:wrap}.ek-timeline .ek-curve-layout svg{width:260px;max-width:100%;height:160px;background:#eeeee4}.ek-timeline .ek-curve-fields{display:grid;grid-template-columns:1fr 1fr;gap:9px 14px}.ek-timeline .ek-curve-fields input{width:85px}.ek-timeline .ek-status{margin:10px 0 0;min-height:20px;color:#5a6356;font-size:12px}.ek-timeline .ek-status[data-error=true]{color:#9b301d}.ek-timeline .ek-empty{padding:20px 0;color:#5a6356}
@container(max-width:430px){.ek-timeline .ek-row{grid-template-columns:70px 1fr}.ek-timeline .ek-transport{gap:8px}.ek-timeline .ek-play{min-width:60px}.ek-timeline .ek-curve-layout{gap:12px}.ek-timeline .ek-curve-fields{grid-template-columns:repeat(4,1fr);gap:6px}.ek-timeline .ek-curve-fields input{width:60px}.ek-timeline output{font-size:11px}}
`;

/** A bounded native-control authoring panel sharing an existing player's clock. No animation is installed on mount. */
export function createTimeline(player, container, spec = {}) {
  options(spec, ['tracks', 'label', 'onChange', 'onError'], 'timeline');
  assert(
    container?.ownerDocument && typeof container.append === 'function',
    'INVALID_CONTAINER',
    'Mount a timeline into a DOM element.',
  );
  assert(
    player && ['on', 'seek', 'play', 'pause'].every((name) => typeof player[name] === 'function') && !player.disposed,
    'INVALID_TIMELINE',
    'Use a live scene player.',
  );
  assert(!containerOwners.has(container), 'TIMELINE_OWNED', 'This container already has a timeline.');
  for (const key of ['onChange', 'onError'])
    assert(
      spec[key] === undefined || typeof spec[key] === 'function',
      'INVALID_TIMELINE',
      `${key} must be a function.`,
    );
  const input = spec.tracks ?? [];
  assert(Array.isArray(input) && input.length <= 32, 'INVALID_TIMELINE', 'Use at most 32 timeline tracks.');
  const tracks = [],
    claims = new Map();
  for (let i = 0; i < input.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(input, i);
    assert(descriptor && 'value' in descriptor, 'INVALID_TIMELINE', 'Tracks must be dense data without accessors.');
    const track = descriptor.value;
    options(track, ['label', 'handle', 'property', 'keys'], 'timeline track');
    const label = text(track.label ?? track.property, 'track label', 100),
      property = text(track.property, 'track property', 100),
      handle = track.handle,
      owner = handle?._record ?? handle;
    assert(label.length > 0, 'INVALID_TIMELINE', 'Give each track an accessible label.');
    assert(
      handle && typeof handle.replaceKeys === 'function' && handle._record && typeof owner === 'object',
      'INVALID_TIMELINE',
      'Each track needs an editable node handle.',
    );
    handle._live?.();
    const keys = prepareTimelineKeys(track.keys),
      set = claims.get(owner) ?? new Set();
    const record = handle._record;
    assert(
      typeof record.props[property] === 'number',
      'INVALID_TIMELINE',
      'The timeline edits numeric node properties.',
    );
    assert(
      !record.bindings.has(property) && !record.collectionOwned.has(property),
      'CHANNEL_OWNED',
      'Release the channel’s binding before editing keys.',
    );
    validateTrack(record, property, keys);
    assert(
      !set.has(property) && !channelOwners.get(owner)?.has(property),
      'TIMELINE_OWNED',
      'A timeline already owns this handle/property.',
    );
    set.add(property);
    claims.set(owner, set);
    tracks.push({ label, property, handle, owner, keys });
  }
  const label = text(spec.label ?? 'Animation timeline', 'timeline label', 100),
    doc = container.ownerDocument,
    id = `ek-timeline-${++nextId}`,
    listeners = [],
    unsubscribers = [];
  assert(label.length > 0, 'INVALID_TIMELINE', 'Give the timeline an accessible label.');
  let disposed = false,
    selection = tracks.length ? { track: 0, key: 0 } : null;
  const make = (name, className, parent) => {
    const element = doc.createElement(name);
    if (className) element.className = className;
    if (parent) parent.append(element);
    return element;
  };
  const root = make('section', 'ek-timeline');
  root.setAttribute('aria-label', label);
  root.setAttribute('role', 'region');
  const style = make('style', null, root);
  style.textContent = styles;
  const transport = make('div', 'ek-transport', root),
    play = make('button', 'ek-play', transport);
  play.type = 'button';
  const seek = make('input', 'ek-seek', transport);
  seek.type = 'range';
  seek.min = '0';
  seek.step = '.001';
  seek.setAttribute('aria-label', 'Seek animation');
  const time = make('output', null, transport);
  time.setAttribute('aria-label', 'Current animation time');
  const rows = make('div', 'ek-tracks', root),
    edit = make('div', 'ek-edit', root),
    caption = make('p', 'ek-selection', edit),
    fields = make('div', 'ek-fields', edit);
  function field(parent, title, name) {
    const wrap = make('label', null, parent);
    wrap.textContent = title;
    const control = make('input', null, wrap);
    control.type = 'number';
    control.step = '.01';
    control.setAttribute('aria-label', title);
    control.dataset.field = name;
    return control;
  }
  const at = field(fields, 'Time (seconds)', 'at'),
    value = field(fields, 'Value', 'value');
  at.min = '0';
  at.max = '86400';
  const details = make('details', null, edit),
    summary = make('summary', null, details);
  summary.textContent = 'Segment easing';
  const curveLayout = make('div', 'ek-curve-layout', details),
    svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 260 160');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Selected segment easing curve');
  curveLayout.append(svg);
  const curveFields = make('div', 'ek-curve-fields', curveLayout),
    controls = ['x1', 'y1', 'x2', 'y2'].map((name) => field(curveFields, name, name));
  for (const index of [0, 2]) {
    controls[index].min = '0';
    controls[index].max = '1';
  }
  const status = make('p', 'ek-status', root);
  status.id = `${id}-status`;
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  root.setAttribute('aria-describedby', status.id);
  const live = () => assert(!disposed, 'DISPOSED', 'This timeline has been disposed.');
  const listen = (element, name, fn) => {
    element.addEventListener(name, fn);
    listeners.push(() => element.removeEventListener(name, fn));
  };
  const say = (message, error = false) => {
    status.textContent = message;
    status.dataset.error = String(error);
  };
  function report(error) {
    say(error?.message ?? 'The edit could not be applied.', true);
    try {
      spec.onError?.(error);
    } catch {
      /* Error reporting cannot break editor cleanup. */
    }
  }
  const guard = (fn) => (event) => {
    try {
      fn(event);
    } catch (error) {
      report(error);
      sync();
      renderDetails();
    }
  };
  function current() {
    return selection ? tracks[selection.track].keys[selection.key] : null;
  }
  function curveFor(key) {
    return Array.isArray(key.ease) ? key.ease : (namedCurves[key.ease] ?? fallbackCurve);
  }
  function renderCurve(key) {
    svg.replaceChildren();
    const tuple = curveFor(key),
      fn = Array.isArray(key.ease)
        ? cubicBezier(...tuple)
        : typeof key.ease === 'function'
          ? key.ease
          : easings[key.ease];
    const samples = Array.from({ length: 65 }, (_, i) => number(fn(i / 64), 'easing preview'));
    const low = Math.min(0, ...samples, tuple[1], tuple[3]),
      high = Math.max(1, ...samples, tuple[1], tuple[3]),
      px = (x) => 12 + x * 236,
      py = (y) => 148 - ((y - low) / (high - low)) * 136;
    const path = (d, stroke, width = 1) => {
      const p = doc.createElementNS(svg.namespaceURI, 'path');
      p.setAttribute('d', d);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', stroke);
      p.setAttribute('stroke-width', String(width));
      svg.append(p);
      return p;
    };
    path(`M${px(0)} ${py(0)}H${px(1)}M${px(0)} ${py(0)}V${py(1)}`, '#c3cabb');
    if (Array.isArray(key.ease) || namedCurves[key.ease]) {
      path(
        `M${px(0)} ${py(0)}L${px(tuple[0])} ${py(tuple[1])}M${px(1)} ${py(1)}L${px(tuple[2])} ${py(tuple[3])}`,
        '#9da98f',
      );
      path(
        `M${px(0)} ${py(0)}C${px(tuple[0])} ${py(tuple[1])} ${px(tuple[2])} ${py(tuple[3])} ${px(1)} ${py(1)}`,
        '#99471f',
        2.5,
      );
    } else path(samples.map((v, i) => `${i ? 'L' : 'M'}${px(i / 64)} ${py(v)}`).join(' '), '#99471f', 2.5);
  }
  function renderDetails() {
    const key = current();
    edit.hidden = !key;
    if (!key) return;
    const track = tracks[selection.track];
    caption.textContent = `${track.label} · key ${selection.key + 1} of ${track.keys.length}`;
    at.value = String(key.at);
    value.value = String(key.value);
    const tuple = curveFor(key);
    controls.forEach((control, i) => {
      control.value = String(tuple[i]);
      control.disabled = selection.key === track.keys.length - 1;
    });
    summary.textContent =
      selection.key === track.keys.length - 1
        ? 'Final key · no outgoing segment'
        : !Array.isArray(key.ease) && !namedCurves[key.ease]
          ? 'Custom easing · adjust controls to replace'
          : 'Segment easing';
    renderCurve(key);
  }
  function renderRows(focus = false) {
    rows.replaceChildren();
    if (!tracks.length) {
      const empty = make('p', 'ek-empty', rows);
      empty.textContent = 'Add an authored keyframe track to inspect its timing.';
      return;
    }
    const duration = Math.max(0.001, player.duration);
    tracks.forEach((track, index) => {
      const row = make('div', 'ek-row', rows),
        name = make('span', 'ek-track-label', row);
      name.textContent = track.label;
      const rail = make('div', 'ek-rail', row);
      rail.setAttribute('role', 'group');
      rail.setAttribute('aria-label', `${track.label} keys`);
      track.keys.forEach((key, keyIndex) => {
        const button = make('button', 'ek-key', rail);
        button.type = 'button';
        button.style.left = `${Math.max(0, Math.min(100, (key.at / duration) * 100))}%`;
        button.dataset.track = String(index);
        button.dataset.key = String(keyIndex);
        button.setAttribute('aria-pressed', String(selection?.track === index && selection.key === keyIndex));
        button.setAttribute('aria-label', `${track.label}, key ${keyIndex + 1}, ${key.at} seconds, value ${key.value}`);
        button.title = 'Select key; Left/Right nudges time by .01 seconds, Shift by .1 seconds.';
        if (focus && selection?.track === index && selection.key === keyIndex) button.dataset.restoreFocus = 'true';
      });
    });
    if (focus) rows.querySelector('[data-restore-focus]')?.focus();
  }
  function sync() {
    if (disposed) return;
    seek.max = String(player.duration);
    seek.value = String(player.time);
    time.value = `${player.time.toFixed(2)} / ${player.duration.toFixed(2)} s`;
    time.textContent = time.value;
    play.textContent = player.playing ? 'Pause' : 'Play';
    play.setAttribute('aria-pressed', String(player.playing));
    const owned = player.driver !== null && player.driver !== 'media';
    play.disabled = owned;
    seek.disabled = owned;
  }
  function select(track, key) {
    live();
    number(track, 'track index', 0, tracks.length - 1);
    assert(Number.isInteger(track), 'INVALID_TIMELINE', 'Track index must be an integer.');
    number(key, 'key index', 0, tracks[track].keys.length - 1);
    assert(Number.isInteger(key), 'INVALID_TIMELINE', 'Key index must be an integer.');
    selection = { track, key };
    renderRows(true);
    renderDetails();
    return api;
  }
  function update(track, key, patch) {
    live();
    options(patch, ['at', 'value', 'ease'], 'key edit');
    number(track, 'track index', 0, tracks.length - 1);
    assert(Number.isInteger(track), 'INVALID_TIMELINE', 'Track index must be an integer.');
    number(key, 'key index', 0, tracks[track].keys.length - 1);
    assert(Number.isInteger(key), 'INVALID_TIMELINE', 'Key index must be an integer.');
    const target = tracks[track],
      candidate = prepareTimelineKeys(target.keys.map((item, index) => (index === key ? { ...item, ...patch } : item)));
    validateTrack(target.handle._record, target.property, candidate);
    // Preview trusted easing before changing the authored channel or editor state.
    const proposed = candidate[key],
      ease = Array.isArray(proposed.ease)
        ? cubicBezier(...proposed.ease)
        : typeof proposed.ease === 'function'
          ? proposed.ease
          : easings[proposed.ease];
    for (let i = 0; i <= 64; i++) number(ease(i / 64), 'easing preview');
    player.pause();
    target.handle.replaceKeys(target.property, runtimeKeys(candidate));
    target.keys = candidate;
    selection = { track, key };
    renderRows();
    renderDetails();
    sync();
    say('Key updated.');
    try {
      spec.onChange?.(Object.freeze({ track, key, keys: candidate }));
    } catch (cause) {
      report(Object.assign(new Error('Timeline change callback failed.'), { code: 'CALLBACK_FAILED', cause }));
    }
    return api;
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const stop of unsubscribers) stop();
    for (const remove of listeners) remove();
    for (const [owner, properties] of claims) {
      const owned = channelOwners.get(owner);
      for (const property of properties) if (owned?.get(property) === api) owned.delete(property);
      if (!owned?.size) channelOwners.delete(owner);
    }
    if (containerOwners.get(container) === api) containerOwners.delete(container);
    root.remove();
  }
  const api = Object.freeze({
    element: root,
    select,
    update,
    dispose,
    get disposed() {
      return disposed;
    },
    get selection() {
      return selection ? Object.freeze({ ...selection }) : null;
    },
    get tracks() {
      return Object.freeze(
        tracks.map((track) =>
          Object.freeze({ label: track.label, handle: track.handle, property: track.property, keys: track.keys }),
        ),
      );
    },
  });
  listen(
    play,
    'click',
    guard(() => {
      if (player.playing) player.pause();
      else player.play();
      sync();
    }),
  );
  listen(
    seek,
    'input',
    guard(() => {
      player.seek(number(Number(seek.value), 'seek seconds', 0, player.duration), { reset: false });
      sync();
    }),
  );
  listen(
    rows,
    'click',
    guard((event) => {
      const button = event.target.closest?.('[data-key]');
      if (button && rows.contains(button)) select(Number(button.dataset.track), Number(button.dataset.key));
    }),
  );
  listen(
    rows,
    'keydown',
    guard((event) => {
      const button = event.target.closest?.('[data-key]');
      if (!button || !rows.contains(button) || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const track = Number(button.dataset.track),
        key = Number(button.dataset.key),
        delta = (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 0.1 : 0.01);
      update(track, key, { at: Number((tracks[track].keys[key].at + delta).toFixed(6)) });
      renderRows(true);
    }),
  );
  const readField = (localInput1) => {
    assert(localInput1.value.trim() !== '', 'INVALID_NUMBER', 'Enter a number before committing this edit.');
    return number(Number(localInput1.value), 'key edit');
  };
  for (const control of [at, value])
    listen(
      control,
      'change',
      guard(() => {
        if (!selection) return;
        update(selection.track, selection.key, { [control.dataset.field]: readField(control) });
      }),
    );
  for (const control of controls)
    listen(
      control,
      'change',
      guard(() => {
        if (!selection) return;
        update(selection.track, selection.key, { ease: controls.map(readField) });
      }),
    );
  try {
    renderRows();
    renderDetails();
    sync();
    for (const event of ['frame', 'play', 'pause', 'driver']) unsubscribers.push(player.on(event, sync));
    unsubscribers.push(
      player.on('motionBlocked', (message) => say(String(message))),
      player.on('dispose', dispose),
    );
    for (const [owner, properties] of claims) {
      let owned = channelOwners.get(owner);
      if (!owned) {
        owned = new Map();
        channelOwners.set(owner, owned);
      }
      for (const property of properties) owned.set(property, api);
    }
    containerOwners.set(container, api);
    container.append(root);
  } catch (error) {
    dispose();
    throw error;
  }
  return api;
}
