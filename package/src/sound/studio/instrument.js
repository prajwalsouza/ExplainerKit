import { assert, number, options, text } from '../../core/validate.js';
import { audioResult, dbToGain, studioRate } from './core.js';
import { midiPitch } from '../instruments.js';

const renderers = new WeakMap();

/** Frames between control-rate values, such as a track's expression curve. */
export const CONTROL_FRAMES = 64;

/**
 * Register an instrument. `render(voice)` adds one note into `voice.left` and
 * `voice.right`, starting at `voice.start`. `release` is the longest time a
 * note keeps sounding after its gate closes, and `cost` estimates work per frame.
 */
export function defineInstrument({ kind, name, release, cost, range = [0, 127] }, render) {
  const instrument = Object.freeze({
    kind,
    name: text(name, 'instrument name', 200),
    release: number(release, 'instrument release', 0, 30),
    cost: number(cost, 'instrument cost', 0.1, 400),
    range: Object.freeze([...range]),
  });
  renderers.set(instrument, render);
  return instrument;
}

export function instrumentRenderer(instrument) {
  const render = renderers.get(instrument);
  assert(render, 'SOUND_INSTRUMENT', 'Use an instrument made by an explainerkit/sound/studio factory.');
  return render;
}

/** Equal-power pan gains for one voice. */
export function panGains(pan) {
  const angle = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4;
  return [Math.cos(angle), Math.sin(angle)];
}

/** Render one note of a studio instrument to stereo PCM, for auditioning or building a sound effect. */
export function playInstrument(instrument, pitch, settings = {}) {
  const render = instrumentRenderer(instrument);
  options(settings, ['velocity', 'duration', 'sampleRate', 'gain', 'pan', 'seed', 'dynamics'], 'instrument note');
  const rate = studioRate(settings.sampleRate ?? 48000),
    midi = midiPitch(pitch),
    duration = number(settings.duration ?? 1, 'note duration', 0.01, 60),
    gate = Math.max(1, Math.round(duration * rate)),
    frames = gate + Math.round(instrument.release * rate);
  assert(frames * instrument.cost <= 6e9, 'RESOURCE_LIMIT', 'The note exceeds the single-note work limit.');
  const left = new Float32Array(frames),
    right = new Float32Array(frames);
  let dynamics = null;
  if (settings.dynamics !== undefined) {
    dynamics = new Float32Array(Math.ceil(frames / CONTROL_FRAMES) + 1).fill(
      number(settings.dynamics, 'note dynamics', 0, 1),
    );
  }
  render({
    left,
    right,
    rate,
    start: 0,
    gate,
    pitch: midi,
    velocity: number(settings.velocity ?? 0.7, 'note velocity', 0, 1),
    gain: dbToGain(number(settings.gain ?? 0, 'note gain in dB', -60, 24)),
    pan: number(settings.pan ?? 0, 'note pan', -1, 1),
    seed: typeof settings.seed === 'number' ? number(settings.seed, 'note seed', 0, 2 ** 31) : 1,
    dynamics,
  });
  return audioResult(left, right, rate, { instrument: instrument.name, midi });
}

/**
 * Combine instruments into one. Each layer can be limited to a pitch range,
 * transposed and levelled. Ranges that overlap by `blend` semitones crossfade.
 */
export function layerInstruments(layers, settings = {}) {
  options(settings, ['name'], 'layered instrument');
  assert(Array.isArray(layers) && layers.length >= 1 && layers.length <= 8, 'SOUND_INSTRUMENT', 'Layer 1–8 parts.');
  const parts = layers.map((layer) => {
    options(layer, ['instrument', 'gain', 'transpose', 'from', 'to', 'blend', 'velocity'], 'instrument layer');
    const from = number(layer.from ?? 0, 'layer lowest pitch', 0, 127),
      to = number(layer.to ?? 127, 'layer highest pitch', from, 127);
    const velocity = layer.velocity ?? [0, 1];
    assert(
      Array.isArray(velocity) && velocity.length === 2,
      'SOUND_INSTRUMENT',
      'A layer velocity range has two ends.',
    );
    return {
      instrument: layer.instrument,
      render: instrumentRenderer(layer.instrument),
      gain: dbToGain(number(layer.gain ?? 0, 'layer gain in dB', -60, 24)),
      transpose: number(layer.transpose ?? 0, 'layer transposition', -48, 48),
      from,
      to,
      blend: number(layer.blend ?? 0, 'layer blend', 0, 24),
      velocity: [number(velocity[0], 'layer velocity', 0, 1), number(velocity[1], 'layer velocity', 0, 1)],
    };
  });
  return defineInstrument(
    {
      kind: 'layer',
      name: settings.name ?? parts.map((part) => part.instrument.name).join(' + '),
      release: Math.max(...parts.map((part) => part.instrument.release)),
      cost: parts.reduce((sum, part) => sum + part.instrument.cost, 0),
    },
    (voice) => {
      for (const part of parts) {
        if (voice.velocity < part.velocity[0] || voice.velocity > part.velocity[1]) continue;
        // Outside its range a layer fades over `blend` semitones and is then silent.
        const outside = Math.max(part.from - voice.pitch, voice.pitch - part.to, 0);
        if (outside > part.blend || (outside > 0 && part.blend === 0)) continue;
        const fade = part.blend ? Math.cos((outside / part.blend) * (Math.PI / 2)) : 1;
        part.render({ ...voice, pitch: voice.pitch + part.transpose, gain: voice.gain * part.gain * fade });
      }
    },
  );
}
