// Adaptive music in the style of game scores. A score is a set of bar-length
// clips, playlists that sequence them (with repeats, random choices, nested
// sequences and endless loops, like a tracker's order list), transitions that
// wait for a musical boundary, layers whose gain follows an intensity value,
// and stingers that land on the beat.
//
// The techniques are the standard ones described by Collins, "Game Sound"
// (MIT Press, 2008, ch. 8), Sweet, "Writing Interactive Music for Video
// Games" (2014) and the interactive-music system of Land and McConnell's
// US patent 5,315,057 (1994): horizontal re-sequencing, vertical layering,
// transition segments, quantised switching and pre-entry/post-exit audio.
//
// `plan` is pure: it turns state changes into a timed schedule. `render`
// mixes caller-supplied PCM for that schedule. Neither plays audio.

import { assert, number, options, safeCopy, text } from '../core/validate.js';
import { allocate, rng, sampleRate as readRate } from '../sound/pcm.js';
import { musicGrid } from './grid.js';

const MAX_CLIPS = 256,
  MAX_DEPTH = 8,
  MAX_SCHEDULED = 20_000,
  MAX_CHANGES = 10_000,
  QUANTIZE = ['immediate', 'beat', 'bar', 'clip-end', 'exit-cue'];

function id(value, name) {
  const v = text(value, name, 100);
  assert(/^[A-Za-z0-9_.:-]+$/.test(v), 'ADAPTIVE_MUSIC', `${name} uses letters, digits, _ . : or -.`);
  return v;
}

function readQuantize(value, name) {
  if (value && typeof value === 'object') {
    options(value, ['bars'], name);
    const bars = number(value.bars, `${name}.bars`, 1, 64);
    assert(Number.isInteger(bars), 'ADAPTIVE_MUSIC', `${name}.bars must be whole.`);
    return { bars };
  }
  assert(QUANTIZE.includes(value), 'ADAPTIVE_MUSIC', `${name} is ${QUANTIZE.join(', ')} or {bars}.`);
  return value;
}

function readItem(item, clips, depth, path) {
  assert(depth <= MAX_DEPTH, 'RESOURCE_LIMIT', `Playlists nest at most ${MAX_DEPTH} levels.`);
  if (typeof item === 'string') item = { clip: item };
  assert(item && typeof item === 'object', 'ADAPTIVE_MUSIC', `${path} must be a clip id or playlist item.`);
  options(item, ['clip', 'sequence', 'choose', 'loop', 'repeat'], path);
  const kinds = ['clip', 'sequence', 'choose', 'loop'].filter((k) => k in item);
  assert(kinds.length === 1, 'ADAPTIVE_MUSIC', `${path} needs exactly one of clip, sequence, choose or loop.`);
  const repeat = number(item.repeat ?? 1, `${path}.repeat`, 1, 256);
  assert(Number.isInteger(repeat), 'ADAPTIVE_MUSIC', `${path}.repeat must be whole.`);
  const kind = kinds[0];
  if (kind === 'clip') {
    const clip = id(item.clip, `${path}.clip`);
    assert(clips.has(clip), 'ADAPTIVE_MUSIC', `${path} names unknown clip ${clip}.`);
    return { kind, clip, repeat };
  }
  const list = item[kind];
  assert(
    Array.isArray(list) && list.length > 0 && list.length <= 64,
    'ADAPTIVE_MUSIC',
    `${path}.${kind} holds 1–64 items.`,
  );
  const items = list.map((child, i) => readItem(child, clips, depth + 1, `${path}.${kind}[${i}]`));
  if (kind === 'loop')
    assert(repeat === 1, 'ADAPTIVE_MUSIC', `${path}: a loop repeats until a transition, so it takes no repeat.`);
  return { kind, items, repeat };
}

