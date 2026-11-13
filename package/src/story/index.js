import { assert, number, options, safeCopy, text } from '../core/validate.js';
import { arrivalController, arrivalPlan, scrollPace, ARRIVALS } from '../player/pace.js';
import { captureCues, cueController } from './cues.js';

export { scrollPace, arrivalPlan, arrivalTime, SCROLL_PACES, DEFAULT_PACE_BOUNDS, ARRIVALS } from '../player/pace.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function length(value, height, name) {
  if (typeof value === 'number') return number(value, name, 1, 1e7);
  assert(
    typeof value === 'string' && /^\d+(?:\.\d+)?(?:px|vh)$/.test(value),
    'INVALID_STORY_LENGTH',
    `${name} needs positive pixels or vh.`,
  );
  return number(parseFloat(value) * (value.endsWith('vh') ? height / 100 : 1), name, 1, 1e7);
}
const own = (value, key) => {
  const d = Object.getOwnPropertyDescriptor(value, key);
  assert(!d || 'value' in d, 'INVALID_DATA', 'Accessor properties are not accepted as data.');
  return d?.value;
};
/** Validates one hold's reader controls. Parameters are live objects, so they never pass through safeCopy. */
function prepareControls(list) {
  assert(
    Array.isArray(list) && list.length > 0 && list.length <= 8,
    'INVALID_STORY_CONTROLS',
    'A hold takes one to eight controls.',
  );
  return Object.freeze(
    Array.from({ length: list.length }, (_, i) => {
      const c = own(list, i);
      options(c, ['parameter', 'min', 'max', 'step', 'label', 'format'], 'story control');
      const p = c.parameter;
      assert(
        p &&
          ['override', 'release', 'sample'].every((key) => typeof p[key] === 'function') &&
          Number.isFinite(p.min) &&
          Number.isFinite(p.max),
        'INVALID_STORY_CONTROLS',
        'A control needs a scene parameter.',
      );
      const min = c.min ?? p.min,
        max = c.max ?? p.max;
      assert(
        Number.isFinite(min) && Number.isFinite(max) && min >= p.min && max <= p.max && max > min,
        'INVALID_STORY_CONTROLS',
        'Control min and max must lie inside the parameter range, with max above min.',
      );
      const step = c.step ?? (max - min) / 100;
      assert(
        Number.isFinite(step) && step > 0 && step <= max - min,
        'INVALID_STORY_CONTROLS',
        'Control step must be positive and at most the range.',
      );
      assert(
        typeof c.label === 'string' && c.label.length > 0 && c.label.length <= 200,
        'INVALID_STORY_CONTROLS',
        'Each control needs a label of at most 200 characters.',
      );
      assert(
        c.format === undefined || typeof c.format === 'function',
        'INVALID_STORY_CONTROLS',
        'format must be a function.',
      );
      return Object.freeze({ parameter: p, min, max, step, label: c.label, format: c.format ?? null });
    }),
  );
}
/** Separates hold controls from plain act data. Returns JSON-safe acts and controls keyed by `act:hold`. */
function splitActs(acts) {
  assert(Array.isArray(acts) && acts.length <= 256, 'INVALID_STORY_ACTS', 'Use one to 256 acts.');
  const controls = new Map();
  const plain = Array.from({ length: acts.length }, (_, a) => {
    const act = own(acts, a);
    if (!act || typeof act !== 'object' || Array.isArray(act)) return act;
    options(act, ['id', 'from', 'to', 'length', 'holds'], 'story act');
    const holds = act.holds;
    if (!Array.isArray(holds)) return act;
    assert(holds.length <= 128, 'INVALID_STORY_HOLDS', 'Use at most 128 holds per act.');
    let stripped = false;
    const next = Array.from({ length: holds.length }, (__, h) => {
      const hold = own(holds, h);
      if (!hold || typeof hold !== 'object' || !Object.hasOwn(hold, 'controls')) return hold;
      options(hold, ['at', 'length', 'controls'], 'story hold');
      controls.set(`${a}:${h}`, prepareControls(hold.controls));
      stripped = true;
      const rest = { ...hold };
      delete rest.controls;
      return rest;
    });
    return stripped ? { ...act, holds: next } : act;
  });
  return { plain, controls };
}

