import { assert, number, options } from '../../core/validate.js';
import { audioResult, STUDIO_LIMITS, stereoCopy } from './core.js';
import { bitcrush, exciter, fade, gain, haas, pan, saturation, width } from './color.js';
import { compressor, gate, limiter, multibandCompressor, transientShaper } from './dynamics.js';
import { equalizer, ladderFilter, sweepFilter } from './filters.js';
import { reverb, reverbTail } from './reverb.js';
import { chorus, delay, ensemble, flanger, phaser, pitchShift, shimmer, tremolo } from './time.js';

const EFFECTS = {
  eq: equalizer,
  filter: sweepFilter,
  ladder: ladderFilter,
  compressor,
  multiband: multibandCompressor,
  limiter,
  gate,
  transient: transientShaper,
  reverb,
  shimmer,
  delay,
  chorus,
  ensemble,
  flanger,
  phaser,
  tremolo,
  pitchShift,
  saturation,
  bitcrush,
  exciter,
  width,
  pan,
  haas,
  gain,
  fade,
};

/** Every effect type accepted in a chain. */
export const EFFECT_TYPES = Object.freeze(Object.keys(EFFECTS));

/** Check a chain's shape before any audio is processed. */
export function checkEffects(chain, name = 'effect chain') {
  assert(
    Array.isArray(chain) && chain.length <= STUDIO_LIMITS.effects,
    'SOUND_EFFECT',
    `${name} must be an array of at most ${STUDIO_LIMITS.effects} effects.`,
  );
  for (const effect of chain) {
    assert(
      effect && typeof effect === 'object' && Object.hasOwn(EFFECTS, effect.type),
      'SOUND_EFFECT',
      `${name} uses an unknown effect type. See EFFECT_TYPES.`,
    );
    if (effect.bypass !== undefined) assert(typeof effect.bypass === 'boolean', 'SOUND_EFFECT', 'bypass is boolean.');
  }
  return chain;
}

/** Seconds of ringing the chain can add after its input ends. */
export function effectTail(chain) {
  let tail = 0;
  for (const effect of chain) {
    if (effect.bypass) continue;
    if (effect.type === 'reverb') tail += reverbTail(effect);
    else if (effect.type === 'shimmer') tail += effect.decay ?? 7;
    else if (effect.type === 'delay' && typeof (effect.time ?? '1/4') === 'number') {
      tail += Math.min(8, effect.time * (1 + Math.log(0.001) / Math.log(Math.max(0.05, effect.feedback ?? 0.35))));
    } else if (effect.type === 'delay') tail += 3;
  }
  return Math.min(30, tail);
}

/** Run a checked chain over a mutable stereo buffer and collect each effect's report. */
export function runEffects(buffer, chain, context = {}) {
  const reports = [];
  for (const effect of chain) {
    if (effect.bypass) continue;
    const { bypass: _bypass, ...params } = effect;
    const report = EFFECTS[effect.type](buffer, params, context);
    reports.push(Object.freeze({ type: effect.type, ...report }));
  }
  for (let i = 0; i < buffer.left.length; i += 97) {
    assert(
      Number.isFinite(buffer.left[i]) && Math.abs(buffer.left[i]) < 1e4,
      'SOUND_RANGE',
      'An effect produced an unbounded signal. Lower its feedback, resonance or gain.',
    );
  }
  return reports;
}

/**
 * Process decoded audio through an ordered effect chain and return new stereo
 * PCM. The input is not modified. `tail` appends silence first so reverbs and
 * delays have room to ring out.
 */
export function processAudio(input, chain, settings = {}) {
  options(settings, ['tail', 'tempo', 'keys', 'curves'], 'processAudio options');
  checkEffects(chain);
  const rate = input?.sampleRate;
  const tail = settings.tail === 'auto' ? effectTail(chain) : number(settings.tail ?? 0, 'effect tail', 0, 60);
  const buffer = stereoCopy(input, Math.round(tail * (typeof rate === 'number' ? rate : 0)));
  const keys = new Map();
  if (settings.keys !== undefined) {
    options(settings.keys, Object.keys(settings.keys), 'sidechain keys');
    for (const [id, source] of Object.entries(settings.keys)) {
      const key = stereoCopy(source, 0, `sidechain key ${id}`);
      assert(key.rate === buffer.rate, 'AUDIO_RATE', 'Sidechain keys must use the processed sample rate.');
      const left = new Float32Array(buffer.left.length),
        right = new Float32Array(buffer.left.length);
      left.set(key.left.subarray(0, left.length));
      right.set(key.right.subarray(0, right.length));
      keys.set(id, { left, right });
    }
  }
  if (settings.tempo !== undefined) number(settings.tempo, 'tempo in BPM', 20, 400);
  assert(settings.curves === undefined || typeof settings.curves === 'boolean', 'SOUND_EFFECT', 'curves is boolean.');
  const reports = runEffects(buffer, chain, { tempo: settings.tempo, keys, curves: settings.curves ?? false });
  return audioResult(buffer.left, buffer.right, buffer.rate, { reports: Object.freeze(reports) });
}