function readSpec(spec) {
  options(
    spec,
    ['tempo', 'beatsPerBar', 'clips', 'states', 'initial', 'layers', 'transitions', 'stingers', 'layerFade', 'seed'],
    'adaptive score',
  );
  const tempo = number(spec.tempo, 'tempo', 20, 400),
    beatsPerBar = number(spec.beatsPerBar ?? 4, 'beats per bar', 1, 16);
  assert(Number.isInteger(beatsPerBar), 'ADAPTIVE_MUSIC', 'beatsPerBar must be whole.');
  const beat = 60 / tempo,
    clips = new Map();
  assert(spec.clips && typeof spec.clips === 'object', 'ADAPTIVE_MUSIC', 'Give clips as {id: {bars}}.');
  options(spec.clips, Object.keys(spec.clips), 'clips');
  const clipIds = Object.keys(spec.clips);
  assert(clipIds.length > 0 && clipIds.length <= MAX_CLIPS, 'RESOURCE_LIMIT', `Define 1–${MAX_CLIPS} clips.`);
  for (const key of clipIds) {
    const c = spec.clips[key];
    options(c, ['bars', 'beats', 'pickup', 'tail', 'exitCues'], `clip ${key}`);
    const beats =
      c.beats !== undefined
        ? number(c.beats, `${key}.beats`, 0.25, 4096)
        : number(c.bars, `${key}.bars`, 0.25, 1024) * beatsPerBar;
    const exitCues = safeCopy(c.exitCues ?? []);
    assert(
      Array.isArray(exitCues) && exitCues.length <= 64,
      'ADAPTIVE_MUSIC',
      `${key}.exitCues holds at most 64 beat positions.`,
    );
    exitCues.forEach((v, i) => number(v, `${key}.exitCues[${i}]`, 0, beats));
    clips.set(id(key, 'clip id'), {
      id: key,
      length: beats * beat,
      pickup: number(c.pickup ?? 0, `${key}.pickup`, 0, 64) * beat,
      tail: number(c.tail ?? 0, `${key}.tail`, 0, 64) * beat,
      exitCues: exitCues.map((v) => v * beat).sort((a, b) => a - b),
    });
  }
  assert(spec.states && typeof spec.states === 'object', 'ADAPTIVE_MUSIC', 'Give states as {id: {play}}.');
  options(spec.states, Object.keys(spec.states), 'states');
  const states = new Map();
  for (const key of Object.keys(spec.states)) {
    const s = spec.states[key];
    options(s, ['play', 'next'], `state ${key}`);
    assert(
      Array.isArray(s.play) && s.play.length > 0 && s.play.length <= 64,
      'ADAPTIVE_MUSIC',
      `${key}.play holds 1–64 items.`,
    );
    states.set(id(key, 'state id'), {
      id: key,
      items: s.play.map((item, i) => readItem(item, clips, 1, `${key}.play[${i}]`)),
      next: s.next === undefined ? null : id(s.next, `${key}.next`),
    });
  }
  assert(states.size > 0 && states.size <= 64, 'ADAPTIVE_MUSIC', 'Define 1–64 states.');
  for (const s of states.values())
    assert(s.next === null || states.has(s.next), 'ADAPTIVE_MUSIC', `${s.id}.next names unknown state ${s.next}.`);
  const layers = new Map();
  options(spec.layers ?? {}, Object.keys(spec.layers ?? {}), 'layers');
  for (const key of Object.keys(spec.layers ?? {})) {
    const l = spec.layers[key];
    options(l, ['from', 'to'], `layer ${key}`);
    const from = number(l.from ?? 0, `${key}.from`, 0, 1),
      to = number(l.to ?? Math.min(1, from + 0.2), `${key}.to`, from, 1);
    layers.set(id(key, 'layer id'), { id: key, from, to });
  }
  assert(layers.size <= 16, 'RESOURCE_LIMIT', 'Use at most 16 layers.');
  const transitions = safeCopy(spec.transitions ?? []);
  assert(
    Array.isArray(transitions) && transitions.length <= 256,
    'RESOURCE_LIMIT',
    'Use at most 256 transition rules.',
  );
  const rules = transitions.map((t, i) => {
    options(t, ['from', 'to', 'at', 'via', 'fade', 'match'], `transitions[${i}]`);
    const from = t.from === undefined || t.from === '*' ? '*' : id(t.from, 'transition from'),
      to = t.to === undefined || t.to === '*' ? '*' : id(t.to, 'transition to');
    for (const s of [from, to])
      assert(s === '*' || states.has(s), 'ADAPTIVE_MUSIC', `transitions[${i}] names unknown state ${s}.`);
    const via = t.via === undefined ? null : id(t.via, 'transition via');
    assert(via === null || clips.has(via), 'ADAPTIVE_MUSIC', `transitions[${i}].via names unknown clip ${via}.`);
    return {
      from,
      to,
      at: readQuantize(t.at ?? 'bar', `transitions[${i}].at`),
      via,
      fade: number(t.fade ?? 0, `transitions[${i}].fade`, 0, 64) * beat,
      match: t.match === undefined ? false : t.match === true,
    };
  });
  const stingers = new Map();
  options(spec.stingers ?? {}, Object.keys(spec.stingers ?? {}), 'stingers');
  for (const key of Object.keys(spec.stingers ?? {})) {
    const s = spec.stingers[key];
    options(s, ['beats', 'pickup', 'at'], `stinger ${key}`);
    assert(!clips.has(key), 'ADAPTIVE_MUSIC', `Stinger ${key} shares an id with a clip.`);
    stingers.set(id(key, 'stinger id'), {
      id: key,
      length: number(s.beats ?? 1, `${key}.beats`, 0.25, 64) * beat,
      pickup: number(s.pickup ?? 0, `${key}.pickup`, 0, 16) * beat,
      at: readQuantize(s.at ?? 'beat', `${key}.at`),
    });
  }
  const initial = spec.initial === undefined ? [...states.keys()][0] : id(spec.initial, 'initial state');
  assert(states.has(initial), 'ADAPTIVE_MUSIC', `Unknown initial state ${initial}.`);
  return {
    tempo,
    beatsPerBar,
    beat,
    bar: beat * beatsPerBar,
    clips,
    states,
    layers,
    rules,
    stingers,
    initial,
    layerFade: number(spec.layerFade ?? 2, 'layer fade', 0, 64) * beat,
    seed: spec.seed ?? 1,
  };
}