/** A pure, reversible map from scroll distance to story time. Hold `controls` are validated and ignored here. */
export function storyTimeline(acts, spec = {}) {
  options(spec, ['duration', 'viewportHeight'], 'story timeline options');
  const duration = number(spec.duration, 'story duration', 0.000001, 86400),
    height = number(spec.viewportHeight ?? 800, 'viewport height', 1, 16384),
    copy = safeCopy(splitActs(acts).plain);
  assert(Array.isArray(copy) && copy.length > 0 && copy.length <= 256, 'INVALID_STORY_ACTS', 'Use one to 256 acts.');
  const explicit = copy.some((act) => Object.hasOwn(act, 'from') || Object.hasOwn(act, 'to'));
  let offset = 0,
    end = 0;
  const spans = [],
    snapPoints = [],
    ids = new Set();
  const prepared = copy.map((act, index) => {
    options(act, ['id', 'from', 'to', 'length', 'holds'], 'story act');
    const id = act.id ?? String(index);
    assert(
      typeof id === 'string' && id.length > 0 && id.length <= 128 && !ids.has(id),
      'INVALID_STORY_ACT',
      'Act IDs must be unique nonempty strings.',
    );
    ids.add(id);
    const from = explicit ? number(act.from, 'act from', 0, duration) : end,
      to = explicit
        ? number(act.to, 'act to', 0, duration)
        : index === copy.length - 1
          ? duration
          : (duration * (index + 1)) / copy.length;
    assert(
      from === end && to > from,
      'INVALID_STORY_ACT',
      'Act times must be positive, contiguous, and cover the player duration.',
    );
    end = to;
    const travel = length(act.length ?? '220vh', height, 'act length'),
      holds = act.holds ?? [];
    assert(Array.isArray(holds) && holds.length <= 128, 'INVALID_STORY_HOLDS', 'Use at most 128 holds per act.');
    let previous = -Infinity,
      totalHold = 0;
    const pauses = holds.map((hold) => {
      options(hold, ['at', 'length'], 'story hold');
      const at = number(hold.at, 'hold time', from, to),
        distance = length(hold.length ?? '40vh', height, 'hold length');
      assert(at > previous, 'INVALID_STORY_HOLDS', 'Hold times must strictly increase.');
      previous = at;
      totalHold += distance;
      return { at, distance };
    });
    assert(totalHold < travel, 'INVALID_STORY_HOLDS', 'Holds must leave some distance for the moving part of the act.');
    const moving = travel - totalHold,
      start = offset,
      marks = [];
    let cursor = offset,
      time = from;
    pauses.forEach((hold, k) => {
      const next = cursor + (moving * (hold.at - time)) / (to - from);
      if (next > cursor)
        spans.push(
          Object.freeze({ start: cursor, end: next, from: time, to: hold.at, index, holding: false, hold: null }),
        );
      spans.push(
        Object.freeze({
          start: next,
          end: next + hold.distance,
          from: hold.at,
          to: hold.at,
          index,
          holding: true,
          hold: k,
        }),
      );
      marks.push(Object.freeze({ at: hold.at, start: next, end: next + hold.distance }));
      snapPoints.push(next + hold.distance / 2);
      cursor = next + hold.distance;
      time = hold.at;
    });
    if (time < to)
      spans.push(
        Object.freeze({ start: cursor, end: start + travel, from: time, to, index, holding: false, hold: null }),
      );
    offset += travel;
    assert(offset <= 1e7, 'RESOURCE_LIMIT', 'Story travel exceeds ten million pixels.');
    return Object.freeze({ id, index, from, to, start, end: offset, length: travel, holds: Object.freeze(marks) });
  });
  assert(end === duration, 'INVALID_STORY_ACT', 'Acts must cover the entire player duration.');
  const sample = (position) => {
    number(position, 'story position', -1e9, 1e9);
    const at = clamp(position, 0, offset);
    let span = spans.at(-1);
    for (const candidate of spans) {
      if (at < candidate.end) {
        span = candidate;
        break;
      }
    }
    const time = span.holding
        ? span.from
        : span.from + (span.to - span.from) * clamp((at - span.start) / (span.end - span.start), 0, 1),
      act = prepared[span.index];
    return Object.freeze({
      position: at,
      time,
      act: act.id,
      index: span.index,
      holding: span.holding,
      hold: span.hold,
      progress: clamp((at - act.start) / act.length, 0, 1),
    });
  };
  const positionAt = (time, { hold = 'start' } = {}) => {
    number(time, 'story time', 0, duration);
    assert(['start', 'center', 'end'].includes(hold), 'INVALID_STORY_OPTIONS', 'hold is start, center or end.');
    const pause = spans.find((s) => s.holding && s.from === time);
    if (pause) return hold === 'end' ? pause.end : hold === 'center' ? (pause.start + pause.end) / 2 : pause.start;
    const span = spans.find((s) => !s.holding && time >= s.from && time <= s.to);
    assert(span, 'INVALID_STORY_OPTIONS', 'No scroll span covers this time.');
    return span.start + ((span.end - span.start) * (time - span.from)) / (span.to - span.from);
  };
  return Object.freeze({
    duration,
    length: offset,
    acts: Object.freeze(prepared),
    spans: Object.freeze(spans),
    holds: Object.freeze(snapPoints),
    sample,
    positionAt,
  });
}

