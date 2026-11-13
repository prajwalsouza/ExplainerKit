import { assert, number } from '../core/validate.js';
import { sampleBankRate } from '../sound/samples.js';
import { createMusicScore, integer, list, musicScoreTime, record, SCORE_LIMITS } from './score.js';
import { defaultScoreInstrument, mixScoreVoice, SCORE_ENVELOPES, SCORE_INSTRUMENTS } from './score-voices.js';

const MAX_OUTPUT_SAMPLES = 32_000_000;
const MAX_VOICE_FRAMES = 24_000_000;
const MAX_SAMPLE_VOICE_FRAMES = 12_000_000;

function programState() {
  return { program: 0, volume: 1, expression: 1, pan: 0 };
}

function firstAfter(changes, tick) {
  let low = 0,
    high = changes.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (changes[middle].tick <= tick) low = middle + 1;
    else high = middle;
  }
  return low;
}

function pedalMap(messages) {
  const channels = Array.from({ length: 16 }, () => []);
  for (const message of messages) {
    if (message.status >> 4 !== 11 || message.data1 !== 64) continue;
    const lane = channels[message.status & 15],
      down = message.data2 >= 64;
    if (down !== (lane.at(-1)?.down ?? false)) lane.push({ tick: message.tick, down });
  }
  return channels;
}

function compileTrack(track, setting, time, rate, frames, state) {
  const controls = Array.from({ length: 16 }, programState);
  const pedals = pedalMap(track.messages);
  const voices = [];
  let cursor = 0;
  for (const note of track.notes) {
    while (cursor < track.messages.length && track.messages[cursor].tick <= note.tick) {
      const { status, data1, data2 } = track.messages[cursor++];
      const control = controls[status & 15];
      if (status >> 4 === 12) control.program = data1;
      if (status >> 4 === 11) {
        if (data1 === 7) control.volume = data2 / 127;
        if (data1 === 10) control.pan = Math.max(-1, Math.min(1, (data2 - 64) / 63));
        if (data1 === 11) control.expression = data2 / 127;
      }
    }
    if (!note.duration) continue;
    const { program, volume, expression, pan } = controls[note.channel];
    const velocity = note.velocity / 127;
    const gain = setting.gain * volume * expression * (setting.sample ? 1 : velocity ** 1.55 * 0.42);
    if (!gain) continue;
    const instrument = setting.instrument ?? defaultScoreInstrument(note.channel, program);
    const start = Math.round(time.secondsAt(note.tick) * rate);
    const keyUp = note.tick + note.duration,
      changes = pedals[note.channel];
    const after = firstAfter(changes, keyUp);
    const release = changes[after - 1]?.down ? (changes[after]?.tick ?? track.endTick) : keyUp;
    const gate = Math.max(1, Math.round(time.secondsAt(release) * rate) - start);
    const releaseSeconds = setting.sample?.release ?? SCORE_ENVELOPES[instrument][1];
    const tail = Math.min(frames - start - gate, Math.round(releaseSeconds * rate));
    if (setting.sample) {
      state.sampleFrames += gate + tail;
      assert(gate + tail <= 30 * rate, 'MUSIC_RENDER', 'Sampled notes are limited to 30 seconds including release.');
      assert(
        state.sampleFrames <= MAX_SAMPLE_VOICE_FRAMES,
        'MUSIC_RENDER',
        'Score exceeds the sampled voice work limit.',
      );
    }
    state.voiceFrames += gate + tail;
    assert(state.voiceFrames <= MAX_VOICE_FRAMES, 'MUSIC_RENDER', 'Score exceeds the offline voice work limit.');
    voices.push({ start, gate, tail, pitch: note.pitch, velocity, instrument, gain, pan: setting.pan ?? pan });
  }
  return voices;
}

function room(left, right, rate, wet) {
  if (!wet) return;
  const delays = [0.031, 0.049, 0.073, 0.113].map((seconds) => Math.round(seconds * rate));
  const reflections = [0.41, 0.29, 0.17, 0.09].map((gain) => gain * wet);
  // Read earlier dry samples while sweeping backwards to avoid feedback.
  for (let i = left.length - 1; i >= delays[0]; i--) {
    for (let index = 0; index < delays.length; index++) {
      const delay = delays[index];
      if (i < delay) break;
      const reflection = reflections[index];
      left[i] += right[i - delay] * reflection;
      right[i] += left[i - delay] * reflection;
    }
  }
}

