import { assert, number } from '../core/validate.js';

/**
 * Time-addressed building blocks for character motion. Every function here is pure: the same time gives
 * the same value, so characters rewind exactly. Sources for each constant are in
 * docs/research/character-animation.md.
 */
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => {
  t = clamp(t);
  return t * t * (3 - 2 * t);
};
/** Integral of smooth() from 0 to t, used to integrate eased speed into exact distance. */
export const smoothIntegral = (t) => {
  t = clamp(t);
  return t * t * t - (t * t * t * t) / 2;
};

/** A hash in [0, 1) addressed by integers, so seeded schedules need no shared random state. */
export function hash(seed, index, channel = 0) {
  let h = (seed ^ Math.imul(index + 1, 0x9e3779b1) ^ Math.imul(channel + 1, 0x85ebca77)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth 1D value noise in [-1, 1]. */
export function noise1(seed, x) {
  const i = Math.floor(x),
    t = x - i,
    s = t * t * t * (t * (t * 6 - 15) + 10);
  return lerp(hash(seed, i, 7) * 2 - 1, hash(seed, i + 1, 7) * 2 - 1, s);
}

/**
 * Step response of a critically damped spring with the given half-life: 0 at the step, approaching 1.
 * Summing steps gives exact follow-through for piecewise-constant targets (gaze, head turns).
 */
export function dampedStep(age, halfLife) {
  if (age <= 0) return 0;
  const w = 1.6783469900166605 / halfLife; // y(t) = 1 − (1 + ωt)e^(−ωt) reaches 1/2 at t = 1.678 / ω
  return 1 - (1 + w * age) * Math.exp(-w * age);
}

// Preparation is independent of the requested seek time. Each seeded schedule is the same sequential
// sum it always was, but it is extended lazily only as far as the latest time asked for, so a large
// cast keeps every schedule cached (bounded LRU) instead of rebuilding a day of events per frame.
const MAX_SCENE_TIME = 86400;
const blinkSchedules = new Map();
const saccadeSchedules = new Map();
const MAX_SCHEDULES = 512,
  MAX_EVENTS = 100000;
/** `series.next(i, at)` gives event i (≥ 1) from event i − 1; `first` is event 0. */
function schedule(cache, key, time, series) {
  let s = cache.get(key);
  if (s) cache.delete(key);
  else s = { events: [series.first], done: series.first > MAX_SCENE_TIME };
  cache.set(key, s);
  if (cache.size > MAX_SCHEDULES) cache.delete(cache.keys().next().value);
  const { events } = s;
  while (!s.done && events[events.length - 1] <= Math.min(time + 30, MAX_SCENE_TIME)) {
    const i = events.length,
      at = series.next(i, events[i - 1]);
    if (i >= MAX_EVENTS || series.stop(at, i)) {
      s.done = true;
      break;
    }
    events.push(at);
  }
  return events;
}
function lastAtOrBefore(events, time) {
  let low = 0,
    high = events.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (events[mid] <= time) low = mid + 1;
    else high = mid;
  }
  return low - 1;
}

/**
 * Seeded blink schedule. Mean interval ≈ 4 s (≈ 15 per minute, inside the measured 14–17/min mean);
 * intervals vary between 1.5 s and about 7 s. Returns lid closure in [0, 1] at time t.
 * The blink shape (fast close, short hold, slower open, ≈ 0.18 s) is an animation convention.
 */
export function blinkAt(seed, t, { mean = 4, close = 0.06, hold = 0.025, open = 0.1, extra = [] } = {}) {
  number(t, 'character time', 0, MAX_SCENE_TIME);
  number(mean, 'mean blink interval', 1.5, 3600);
  number(close, 'blink close duration', 1e-6, 10);
  number(hold, 'blink hold duration', 0, 10);
  number(open, 'blink open duration', 1e-6, 10);
  assert(Array.isArray(extra) && extra.length <= 4096, 'RESOURCE_LIMIT', 'Use at most 4096 explicit blinks.');
  const profile = (u) =>
    u < 0
      ? 0
      : u < close
        ? smooth(u / close)
        : u < close + hold
          ? 1
          : u < close + hold + open
            ? 1 - smooth((u - close - hold) / open)
            : 0;
  let lid = 0;
  for (const at of extra) lid = Math.max(lid, profile(t - number(at, 'explicit blink time', 0, MAX_SCENE_TIME)));
  const events = schedule(blinkSchedules, `${seed | 0}:${mean}`, t, {
    first: 0.6 + hash(seed, 0, 1) * mean,
    next: (i, at) => at + (1.5 + -Math.log(1 - hash(seed, i, 1) * 0.95) * (mean - 1.5)),
    stop: (at) => at > MAX_SCENE_TIME,
  });
  for (let i = lastAtOrBefore(events, t); i >= 0 && events[i] > t - close - hold - open; i--) {
    lid = Math.max(lid, profile(t - events[i]));
  }
  return lid;
}

/** Small idle eye darts: seeded targets held for 0.4–2.4 s, moving with a quick ease (placeholder timing). */
export function saccade(seed, t) {
  number(t, 'character time', 0, MAX_SCENE_TIME);
  const events = schedule(saccadeSchedules, seed | 0, t, {
    first: 0,
    next: (i, at) => at + (0.4 + hash(seed, i - 1, 3) * 2),
    stop: () => false,
  });
  const i = lastAtOrBefore(events, t),
    at = events[i];
  const target = (index) =>
    index > 0 ? [(hash(seed, index, 4) * 2 - 1) * 0.35, (hash(seed, index, 5) * 2 - 1) * 0.2] : [0, 0];
  const prev = target(i - 1),
    next = target(i);
  const s = smooth((t - at) / 0.05);
  return [lerp(prev[0], next[0], s), lerp(prev[1], next[1], s)];
}

/** Weight of a clip at time t: eased in over fadeIn, held, eased out over fadeOut. */
export function envelope(t, at, duration, fadeIn, fadeOut) {
  if (t < at || t > at + duration) return 0;
  const u = t - at;
  return Math.min(fadeIn > 0 ? smooth(u / fadeIn) : 1, fadeOut > 0 ? smooth((duration - u) / fadeOut) : 1);
}