/**
 * Builds accessible range inputs for one hold. Returns the group element and a dispose() that releases overrides.
 * @param {{createElement(tag:string):any}} document
 * @param {ReadonlyArray<{parameter:any,min:number,max:number,step:number,label:string,format:((value:number)=>unknown)|null}>} controls
 * @param {{time?:number,onError?:(error:unknown)=>void}} [spec]
 */
export function holdControls(document, controls, spec = {}) {
  const { time = 0, onError } = spec;
  assert(
    document && typeof document.createElement === 'function',
    'INVALID_STORY_CONTROLS',
    'holdControls needs a document.',
  );
  const group = document.createElement('div'),
    touched = new Set(),
    cleanups = [];
  group.className = 'explainerkit-story-controls';
  group.setAttribute('role', 'group');
  const show = (c, v) =>
    text(
      c.format ? String(c.format(v)) : String(+v.toFixed(clamp(-Math.floor(Math.log10(c.step)), 0, 6))),
      'control value',
      200,
    );
  for (const c of controls) {
    const label = document.createElement('label'),
      name = document.createElement('span'),
      input = document.createElement('input'),
      out = document.createElement('output');
    label.className = 'explainerkit-story-control';
    name.textContent = c.label;
    input.type = 'range';
    input.min = String(c.min);
    input.max = String(c.max);
    input.step = String(c.step);
    const start = clamp(c.parameter.sample(time), c.min, c.max);
    input.value = String(start);
    out.textContent = show(c, start);
    input.setAttribute('aria-valuetext', out.textContent);
    out.setAttribute('aria-hidden', 'true');
    const change = () => {
      try {
        const v = clamp(Number(input.value), c.min, c.max);
        touched.add(c.parameter);
        c.parameter.override(v);
        out.textContent = show(c, v);
        input.setAttribute('aria-valuetext', out.textContent);
      } catch (error) {
        if (onError) onError(error);
        else throw error;
      }
    };
    input.addEventListener('input', change);
    cleanups.push(() => input.removeEventListener('input', change));
    label.append(name, input, out);
    group.append(label);
  }
  let done = false;
  return Object.freeze({
    element: group,
    dispose() {
      if (done) return;
      done = true;
      for (const fn of cleanups) fn();
      group.remove?.();
      for (const p of touched) p.release();
      touched.clear();
    },
  });
}

