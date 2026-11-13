import { assert, number, options } from '../core/validate.js';
import { dbToGain, gainToDb, seeded, STUDIO_LIMITS, studioRate } from '../sound/studio/core.js';
import { limiter } from '../sound/studio/dynamics.js';
import { CONTROL_FRAMES, instrumentRenderer } from '../sound/studio/instrument.js';
import { measureAudio } from '../sound/studio/meters.js';
import { checkEffects, effectTail, runEffects } from '../sound/studio/rack.js';
import { createMusicScore, musicScoreTime } from './score.js';

/** Limits of one production render. `work` counts rendered voice frames weighted by instrument cost. */
export const PRODUCTION_LIMITS = Object.freeze({ seconds: 600, tracks: 64, buses: 16, returns: 8, work: 8e10 });

function identifier(value, used, name) {
  assert(
    typeof value === 'string' && value.length > 0 && value.length <= 128,
    'MUSIC_PRODUCTION',
    `${name} needs an ID.`,
  );
  assert(!used.has(value) && value !== 'master', 'MUSIC_PRODUCTION', `${name} ID ${value} is already used.`);
  used.add(value);
  return value;
}

/** Replace `{tick, value}` automation points with `{time, value}` in seconds. */
function resolveTicks(chain, time, name) {
  return checkEffects(chain ?? [], name).map((effect) => {
    const resolved = {};
    for (const [key, value] of Object.entries(effect)) {
      resolved[key] =
        Array.isArray(value) &&
        value.length &&
        value.every((point) => point && typeof point === 'object' && 'tick' in point)
          ? value.map((point) => ({
              time: time.secondsAt(number(point.tick, 'automation tick', 0, 0x0fffffff)),
              value: point.value,
            }))
          : value;
    }
    return resolved;
  });
}

function sendLevels(value, returns, name) {
  const sends = [];
  if (value === undefined) return sends;
  options(value, Object.keys(value), `${name} sends`);
  for (const [id, level] of Object.entries(value)) {
    assert(returns.has(id), 'MUSIC_PRODUCTION', `${name} sends to unknown return ${id}.`);
    sends.push([id, dbToGain(number(level, 'send level in dB', -80, 12))]);
  }
  return sends;
}

function automationCurve(points, frames, rate, time, name, min, max) {
  if (points === undefined) return null;
  assert(
    Array.isArray(points) && points.length >= 1 && points.length <= 4096,
    'MUSIC_PRODUCTION',
    `${name} needs 1–4096 points.`,
  );
  const resolved = points.map((point) => {
    options(point, ['tick', 'time', 'value'], `${name} point`);
    assert(
      (point.tick === undefined) !== (point.time === undefined),
      'MUSIC_PRODUCTION',
      `Give each ${name} point a tick or a time.`,
    );
    return [
      point.tick === undefined
        ? number(point.time, `${name} time`, 0, 86400)
        : time.secondsAt(number(point.tick, `${name} tick`, 0, 0x0fffffff)),
      number(point.value, name, min, max),
    ];
  });
  resolved.sort((a, b) => a[0] - b[0]);
  const curve = new Float32Array(frames);
  let index = 0;
  for (let i = 0; i < frames; i++) {
    const seconds = i / rate;
    while (index + 1 < resolved.length && resolved[index + 1][0] <= seconds) index++;
    const [t0, v0] = resolved[index],
      next = resolved[index + 1];
    curve[i] = !next || seconds <= t0 ? v0 : v0 + ((next[1] - v0) * (seconds - t0)) / Math.max(1e-9, next[0] - t0);
  }
  return curve;
}

/**
 * Continuous controllers of one track as control-rate curves. Expression
 * (CC 11) and dynamics (CC 1) ramp linearly between their events and are
 * multiplied into one curve per channel. Sustain (CC 64) becomes pedal spans.
 */
