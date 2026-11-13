import { assert, number, options } from './validate.js';
import { easings } from './timing.js';
import { sampledEasing, easingFromTrack } from './measured-easing.js';

/** Small numeric tools every scene needs. Pure, total and dependency-free. */
export const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
export const lerp = (from, to, progress) => from + (to - from) * progress;
/** Named easing functions and measured sample adapters.
 * @type {Readonly<{linear:(t:number)=>number,smooth:(t:number)=>number,easeOut:(t:number)=>number,easeInOut:(t:number)=>number,launch:(t:number)=>number,titleOpen:(t:number)=>number,anticipateOut:(t:number)=>number,linearStop:(t:number)=>number,snapIn:(t:number)=>number,fromSamples:typeof sampledEasing,fromTrack:typeof easingFromTrack}>}
 */
export const ease = Object.freeze({
  ...Object.fromEntries(Object.entries(easings).map(([name, fn]) => [name, (t) => fn(clamp(t))])),
  launch: easings.launch,
  titleOpen: easings.titleOpen,
  fromSamples: sampledEasing,
  fromTrack: easingFromTrack,
});

/** A seeded random stream (mulberry32). The same seed always replays the same draws, so seeking stays exact. */
export function seeded(seed) {
  number(seed, 'seed', -(2 ** 31), 2 ** 32);
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Reading pace: four seconds at least, otherwise fifteen characters a second plus a breath. */
export const readingPace = (line) => Math.max(4, line.length / 15 + 1.3);

/**
 * A narrated timeline: one beat per caption line, timed by the line, never by the animation.
 * `at(i)` is the start of beat i in seconds; fractions move through a beat (`at(1.5)` is halfway through beat 1).
 * `lead` reserves the opening seconds (a title card); the last beat holds for `tail` extra seconds.
 */
export function beats(lines, spec = {}) {
  options(spec, ['lead', 'pace', 'tail'], 'beats');
  assert(
    Array.isArray(lines) && lines.length > 0 && lines.every((l) => typeof l === 'string'),
    'INVALID_BEATS',
    'Beats need one or more caption lines.',
  );
  const lead = number(spec.lead ?? 0, 'lead', 0, 3600),
    tail = number(spec.tail ?? 1, 'tail', 0, 3600);
  const pace = spec.pace ?? readingPace;
  assert(typeof pace === 'function', 'INVALID_BEATS', 'pace must be a function of the caption line.');
  const lengths = lines.map((line, i) =>
    number(pace(line) + (i === lines.length - 1 ? tail : 0), 'beat length', 1e-3, 3600),
  );
  const starts = [];
  let t = lead;
  for (const length of lengths) {
    starts.push(t);
    t += length;
  }
  const duration = t;
  const at = (i) => {
    number(i, 'beat', -1, lines.length);
    const k = Math.floor(i),
      f = i - k;
    if (k < 0) return 0;
    if (k >= lines.length) return duration;
    return starts[k] + f * lengths[k];
  };
  const index = (time) => {
    let k = -1;
    while (k + 1 < starts.length && time >= starts[k + 1]) k++;
    return k;
  };
  return Object.freeze({
    lines: Object.freeze([...lines]),
    starts: Object.freeze(starts),
    lengths: Object.freeze(lengths),
    lead,
    duration,
    at,
    index,
    /** The caption showing at a time, or '' during the lead. */
    line: (time) => lines[index(time)] ?? '',
    /** Eased progress through [at(from), at(from) + duration]. */
    progress: (time, from, localDuration1 = 1.1, name = 'easeInOut') => ease[name]((time - at(from)) / localDuration1),
  });
}

const STYLES = ['fade', 'rise', 'pop', 'cut', 'reveal'];
export const DIM_DURATION = 0.7;
/**
 * Presence: when a node is on stage. Entrances and exits multiply opacity and offset position on top of
 * whatever drives those properties, so `enter` never competes with a binding or track for ownership.
 */
export function presenceSpec(kind, at, spec = {}) {
  options(spec, ['style', 'duration', 'delay', 'lift', 'ease', 'pivot'], kind);
  const style = spec.style ?? (kind === 'enter' ? 'rise' : 'fade');
  assert(STYLES.includes(style), 'INVALID_PRESENCE', `Use ${STYLES.join(', ')}.`);
  const start = number(at, `${kind} time`, 0, 86400) + number(spec.delay ?? 0, 'delay', 0, 3600);
  const duration =
    style === 'cut' ? 0 : number(spec.duration ?? (kind === 'enter' ? 0.9 : 0.55), 'duration', 1e-3, 3600);
  const end = number(start + duration, `${kind} end`, 0, 86400);
  const curve = spec.ease ?? 'easeOut';
  assert(
    typeof curve === 'function' || (typeof curve === 'string' && Object.hasOwn(easings, curve)),
    'INVALID_EASING',
    'Use a registered easing or trusted curve.',
  );
  return Object.freeze({
    at: start,
    duration,
    end,
    lift: number(spec.lift ?? (kind === 'enter' ? 18 : 8), 'lift', -1000, 1000),
    style,
    ease: curve,
    pivot: spec.pivot ?? (style === 'reveal' ? 'center' : undefined),
  });
}
export function dimSpec(keys) {
  assert(Array.isArray(keys) && keys.length > 0, 'INVALID_PRESENCE', 'dim takes [[time, level], ...].');
  return Object.freeze(
    Array.from(keys, (key) => {
      assert(Array.isArray(key) && key.length === 2, 'INVALID_PRESENCE', 'Each dim key needs [time, level].');
      const at = number(key[0], 'dim time', 0, 86400),
        level = number(key[1], 'dim level', 0, 1);
      number(at + DIM_DURATION, 'dim end', 0, 86400);
      return Object.freeze([at, level]);
    }).sort((a, b) => a[0] - b[0]),
  );
}

/** Apply presence to sampled properties. Before an entrance a node is invisible; after an exit it is gone. */
export function applyPresence(presence, props, time) {
  const { enter, exit, dim } = presence;
  let opacity = 1,
    lift = 0,
    scale = 1;
  if (enter) {
    const progress = enter.duration ? clamp((time - enter.at) / enter.duration) : time >= enter.at ? 1 : 0;
    const k = (typeof enter.ease === 'function' ? enter.ease : easings[enter.ease ?? 'easeOut'])(progress);
    opacity *= k;
    if (enter.style === 'rise') lift += (1 - k) * enter.lift;
    if (enter.style === 'pop') scale *= 1 + 0.22 * (1 - k);
    if (enter.style === 'reveal') props.scaleY = (props.scaleY ?? 1) * k;
    if (enter.pivot !== undefined) props.pivot = enter.pivot;
  }
  if (exit) {
    const progress = exit.duration ? clamp((time - exit.at) / exit.duration) : time >= exit.at ? 1 : 0;
    const k = (typeof exit.ease === 'function' ? exit.ease : easings[exit.ease ?? 'easeOut'])(progress);
    opacity *= 1 - k;
    if (exit.style === 'rise') lift -= k * exit.lift;
    if (exit.style === 'reveal') props.scaleY = (props.scaleY ?? 1) * (1 - k);
    if (exit.pivot !== undefined) props.pivot = exit.pivot;
  }
  if (dim) {
    let level = 1;
    for (const [at, to] of dim) {
      const k = ease.easeOut((time - at) / DIM_DURATION);
      if (k <= 0) break;
      level = lerp(level, to, k);
    }
    opacity *= level;
  }
  props.opacity = clamp((props.opacity ?? 1) * opacity);
  if (lift) props.y = (props.y ?? 0) + lift;
  if (scale !== 1) {
    props.scaleX = (props.scaleX ?? 1) * scale;
    props.scaleY = (props.scaleY ?? 1) * scale;
  }
  return props;
}
