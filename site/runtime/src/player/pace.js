import { assert, number, options } from '../core/validate.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Reading paces, slowest first. */
export const SCROLL_PACES = Object.freeze(['still', 'reading', 'skimming', 'rushing']);
/** Upper speeds (viewport heights per second) of still, reading and skimming; anything faster is rushing. */
export const DEFAULT_PACE_BOUNDS = Object.freeze([0.05, 1.2, 4]);
const CAPACITY = 32;

/**
 * Scroll velocity as a signal. Feed positions (pixels) with timestamps (milliseconds); read the velocity and a
 * pace class. Pace never changes which time a story shows (position alone does, so seeking stays exact): use it
 * to choose how a transition plays (a figure walks off when reading, fades when rushing) and what to load next
 * (direction and speed predict the next act). Bounded: it keeps at most 32 samples.
 */
export function scrollPace(spec = {}) {
  options(spec, ['viewportHeight', 'window', 'bounds'], 'scroll pace');
  let height = number(spec.viewportHeight ?? 800, 'viewport height', 1, 16384);
  const span = number(spec.window ?? 180, 'pace window', 16, 2000);
  const bounds = spec.bounds ?? DEFAULT_PACE_BOUNDS;
  assert(
    Array.isArray(bounds) &&
      bounds.length === 3 &&
      bounds.every((b, i) => Number.isFinite(b) && b > 0 && (i === 0 || b > bounds[i - 1])),
    'INVALID_PACE_BOUNDS',
    'Pace bounds must be three increasing positive speeds, in viewport heights per second.',
  );
  const xs = new Float64Array(CAPACITY),
    ts = new Float64Array(CAPACITY);
  let count = 0,
    head = 0;
  function sample(time) {
    number(time, 'pace time');
    if (!count) return freeze(0, 0);
    const last = (head - 1 + CAPACITY) % CAPACITY,
      position = xs[last];
    // The oldest sample still inside the window before the newest: a short secant, steady against jitter.
    let first = last;
    for (let k = 1; k < count; k++) {
      const i = (last - k + CAPACITY) % CAPACITY;
      if (ts[last] - ts[i] > span) break;
      first = i;
    }
    let velocity = first === last ? 0 : (xs[last] - xs[first]) / ((ts[last] - ts[first]) / 1000);
    // No new samples: the reader has stopped. Velocity eases out over one window after the last event.
    const age = time - ts[last];
    if (age > span / 2) velocity *= Math.exp(-(age - span / 2) / (span / 2));
    return freeze(position, Math.abs(velocity) < 1e-3 ? 0 : velocity);
  }
  function freeze(position, velocity) {
    const speed = Math.abs(velocity) / height,
      pace = speed < bounds[0] ? 'still' : speed < bounds[1] ? 'reading' : speed < bounds[2] ? 'skimming' : 'rushing';
    return Object.freeze({ position, velocity, speed, direction: Math.sign(velocity), pace });
  }
  return Object.freeze({
    /** Record a position at a time (milliseconds, increasing) and return the pace there. */
    add(position, time) {
      number(position, 'pace position');
      number(time, 'pace time');
      if (count) {
        const last = (head - 1 + CAPACITY) % CAPACITY;
        assert(time >= ts[last], 'INVALID_PACE_TIME', 'Pace times must not decrease.');
        if (time === ts[last]) {
          xs[last] = position;
          return sample(time);
        }
      }
      xs[head] = position;
      ts[head] = time;
      head = (head + 1) % CAPACITY;
      count = Math.min(CAPACITY, count + 1);
      return sample(time);
    },
    sample,
    /** A new viewport height (speeds are in viewports per second). */
    resize(viewportHeight) {
      height = number(viewportHeight, 'viewport height', 1, 16384);
    },
    reset() {
      count = 0;
      head = 0;
    },
  });
}

/** Ways into a story that opens part-way: show it, replay from the start, replay this act, or rewind. */
export const ARRIVALS = Object.freeze(['jump', 'travel', 'chapter', 'top']);

/**
 * The plan for arriving part-way into a story (a reload, back/forward, or a link to a chapter): the time to show
 * first, the time to reach, and how many seconds to take. Pure. `chapters` are the story's act or chapter start
 * times in increasing order. Default seconds grow with the share of the story replayed, from 0.5 to 2.4 s.
 */