function mixSampleVoice(left, right, voice, bank, rate) {
  const { start, gate, tail, pitch, velocity, gain, pan } = voice;
  const { channels } = bank.note(pitch, { velocity, gain, pan, duration: (gate + tail) / rate, release: tail / rate });
  for (let frame = 0; frame < gate + tail; frame++) {
    left[start + frame] += channels[0][frame];
    right[start + frame] += channels[1][frame];
  }
}

/** Render a score to stereo PCM with a fixed time origin and optional aligned stems. */
export function renderMusicScore(input, options = {}) {
  const score = createMusicScore(input),
    time = musicScoreTime(score);
  const {
    sampleRate = 48000,
    tracks = [],
    tail = 0.7,
    space = 0.15,
    gain = 0.9,
    stems = false,
  } = record(options, ['sampleRate', 'tracks', 'tail', 'space', 'gain', 'stems'], 'score render options');
  const rate = integer(sampleRate, 16000, 96000, 'score sample rate');
  number(tail, 'score tail', 0.6, 5);
  number(space, 'score room amount', 0, 1);
  number(gain, 'score master gain', 0, 2);
  assert(typeof stems === 'boolean', 'MUSIC_RENDER', 'Stems must be boolean.');
  const settings = new Map();
  const trackIds = new Set(score.tracks.map((track) => track.id));
  for (const value of list(tracks, SCORE_LIMITS.tracks, 'render tracks')) {
    const {
      id,
      instrument,
      sample: sampleSpec,
      gain: trackGain = 1,
      pan,
    } = record(value, ['id', 'instrument', 'sample', 'gain', 'pan'], 'render track');
    assert(trackIds.has(id) && !settings.has(id), 'MUSIC_RENDER', 'Render tracks must have unique score track IDs.');
    assert(
      instrument === undefined || SCORE_INSTRUMENTS.includes(instrument),
      'MUSIC_RENDER',
      'Unknown score instrument.',
    );
    if (pan !== undefined) number(pan, 'score track pan', -1, 1);
    let sample;
    if (sampleSpec !== undefined) {
      const { bank, release = 0.3 } = record(sampleSpec, ['bank', 'release'], 'sampled render track');
      assert(instrument === undefined, 'MUSIC_RENDER', 'Choose one synthesized instrument or sampled bank per track.');
      assert(
        sampleBankRate(bank) === rate,
        'MUSIC_RENDER',
        'Use a sampleInstrument bank with the score render sample rate.',
      );
      sample = { bank, release: number(release, 'sample release', 0, 2) };
    }
    settings.set(id, { instrument, sample, gain: number(trackGain, 'score track gain', 0, 2), pan });
  }
  const frames = Math.ceil((time.duration + tail) * rate);
  assert(
    frames * (2 + 2 * score.tracks.length) <= MAX_OUTPUT_SAMPLES,
    'MUSIC_RENDER',
    'Score exceeds the offline render work limit. Reduce duration, track count or sample rate.',
  );
  const state = { voiceFrames: 0, sampleFrames: 0 };
  const compiled = score.tracks.map((track) =>
    compileTrack(track, settings.get(track.id) ?? { gain: 1 }, time, rate, frames, state),
  );
  const channels = [new Float32Array(frames), new Float32Array(frames)],
    renderedStems = [];
  for (const [index, voices] of compiled.entries()) {
    if (!voices.length) {
      if (stems)
        renderedStems.push(
          Object.freeze({
            id: score.tracks[index].id,
            channels: Object.freeze([new Float32Array(frames), new Float32Array(frames)]),
          }),
        );
      continue;
    }
    const left = new Float32Array(frames),
      right = new Float32Array(frames);
    const sample = settings.get(score.tracks[index].id)?.sample;
    for (const voice of voices) {
      if (sample) mixSampleVoice(left, right, voice, sample.bank, rate);
      else mixScoreVoice(left, right, voice, rate);
    }
    room(left, right, rate, space);
    for (let i = 0; i < frames; i++) {
      left[i] *= gain;
      right[i] *= gain;
      channels[0][i] += left[i];
      channels[1][i] += right[i];
    }
    if (stems)
      renderedStems.push(Object.freeze({ id: score.tracks[index].id, channels: Object.freeze([left, right]) }));
  }
  let peak = 0,
    clippedSamples = 0;
  for (const channel of channels) {
    for (const sample of channel) {
      const absolute = Math.abs(sample);
      peak = Math.max(peak, absolute);
      if (absolute > 1) clippedSamples++;
    }
  }
  return Object.freeze({
    sampleRate: rate,
    channels: Object.freeze(channels),
    duration: frames / rate,
    peak,
    clippedSamples,
    stems: Object.freeze(renderedStems),
  });
}