const leases = new WeakMap();
/** Native scroll driver. A CSS sticky stage stays in normal document flow. */
export function attachStory(player, spec = {}) {
  options(
    spec,
    [
      'acts',
      'element',
      'container',
      'sticky',
      'smoothing',
      'snap',
      'snapDelay',
      'snapDistance',
      'onError',
      'onAct',
      'onProgress',
      'onHold',
      'reset',
      'reducedMotion',
      'steps',
      'narrow',
      'holdControls',
      'arrival',
      'arrivalSeconds',
      'arrivalWait',
      'ready',
      'onArrival',
      'onPace',
      'paceBounds',
      'cues',
    ],
    'story options',
  );
  assert(
    player &&
      ['seek', 'pause', 'setDriver', 'on', 'reportError'].every((key) => typeof player[key] === 'function') &&
      !player.disposed,
    'INVALID_PLAYER',
    'Story needs a live ExplainerKit player.',
  );
  const element = spec.element ?? player.element?.parentElement,
    win = element?.ownerDocument?.defaultView;
  assert(
    win && typeof element.getBoundingClientRect === 'function',
    'INVALID_STORY_ELEMENT',
    'Provide a story region element.',
  );
  const container = spec.container ?? win,
    sticky = spec.sticky === false ? null : (spec.sticky ?? player.element);
  assert(
    container === win ||
      (container?.ownerDocument === element.ownerDocument && container !== element && container.contains(element)),
    'INVALID_SCROLL_CONTAINER',
    'The container must be the window or an ancestor of the story region.',
  );
  assert(
    !sticky || (sticky !== element && element.contains(sticky) && sticky.style),
    'INVALID_STORY_STICKY',
    'The sticky stage must be inside the story region.',
  );
  assert(
    !leases.has(element) && (!sticky || !leases.has(sticky)),
    'STORY_OWNED',
    'Detach the existing story before reusing its region or stage.',
  );
  const smoothing = number(spec.smoothing ?? 0, 'story smoothing', 0, 2),
    snap = spec.snap ?? false;
  assert(snap === false || snap === 'holds', 'INVALID_STORY_SNAP', 'Use false or holds for snap.');
  const snapDelay = number(spec.snapDelay ?? 220, 'snap delay', 50, 5000),
    snapDistance = number(spec.snapDistance ?? 0.25, 'snap distance', 0, 1);
  assert(
    spec.onError === undefined || typeof spec.onError === 'function',
    'INVALID_ERROR_HANDLER',
    'onError must be a function.',
  );
  for (const key of ['onAct', 'onProgress', 'onHold'])
    assert(
      spec[key] === undefined || typeof spec[key] === 'function',
      'INVALID_STORY_OPTIONS',
      `${key} must be a function.`,
    );
  // reset:true restores authored parameters on every scroll seek; false keeps what the reader changed in a hold.
  // Reader overrides from hold controls survive either way: Parameter.reset() keeps overrides, the story releases them.
  const reset = spec.reset ?? true;
  assert(typeof reset === 'boolean', 'INVALID_STORY_OPTIONS', 'reset must be boolean.');
  const renderControls = spec.holdControls ?? true;
  assert(typeof renderControls === 'boolean', 'INVALID_STORY_OPTIONS', 'holdControls must be boolean.');
  const narrowWidth = number(spec.narrow ?? 900, 'narrow width', 0, 16384);
  assert(
    typeof win.requestAnimationFrame === 'function' && typeof win.setTimeout === 'function',
    'UNSUPPORTED_BROWSER',
    'Story needs animation frames and timers.',
  );
  // Arriving part-way (reload, back/forward, a link): jump (default), travel from the start, replay this act, or top.
  const arrival = spec.arrival ?? 'jump';
  assert(ARRIVALS.includes(arrival), 'INVALID_STORY_OPTIONS', 'arrival must be jump, travel, chapter or top.');
  const arrivalSeconds =
      spec.arrivalSeconds === undefined ? null : number(spec.arrivalSeconds, 'arrival seconds', 0, 30),
    arrivalWait = number(spec.arrivalWait ?? 4000, 'arrival wait', 0, 30000);
  for (const key of ['ready', 'onArrival', 'onPace'])
    assert(
      spec[key] === undefined || typeof spec[key] === 'function',
      'INVALID_STORY_OPTIONS',
      `${key} must be a function.`,
    );
  const clockRaw = () => win.performance?.now?.() ?? Date.now(),
    clockOrigin = clockRaw(),
    clockNow = () => clockRaw() - clockOrigin; // milliseconds since attach
  const reducedPolicy = spec.reducedMotion ?? 'continuous';
  assert(
    ['continuous', 'stills'].includes(reducedPolicy),
    'INVALID_STORY_OPTIONS',
    'reducedMotion must be continuous or stills.',
  );
  let { plain: acts, controls } = splitActs(spec.acts);
  const cues = captureCues(spec.cues);
  acts = safeCopy(acts);
  const media = win.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null,
    cleanups = [];
  let currentAct = null,
    disposed = false,
    request = null,
    timer = null,
    observer = null,
    unsubDispose = null,
    unsubDriver = null,
    map = null,
    displayed = null,
    lastStamp = null,
    pointer = false,
    owned = false,
    progressKey = null,
    holdKey = null,
    holdState = null,
    live = null,
    lastPaceAt = 0;
  const viewport = () =>
    number(container === win ? win.innerHeight : container.clientHeight, 'story viewport height', 1, 16384);
  // Build and validate before acquiring player ownership or changing the document.
  map = storyTimeline(acts, { duration: player.duration, viewportHeight: viewport() });
  const pace = scrollPace({ viewportHeight: viewport(), ...(spec.paceBounds ? { bounds: spec.paceBounds } : {}) });
  let paceNow = pace.sample(0);
  const cueState = cueController(cues, map, () => !disposed);
  const arriving = arrivalController({
    mode: arrival,
    seconds: arrivalSeconds,
    ready: spec.ready,
    wait: arrivalWait,
    onArrival: spec.onArrival,
    now: clockNow,
    schedule: () => schedule(),
    timer: (fn, ms) => (typeof win.setTimeout === 'function' ? win.setTimeout(fn, ms) : globalThis.setTimeout(fn, ms)),
    report: (error) => fail(error),
  });
  const cards = resolveSteps(spec.steps);
  checkSteps(map);
  const narrowBefore = !!element.classList?.contains('explainerkit-story-narrow');
  const saved = [];
  function style(node, key, value) {
    if (!saved.some((s) => s.node === node && s.key === key))
      saved.push({ node, key, value: node.style.getPropertyValue(key), priority: node.style.getPropertyPriority(key) });
    if (node.style.getPropertyValue(key) !== value) node.style.setProperty(key, value);
  }
  function resolveSteps(steps) {
    if (steps === undefined) return [];
    const list = typeof steps === 'string' ? [...element.querySelectorAll(text(steps, 'steps selector', 500))] : steps;
    assert(
      list && typeof list.length === 'number' && list.length <= 256,
      'INVALID_STORY_STEPS',
      'steps must be a selector or a list of at most 256 elements.',
    );
    const nodes = Array.from({ length: list.length }, (_, i) => list[i]),
      seen = new Set();
    return nodes.map((node, i) => {
      assert(
        node &&
          node.ownerDocument === element.ownerDocument &&
          node.style &&
          node.classList &&
          node.parentNode &&
          element.contains(node) &&
          node !== sticky &&
          !seen.has(node),
        'INVALID_STORY_STEPS',
        'Each step must be a distinct element inside the story region.',
      );
      seen.add(node);
      const named = node.getAttribute?.('data-act');
      return { node, act: named ?? null, order: i, active: node.classList.contains('active'), slot: null };
    });
  }
  // Steps name their act with data-act; unnamed steps take acts in document order.
  function checkSteps(timeline) {
    const used = new Set();
    for (const card of cards) {
      const id = card.act ?? timeline.acts[card.order]?.id;
      assert(
        timeline.acts.some((a) => a.id === id) && !used.has(id),
        'INVALID_STORY_STEPS',
        `Step ${card.order + 1} must name a distinct act (data-act).`,
      );
      used.add(id);
    }
  }
  const stepFor = (id) => cards.find((card) => (card.act ?? map.acts[card.order]?.id) === id) ?? null;
  function layoutSteps() {
    if (!cards.length) return;
    const width = container === win ? win.innerWidth : container.clientWidth,
      narrow = typeof width === 'number' && width < narrowWidth;
    element.classList?.toggle('explainerkit-story-narrow', narrow);
    const stage = sticky?.getBoundingClientRect?.().height;
    if (Number.isFinite(stage)) style(element, '--explainerkit-stage-height', `${Math.round(stage)}px`);
    const regionTop = element.getBoundingClientRect().top;
    for (const card of cards) {
      const act = map.acts.find((a) => a.id === (card.act ?? map.acts[card.order].id)),
        parent = card.slot.offsetParent,
        shift =
          parent && parent !== element && typeof parent.getBoundingClientRect === 'function'
            ? parent.getBoundingClientRect().top + (parent.clientTop ?? 0) - regionTop
            : 0;
      style(card.slot, 'position', 'absolute');
      style(card.slot, 'top', `${act.start - shift}px`);
      style(card.slot, 'height', `${act.length}px`);
      style(card.node, 'position', 'sticky');
      style(
        card.node,
        'top',
        narrow
          ? 'var(--explainerkit-step-top, calc(var(--explainerkit-stage-height, 0px) + 16px))'
          : 'var(--explainerkit-step-top, 20vh)',
      );
    }
  }
  function mountSteps() {
    if (!cards.length) return;
    if (typeof win.getComputedStyle === 'function' && win.getComputedStyle(element).position === 'static')
      style(element, 'position', 'relative');
    for (const card of cards) {
      const slot = element.ownerDocument.createElement('div');
      slot.className = 'explainerkit-step-slot';
      slot.setAttribute('data-act', card.act ?? map.acts[card.order].id);
      card.node.replaceWith(slot);
      slot.append(card.node);
      card.slot = slot;
    }
  }
  function unmountSteps() {
    for (const card of cards) {
      if (!card.slot) continue;
      if (card.slot.parentNode) card.slot.replaceWith(card.node);
      else card.slot.remove?.();
      card.slot = null;
      card.node.classList.toggle('active', card.active);
    }
    if (cards.length) element.classList?.toggle('explainerkit-story-narrow', narrowBefore);
  }
  function geometry() {
    const top = container === win ? 0 : container.getBoundingClientRect().top + (container.clientTop ?? 0);
    return top - element.getBoundingClientRect().top;
  }
  // Announce the act under the scroll position whenever it changes, for preloading or chapter UI.
  function announce(sampled) {
    if (sampled.act === currentAct) return;
    currentAct = sampled.act;
    for (const card of cards)
      card.node.classList.toggle('active', (card.act ?? map.acts[card.order].id) === currentAct);
    spec.onAct?.(sampled.act, sampled.index);
  }
  function progress(sampled) {
    const key = `${sampled.act}:${sampled.progress}`;
    if (key === progressKey) return;
    progressKey = key;
    spec.onProgress?.(sampled.act, sampled.progress, sampled.index);
  }
  // The hold on screen owns its controls; leaving it (or the act) releases every override it applied.
  function hold(sampled) {
    const key = sampled.hold === null ? null : `${sampled.index}:${sampled.hold}`,
      list = key && controls.get(key);
    if ((list ? key : null) === holdKey) return;
    leaveHold();
    if (!list) return;
    holdKey = key;
    const act = map.acts[sampled.index],
      card = stepFor(act.id),
      mark = act.holds[sampled.hold];
    holdState = Object.freeze({ act: act.id, index: sampled.index, hold: sampled.hold, at: mark.at, controls: list });
    if (renderControls && card) {
      live = holdControls(element.ownerDocument, list, { time: mark.at, onError: fail });
      live.element.setAttribute('aria-label', `Controls for ${act.id}`);
      card.node.append(live.element);
    }
    spec.onHold?.(holdState);
  }
  function leaveHold() {
    if (holdKey === null) return;
    const list = controls.get(holdKey);
    live?.dispose();
    live = null;
    for (const c of list ?? []) c.parameter.release();
    holdKey = null;
    holdState = null;
    spec.onHold?.(null);
  }
  function track(sampled, position = sampled.position) {
    announce(sampled);
    if (disposed) return;
    progress(sampled);
    if (disposed) return;
    hold(sampled);
    if (disposed) return;
    if (cues.length) cueState.advance(sampled, pace.sample(Math.max(clockNow(), lastPaceAt)), media?.matches, position);
  }
  function commit(time) {
    if (time !== displayed) {
      player.seek(time, { reset, source: 'scroll' });
      displayed = time;
    }
  }
  function present(sampled, timeline = map) {
    return media?.matches && reducedPolicy === 'stills' && sampled.position < timeline.length
      ? timeline.acts[sampled.index].from
      : sampled.time;
  }
  function resize() {
    const candidate = storyTimeline(acts, { duration: player.duration, viewportHeight: viewport() });
    cueState.validate(candidate);
    map = candidate;
    cueState.remap(map);
    pace.resize(viewport());
    style(element, 'height', `${viewport() + map.length}px`);
    if (sticky) {
      style(sticky, 'position', 'sticky');
      style(sticky, 'top', '0px');
    }
    layoutSteps();
  }
  function cancelSnap() {
    if (timer !== null) win.clearTimeout(timer);
    timer = null;
  }
  function fail(error) {
    dispose();
    if (spec.onError) spec.onError(error);
    else player.reportError(error);
  }
  function tick(stamp) {
    request = null;
    if (disposed) return;
    try {
      const position = geometry(),
        sampled = map.sample(position),
        target = present(sampled);
      track(sampled, position);
      if (disposed) return;
      offerArrival(position, sampled);
      const arrivingAt = media?.matches ? null : arriving.timeFor(target);
      if (arrivingAt !== null) {
        commit(arrivingAt);
        lastStamp = null;
        schedule();
        return;
      }
      if (!smoothing || media?.matches || displayed === null) {
        commit(target);
        lastStamp = null;
        return;
      }
      const delta = lastStamp === null ? 16 : clamp(stamp - lastStamp, 1, 100);
      lastStamp = stamp;
      const next = displayed + (target - displayed) * (1 - Math.exp(-delta / (smoothing * 1000)));
      if (Math.abs(target - next) < 0.001) {
        commit(target);
        lastStamp = null;
      } else {
        commit(next);
        schedule();
      }
    } catch (error) {
      fail(error);
    }
  }
  function schedule() {
    if (!disposed && request === null) request = win.requestAnimationFrame(tick);
  }
  /** Opening part-way: plan the way in from the act under the position. `top` scrolls back to the start. */
  function offerArrival(position, sampled) {
    const plan = arriving.offer(
      position,
      viewport(),
      (mode, seconds) =>
        arrivalPlan({
          mode,
          seconds,
          time: present(sampled),
          duration: player.duration,
          chapters: map.acts.map((a) => a.from).filter((t, i, all) => i === 0 || t > all[i - 1]),
        }),
      sampled.act,
    );
    if (plan?.rewind) {
      const current = container === win ? win.scrollY : container.scrollTop;
      container.scrollTo({ top: current - position, behavior: 'instant' });
    }
  }
  function snapNow() {
    timer = null;
    if (disposed || pointer || media?.matches || !map.holds.length) return;
    try {
      const position = geometry();
      if (position < 0 || position > map.length) return;
      const nearest = map.holds.reduce((best, value) =>
        Math.abs(value - position) < Math.abs(best - position) ? value : best,
      );
      const delta = nearest - position;
      if (Math.abs(delta) < 0.5 || Math.abs(delta) > viewport() * snapDistance) return;
      const current = container === win ? win.scrollY : container.scrollTop;
      container.scrollTo({ top: current + delta, behavior: 'instant' });
    } catch (error) {
      fail(error);
    }
  }
  function scroll(event) {
    const reading = pace.add(geometry(), Math.max(clockNow(), lastPaceAt));
    lastPaceAt = Math.max(clockNow(), lastPaceAt);
    if (reading.pace !== paceNow.pace || reading.direction !== paceNow.direction) spec.onPace?.(reading);
    paceNow = reading;
    void event;
    schedule();
    cancelSnap();
    if (snap && !pointer && !media?.matches) timer = win.setTimeout(snapNow, snapDelay);
  }
  function interrupt() {
    cancelSnap();
    arriving.touch();
  }
  function down() {
    pointer = true;
    interrupt();
  }
  function up() {
    pointer = false;
  }
  function resized() {
    try {
      resize();
      schedule();
    } catch (error) {
      fail(error);
    }
  }
  function update(next = {}) {
    assert(!disposed, 'DISPOSED', 'This story has been disposed.');
    options(next, ['acts'], 'story update');
    const split = next.acts === undefined ? { plain: acts, controls } : splitActs(next.acts),
      candidateActs = next.acts === undefined ? acts : safeCopy(split.plain);
    const candidate = storyTimeline(candidateActs, { duration: player.duration, viewportHeight: viewport() }),
      position = geometry(),
      sampled = candidate.sample(position);
    checkSteps(candidate);
    cueState.validate(candidate);
    // Validate and sample first. Invalid replacements keep the prior map, styles and driver.
    if (next.acts !== undefined) leaveHold();
    player.seek(present(sampled, candidate), { reset, source: 'scroll' });
    if (disposed) return api;
    acts = candidateActs;
    controls = split.controls;
    map = candidate;
    cueState.remap(map);
    displayed = present(sampled, candidate);
    lastStamp = null;
    if (request !== null) win.cancelAnimationFrame(request);
    request = null;
    cancelSnap();
    style(element, 'height', `${viewport() + map.length}px`);
    layoutSteps();
    progressKey = null;
    track(sampled, position);
    return api;
  }
  function refresh() {
    if (disposed) return;
    return update();
  }
  function listen(target, name, fn) {
    target.addEventListener(name, fn, { passive: true });
    cleanups.push(() => target.removeEventListener(name, fn));
  }
  function dispose(release = true) {
    if (disposed) return;
    disposed = true;
    cueState.dispose();
    cancelSnap();
    if (request !== null) win.cancelAnimationFrame(request);
    request = null;
    observer?.disconnect();
    for (const cleanup of cleanups) cleanup();
    unsubDispose?.();
    unsubDriver?.();
    try {
      leaveHold();
    } catch {
      /* Disposal stays terminal. */
    }
    unmountSteps();
    for (const record of saved) {
      if (record.value) record.node.style.setProperty(record.key, record.value, record.priority);
      else record.node.style.removeProperty(record.key);
    }
    leases.delete(element);
    if (sticky) leases.delete(sticky);
    if (release && owned && !player.disposed && player.driver === 'scroll') player.setDriver(null);
    owned = false;
  }
  function seekTime(time, seekOptions = {}) {
    assert(!disposed, 'DISPOSED', 'This story has been disposed.');
    options(seekOptions, ['hold'], 'story seek');
    const position = map.positionAt(time, seekOptions),
      current = container === win ? win.scrollY : container.scrollTop;
    cancelSnap();
    container.scrollTo({ top: current + position - geometry(), behavior: 'instant' });
    schedule();
    return api;
  }
  const api = Object.freeze({
    get timeline() {
      return map;
    },
    get act() {
      return currentAct;
    },
    get hold() {
      return holdState;
    },
    get disposed() {
      return disposed;
    },
    /** The reader's scroll pace now: velocity (px/s), speed (viewports/s), direction and pace class. */
    get pace() {
      return disposed ? paceNow : pace.sample(Math.max(clockNow(), lastPaceAt));
    },
    /** The arrival plan when the story opened part-way (with waiting and done), else null. */
    get arrival() {
      return arriving.state;
    },
    refresh,
    update,
    dispose,
    seekTime,
  });
  player.setDriver('scroll');
  assert(
    !player.disposed && player.driver === 'scroll',
    'DRIVER_OWNED',
    'Player ownership changed while the story was attaching.',
  );
  owned = true;
  try {
    leases.set(element, true);
    if (sticky) leases.set(sticky, true);
    unsubDispose = player.on('dispose', () => dispose(false));
    unsubDriver = player.on('driver', (driver) => {
      if (driver !== 'scroll') dispose(false);
    });
    player.pause();
    assert(
      !disposed && !player.disposed && player.driver === 'scroll',
      'DRIVER_OWNED',
      'Player ownership changed while the story was attaching.',
    );
    mountSteps();
    resize();
    listen(container, 'scroll', scroll);
    listen(win, 'resize', resized);
    listen(container, 'wheel', interrupt);
    listen(container, 'touchstart', interrupt);
    listen(container, 'pointerdown', down);
    listen(win, 'pointerup', up);
    listen(win, 'pointercancel', up);
    listen(win, 'keydown', interrupt);
    media?.addEventListener?.('change', schedule);
    cleanups.push(() => media?.removeEventListener?.('change', schedule));
    if (win.ResizeObserver) {
      observer = new win.ResizeObserver(resized);
      observer.observe(element);
      if (container !== win) observer.observe(container);
    }
    refresh();
    if (disposed) return api;
    // Already part-way down at attach (a restored position): begin the way in before the first paint.
    const position = geometry(),
      sampled = map.sample(position);
    offerArrival(position, sampled);
    const first = arriving.timeFor(present(sampled));
    if (first !== null && !media?.matches) {
      commit(first);
      schedule();
    }
  } catch (error) {
    dispose();
    throw error;
  }
  return api;
}