export function arrivalPlan({ mode = 'jump', time, duration, chapters = [0], seconds = null }) {
  assert(ARRIVALS.includes(mode), 'INVALID_ARRIVAL', 'Arrival must be jump, travel, chapter or top.');
  number(duration, 'duration', 0);
  number(time, 'arrival time', 0, duration);
  assert(
    Array.isArray(chapters) && chapters.length >= 1 && chapters.length <= 1000,
    'INVALID_CHAPTERS',
    'Arrival chapters must be a nonempty list of at most 1000 times.',
  );
  let start = 0;
  for (const [i, at] of chapters.entries()) {
    number(at, 'chapter time', 0, duration);
    assert(i === 0 || at > chapters[i - 1], 'INVALID_CHAPTERS', 'Chapter times must strictly increase.');
    if (at <= time) start = at;
  }
  const from = mode === 'travel' ? 0 : mode === 'chapter' ? start : mode === 'top' ? 0 : time,
    to = mode === 'top' ? 0 : time,
    share = duration > 0 ? (to - from) / duration : 0,
    span =
      to === from
        ? 0
        : seconds === null
          ? clamp(0.5 + 1.9 * Math.sqrt(share), 0.5, 2.4)
          : number(seconds, 'arrival seconds', 0, 30);
  return Object.freeze({ mode, from, to, seconds: span, rewind: mode === 'top' });
}

/** The time an arrival shows `elapsed` seconds in (ease in and out); `to` may follow a moving target. */
export function arrivalTime(plan, elapsed, to = plan.to) {
  number(elapsed, 'arrival elapsed');
  if (!(plan.seconds > 0)) return to;
  const u = clamp(elapsed / plan.seconds, 0, 1),
    e = u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
  return plan.from + (to - plan.from) * e;
}

/**
 * Shared arrival state for the scroll drivers. A story arrives part-way when it attaches already scrolled, or when
 * the browser restores the position shortly after (within `window` ms, before any reader input). Reader input
 * ends an arrival at once. `ready(act)` may return a promise: the replay holds at its start until it settles or
 * `wait` ms pass, so a chapter whose assets are still loading does not play in half-built.
 * @internal
 */
export function arrivalController({ mode, seconds, ready, wait, onArrival, now, schedule, report, timer }) {
  const opened = now();
  let state = null,
    touched = false,
    used = false;
  return {
    get state() {
      return state && Object.freeze({ ...state.plan, waiting: state.waiting, done: state.done });
    },
    get active() {
      return !!state && !state.done;
    },
    /** Reader input: no arrival may start, and one in progress lands on its target. */
    touch() {
      touched = true;
      if (state && !state.done) {
        state.done = true;
        schedule();
      }
    },
    /** A position seen at attach or on a scroll; returns the plan when this begins an arrival. */
    offer(position, viewport, makePlan, act) {
      if (used || touched || position < viewport * 0.25 || now() - opened > 1500) return null;
      used = true;
      const plan = makePlan(mode, seconds);
      state = { plan, waiting: false, done: plan.seconds === 0, elapsed: 0, last: null };
      if (!state.done && ready) {
        state.waiting = true;
        let settled = false;
        const go = () => {
          if (settled) return;
          settled = true;
          state.waiting = false;
          state.last = null;
          schedule();
        };
        (timer ?? globalThis.setTimeout)(go, wait);
        Promise.resolve()
          .then(() => ready(act))
          .then(go, (error) => {
            report(error);
            go();
          });
      }
      onArrival?.(this.state);
      return plan;
    },
    /** The time to show while arriving, following the current target; null when no arrival is running. */
    timeFor(target) {
      if (!state || state.done) return null;
      if (state.waiting) return state.plan.from;
      // Advance by frame steps of at most 50 ms: a page busy building (a long task) resumes the replay where it
      // was rather than finding it already over.
      const t = now();
      state.elapsed += state.last === null ? 0 : Math.min(t - state.last, 50) / 1000;
      state.last = t;
      const time = arrivalTime(state.plan, state.elapsed, target);
      if (state.elapsed >= state.plan.seconds) state.done = true;
      return time;
    },
  };
}
