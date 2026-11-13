import { libraryCurveIdentity } from './curves.js';
import { assert, number, options, safeCopy, text } from '../core/validate.js';
import { easings, makeTrack, trackValue } from '../core/timing.js';
import { colorInterpolator } from '../color/index.js';

/**
 * @typedef {number|string} TimelineValue
 * @typedef {string|((progress:number)=>number)} TimelineEase
 * @typedef {number|string} TimelinePosition
 * @typedef {{from?:TimelineValue,to:TimelineValue,duration?:number,delay?:number,at?:number,ease?:TimelineEase,modifier?:(value:TimelineValue)=>TimelineValue}} TimelineKeyframe
 * @typedef {{from?:TimelineValue,to?:TimelineValue,duration?:number,delay?:number,ease?:TimelineEase,repeat?:number,repeatDelay?:number,alternate?:boolean,reversed?:boolean,keyframes?:TimelineKeyframe[],interpolate?:(from:TimelineValue,to:TimelineValue,progress:number)=>TimelineValue,modifier?:(value:TimelineValue)=>TimelineValue,type?:'color'|'string'|'discrete'}} TimelineChannel
 * @typedef {{defaults?:{duration?:number,ease?:TimelineEase},repeat?:number,repeatDelay?:number,alternate?:boolean,reversed?:boolean}} TimelineOptions
 * @typedef {Readonly<{values:Readonly<Record<string,TimelineValue>>,localTime:number,iteration:number,direction:number,duration:number}>} TimelineSnapshot
 * @typedef {Readonly<{channels:readonly string[],values:readonly TimelineValue[],localTime:number,iteration:number,direction:number,duration:number}>} TimelineValuesSnapshot
 * @typedef {Readonly<{channels:readonly string[],version:number,duration:number,sample:(time?:number)=>TimelineValuesSnapshot}>} PreparedTimeline
 * @typedef {Readonly<{name:string,data?:unknown,time:number,at:number,direction:number,iteration:number,order:number}>} TimelineEvent
 */