function trackControls(track, time, rate, frames) {
  const lanes = new Map(),
    pedals = Array.from({ length: 16 }, () => []),
    pans = new Map();
  for (const message of track.messages) {
    if (message.status >> 4 !== 11) continue;
    const channel = message.status & 15;
    if (message.data1 === 64) {
      const down = message.data2 >= 64,
        lane = pedals[channel];
      if (down !== (lane.at(-1)?.down ?? false)) lane.push({ tick: message.tick, down });
    } else if (message.data1 === 11 || message.data1 === 1) {
      const key = `${channel}:${message.data1}`;
      if (!lanes.has(key)) lanes.set(key, []);
      lanes.get(key).push([time.secondsAt(message.tick), message.data2 / 127]);
    } else if (message.data1 === 10 && !pans.has(channel)) pans.set(channel, (message.data2 - 64) / 63);
  }
  const steps = Math.ceil(frames / CONTROL_FRAMES) + 1,
    curves = new Map();
  for (const [key, points] of lanes) {
    const channel = Number(key.split(':')[0]);
    let curve = curves.get(channel);
    if (!curve) curves.set(channel, (curve = new Float32Array(steps).fill(1)));
    let index = 0;
    for (let step = 0; step < steps; step++) {
      const seconds = (step * CONTROL_FRAMES) / rate;
      while (index + 1 < points.length && points[index + 1][0] <= seconds) index++;
      const [t0, v0] = points[index],
        next = points[index + 1];
      curve[step] *=
        !next || seconds <= t0 ? v0 : v0 + ((next[1] - v0) * (seconds - t0)) / Math.max(1e-9, next[0] - t0);
    }
  }
  return { curves, pedals, pans };
}

function releaseTick(note, pedal, endTick) {
  const keyUp = note.tick + note.duration;
  let low = 0,
    high = pedal.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (pedal[middle].tick <= keyUp) low = middle + 1;
    else high = middle;
  }
  return pedal[low - 1]?.down ? (pedal[low]?.tick ?? endTick) : keyUp;
}

function addInto(target, source, gain = 1) {
  const [tl, tr] = target,
    [sl, sr] = source;
  if (gain === 1) {
    for (let i = 0; i < tl.length; i++) {
      tl[i] += sl[i];
      tr[i] += sr[i];
    }
  } else {
    for (let i = 0; i < tl.length; i++) {
      tl[i] += sl[i] * gain;
      tr[i] += sr[i] * gain;
    }
  }
}

function fader(left, right, gainDb, pan, gainCurve, panCurve) {
  const gain = dbToGain(gainDb);
  for (let i = 0; i < left.length; i++) {
    const g = gainCurve ? gain * Math.exp(gainCurve[i] * 0.11512925464970229) : gain,
      angle = (((panCurve ? panCurve[i] : pan) + 1) * Math.PI) / 4;
    left[i] *= g * Math.SQRT2 * Math.cos(angle);
    right[i] *= g * Math.SQRT2 * Math.sin(angle);
  }
}

function peakDb(left, right) {
  let peak = 0;
  for (let i = 0; i < left.length; i++) {
    const value = Math.max(Math.abs(left[i]), Math.abs(right[i]));
    if (value > peak) peak = value;
  }
  return Math.round(gainToDb(peak) * 100) / 100;
}

/**
 * Render a score as a mixed production. Each track plays a studio instrument
 * into its own channel strip with effects, a fader and sends. Tracks can feed
 * buses, sends feed shared returns such as a hall, and the master chain ends
 * with loudness targeting and a true-peak limiter.
 */
