import { assert, number, options, safeCopy, text } from '../core/validate.js';
import { createAudioMix } from './mix.js';
import { capturePCM, dense, sampleRate, allocate, result } from './pcm.js';
import { soundEffect, SOUND_EFFECT_KINDS } from './effects.js';
import { note, chord } from './instruments.js';

function peakTime(pcm) {
  const block = Math.max(1, Math.round(pcm.sampleRate * 0.01));
  let best = 0,
    at = 0;
  for (let i = 0; i < pcm.channels[0].length; i += block) {
    let energy = 0;
    for (const channel of pcm.channels)
      for (let j = i; j < Math.min(i + block, channel.length); j++) energy += channel[j] * channel[j];
    if (energy > best) {
      best = energy;
      at = (i + Math.min(block, pcm.channels[0].length - i) / 2) / pcm.sampleRate;
    }
  }
  return at;
}
/** Captured semantic cues on an explicit timeline. Rendering delegates to the existing PCM mixer. */
export function createSoundtrack(input, spec = {}) {
  options(spec, ['tempo', 'sampleRate', 'duckGain', 'attack', 'release', 'threshold'], 'soundtrack');
  const tempo = number(spec.tempo ?? 110, 'tempo', 20, 300),
    rate = sampleRate(spec.sampleRate),
    mixOptions = Object.fromEntries(
      ['duckGain', 'attack', 'release', 'threshold'].filter((k) => spec[k] !== undefined).map((k) => [k, spec[k]]),
    ),
    attack = number(spec.attack ?? 0.05, 'duck attack', 0.001, 2),
    release = number(spec.release ?? 0.2, 'duck release', 0.001, 5),
    ids = new Set();
  let totalSamples = 0;
  const cues = dense(input, 'soundtrack cues', 512).map((cue, index) => {
    options(
      cue,
      ['id', 'at', 'beat', 'effect', 'note', 'chord', 'sound', 'duration', 'beats', 'options', 'gain', 'role', 'align'],
      'sound cue',
    );
    const id = text(cue.id ?? `cue-${index}`, 'sound cue ID', 200);
    assert(id && !ids.has(id), 'DUPLICATE_ID', 'Sound cue IDs must be unique.');
    ids.add(id);
    assert(
      !(cue.at !== undefined && cue.beat !== undefined) && !(cue.duration !== undefined && cue.beats !== undefined),
      'SOUND_CUE',
      'Use seconds or beats for each timing field, not both.',
    );
    const sources = ['effect', 'note', 'chord', 'sound'].filter((k) => cue[k] !== undefined);
    assert(sources.length === 1, 'SOUND_CUE', 'Each cue has one effect, note, chord or decoded sound.');
    const at = number(cue.at ?? (number(cue.beat ?? 0, 'cue beat', 0, 432000) * 60) / tempo, 'cue anchor', 0, 86400),
      duration =
        cue.duration ??
        (cue.beats !== undefined ? (number(cue.beats, 'cue beats', 0.001, 1024) * 60) / tempo : undefined),
      settings = cue.options === undefined ? {} : safeCopy(cue.options);
    const controls = {
      sampleRate: rate,
      ...settings,
      ...(duration !== undefined ? { duration: number(duration, 'cue duration', 0.001, 120) } : {}),
    };
    const generated =
      cue.effect !== undefined
        ? soundEffect(cue.effect, controls)
        : cue.note !== undefined
          ? note(cue.note, controls)
          : cue.chord !== undefined
            ? chord(cue.chord, controls)
            : capturePCM(cue.sound);
    assert(
      cue.sound === undefined || (cue.options === undefined && duration === undefined),
      'SOUND_CUE',
      'Process supplied PCM explicitly before scheduling it.',
    );
    totalSamples += generated.channels.reduce((n, c) => n + c.length, 0);
    assert(totalSamples <= 32000000, 'RESOURCE_LIMIT', 'Captured soundtrack sources exceed 32 million samples.');
    const pcm = capturePCM(generated),
      align = cue.align ?? 'start';
    assert(['start', 'peak', 'end'].includes(align), 'SOUND_CUE', 'Cue alignment is start, peak or end.');
    const anchorOffset = align === 'peak' ? peakTime(pcm) : align === 'end' ? pcm.duration : 0,
      start = number(at - anchorOffset, 'cue start (move the anchor later or trim the sound)', 0, 86400),
      gain = number(cue.gain ?? 1, 'cue gain', 0, 16),
      role = cue.role ?? (cue.note !== undefined || cue.chord !== undefined ? 'music' : 'effect');
    assert(['effect', 'music', 'narration'].includes(role), 'AUDIO_ROLE', 'Use effect, music or narration.');
    number(start + pcm.duration, 'cue end', 0, 86400);
    return { id, start, gain, role, pcm, at, align, source: sources[0], anchorOffset };
  });
  assert(cues.length > 0, 'SOUND_CUE', 'A soundtrack needs at least one cue.');
  // Validate ducking options once even when a later render contains only silence.
  createAudioMix([{ id: 'validation', channels: [new Float32Array(1)], sampleRate: rate }], mixOptions);
  const duration = Math.max(...cues.map((c) => c.start + c.pcm.duration)),
    cache = new Map();
  function mixer(from, to) {
    const selected = cues.filter((c) => c.start <= to + attack && c.start + c.pcm.duration >= from - release);
    if (!selected.length) return null;
    assert(
      selected.length <= 32,
      'RESOURCE_LIMIT',
      'At most 32 cues may overlap a render block and its ducking margin.',
    );
    const key = JSON.stringify(selected.map((c) => c.id));
    let mix = cache.get(key);
    if (!mix) {
      mix = createAudioMix(
        selected.map((c) => ({
          id: c.id,
          start: c.start,
          gain: c.gain,
          role: c.role,
          channels: c.pcm.channels,
          sampleRate: c.pcm.sampleRate,
        })),
        mixOptions,
      );
      if (cache.size >= 16) cache.delete(cache.keys().next().value);
      cache.set(key, mix);
    }
    return mix;
  }
  return Object.freeze({
    duration,
    tempo,
    sampleRate: rate,
    cues: Object.freeze(
      cues.map((c) =>
        Object.freeze({
          id: c.id,
          at: c.at,
          start: c.start,
          duration: c.pcm.duration,
          gain: c.gain,
          role: c.role,
          align: c.align,
          anchorOffset: c.anchorOffset,
          source: c.source,
        }),
      ),
    ),
    sample(time) {
      number(time, 'soundtrack sample', 0, 86400);
      return mixer(time, time)?.sample(time) ?? Object.freeze([0, 0]);
    },
    render({ from = 0, duration: length = duration - from, sampleRate: outputRate = rate } = {}) {
      number(from, 'soundtrack render start', 0, 86400);
      number(length, 'soundtrack duration', Number.MIN_VALUE, 86400 - from);
      outputRate = sampleRate(outputRate);
      const count = Math.max(1, Math.round(length * outputRate)),
        channels = allocate(count),
        block = Math.max(1, Math.floor(outputRate * 0.25));
      let clippedSamples = 0;
      for (let i = 0; i < count; i += block) {
        const n = Math.min(block, count - i),
          start = from + i / outputRate,
          mix = mixer(start, start + n / outputRate);
        if (!mix) continue;
        const rendered = mix.render({ from: start, duration: n / outputRate, sampleRate: outputRate });
        clippedSamples += rendered.clippedSamples;
        for (let c = 0; c < 2; c++) channels[c].set(rendered.channels[c].subarray(0, n), i);
      }
      return Object.freeze({
        ...result(channels, outputRate, { source: 'semantic-soundtrack', tempo, from, cues: cues.length }),
        clippedSamples,
      });
    },
  });
}