/** Walk a state's playlist one clip at a time. Loops repeat until the caller stops asking. */
function* walk(items, random, last) {
  for (const item of items) {
    if (item.kind === 'loop') {
      for (;;) yield* walk(item.items, random, last);
    }
    for (let r = 0; r < item.repeat; r++) {
      if (item.kind === 'clip') yield item.clip;
      else if (item.kind === 'sequence') yield* walk(item.items, random, last);
      else {
        // Choose one child at random, avoiding the previous choice when there is another.
        const choices = item.items.map((_, i) => i).filter((i) => item.items.length === 1 || i !== last.get(item));
        const pick = choices[Math.floor(random() * choices.length)];
        last.set(item, pick);
        yield* walk([item.items[pick]], random, last);
      }
    }
  }
}

function boundary(score, rule, clip, start, request) {
  const at = rule.at,
    elapsed = Math.max(0, request - start),
    end = start + clip.length;
  if (at === 'immediate') return request;
  if (at === 'clip-end') return end;
  if (at === 'exit-cue') {
    const cue = clip.exitCues.find((c) => start + c >= request - 1e-9);
    return cue === undefined ? end : start + cue;
  }
  const unit = at === 'beat' ? score.beat : at === 'bar' ? score.bar : at.bars * score.bar;
  return Math.min(end, start + Math.ceil(elapsed / unit - 1e-9) * unit);
}

