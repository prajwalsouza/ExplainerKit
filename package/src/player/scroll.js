import { assert, number, options } from '../core/validate.js';
import { arrivalController, arrivalPlan, scrollPace, ARRIVALS } from './pace.js';

export { scrollPace, arrivalPlan, arrivalTime, SCROLL_PACES, DEFAULT_PACE_BOUNDS, ARRIVALS } from './pace.js';

/** Clamp a position into an authored interval. A zero-length interval is a cut. */
export function scrollProgress({ position, start = 0, end }) {
  number(position, 'scroll position');
  number(start, 'scroll start');
  number(end, 'scroll end');
  assert(end >= start, 'INVALID_SCROLL_RANGE', 'Scroll end must not precede start.');
  if (end === start) return position < start ? 0 : 1;
  return Math.max(0, Math.min(1, (position - start) / (end - start)));
}

function checkedChapters(chapters, duration) {
  assert(
    Array.isArray(chapters) && chapters.length >= 1 && chapters.length <= 1000,
    'INVALID_CHAPTERS',
    'Chapters must be a nonempty array with at most 1000 times.',
  );
  const result = chapters.map((time, i) => {
    number(time, 'chapter time', 0, duration);
    assert(i === 0 || time > chapters[i - 1], 'INVALID_CHAPTERS', 'Chapter times must strictly increase.');
    return time;
  });
  assert(
    result[0] === 0 && result.at(-1) === duration,
    'INVALID_CHAPTERS',
    'Chapter times must include zero and the duration.',
  );
  return result;
}

/** Map progress to time, optionally selecting the latest reached chapter. */
export function scrollTime(progress, duration, chapters = null) {
  number(progress, 'scroll progress');
  number(duration, 'duration', 0);
  const time = Math.max(0, Math.min(1, progress)) * duration;
  if (chapters === null) return time;
  const times = checkedChapters(chapters, duration);
  let result = 0;
  for (const chapter of times) {
    if (chapter > time) break;
    result = chapter;
  }
  return result;
}

/**
 * Drive an existing player from native scrolling. The region should be an
 * untransformed block containing a sticky stage; this driver does not pin it.
 * start/end are pixel offsets into the region's available scroll travel.
 * reducedMotion:'chapters' quantizes only when the media query requests it.
 * A later scheduled failure detaches and reports through onError or the player.
 * Initial attachment and explicit refresh failures remain synchronous errors.
 */