/** Share an authored visual time window; impacts align to arrival, sweeps end there. */
export function cueForMotion(effect, motion, spec = {}) {
  assert(SOUND_EFFECT_KINDS.includes(effect), 'SOUND_KIND', 'Use a semantic sound effect.');
  options(motion, ['at', 'duration', 'ease'], 'motion timing');
  options(spec, ['id', 'anchor', 'duration', 'options', 'gain'], 'motion sound');
  const at = number(motion.at ?? 0, 'motion start', 0, 86400),
    duration = number(motion.duration, 'motion duration', 0.001, 60),
    anchor = spec.anchor ?? 'end';
  assert(['start', 'end'].includes(anchor), 'SOUND_CUE', 'Motion anchor is start or end.');
  number(at + duration, 'motion end', 0, 86400);
  number(spec.gain ?? 1, 'motion sound gain', 0, 16);
  if (spec.duration !== undefined) number(spec.duration, 'motion sound duration', 0.015, 8);
  const sweep = ['whoosh', 'swipe', 'riser', 'reverse'].includes(effect);
  return Object.freeze({
    ...(spec.id !== undefined ? { id: spec.id } : {}),
    effect,
    at: anchor === 'end' ? at + duration : at,
    align: anchor === 'start' ? 'start' : sweep ? 'end' : 'peak',
    ...(spec.duration !== undefined || sweep ? { duration: spec.duration ?? duration } : {}),
    options: safeCopy(spec.options ?? {}),
    gain: spec.gain ?? 1,
  });
}

/** A bounded authored note/chord motif with beat scheduling and explicit swing. */
export function musicPhrase(sequence, spec = {}) {
  options(
    spec,
    ['tempo', 'stepBeats', 'gate', 'swing', 'instrument', 'velocity', 'seed', 'sampleRate'],
    'music phrase',
  );
  const tempo = number(spec.tempo ?? 110, 'tempo', 20, 300),
    step = number(spec.stepBeats ?? 0.5, 'step beats', 0.0625, 8),
    gate = number(spec.gate ?? 0.8, 'gate', 0.1, 2),
    swing = number(spec.swing ?? 0, 'swing', 0, 0.45),
    notes = dense(sequence, 'phrase steps', 128);
  const cues = notes.flatMap((pitch, i) =>
    pitch === null
      ? []
      : [
          {
            id: `step-${i}`,
            beat: i * step + (i % 2 ? swing * step : 0),
            beats: step * gate,
            ...(Array.isArray(pitch) ? { chord: pitch } : { note: pitch }),
            options: { instrument: spec.instrument ?? 'felt', velocity: spec.velocity ?? 0.65, seed: spec.seed ?? 1 },
          },
        ],
  );
  return createSoundtrack(cues, { tempo, sampleRate: spec.sampleRate }).render();
}