const LIMIT = Object.freeze({
  channels: 10000,
  groups: 20000,
  frames: 100000,
  events: 10000,
  depth: 8,
  values: 2000000,
  time: 86400,
});
const timelines = new WeakSet();
export const isTimeline = (value) => timelines.has(value);
const own = (object, key) => Object.hasOwn(object, key);
const clamp = (value) => Math.max(0, Math.min(1, value));
const seconds = (value, name = 'timeline seconds') => number(value, name, 0, LIMIT.time);
const boolean = (value, name) => {
  assert(typeof value === 'boolean', 'INVALID_TIMELINE', `${name} must be boolean.`);
  return value;
};
const repeats = (value) => {
  assert(
    value === Infinity || (Number.isInteger(value) && value >= 0 && value <= 10000),
    'INVALID_TIMELINE',
    'repeat is additional iterations, 0–10000 or Infinity.',
  );
  return value;
};
function safeName(value, label = 'channel') {
  text(value, label, 128);
  assert(
    /^[A-Za-z_][\w.:-]*$/.test(value) &&
      !value.split(/[.:-]/).some((part) => ['__proto__', 'prototype', 'constructor'].includes(part)),
    'INVALID_TIMELINE',
    `Use a safe ${label} name.`,
  );
  return value;
}
function recordEntries(value, label, limit = LIMIT.channels) {
  assert(
    value && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null),
    'INVALID_TIMELINE',
    `${label} must be a plain record.`,
  );
  const keys = Reflect.ownKeys(value);
  assert(keys.length <= limit, 'RESOURCE_LIMIT', `${label} exceeds its entry budget.`);
  const result = [];
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    assert(
      typeof key === 'string' && descriptor.enumerable && 'value' in descriptor,
      'INVALID_TIMELINE',
      `${label} uses enumerable data properties; accessors are unsupported.`,
    );
    result.push([safeName(key), descriptor.value]);
  }
  return result;
}
function dense(value, max, label) {
  assert(
    Array.isArray(value) && value.length > 0 && value.length <= max,
    'RESOURCE_LIMIT',
    `${label} needs 1–${max} entries.`,
  );
  assert(
    Reflect.ownKeys(value).length === value.length + 1,
    'INVALID_TIMELINE',
    `${label} must be dense without extra properties.`,
  );
  const result = [];
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, index);
    assert(
      descriptor && 'value' in descriptor,
      'INVALID_TIMELINE',
      `${label} must contain data entries, not holes or accessors.`,
    );
    result.push(descriptor.value);
  }
  return result;
}
function eventPayload(input) {
  let nodes = 0,
    bytes = 0;
  const visit = (item, depth = 0) => {
    assert(++nodes <= 4096 && depth <= 16, 'RESOURCE_LIMIT', 'Event metadata exceeds its value or depth budget.');
    if (typeof item === 'string') {
      text(item, 'event data string', 10000);
      bytes += new TextEncoder().encode(item).length;
    } else if (typeof item === 'number') {
      number(item, 'event data number', -1e100, 1e100);
      bytes += 8;
    } else if (item === null || typeof item === 'boolean') bytes++;
    else {
      assert(
        item &&
          typeof item === 'object' &&
          (Array.isArray(item) ||
            Object.getPrototypeOf(item) === Object.prototype ||
            Object.getPrototypeOf(item) === null),
        'INVALID_DATA',
        'Event metadata must contain plain JSON data.',
      );
      const keys = Reflect.ownKeys(item);
      assert(keys.length <= 4097, 'RESOURCE_LIMIT', 'Event metadata record exceeds its value budget.');
      for (const key of keys) {
        if (Array.isArray(item) && key === 'length') continue;
        const descriptor = Object.getOwnPropertyDescriptor(item, key);
        assert(
          typeof key === 'string' && descriptor.enumerable && 'value' in descriptor,
          'INVALID_DATA',
          'Event metadata accessors and hidden properties are unsupported.',
        );
        text(key, 'event data key', 10000);
        bytes += new TextEncoder().encode(key).length;
        visit(descriptor.value, depth + 1);
      }
    }
    assert(bytes <= 65536, 'RESOURCE_LIMIT', 'Event metadata exceeds64KiB.');
  };
  visit(input);
  return { data: safeCopy(input), bytes };
}
function timelineValue(input) {
  if (typeof input === 'number') return number(input, 'timeline value');
  return text(input, 'timeline string', 4096);
}
const valueSize = (input) => (typeof input === 'string' ? new TextEncoder().encode(input).length : 8);
function trusted(fn, label) {
  assert(fn === undefined || typeof fn === 'function', 'INVALID_TIMELINE', `${label} must be a trusted function.`);
  return fn;
}
function curve(input) {
  assert(
    typeof input === 'function' || (typeof input === 'string' && own(easings, input)),
    'INVALID_EASING',
    'Use a native easing name or trusted function.',
  );
  return input;
}
const token = /[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g;
function interpolation(from, to, custom, kind) {
  if (custom) return (progress) => timelineValue(custom(from, to, progress));
  assert(typeof from === typeof to, 'INVALID_TIMELINE', 'A channel segment keeps its numeric or string value type.');
  if (kind === 'discrete') return () => from;
  if (typeof from === 'number')
    return (progress) => number(from + (to - from) * progress, 'interpolated timeline value');
  if (
    kind === 'color' ||
    (kind === undefined && /^(?:#|rgba?\(|hsla?\()/i.test(from) && /^(?:#|rgba?\(|hsla?\()/i.test(to))
  ) {
    const mix = colorInterpolator(from, to);
    return (progress) => mix(clamp(progress));
  }
  const a = [...from.matchAll(token)],
    b = [...to.matchAll(token)];
  assert(a.length <= 64 && b.length <= 64, 'RESOURCE_LIMIT', 'A timeline string supports at most64 numeric fields.');
  const leftParts = from.split(token),
    rightParts = to.split(token);
  if (a.length && a.length === b.length && leftParts.every((part, index) => part === rightParts[index])) {
    const start = a.map((match) => number(Number(match[0]), 'string field')),
      end = b.map((match) => number(Number(match[0]), 'string field'));
    return (progress) => {
      if (progress === 0) return from;
      if (progress === 1) return to;
      let result = leftParts[0];
      for (let index = 0; index < start.length; index++)
        result +=
          number(start[index] + (end[index] - start[index]) * progress, 'interpolated string field') +
          leftParts[index + 1];
      return text(result, 'interpolated timeline string', 4096);
    };
  }
  assert(kind !== 'string', 'INVALID_TIMELINE', 'Interpolated strings need matching bounded numeric templates.');
  return () => from;
}
function timing(duration, repeat, repeatDelay, alternate, reversed, time) {
  if (duration === Infinity) {
    assert(
      !reversed,
      'INVALID_TIMELINE',
      'An infinite authored span cannot reverse globally; reverse its finite channel cycles.',
    );
    return { localTime: time, iteration: 0, direction: 1 };
  }
  const total = duration * (repeat + 1) + repeatDelay * repeat;
  let iteration, phase;
  if (duration === 0) {
    iteration = 0;
    phase = 0;
  } else if (repeat !== Infinity && time >= total) {
    iteration = repeat;
    phase = duration;
  } else {
    iteration = Math.min(repeat, Math.floor(time / (duration + repeatDelay)));
    phase = Math.min(duration, time - iteration * (duration + repeatDelay));
  }
  const reverse = reversed !== (alternate && iteration % 2 === 1);
  return { localTime: reverse ? duration - phase : phase, iteration, direction: reverse ? -1 : 1 };
}
function latest(entries, time) {
  if (entries.length === 1) return entries[0];
  let low = 0,
    high = entries.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (entries[mid].at <= time) low = mid + 1;
    else high = mid;
  }
  return entries[Math.max(0, low - 1)];
}
function sampleGroup(group, time) {
  if (time < group.at) return group.frames[0].from;
  const localTime =
    group.repeat === 0 && !group.reversed
      ? Math.min(group.span, time - group.at)
      : timing(group.span, group.repeat, group.repeatDelay, group.alternate, group.reversed, time - group.at).localTime;
  const frame = latest(group.frames, localTime);
  let result;
  if (localTime < frame.at) return frame.from;
  else if (frame.duration === 0 || localTime >= frame.end) result = frame.to;
  else {
    // Numeric frames use the existing native track's endpoint/progress/result
    // validation directly. Other prepared interpolators consume its0→1 track.
    const sampled = trackValue(frame.timing, localTime, frame.numeric ? frame.from : 0);
    result = frame.numeric ? sampled : frame.mix(sampled);
  }
  return frame.modifier ? timelineValue(frame.modifier(result)) : result;
}
function samplePlan(plan, time) {
  const state = timing(plan.span, plan.repeat, plan.repeatDelay, plan.alternate, plan.reversed, time);
  const values = {};
  let children;
  for (let index = 0; index < plan.sampleChannels.length; index++) {
    const { key, entries } = plan.sampleChannels[index];
    const entry = latest(entries, state.localTime);
    if (entry.kind === 'group') values[key] = sampleGroup(entry, state.localTime);
    else {
      children ??= new Map();
      let snapshot = children.get(entry.child);
      if (!snapshot) {
        snapshot = samplePlan(entry.child.plan, Math.max(0, state.localTime - entry.at) / entry.child.scale);
        children.set(entry.child, snapshot);
      }
      values[key] = snapshot.values[key];
    }
  }
  return Object.freeze({ values: Object.freeze(values), ...state, duration: plan.duration });
}
function samplePlanChannel(plan, key, time) {
  const entries = plan.channels.get(key);
  if (!entries) return undefined;
  const local = timing(plan.span, plan.repeat, plan.repeatDelay, plan.alternate, plan.reversed, time).localTime,
    entry = latest(entries, local);
  return entry.kind === 'group'
    ? sampleGroup(entry, local)
    : samplePlanChannel(entry.child.plan, key, Math.max(0, local - entry.at) / entry.child.scale);
}

function prepareSamplingRow(key, entries) {
  const group = entries.length === 1 ? entries[0] : null;
  const frame =
    group?.kind === 'group' && group.frames.length === 1 && group.repeat === 0 && !group.reversed
      ? group.frames[0]
      : null;
  const authoredEase = frame?.timing?.[0].ease ?? null;
  const resolvedEase = typeof authoredEase === 'string' ? easings[authoredEase] : authoredEase;
  const flat =
    frame?.numeric && !frame.modifier
      ? Object.freeze({
          groupAt: group.at,
          span: group.span,
          at: frame.at,
          end: frame.end,
          duration: frame.duration,
          from: frame.from,
          to: frame.to,
          ease: resolvedEase,
          easeKey: nativePureCurves.has(resolvedEase) ? resolvedEase : libraryCurveIdentity(resolvedEase),
        })
      : null;
  return Object.freeze({ key, entries, flat });
}
function sampleNumericValue(flat, time) {
  if (time < flat.groupAt) return flat.from;
  const local = Math.min(flat.span, time - flat.groupAt);
  if (local < flat.at) return flat.from;
  if (flat.duration === 0 || local >= flat.end) return flat.to;
  let eased;
  try {
    eased = (0, flat.ease)((local - flat.at) / flat.duration);
  } catch (cause) {
    const error = new Error('Trusted easing callback failed.');
    error.code = 'EASING_FAILED';
    error.cause = cause;
    throw error;
  }
  number(eased, 'easing result');
  return number(flat.from + (flat.to - flat.from) * eased, 'animated value');
}

const nativePureCurves = new WeakSet(Object.values(easings));
function prepareValueSteps(rows) {
  const steps = [];
  for (let index = 0; index < rows.length;) {
    const start = index,
      flat = rows[index].flat;
    index++;
    if (flat && flat.easeKey !== undefined) {
      while (index < rows.length) {
        const next = rows[index].flat;
        if (
          !next ||
          next.easeKey !== flat.easeKey ||
          !Object.is(next.groupAt, flat.groupAt) ||
          !Object.is(next.span, flat.span) ||
          !Object.is(next.at, flat.at) ||
          !Object.is(next.end, flat.end) ||
          !Object.is(next.duration, flat.duration)
        )
          break;
        index++;
      }
    }
    steps.push(Object.freeze({ start, end: index, shared: index - start > 1 }));
  }
  return steps.some((step) => step.shared) ? Object.freeze(steps) : null;
}
function sampleSharedValues(plan, channels, time) {
  const state = timing(plan.span, plan.repeat, plan.repeatDelay, plan.alternate, plan.reversed, time);
  const values = [];
  let children;
  for (let stepIndex = 0; stepIndex < plan.valueSteps.length; stepIndex++) {
    const step = plan.valueSteps[stepIndex],
      row = plan.sampleChannels[step.start],
      flat = row.flat;
    if (step.shared) {
      let endpoint = 0,
        eased;
      if (state.localTime < flat.groupAt) endpoint = -1;
      else {
        const local = Math.min(flat.span, state.localTime - flat.groupAt);
        if (local < flat.at) endpoint = -1;
        else if (flat.duration === 0 || local >= flat.end) endpoint = 1;
        else {
          try {
            eased = (0, flat.ease)((local - flat.at) / flat.duration);
          } catch (cause) {
            const error = new Error('Trusted easing callback failed.');
            error.code = 'EASING_FAILED';
            error.cause = cause;
            throw error;
          }
          number(eased, 'easing result');
        }
      }
      for (let index = step.start; index < step.end; index++) {
        const record = plan.sampleChannels[index].flat;
        values[index] =
          endpoint < 0
            ? record.from
            : endpoint > 0
              ? record.to
              : number(record.from + (record.to - record.from) * eased, 'animated value');
      }
    } else if (flat) values[step.start] = sampleNumericValue(flat, state.localTime);
    else {
      const entry = latest(row.entries, state.localTime);
      if (entry.kind === 'group') values[step.start] = sampleGroup(entry, state.localTime);
      else {
        children ??= new Map();
        let snapshot = children.get(entry.child);
        if (!snapshot) {
          snapshot = samplePlanValues(
            entry.child.plan,
            entry.child.plan.valueChannels,
            Math.max(0, state.localTime - entry.at) / entry.child.scale,
          );
          children.set(entry.child, snapshot);
        }
        values[step.start] = snapshot.values[entry.slot];
      }
    }
  }
  return Object.freeze({ channels, values: Object.freeze(values), ...state, duration: plan.duration });
}

function samplePlanValues(plan, channels, time) {
  return plan.valueSteps ? sampleSharedValues(plan, channels, time) : sampleIndependentValues(plan, channels, time);
}
function sampleIndependentValues(plan, channels, time) {
  const state = timing(plan.span, plan.repeat, plan.repeatDelay, plan.alternate, plan.reversed, time);
  const values = [];
  let children;
  for (let index = 0; index < plan.sampleChannels.length; index++) {
    const { entries, flat } = plan.sampleChannels[index];
    if (flat) {
      values[index] = sampleNumericValue(flat, state.localTime);
      continue;
    }
    const entry = latest(entries, state.localTime);
    if (entry.kind === 'group') values[index] = sampleGroup(entry, state.localTime);
    else {
      // Retain the existing child evaluator and ordering. A shared child is
      // evaluated once, including its trusted callbacks, before projection.
      children ??= new Map();
      let snapshot = children.get(entry.child);
      if (!snapshot) {
        snapshot = samplePlanValues(
          entry.child.plan,
          entry.child.plan.valueChannels,
          Math.max(0, state.localTime - entry.at) / entry.child.scale,
        );
        children.set(entry.child, snapshot);
      }
      values[index] = snapshot.values[entry.slot];
    }
  }
  return Object.freeze({ channels, values: Object.freeze(values), ...state, duration: plan.duration });
}
function totalDuration(span, repeat, delay) {
  if (span === 0) {
    return 0;
  }
  return span === Infinity || repeat === Infinity ? Infinity : span * (repeat + 1) + delay * repeat;
}

/** Pure, reusable named-channel orchestration. Native seconds throughout. */
export class Timeline {
  #defaults;
  #repeat;
  #repeatDelay;
  #alternate;
  #reversed;
  #groups = [];
  #byChannel = new Map();
  #channelNames = new Set();
  #nominal = 0;
  #span = 0;
  #children = [];
  #events = [];
  #labels = new Map();
  #wait = 0;
  #lastStart = 0;
  #lastEnd = 0;
  #version = 0;
  #order = 0;
  #plan = null;
  #frames = 0;
  #valueBytes = 0;
  #eventBytes = 0;
  /** @param {TimelineOptions} [spec] */
  constructor(spec = {}) {
    options(spec, ['defaults', 'repeat', 'repeatDelay', 'alternate', 'reversed'], 'timeline');
    const defaults = spec.defaults ?? {};
    options(defaults, ['duration', 'ease'], 'timeline defaults');
    this.#defaults = Object.freeze({
      duration: number(defaults.duration ?? 1, 'default duration', 1e-6, LIMIT.time),
      ease: curve(defaults.ease ?? 'linear'),
    });
    this.#repeat = repeats(spec.repeat ?? 0);
    this.#repeatDelay = seconds(spec.repeatDelay ?? 0, 'repeat delay');
    this.#alternate = boolean(spec.alternate ?? false, 'alternate');
    this.#reversed = boolean(spec.reversed ?? false, 'reversed');
    timelines.add(this);
    Object.freeze(this);
  }
  get version() {
    return this.#version;
  }
  get labels() {
    return Object.freeze(Object.fromEntries(this.#labels));
  }
  get duration() {
    return this.#compile().duration;
  }
  get iterationDuration() {
    return this.#span;
  }
  get authoredDuration() {
    return this.#nominal;
  }
  #changed() {
    this.#version++;
    this.#plan = null;
  }
  /** @param {TimelinePosition} [position] @param {number} [fallback] @returns {number} */
  resolvePosition(position, fallback = this.#nominal) {
    seconds(fallback, 'position fallback');
    if (position === undefined) return fallback;
    if (typeof position === 'number') return seconds(position, 'position');
    text(position, 'timeline position', 256);
    const match = position.match(/^(.*?)(?:([+-])=(\d*\.?\d+(?:e[+-]?\d+)?))?$/i);
    assert(match, 'INVALID_TIMELINE', 'Use seconds, a label, < or << with an optional +=/-= seconds offset.');
    const base = match[1];
    let at;
    if (base === '') at = fallback;
    else if (base === '<') at = this.#lastEnd;
    else if (base === '<<') at = this.#lastStart;
    else {
      assert(this.#labels.has(base), 'INVALID_TIMELINE', `Unknown timeline label ${base}.`);
      at = this.#labels.get(base);
    }
    if (match[2]) at += (match[2] === '+' ? 1 : -1) * seconds(Number(match[3]), 'position offset');
    return seconds(at, 'resolved position');
  }
  /** @param {string} label @param {TimelinePosition} [position] */
  label(label, position) {
    safeName(label, 'label');
    assert(
      this.#labels.size < LIMIT.groups || this.#labels.has(label),
      'RESOURCE_LIMIT',
      'Timeline label budget exceeded.',
    );
    const at = this.resolvePosition(position);
    this.#labels.set(label, at);
    this.#changed();
    return this;
  }
  /** @param {number} duration @param {TimelinePosition} [position] */
  wait(duration, position) {
    duration = seconds(duration, 'wait duration');
    const at = this.resolvePosition(position),
      end = seconds(at + duration, 'wait end');
    const total = totalDuration(Math.max(this.#span, end), this.#repeat, this.#repeatDelay);
    if (total !== Infinity) seconds(total, 'timeline total duration');
    this.#wait = Math.max(this.#wait, end);
    this.#span = Math.max(this.#span, end);
    this.#nominal = Math.max(this.#nominal, end);
    this.#lastStart = at;
    this.#lastEnd = end;
    this.#changed();
    return this;
  }
  /** @param {Record<string,TimelineChannel>|Timeline} channels @param {TimelinePosition} [position] */
  add(channels, position) {
    if (isTimeline(channels)) return this.child(channels, position);
    const captured = recordEntries(channels, 'timeline channels');
    assert(
      captured.length > 0 && this.#groups.length + captured.length <= LIMIT.groups,
      'RESOURCE_LIMIT',
      'Timeline group budget exceeded.',
    );
    const at = this.resolvePosition(position),
      prepared = [],
      childFrames = this.#children.reduce((sum, child) => sum + child.plan.frameCount, 0),
      childGroups = this.#children.reduce((sum, child) => sum + child.plan.groupCount, 0),
      childBytes = this.#children.reduce((sum, child) => sum + child.plan.valueBytes, 0),
      newNames = captured.filter(([key]) => !this.#channelNames.has(key)).length;
    assert(
      this.#groups.length + captured.length + childGroups <= LIMIT.groups &&
        this.#channelNames.size + newNames <= LIMIT.channels &&
        this.#frames + childFrames + captured.length <= LIMIT.frames,
      'RESOURCE_LIMIT',
      'Timeline aggregate authoring budget exceeded.',
    );
    let newFrames = 0,
      newBytes = 0,
      end = at;
    for (const [key, descriptor] of captured) {
      options(
        descriptor,
        [
          'from',
          'to',
          'duration',
          'delay',
          'ease',
          'repeat',
          'repeatDelay',
          'alternate',
          'reversed',
          'keyframes',
          'interpolate',
          'modifier',
          'type',
        ],
        'timeline channel',
      );
      const repeat = repeats(descriptor.repeat ?? 0),
        repeatDelay = seconds(descriptor.repeatDelay ?? 0, 'channel repeat delay'),
        alternate = boolean(descriptor.alternate ?? false, 'channel alternate'),
        reversed = boolean(descriptor.reversed ?? false, 'channel reversed'),
        custom = trusted(descriptor.interpolate, 'interpolate');
      assert(
        descriptor.type === undefined || ['color', 'string', 'discrete'].includes(descriptor.type),
        'INVALID_TIMELINE',
        'Channel type is color, string or discrete.',
      );
      const delay = seconds(descriptor.delay ?? 0, 'channel delay');
      const frames =
        descriptor.keyframes === undefined
          ? [descriptor]
          : dense(descriptor.keyframes, LIMIT.frames - this.#frames - childFrames - newFrames, 'timeline keyframes');
      assert(
        descriptor.keyframes === undefined || !own(descriptor, 'to'),
        'INVALID_TIMELINE',
        'Use to or keyframes, not both.',
      );
      let cursor = 0,
        previous = descriptor.from;
      const compiled = [];
      for (const input of frames) {
        if (descriptor.keyframes !== undefined)
          options(input, ['from', 'to', 'duration', 'delay', 'at', 'ease', 'modifier'], 'timeline keyframe');
        assert(own(input, 'to'), 'INVALID_TIMELINE', 'A timeline keyframe needs to.');
        const requestedOffset = seconds(
          (input.at === undefined ? cursor : seconds(input.at, 'keyframe at')) +
            (descriptor.keyframes === undefined ? 0 : seconds(input.delay ?? 0, 'keyframe delay')),
          'keyframe offset',
        );
        assert(
          requestedOffset + 1e-12 * Math.max(1, cursor, requestedOffset) >= cursor,
          'INVALID_TIMELINE',
          'Keyframes must be chronological and cannot overlap.',
        );
        const offset = Math.max(cursor, requestedOffset);
        let from = input.from ?? previous;
        if (from === undefined) {
          from = this.valueAt(key, at + delay);
          assert(from !== undefined, 'INVALID_TIMELINE', `First ${key} segment needs from.`);
        }
        from = timelineValue(from);
        const to = timelineValue(input.to),
          bytes = valueSize(from) + valueSize(to);
        // Charge before preparing interpolators or allocating the next frame.
        // Shared keyframe arrays across many channels cannot amplify work past
        // this aggregate budget, even when the input object graph is tiny.
        assert(
          this.#frames + childFrames + newFrames + 1 <= LIMIT.frames &&
            this.#valueBytes + this.#eventBytes + childBytes + newBytes + bytes <= LIMIT.values,
          'RESOURCE_LIMIT',
          'Timeline running keyframe/value budget exceeded.',
        );
        const duration = number(
            input.duration ?? descriptor.duration ?? this.#defaults.duration,
            'keyframe duration',
            0,
            LIMIT.time,
          ),
          endAt = seconds(offset + duration, 'keyframe end'),
          easing = curve(input.ease ?? descriptor.ease ?? this.#defaults.ease),
          modifier = trusted(input.modifier ?? descriptor.modifier, 'modifier');
        assert(
          !['color', 'string'].includes(descriptor.type) || (typeof from === 'string' && typeof to === 'string'),
          'INVALID_TIMELINE',
          'Color and string channel types require string endpoints.',
        );
        const numeric = typeof from === 'number' && typeof to === 'number' && !custom && descriptor.type !== 'discrete';
        const mix = numeric ? null : interpolation(from, to, custom, descriptor.type);
        compiled.push(
          Object.freeze({
            at: offset,
            end: endAt,
            duration,
            from,
            to,
            mix,
            numeric,
            modifier,
            timing: duration
              ? Object.freeze([
                  makeTrack({
                    property: key,
                    from: numeric ? from : 0,
                    to: numeric ? to : 1,
                    at: offset,
                    duration,
                    ease: typeof easing === 'string' ? easings[easing] : easing,
                  }),
                ])
              : null,
          }),
        );
        previous = to;
        cursor = endAt;
        newFrames++;
        newBytes += bytes;
      }
      assert(cursor > 0 || repeat === 0, 'INVALID_TIMELINE', 'A zero-duration channel cannot repeat.');
      const total = totalDuration(cursor, repeat, repeatDelay),
        start = seconds(at + delay, 'channel start'),
        finish = total === Infinity ? Infinity : seconds(start + total, 'channel end'),
        nominal = total === Infinity ? seconds(start + cursor, 'channel nominal end') : finish;
      prepared.push(
        Object.freeze({
          kind: 'group',
          key,
          at: start,
          span: cursor,
          total,
          repeat,
          repeatDelay,
          alternate,
          reversed,
          frames: Object.freeze(compiled),
          order: this.#order + prepared.length,
          nominal,
        }),
      );
      end = Math.max(end, nominal);
    }
    assert(
      this.#frames + newFrames <= LIMIT.frames && this.#valueBytes + newBytes <= LIMIT.values,
      'RESOURCE_LIMIT',
      'Timeline keyframe or value-byte budget exceeded.',
    );
    assert(
      this.#frames + newFrames + childFrames <= LIMIT.frames &&
        this.#groups.length + prepared.length + childGroups <= LIMIT.groups &&
        this.#valueBytes + this.#eventBytes + newBytes + childBytes <= LIMIT.values &&
        this.#channelNames.size + newNames <= LIMIT.channels,
      'RESOURCE_LIMIT',
      'Timeline aggregate channel, track or value budget exceeded.',
    );
    const span = Math.max(
      this.#span,
      ...prepared.map((group) => (group.total === Infinity ? Infinity : group.at + group.total)),
    );
    assert(
      span !== Infinity || !this.#reversed,
      'INVALID_TIMELINE',
      'An infinite authored span cannot reverse globally.',
    );
    const total = totalDuration(span, this.#repeat, this.#repeatDelay);
    if (total !== Infinity) seconds(total, 'timeline total duration');
    this.#groups.push(...prepared);
    for (const group of prepared) {
      this.#channelNames.add(group.key);
      if (!this.#byChannel.has(group.key)) this.#byChannel.set(group.key, []);
      const entries = this.#byChannel.get(group.key);
      let low = 0,
        high = entries.length;
      while (low < high) {
        const mid = (low + high) >>> 1;
        if (entries[mid].at <= group.at) low = mid + 1;
        else high = mid;
      }
      entries.splice(low, 0, group);
    }
    this.#span = span;
    this.#nominal = Math.max(this.#nominal, end);
    this.#frames += newFrames;
    this.#valueBytes += newBytes;
    this.#order += prepared.length;
    this.#lastStart = at;
    this.#lastEnd = end;
    this.#changed();
    return this;
  }
  /** @param {Record<string,TimelineValue>} channels @param {TimelinePosition} [position] */
  set(channels, position) {
    const prepared = {};
    for (const [key, input] of recordEntries(channels, 'timeline set'))
      prepared[key] = { from: timelineValue(input), to: input, duration: 0 };
    return this.add(prepared, position);
  }
  /** @param {Timeline} child @param {TimelinePosition} [position] */
  child(child, position) {
    assert(isTimeline(child) && child !== this, 'INVALID_TIMELINE', 'Use another native Timeline as a child.');
    assert(this.#children.length < 1000, 'RESOURCE_LIMIT', 'Timeline child budget exceeded.');
    const at = this.resolvePosition(position),
      plan = child.#compile(),
      entry = Object.freeze({ plan, at, scale: 1, order: this.#order });
    const candidate = this.#compile(this.#groups, [...this.#children, entry]);
    const end = seconds(at + (plan.duration === Infinity ? plan.nominal : plan.duration), 'child authored end');
    this.#children.push(entry);
    for (const key of plan.channels.keys()) this.#channelNames.add(key);
    this.#span = candidate.span;
    this.#nominal = candidate.nominal;
    this.#order++;
    this.#lastStart = at;
    this.#lastEnd = end;
    this.#changed();
    this.#plan = candidate;
    return this;
  }
  /** @param {{name:string,data?:unknown}} spec @param {TimelinePosition} [position] */
  event(spec, position) {
    options(spec, ['name', 'data'], 'timeline event');
    safeName(spec.name, 'event');
    assert(this.#events.length < LIMIT.events, 'RESOURCE_LIMIT', 'Timeline event budget exceeded.');
    const at = this.resolvePosition(position),
      payload = own(spec, 'data') ? eventPayload(spec.data) : { data: undefined, bytes: 0 },
      data = payload.data;
    assert(
      this.#valueBytes +
        this.#eventBytes +
        payload.bytes +
        this.#children.reduce((sum, child) => sum + child.plan.valueBytes, 0) <=
        LIMIT.values,
      'RESOURCE_LIMIT',
      'Timeline aggregate value-byte budget exceeded.',
    );
    const total = totalDuration(Math.max(this.#span, at), this.#repeat, this.#repeatDelay);
    if (total !== Infinity) seconds(total, 'timeline total duration');
    assert(
      this.#events.length + this.#children.reduce((sum, child) => sum + child.plan.eventCount, 0) < LIMIT.events,
      'RESOURCE_LIMIT',
      'Timeline aggregate event budget exceeded.',
    );
    this.#span = Math.max(this.#span, at);
    this.#nominal = Math.max(this.#nominal, at);
    this.#eventBytes += payload.bytes;
    this.#events.push(
      Object.freeze({ name: spec.name, ...(data === undefined ? {} : { data }), at, order: this.#order++ }),
    );
    this.#lastStart = this.#lastEnd = at;
    this.#changed();
    return this;
  }
  #compile(groups = this.#groups, children = this.#children) {
    if (groups === this.#groups && children === this.#children && this.#plan) return this.#plan;
    const channels = new Map();
    let nominal = this.#wait,
      span = this.#wait,
      frameCount = 0,
      groupCount = groups.length,
      valueBytes = this.#valueBytes + this.#eventBytes,
      eventCount = this.#events.length,
      depth = 1;
    const insert = (key, entry) => {
      if (!channels.has(key)) channels.set(key, []);
      channels.get(key).push(entry);
    };
    for (const group of groups) {
      insert(group.key, group);
      nominal = Math.max(nominal, group.nominal);
      span = Math.max(span, group.total === Infinity ? Infinity : group.at + group.total);
      frameCount += group.frames.length;
    }
    for (const child of children) {
      depth = Math.max(depth, child.plan.depth + 1);
      frameCount += child.plan.frameCount;
      groupCount += child.plan.groupCount;
      valueBytes += child.plan.valueBytes;
      eventCount += child.plan.eventCount;
      nominal = Math.max(
        nominal,
        child.at + (child.plan.duration === Infinity ? child.plan.nominal : child.plan.duration) * child.scale,
      );
      span = Math.max(span, child.at + child.plan.duration * child.scale);
      for (const key of child.plan.channels.keys())
        insert(
          key,
          Object.freeze({
            kind: 'child',
            child,
            at: child.at,
            order: child.order,
            slot: child.plan.valueSlots.get(key),
          }),
        );
    }
    for (const event of this.#events) {
      nominal = Math.max(nominal, event.at);
      span = Math.max(span, event.at);
    }
    assert(
      channels.size <= LIMIT.channels &&
        frameCount <= LIMIT.frames &&
        groupCount <= LIMIT.groups &&
        valueBytes <= LIMIT.values &&
        eventCount <= LIMIT.events &&
        depth <= LIMIT.depth,
      'RESOURCE_LIMIT',
      'Timeline aggregate channels, keyframes, values, events or nesting budget exceeded.',
    );
    seconds(nominal, 'timeline authored span');
    assert(
      span !== Infinity || !this.#reversed,
      'INVALID_TIMELINE',
      'An infinite authored span cannot reverse globally.',
    );
    const duration = totalDuration(span, this.#repeat, this.#repeatDelay);
    if (duration !== Infinity) seconds(duration, 'timeline total duration');
    for (const entries of channels.values()) entries.sort((a, b) => a.at - b.at || a.order - b.order);
    const samplingRows = Object.freeze([...channels].map(([key, entries]) => prepareSamplingRow(key, entries)));
    const plan = Object.freeze({
      channels,
      valueSlots: new Map([...channels.keys()].map((key, index) => [key, index])),
      valueChannels: Object.freeze([...channels.keys()]),
      // Keep channel lookup for selective queries and prepare allocation-free
      // traversal for full snapshots. Rebuilt only when the authored plan changes.
      sampleChannels: samplingRows,
      valueSteps: prepareValueSteps(samplingRows),
      nominal,
      span,
      duration,
      repeat: this.#repeat,
      repeatDelay: this.#repeatDelay,
      alternate: this.#alternate,
      reversed: this.#reversed,
      children: Object.freeze([...children]),
      events: Object.freeze([...this.#events]),
      frameCount,
      groupCount,
      valueBytes,
      eventCount,
      depth,
    });
    if (groups === this.#groups && children === this.#children) this.#plan = plan;
    return plan;
  }
  /** @param {string} key @param {number} [time] @returns {TimelineValue|undefined} */
  valueAt(key, time = 0) {
    safeName(key);
    seconds(time);
    if (!this.#channelNames.has(key)) return undefined;
    const local = timing(this.#span, this.#repeat, this.#repeatDelay, this.#alternate, this.#reversed, time).localTime;
    let entry = this.#byChannel.has(key) ? latest(this.#byChannel.get(key), local) : null;
    for (const child of this.#children)
      if (child.plan.channels.has(key)) {
        const candidate = { kind: 'child', child, at: child.at, order: child.order };
        if (
          !entry ||
          (candidate.at <= local
            ? entry.at > local ||
              candidate.at > entry.at ||
              (candidate.at === entry.at && candidate.order > entry.order)
            : entry.at > local && candidate.at < entry.at)
        )
          entry = candidate;
      }
    if (!entry) return undefined;
    return entry.kind === 'group'
      ? sampleGroup(entry, local)
      : samplePlanChannel(entry.child.plan, key, Math.max(0, local - entry.at) / entry.child.scale);
  }
  /** @param {number} [time] @returns {TimelineSnapshot} */
  sample(time = 0) {
    return samplePlan(this.#compile(), seconds(time));
  }
  /** Capture an immutable plan with a stable positional channel layout.
   * Later authoring does not change this prepared plan.
   * @returns {PreparedTimeline}
   */
  prepare() {
    const plan = this.#compile();
    const channels = plan.valueChannels;
    return Object.freeze({
      channels,
      version: this.#version,
      duration: plan.duration,
      sample: (time = 0) => samplePlanValues(plan, channels, seconds(time)),
    });
  }
  /** @param {number} from @param {number} to @param {{maxEvents?:number}} [spec] @returns {ReadonlyArray<TimelineEvent>} */
  eventsBetween(from, to, spec = {}) {
    number(from, 'event range start', -1e-9, LIMIT.time);
    seconds(to, 'event range end');
    options(spec, ['maxEvents'], 'timeline event query');
    const max = number(spec.maxEvents ?? 1024, 'event crossing limit', 1, LIMIT.events);
    assert(Number.isInteger(max), 'INVALID_TIMELINE', 'maxEvents must be an integer.');
    const output = [],
      forward = to >= from,
      low = Math.min(from, to),
      high = Math.max(from, to);
    let work = 0;
    const paths = new WeakMap();
    const emit = (event, time, direction, iteration, path) => {
      if ((forward && time > from && time <= to) || (!forward && time < from && time >= to)) {
        assert(output.length < max, 'RESOURCE_LIMIT', 'Timeline event crossings exceed maxEvents.');
        const record = Object.freeze({
          name: event.name,
          ...(own(event, 'data') ? { data: event.data } : {}),
          time,
          at: time,
          direction: direction * (forward ? 1 : -1),
          iteration,
          order: event.order,
        });
        paths.set(record, path);
        output.push(record);
      }
    };
    const visit = (plan, lo, hi, deliver) => {
      if (!plan.eventCount) return;
      const period = plan.span + plan.repeatDelay,
        first = plan.span === Infinity || period === 0 ? 0 : Math.max(0, Math.ceil((lo - plan.span) / period)),
        last = plan.span === Infinity || period === 0 ? 0 : Math.min(plan.repeat, Math.floor(hi / period));
      assert(last - first <= max + 2, 'RESOURCE_LIMIT', 'Timeline event cycle crossings exceed the work budget.');
      for (let iteration = first; iteration <= last; iteration++) {
        assert(++work <= 100000, 'RESOURCE_LIMIT', 'Timeline event traversal work budget exceeded.');
        const start = plan.span === Infinity ? 0 : iteration * period,
          reverse = plan.reversed !== (plan.alternate && iteration % 2 === 1),
          direction = reverse ? -1 : 1;
        let a = Math.max(0, lo - start),
          b = Math.min(plan.span, hi - start);
        if (a > b) continue;
        if (reverse) [a, b] = [plan.span - b, plan.span - a];
        const projected = (event, time, childDirection = 1, path = [event.order]) =>
          deliver(event, start + (reverse ? plan.span - time : time), direction * childDirection, iteration, path);
        for (const event of plan.events) {
          assert(++work <= 100000, 'RESOURCE_LIMIT', 'Timeline event traversal work budget exceeded.');
          if (event.at >= a && event.at <= b) projected(event, event.at);
        }
        for (const child of plan.children) {
          assert(++work <= 100000, 'RESOURCE_LIMIT', 'Timeline event traversal work budget exceeded.');
          const childLow = Math.max(0, (a - child.at) / child.scale),
            childHigh = Math.min(child.plan.duration, (b - child.at) / child.scale);
          if (childLow <= childHigh && b >= child.at)
            visit(child.plan, childLow, childHigh, (event, time, childDirection, _iteration, path) =>
              projected(event, child.at + time * child.scale, childDirection, [child.order, ...path]),
            );
        }
      }
    };
    if (from !== to) visit(this.#compile(), low, high, emit);
    const comparePaths = (left, right) => {
      const a = paths.get(left),
        b = paths.get(right);
      for (let index = 0; index < Math.min(a.length, b.length); index++)
        if (a[index] !== b[index]) return a[index] - b[index];
      return a.length - b.length;
    };
    output.sort((a, b) => (forward ? a.time - b.time || comparePaths(a, b) : b.time - a.time || comparePaths(b, a)));
    return Object.freeze(output);
  }
  /** @param {number} factor */
  scaleTime(factor) {
    factor = number(factor, 'timeline time scale', 1e-6, 1e6);
    const scale = (input) => seconds(input * factor, 'scaled time');
    const groups = this.#groups.map((group) =>
      Object.freeze({
        ...group,
        at: scale(group.at),
        span: scale(group.span),
        total: group.total === Infinity ? Infinity : scale(group.total),
        repeatDelay: scale(group.repeatDelay),
        nominal: scale(group.nominal),
        frames: Object.freeze(
          group.frames.map((frame) =>
            Object.freeze({
              ...frame,
              at: scale(frame.at),
              end: scale(frame.end),
              duration: scale(frame.duration),
              timing: frame.timing
                ? Object.freeze([
                    makeTrack({ ...frame.timing[0], at: scale(frame.at), duration: scale(frame.duration) }),
                  ])
                : null,
            }),
          ),
        ),
      }),
    );
    const children = this.#children.map((child) =>
      Object.freeze({ ...child, at: scale(child.at), scale: child.scale * factor }),
    );
    const events = this.#events.map((event) => Object.freeze({ ...event, at: scale(event.at) })),
      labels = new Map([...this.#labels].map(([key, at]) => [key, scale(at)]));
    const wait = scale(this.#wait),
      lastStart = scale(this.#lastStart),
      lastEnd = scale(this.#lastEnd),
      repeatDelay = scale(this.#repeatDelay);
    // Validate the transformed aggregate before committing any authored state.
    const previous = [this.#wait, this.#events, this.#repeatDelay];
    this.#wait = wait;
    this.#events = events;
    this.#repeatDelay = repeatDelay;
    let plan;
    try {
      plan = this.#compile(groups, children);
    } finally {
      [this.#wait, this.#events, this.#repeatDelay] = previous;
    }
    this.#groups = groups;
    this.#byChannel = new Map();
    for (const group of groups) {
      if (!this.#byChannel.has(group.key)) this.#byChannel.set(group.key, []);
      this.#byChannel.get(group.key).push(group);
    }
    for (const entries of this.#byChannel.values()) entries.sort((a, b) => a.at - b.at || a.order - b.order);
    this.#nominal = plan.nominal;
    this.#span = plan.span;
    this.#children = children;
    this.#events = events;
    this.#labels = labels;
    this.#wait = wait;
    this.#repeatDelay = repeatDelay;
    this.#lastStart = lastStart;
    this.#lastEnd = lastEnd;
    this.#changed();
    this.#plan = plan;
    return this;
  }
  /** @param {number} duration */
  stretch(duration) {
    duration = number(duration, 'stretched duration', 1e-6, LIMIT.time);
    const current = this.authoredDuration;
    assert(current > 0, 'INVALID_TIMELINE', 'A zero-duration timeline cannot stretch.');
    return this.scaleTime(duration / current);
  }
}
/** @param {TimelineOptions} [spec] @returns {Timeline} */
export function createTimeline(spec = {}) {
  return new Timeline(spec);
}