export function produceMusic(input, production = {}) {
  const score = createMusicScore(input),
    time = musicScoreTime(score);
  options(
    production,
    ['sampleRate', 'tail', 'seed', 'tracks', 'buses', 'returns', 'master', 'stems'],
    'music production',
  );
  const rate = studioRate(production.sampleRate ?? 48000),
    seed = production.seed ?? 1,
    stemMode = production.stems ?? false;
  assert(typeof seed === 'number' || typeof seed === 'string', 'MUSIC_PRODUCTION', 'The seed is a number or text.');
  assert([false, 'tracks', 'buses'].includes(stemMode), 'MUSIC_PRODUCTION', "Stems are false, 'tracks' or 'buses'.");
  assert(
    time.duration <= PRODUCTION_LIMITS.seconds,
    'RESOURCE_LIMIT',
    'A production renders at most ten minutes of score.',
  );
  const tempo = Math.max(
    20,
    Math.min(400, 60e6 / (score.tempos[0]?.tick === 0 ? score.tempos[0].microsecondsPerQuarter : 500000)),
  );
  const ids = new Set();

  const returnSpecs = production.returns ?? [];
  assert(
    Array.isArray(returnSpecs) && returnSpecs.length <= PRODUCTION_LIMITS.returns,
    'MUSIC_PRODUCTION',
    'Use at most 8 returns.',
  );
  const returns = new Map();
  for (const spec of returnSpecs) {
    options(spec, ['id', 'effects', 'gain'], 'return');
    returns.set(identifier(spec.id, ids, 'A return'), {
      id: spec.id,
      effects: resolveTicks(spec.effects, time, `return ${spec.id}`),
      gain: number(spec.gain ?? 0, 'return gain in dB', -80, 24),
    });
  }

  const busSpecs = production.buses ?? [];
  assert(
    Array.isArray(busSpecs) && busSpecs.length <= PRODUCTION_LIMITS.buses,
    'MUSIC_PRODUCTION',
    'Use at most 16 buses.',
  );
  const buses = new Map();
  for (const spec of busSpecs) {
    options(spec, ['id', 'effects', 'gain', 'pan', 'sends', 'output'], 'bus');
    buses.set(identifier(spec.id, ids, 'A bus'), {
      id: spec.id,
      effects: resolveTicks(spec.effects, time, `bus ${spec.id}`),
      gain: number(spec.gain ?? 0, 'bus gain in dB', -80, 24),
      pan: number(spec.pan ?? 0, 'bus pan', -1, 1),
      sends: sendLevels(spec.sends, returns, `Bus ${spec.id}`),
      output: spec.output ?? 'master',
    });
  }
  const busOrder = [...buses.keys()];
  for (const [index, id] of busOrder.entries()) {
    const { output } = buses.get(id);
    assert(
      output === 'master' || busOrder.indexOf(output) > index,
      'MUSIC_PRODUCTION',
      `Bus ${id} must output to master or to a bus listed after it.`,
    );
  }

  const trackSpecs = production.tracks ?? [];
  assert(
    Array.isArray(trackSpecs) && trackSpecs.length <= PRODUCTION_LIMITS.tracks,
    'MUSIC_PRODUCTION',
    'Use at most 64 tracks.',
  );
  const scoreTracks = new Map(score.tracks.map((track) => [track.id, track]));
  const strips = [];
  const stripIds = new Set();
  for (const spec of trackSpecs) {
    options(
      spec,
      ['id', 'instrument', 'gain', 'pan', 'output', 'effects', 'sends', 'humanize', 'automation', 'mute', 'transpose'],
      'production track',
    );
    assert(
      scoreTracks.has(spec.id) && !stripIds.has(spec.id),
      'MUSIC_PRODUCTION',
      'Each production track names one score track once.',
    );
    assert(!ids.has(spec.id), 'MUSIC_PRODUCTION', `Track ID ${spec.id} is also a bus or return ID.`);
    stripIds.add(spec.id);
    const output = spec.output ?? 'master';
    assert(output === 'master' || buses.has(output), 'MUSIC_PRODUCTION', `Track ${spec.id} outputs to an unknown bus.`);
    const humanize = spec.humanize ?? {};
    options(humanize, ['timing', 'velocity'], 'humanize');
    const automation = spec.automation ?? {};
    options(automation, ['gain', 'pan'], 'track automation');
    assert(spec.mute === undefined || typeof spec.mute === 'boolean', 'MUSIC_PRODUCTION', 'mute is boolean.');
    strips.push({
      id: spec.id,
      track: scoreTracks.get(spec.id),
      instrument: spec.instrument,
      render: instrumentRenderer(spec.instrument),
      gain: number(spec.gain ?? 0, 'track gain in dB', -80, 24),
      pan: spec.pan === undefined ? undefined : number(spec.pan, 'track pan', -1, 1),
      output,
      effects: resolveTicks(spec.effects, time, `track ${spec.id}`),
      sends: sendLevels(spec.sends, returns, `Track ${spec.id}`),
      timing: number(humanize.timing ?? 0, 'humanize timing', 0, 0.1),
      velocity: number(humanize.velocity ?? 0, 'humanize velocity', 0, 0.5),
      automation,
      mute: spec.mute ?? false,
      transpose: number(spec.transpose ?? 0, 'track transposition', -48, 48),
    });
  }

  const masterSpec = production.master ?? {};
  options(masterSpec, ['effects', 'gain', 'loudness', 'ceiling'], 'master');
  const masterEffects = resolveTicks(masterSpec.effects, time, 'master'),
    masterGain = number(masterSpec.gain ?? 0, 'master gain in dB', -80, 24),
    ceiling = masterSpec.ceiling === null ? null : number(masterSpec.ceiling ?? -1, 'master ceiling in dBTP', -24, 0),
    target = masterSpec.loudness === undefined ? null : number(masterSpec.loudness, 'loudness target in LUFS', -40, -6);

  // The tail leaves room for the longest instrument release and for every effect that rings on.
  let tail =
    0.5 + Math.max(0, ...strips.map((strip) => Math.min(10, strip.instrument.release) + effectTail(strip.effects)));
  tail += Math.max(0, ...[...buses.values()].map((bus) => effectTail(bus.effects)));
  tail += Math.max(0, ...[...returns.values()].map((entry) => effectTail(entry.effects))) + effectTail(masterEffects);
  const trim = production.tail === undefined || production.tail === 'auto';
  if (!trim) tail = number(production.tail, 'production tail', 0, 40);
  tail = Math.min(40, tail);
  const frames = Math.ceil((time.duration + tail) * rate);
  const keyIds = new Set();
  for (const chain of [
    ...strips.map((strip) => strip.effects),
    ...[...buses.values()].map((bus) => bus.effects),
    masterEffects,
  ]) {
    for (const effect of chain) if (effect.key !== undefined) keyIds.add(effect.key);
  }
  for (const id of keyIds)
    assert(stripIds.has(id) || buses.has(id), 'MUSIC_PRODUCTION', `Sidechain key ${String(id)} is not a track or bus.`);
  // Bus and return buffers double as stems. A track buffer is kept only when it is a stem or a sidechain key.
  const kept = strips.filter(
    (strip) => keyIds.has(strip.id) || stemMode === 'tracks' || (stemMode === 'buses' && strip.output === 'master'),
  ).length;
  assert(
    frames * 2 * (5 + buses.size + returns.size + kept) <= STUDIO_LIMITS.samples,
    'RESOURCE_LIMIT',
    'The production exceeds the buffer limit. Shorten it, lower the sample rate or render fewer stems.',
  );

  const stereo = () => [new Float32Array(frames), new Float32Array(frames)];
  const master = stereo(),
    busBuffers = new Map(busOrder.map((id) => [id, stereo()])),
    returnBuffers = new Map([...returns.keys()].map((id) => [id, stereo()])),
    keys = new Map(),
    stems = [],
    reports = { tracks: {}, buses: {}, returns: {}, master: [] },
    trackReports = [];
  const context = { tempo, keys, curves: false };
  const destination = (id) => (id === 'master' ? master : busBuffers.get(id));
  let work = 0;
  // Keyed effects read their source as it is at this point, so sources are rendered before their listeners.
  const order = [...strips].sort((a, b) => Number(keyIds.has(b.id)) - Number(keyIds.has(a.id)));
  for (const strip of order) {
    const { track, instrument } = strip;
    const [left, right] = stereo();
    const { curves, pedals, pans } = trackControls(track, time, rate, frames);
    const random = seeded(`${seed}:${strip.id}`);
    let voices = 0;
    if (!strip.mute) {
      for (const note of track.notes) {
        const offset = strip.timing ? (random() + random() - 1) * strip.timing : 0,
          scale = strip.velocity ? 1 + (random() * 2 - 1) * strip.velocity : 1;
        if (!note.duration) continue;
        const start = Math.max(0, Math.round((time.secondsAt(note.tick) + offset) * rate)),
          end = Math.round(time.secondsAt(releaseTick(note, pedals[note.channel], track.endTick)) * rate),
          gate = Math.max(1, end - start);
        if (start >= frames) continue;
        work += (gate + instrument.release * rate) * instrument.cost;
        assert(
          work <= PRODUCTION_LIMITS.work,
          'RESOURCE_LIMIT',
          'The production exceeds its synthesis work limit. Use fewer or shorter notes.',
        );
        strip.render({
          left,
          right,
          rate,
          start,
          gate,
          pitch: Math.max(0, Math.min(127, note.pitch + strip.transpose)),
          velocity: Math.max(0.008, Math.min(1, (note.velocity / 127) * scale)),
          gain: 1,
          pan: 0,
          seed: Math.floor(random() * 2 ** 31),
          dynamics: curves.get(note.channel) ?? null,
        });
        voices++;
      }
    }
    reports.tracks[strip.id] = runEffects({ left, right, rate }, strip.effects, context);
    fader(
      left,
      right,
      strip.gain,
      strip.pan ?? pans.values().next().value ?? 0,
      automationCurve(strip.automation.gain, frames, rate, time, 'gain automation', -120, 24),
      automationCurve(strip.automation.pan, frames, rate, time, 'pan automation', -1, 1),
    );
    if (keyIds.has(strip.id)) keys.set(strip.id, { left, right });
    addInto(destination(strip.output), [left, right]);
    for (const [id, level] of strip.sends) addInto(returnBuffers.get(id), [left, right], level);
    trackReports.push(Object.freeze({ id: strip.id, instrument: instrument.name, voices, peak: peakDb(left, right) }));
    if (stemMode === 'tracks' || (stemMode === 'buses' && strip.output === 'master')) {
      stems.push({ id: strip.id, kind: 'track', channels: [left, right] });
    }
  }
  for (const id of busOrder) {
    const bus = buses.get(id),
      [left, right] = busBuffers.get(id);
    reports.buses[id] = runEffects({ left, right, rate }, bus.effects, context);
    fader(left, right, bus.gain, bus.pan, null, null);
    if (keyIds.has(id)) keys.set(id, { left, right });
    addInto(destination(bus.output), [left, right]);
    for (const [returnId, level] of bus.sends) addInto(returnBuffers.get(returnId), [left, right], level);
    if (stemMode === 'buses' && bus.output === 'master') stems.push({ id, kind: 'bus', channels: [left, right] });
  }
  for (const [id, entry] of returns) {
    const [left, right] = returnBuffers.get(id);
    reports.returns[id] = runEffects({ left, right, rate }, entry.effects, context);
    fader(left, right, entry.gain, 0, null, null);
    addInto(master, [left, right]);
    if (stemMode) stems.push({ id, kind: 'return', channels: [left, right] });
  }

  const [left, right] = master;
  const buffer = { left, right, rate };
  reports.master = runEffects(buffer, masterEffects, context);
  fader(left, right, masterGain, 0, null, null);
  let normalization = 0;
  const frame = () => ({ sampleRate: rate, channels: [left, right] });
  if (target !== null) {
    // Limiting lowers loudness a little, so the gain is corrected once after the first pass.
    for (let pass = 0; pass < 2; pass++) {
      const measured = measureAudio(frame()).integrated;
      if (measured <= -70) break;
      const change = Math.max(-40, Math.min(40, target - measured));
      if (pass && Math.abs(change) < 0.15) break;
      fader(left, right, change, 0, null, null);
      normalization += change;
      if (ceiling !== null) reports.master.push(Object.freeze({ type: 'limiter', ...limiter(buffer, { ceiling }) }));
    }
  } else if (ceiling !== null) reports.master.push(Object.freeze({ type: 'limiter', ...limiter(buffer, { ceiling }) }));
  // An automatic tail ends a quarter second after the mix falls below -72 dBFS, with a short fade.
  let length = frames;
  if (trim) {
    let last = frames - 1;
    while (last > 0 && Math.abs(left[last]) < 0.00025 && Math.abs(right[last]) < 0.00025) last--;
    length = Math.min(frames, Math.max(Math.ceil(time.duration * rate), last + Math.round(0.25 * rate)));
    const fadeFrames = Math.min(length, Math.round(0.2 * rate));
    for (const channels of [master, ...stems.map((stem) => stem.channels)]) {
      for (const channel of channels) for (let i = 0; i < fadeFrames; i++) channel[length - 1 - i] *= i / fadeFrames;
    }
  }
  const cut = (channel) => (length === frames ? channel : channel.subarray(0, length));
  const output = [cut(left), cut(right)];
  const meters = measureAudio({ sampleRate: rate, channels: output });
  return Object.freeze({
    sampleRate: rate,
    channels: Object.freeze(output),
    duration: length / rate,
    scoreDuration: time.duration,
    loudness: meters.integrated,
    truePeak: meters.truePeak,
    peak: dbToGain(meters.samplePeak),
    clippedSamples: meters.clippedSamples,
    meters,
    normalization: Math.round(normalization * 100) / 100,
    tracks: Object.freeze(trackReports),
    stems: Object.freeze(
      stems.map((stem) => Object.freeze({ ...stem, channels: Object.freeze(stem.channels.map(cut)) })),
    ),
    reports: Object.freeze(reports),
    work,
  });
}