export function attachScroll(player, config) {
  options(
    config,
    [
      'element',
      'container',
      'start',
      'end',
      'reducedMotion',
      'chapters',
      'onError',
      'arrival',
      'arrivalSeconds',
      'arrivalWait',
      'ready',
      'onArrival',
      'onPace',
      'paceBounds',
    ],
    'scroll options',
  );
  const { element, start = 0, end, reducedMotion = 'chapters' } = config;
  assert(
    element?.ownerDocument?.defaultView && typeof element.getBoundingClientRect === 'function',
    'INVALID_SCROLL_ELEMENT',
    'Scroll needs a region element in a browser document.',
  );
  const win = element.ownerDocument.defaultView;
  const container = config.container ?? win;
  assert(
    container === win ||
      (container?.ownerDocument === element.ownerDocument && typeof container.getBoundingClientRect === 'function'),
    'INVALID_SCROLL_CONTAINER',
    'Use this document window or a scroll container in the same document.',
  );
  assert(
    container === win || container === element || container.contains(element),
    'INVALID_SCROLL_CONTAINER',
    'The scroll container must contain the region.',
  );
  assert(
    container !== element,
    'INVALID_SCROLL_CONTAINER',
    'The region must be inside, not identical to, its scroll container.',
  );
  number(start, 'scroll start', 0);
  if (end !== undefined) {
    number(end, 'scroll end', 0);
    assert(end >= start, 'INVALID_SCROLL_RANGE', 'Scroll end must not precede start.');
  }
  assert(
    ['continuous', 'chapters'].includes(reducedMotion),
    'INVALID_REDUCED_MOTION',
    'Use chapters or continuous for reducedMotion.',
  );
  assert(
    player &&
      typeof player.seek === 'function' &&
      typeof player.pause === 'function' &&
      typeof player.setDriver === 'function' &&
      typeof player.on === 'function',
    'INVALID_PLAYER',
    'Scroll needs an ExplainerKit player.',
  );
  assert(
    config.onError === undefined || typeof config.onError === 'function',
    'INVALID_ERROR_HANDLER',
    'Scroll onError must be a function.',
  );
  assert(typeof player.reportError === 'function', 'INVALID_PLAYER', 'Scroll needs a player with error reporting.');
  assert(!player.disposed, 'DISPOSED', 'Cannot attach scroll to a disposed player.');
  const duration = number(player.duration, 'duration', 0);
  const chapters = checkedChapters(config.chapters ?? (duration === 0 ? [0] : [0, duration]), duration);
  assert(
    typeof win.requestAnimationFrame === 'function' && typeof win.cancelAnimationFrame === 'function',
    'UNSUPPORTED_BROWSER',
    'Scroll requires requestAnimationFrame.',
  );
  const media = typeof win.matchMedia === 'function' ? win.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const arrival = config.arrival ?? 'jump';
  assert(ARRIVALS.includes(arrival), 'INVALID_ARRIVAL', 'arrival must be jump, travel, chapter or top.');
  for (const key of ['ready', 'onArrival', 'onPace'])
    assert(
      config[key] === undefined || typeof config[key] === 'function',
      'INVALID_SCROLL_OPTIONS',
      `${key} must be a function.`,
    );
  const clockRaw = () => win.performance?.now?.() ?? Date.now(),
    clockOrigin = clockRaw(),
    clockNow = () => clockRaw() - clockOrigin; // milliseconds since attach
  let disposed = false,
    pending = null,
    observer = null,
    unsubscribe = null,
    lastTime = null,
    lastPaceAt = 0;
  const viewportOf = () =>
    number(container === win ? win.innerHeight : container.clientHeight, 'scroll viewport height', 0);
  const pace = scrollPace({
    viewportHeight: Math.max(1, viewportOf()),
    ...(config.paceBounds ? { bounds: config.paceBounds } : {}),
  });
  let paceNow = pace.sample(0);
  const arriving = arrivalController({
    mode: arrival,
    seconds: config.arrivalSeconds === undefined ? null : number(config.arrivalSeconds, 'arrival seconds', 0, 30),
    ready: config.ready,
    wait: number(config.arrivalWait ?? 4000, 'arrival wait', 0, 30000),
    onArrival: config.onArrival,
    now: clockNow,
    schedule: () => schedule(),
    timer: (fn, ms) => (typeof win.setTimeout === 'function' ? win.setTimeout(fn, ms) : globalThis.setTimeout(fn, ms)),
    report: (error) => player.reportError(error),
  });
  const positionOf = () => {
    const top = container === win ? 0 : container.getBoundingClientRect().top + (container.clientTop ?? 0);
    return top - element.getBoundingClientRect().top;
  };

  function refresh() {
    if (disposed || player.disposed) return;
    if (pending !== null) {
      win.cancelAnimationFrame(pending);
      pending = null;
    }
    const viewportHeight = container === win ? win.innerHeight : container.clientHeight;
    number(viewportHeight, 'scroll viewport height', 0);
    if (viewportHeight >= 1) pace.resize(viewportHeight);
    const top = container === win ? 0 : container.getBoundingClientRect().top + (container.clientTop ?? 0);
    const position = top - element.getBoundingClientRect().top;
    const regionHeight = number(element.scrollHeight, 'scroll region height', 0);
    // A region shorter than the viewport is a cut at start, not a negative span.
    const finish = end ?? Math.max(start, regionHeight - viewportHeight);
    const progress = scrollProgress({ position, start, end: finish });
    const target = scrollTime(progress, duration, reducedMotion === 'chapters' && media?.matches ? chapters : null);
    // Opening part-way (a restored position): plan the way in once, before any reader input.
    const plan = arriving.offer(
      position,
      Math.max(1, viewportHeight),
      (mode, seconds) => arrivalPlan({ mode, seconds, time: target, duration, chapters }),
      null,
    );
    if (plan?.rewind)
      container.scrollTo({
        top: (container === win ? win.scrollY : container.scrollTop) - position + start,
        behavior: 'instant',
      });
    const arrivingAt = media?.matches ? null : arriving.timeFor(target);
    // Sampling is deterministic. Only the reader's position, not scroll velocity (pace), determines the
    // selected time, apart from a bounded arrival replay; repeated identical events do no render work.
    const time = arrivingAt ?? target;
    if (time !== lastTime) {
      player.seek(time, { reset: true, source: 'scroll' });
      lastTime = time;
    }
    if (arrivingAt !== null) schedule();
  }
  function scrolled() {
    lastPaceAt = Math.max(clockNow(), lastPaceAt);
    const reading = pace.add(positionOf(), lastPaceAt);
    if (reading.pace !== paceNow.pace || reading.direction !== paceNow.direction) config.onPace?.(reading);
    paceNow = reading;
    schedule();
  }
  const touch = () => arriving.touch();
  function schedule() {
    if (!disposed && !player.disposed && pending === null)
      pending = win.requestAnimationFrame(() => {
        pending = null;
        try {
          refresh();
        } catch (error) {
          // Player seeks are atomic: a failed sample leaves the last valid frame.
          // Release ownership before notification so recovery can attach a driver.
          dispose();
          if (config.onError) config.onError(error);
          else player.reportError(error);
        }
      });
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (pending !== null) win.cancelAnimationFrame(pending);
    pending = null;
    container.removeEventListener('scroll', scrolled);
    win.removeEventListener('resize', schedule);
    for (const name of ['wheel', 'touchstart', 'pointerdown', 'keydown']) win.removeEventListener(name, touch);
    media?.removeEventListener?.('change', schedule);
    observer?.disconnect();
    unsubscribe?.();
    if (!player.disposed) player.setDriver(null);
  }

  // Ownership acquisition precedes listeners, so a competing driver cannot
  // leave a half-attached scroller behind.
  player.setDriver('scroll');
  try {
    player.pause();
    container.addEventListener('scroll', scrolled, { passive: true });
    win.addEventListener('resize', schedule, { passive: true });
    for (const name of ['wheel', 'touchstart', 'pointerdown', 'keydown'])
      win.addEventListener(name, touch, { passive: true });
    media?.addEventListener?.('change', schedule);
    if (typeof win.ResizeObserver === 'function') {
      observer = new win.ResizeObserver(schedule);
      observer.observe(element);
      if (container !== win) observer.observe(container);
    }
    unsubscribe = player.on('dispose', dispose);
    refresh();
  } catch (error) {
    dispose();
    throw error;
  }
  return Object.freeze({
    refresh,
    dispose,
    /** The reader's scroll pace now: velocity (px/s), speed (viewports/s), direction and pace class. */
    get pace() {
      return disposed ? paceNow : pace.sample(Math.max(clockNow(), lastPaceAt));
    },
    /** The arrival plan when the scroll opened part-way (with waiting and done), else null. */
    get arrival() {
      return arriving.state;
    },
  });
}