function findRule(rules, from, to) {
  return (
    rules.find((r) => r.from === from && r.to === to) ??
    rules.find((r) => r.from === from && r.to === '*') ??
    rules.find((r) => r.from === '*' && r.to === to) ??
    rules.find((r) => r.from === '*' && r.to === '*') ?? { at: 'bar', via: null, fade: 0, match: false }
  );
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

const smooth = (x) => {
  const u = Math.max(0, Math.min(1, x));
  return u * u * (3 - 2 * u);
};

/**
 * Build an adaptive score. Call `plan(changes, {duration})` with state,
 * intensity and stinger requests to get a timed schedule, then
 * `render(plan, sources)` to mix your PCM stems for it.
 */
export function createAdaptiveScore(spec) {
  const score = readSpec(spec);

  function plan(changes = [], settings = {}) {
    options(settings, ['duration', 'intensity'], 'adaptive plan');
    const duration = number(settings.duration, 'plan duration', score.beat, 3600);
    assert(
      Array.isArray(changes) && changes.length <= MAX_CHANGES,
      'RESOURCE_LIMIT',
      `Plan at most ${MAX_CHANGES} changes.`,
    );
    const requests = changes.map((c, i) => {
      options(c, ['at', 'state', 'intensity', 'stinger'], `changes[${i}]`);
      const at = number(c.at, `changes[${i}].at`, 0, duration),
        kinds = ['state', 'intensity', 'stinger'].filter((k) => k in c);
      assert(kinds.length === 1, 'ADAPTIVE_MUSIC', `changes[${i}] sets exactly one of state, intensity or stinger.`);
      if ('state' in c)
        assert(
          score.states.has(id(c.state, 'state')),
          'ADAPTIVE_MUSIC',
          `changes[${i}] names unknown state ${c.state}.`,
        );
      if ('stinger' in c)
        assert(
          score.stingers.has(id(c.stinger, 'stinger')),
          'ADAPTIVE_MUSIC',
          `changes[${i}] names unknown stinger ${c.stinger}.`,
        );
      if ('intensity' in c) number(c.intensity, `changes[${i}].intensity`, 0, 1);
      return { ...c, at, order: i };
    });
    requests.sort((a, b) => a.at - b.at || a.order - b.order);
    const random = rng(score.seed),
      stateRequests = requests.filter((r) => 'state' in r),
      scheduled = [],
      markers = [];
    let state = score.initial,
      playlist = walk(score.states.get(state).items, random, new Map()),
      time = 0,
      pending = null,
      nextRequest = 0,
      fadeIn = 0,
      startOffset = 0;
    markers.push({ time: 0, type: 'state', state });
    const nextClipOf = () => {
      for (let guard = 0; guard < 64; guard++) {
        const step = playlist.next();
        if (!step.done) return step.value;
        const following = score.states.get(state).next;
        if (following === null) return null;
        state = following;
        markers.push({ time, type: 'state', state });
        playlist = walk(score.states.get(state).items, random, new Map());
      }
      return null;
    };
    let clipId = nextClipOf();
    while (time < duration - 1e-9 && clipId !== null) {
      assert(
        scheduled.length < MAX_SCHEDULED,
        'RESOURCE_LIMIT',
        'The plan schedules too many clips; shorten it or lengthen the clips.',
      );
      const clip = score.clips.get(clipId),
        start = time - startOffset;
      let end = start + clip.length,
        fadeOut = 0,
        cut = false;
      // Does a state request land during this clip?
      while (
        nextRequest < stateRequests.length &&
        stateRequests[nextRequest].state === (pending?.state ?? state) &&
        stateRequests[nextRequest].at < end
      )
        nextRequest++;
      if (!pending && nextRequest < stateRequests.length && stateRequests[nextRequest].at < end) {
        const request = stateRequests[nextRequest++],
          rule = findRule(score.rules, state, request.state);
        pending = {
          state: request.state,
          rule,
          requested: request.at,
          switchAt: boundary(score, rule, clip, start, Math.max(time, request.at)),
        };
      }
      if (pending && pending.switchAt < end - 1e-9) {
        end = pending.switchAt;
        cut = true;
        fadeOut = pending.rule.fade;
      }
      const playEnd = Math.min(end, duration);
      if (playEnd > time + 1e-9)
        scheduled.push({
          clip: clipId,
          state,
          start,
          offset: time - start,
          from: time,
          end: playEnd,
          fadeIn,
          fadeOut,
          cut,
          tail: cut ? 0 : clip.tail,
          pickup: time - start === 0 ? clip.pickup : 0,
        });
      markers.push({ time, type: 'clip', clip: clipId, state });
      fadeIn = 0;
      startOffset = 0;
      time = end;
      if (pending && Math.abs(pending.switchAt - end) < 1e-9) {
        const { rule } = pending;
        if (rule.via) {
          const via = score.clips.get(rule.via);
          if (time < duration)
            scheduled.push({
              clip: rule.via,
              state: 'transition',
              start: time,
              offset: 0,
              from: time,
              end: Math.min(duration, time + via.length),
              fadeIn: 0,
              fadeOut: 0,
              cut: false,
              tail: via.tail,
              pickup: via.pickup,
            });
          markers.push({ time, type: 'transition', clip: rule.via, from: state, to: pending.state });
          time += via.length;
        }
        state = pending.state;
        markers.push({ time, type: 'state', state, requested: pending.requested });
        playlist = walk(score.states.get(state).items, random, new Map());
        clipId = nextClipOf();
        if (rule.match && !rule.via && clipId !== null) {
          // Enter the new clip at the same position the old one had reached.
          const length = score.clips.get(clipId).length,
            previous = scheduled[scheduled.length - 1];
          startOffset = previous ? (previous.offset + (previous.end - previous.from)) % length : 0;
        }
        fadeIn = rule.fade;
        pending = null;
        continue;
      }
      clipId = nextClipOf();
    }
    // Layer gains from intensity requests, quantised to the next beat.
    const intensityRequests = [
        {
          at: 0,
          intensity: settings.intensity === undefined ? 0 : number(settings.intensity, 'initial intensity', 0, 1),
        },
        ...requests.filter((r) => 'intensity' in r),
      ],
      layers = {};
    for (const layer of score.layers.values()) {
      const keys = [];
      let current = smooth((intensityRequests[0].intensity - layer.from) / Math.max(1e-9, layer.to - layer.from));
      keys.push({ time: 0, gain: current });
      for (const r of intensityRequests.slice(1)) {
        const at = Math.min(duration, Math.ceil(r.at / score.beat - 1e-9) * score.beat),
          target = smooth((r.intensity - layer.from) / Math.max(1e-9, layer.to - layer.from));
        if (target === current) continue;
        const before = keys[keys.length - 1];
        if (at > before.time) keys.push({ time: at, gain: current });
        keys.push({
          time: Math.min(duration, Math.max(at, before.time) + Math.max(0.005, score.layerFade)),
          gain: target,
        });
        current = target;
      }
      layers[layer.id] = keys;
    }
    for (const r of requests.filter((change) => 'intensity' in change))
      markers.push({ time: r.at, type: 'intensity', intensity: r.intensity });
    // Stingers land on their boundary; their pickup starts before it.
    const stingers = requests
      .filter((r) => 'stinger' in r)
      .map((r) => {
        const s = score.stingers.get(r.stinger),
          unit =
            s.at === 'immediate'
              ? 0
              : s.at === 'beat'
                ? score.beat
                : typeof s.at === 'object'
                  ? s.at.bars * score.bar
                  : score.bar,
          hit = unit ? Math.ceil((r.at + s.pickup) / unit - 1e-9) * unit : r.at + s.pickup;
        markers.push({ time: hit, type: 'stinger', stinger: s.id, requested: r.at });
        return { stinger: s.id, hit, start: hit - s.pickup, end: hit + s.length };
      })
      .filter((s) => s.start < duration);
    markers.sort((a, b) => a.time - b.time);
    return deepFreeze({
      duration,
      tempo: score.tempo,
      beatsPerBar: score.beatsPerBar,
      clips: scheduled,
      layers,
      stingers,
      markers,
    });
  }

  function layerGain(keys, time) {
    if (!keys?.length) return 1;
    if (time <= keys[0].time) return keys[0].gain;
    for (let i = 1; i < keys.length; i++)
      if (time <= keys[i].time) {
        const a = keys[i - 1],
          b = keys[i];
        return b.time === a.time ? b.gain : a.gain + ((b.gain - a.gain) * (time - a.time)) / (b.time - a.time);
      }
    return keys[keys.length - 1].gain;
  }

  /** What is playing at a time: state, clip, position in the clip and layer gains. */
  function sample(planned, time) {
    number(time, 'time', 0, 3600);
    const entry = [...planned.clips].reverse().find((c) => c.from <= time + 1e-9 && time < c.end) ?? null,
      gains = {};
    for (const key of Object.keys(planned.layers)) gains[key] = layerGain(planned.layers[key], time);
    return Object.freeze({
      state: entry?.state ?? null,
      clip: entry?.clip ?? null,
      clipTime: entry ? entry.offset + (time - entry.from) : null,
      layers: Object.freeze(gains),
    });
  }

  function source(value, name, rate) {
    options(value, ['channels', 'sampleRate', 'duration', 'metadata', 'clippedSamples'], name);
    assert(readRate(value.sampleRate) === rate, 'AUDIO_RATE', `${name} must use the render sample rate ${rate} Hz.`);
    assert(
      Array.isArray(value.channels) && value.channels.length >= 1 && value.channels.length <= 2,
      'AUDIO_CHANNELS',
      `${name} needs one or two channels.`,
    );
    for (const c of value.channels)
      assert(
        Object.getPrototypeOf(c) === Float32Array.prototype || Object.getPrototypeOf(c) === Float64Array.prototype,
        'SOUND_DATA',
        `${name} channels must be Float32Array or Float64Array.`,
      );
    return value.channels;
  }

  /**
   * Mix PCM for a plan. `sources[clipId]` is either one PCM recording or an
   * object of stems keyed by name; stems named after a layer follow that
   * layer's gain and other stems play at full gain. `sources[stingerId]` is a
   * PCM recording. Each recording starts `pickup` beats before its downbeat
   * and may run on into its tail.
   */
  function render(planned, sources, settings = {}) {
    options(settings, ['sampleRate', 'from', 'duration'], 'adaptive render');
    const rate = readRate(settings.sampleRate ?? 48000),
      from = number(settings.from ?? 0, 'render start', 0, planned.duration),
      length = number(settings.duration ?? planned.duration - from, 'render duration', 1 / rate, 3600),
      count = Math.round(length * rate),
      out = allocate(count, 2),
      to = from + length;
    assert(
      sources && typeof sources === 'object',
      'ADAPTIVE_MUSIC',
      'Give render sources as {clipId: PCM or {stem: PCM}}.',
    );
    options(sources, Object.keys(sources), 'render sources');
    const mixVoice = (channels, audioStart, playFrom, playTo, gainAt) => {
      const a = Math.max(playFrom, from),
        b = Math.min(playTo, to);
      if (b <= a) return;
      const first = Math.round((a - from) * rate),
        last = Math.min(count, Math.round((b - from) * rate));
      for (let n = first; n < last; n++) {
        const t = from + n / rate,
          index = Math.round((t - audioStart) * rate);
        if (index < 0 || index >= channels[0].length) continue;
        const g = gainAt(t);
        if (g === 0) continue;
        out[0][n] += channels[0][index] * g;
        out[1][n] += (channels[1] ?? channels[0])[index] * g;
      }
    };
    for (const entry of planned.clips) {
      const clip = score.clips.get(entry.clip);
      assert(clip, 'ADAPTIVE_MUSIC', `The plan names unknown clip ${entry.clip}.`);
      const value = sources[entry.clip];
      if (value === undefined) continue;
      // The recording's sample 0 sits `pickup` before the clip's downbeat.
      const audioStart = entry.start - clip.pickup,
        playFrom = entry.from - entry.pickup,
        stop = entry.end,
        playTo = stop + entry.tail,
        envelope = (t) => {
          let g = 1;
          if (entry.fadeIn > 0 && t < entry.from + entry.fadeIn) g *= Math.max(0, (t - entry.from) / entry.fadeIn);
          if (entry.cut) {
            const release = Math.max(0.005, entry.fadeOut);
            if (t >= stop) g *= Math.max(0, 1 - (t - stop) / release);
          }
          return g;
        },
        end = entry.cut ? stop + Math.max(0.005, entry.fadeOut) : playTo;
      if ('channels' in value) mixVoice(source(value, entry.clip, rate), audioStart, playFrom, end, envelope);
      else {
        options(value, Object.keys(value), `stems of ${entry.clip}`);
        for (const stem of Object.keys(value)) {
          const keys = planned.layers[stem];
          mixVoice(
            source(value[stem], `${entry.clip}.${stem}`, rate),
            audioStart,
            playFrom,
            end,
            (t) => envelope(t) * (keys ? layerGain(keys, t) : 1),
          );
        }
      }
    }
    for (const s of planned.stingers) {
      const value = sources[s.stinger];
      if (value === undefined) continue;
      const channels = source(value, s.stinger, rate);
      mixVoice(channels, s.start, s.start, s.start + channels[0].length / rate, () => 1);
    }
    let clipped = 0;
    for (const c of out) for (let i = 0; i < c.length; i++) if (Math.abs(c[i]) > 1) clipped++;
    return Object.freeze({
      channels: Object.freeze(out),
      sampleRate: rate,
      duration: count / rate,
      clippedSamples: clipped,
    });
  }

  return Object.freeze({
    tempo: score.tempo,
    beatsPerBar: score.beatsPerBar,
    clips: Object.freeze([...score.clips.keys()]),
    states: Object.freeze([...score.states.keys()]),
    layers: Object.freeze([...score.layers.keys()]),
    stingers: Object.freeze([...score.stingers.keys()]),
    plan,
    sample,
    render,
    grid: (planned) => musicGrid({ tempo: score.tempo, beatsPerBar: score.beatsPerBar, duration: planned.duration }),
  });
}
